import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import api from 'mastodon/api';
import { apiContributePhoto } from 'mastodon/api/albutts';

const messages = defineMessages({
  heading: {
    id: 'albutts.contribute.heading',
    defaultMessage: 'Add photos',
  },
  fileLabel: {
    id: 'albutts.contribute.file_label',
    defaultMessage: 'Photos',
  },
  fileHint: {
    id: 'albutts.contribute.file_hint',
    defaultMessage: 'Pick one or more — image or video.',
  },
  photosClear: {
    id: 'albutts.contribute.photos_clear',
    defaultMessage: 'Clear',
  },
  cancel: {
    id: 'albutts.contribute.cancel',
    defaultMessage: 'Cancel',
  },
  submit: {
    id: 'albutts.contribute.submit',
    defaultMessage:
      'Add {count, plural, one {# photo} other {# photos}} to album',
  },
  submitEmpty: {
    id: 'albutts.contribute.submit_empty',
    defaultMessage: 'Add to album',
  },
  progressLine: {
    id: 'albutts.contribute.progress_line',
    defaultMessage:
      '{done} of {total} uploaded{failed, plural, =0 {} one { · # failed} other { · # failed}}',
  },
  retryFailed: {
    id: 'albutts.contribute.retry_failed',
    defaultMessage: 'Retry {count} failed',
  },
  errorPartial: {
    id: 'albutts.contribute.error_partial',
    defaultMessage:
      "{failed, plural, one {# photo} other {# photos}} didn't upload. Open the browser console to see why, or retry below.",
  },
  done: {
    id: 'albutts.contribute.done',
    defaultMessage: 'Done',
  },
});

// Concurrency cap on the upload pool — matches the new-album composer
// (album_composer.tsx). Four keeps browser socket count sane and
// mirrors what Mastodon media processing absorbs without queue backup.
const UPLOAD_CONCURRENCY = 4;

interface ContributeComposerProps {
  albumId: string;
  onCancel: () => void;
  onContributed: () => void;
}

interface MediaResponse {
  id: string;
}

type PhotoStatus = 'queued' | 'uploading' | 'done' | 'failed';

interface PhotoDraft {
  file: File;
  previewUrl: string;
  key: string;
  status: PhotoStatus;
}

// Post-album contribute modal — the "Add photos" affordance from the
// detail page. Same parallel-pool + per-photo status pattern as
// album_composer.tsx; deliberately kept as a separate component so
// callers can render it as a modal over the detail page without
// pulling in the full new-album shape (title / description /
// visibility).
export const ContributeComposer: React.FC<ContributeComposerProps> = ({
  albumId,
  onCancel,
  onContributed,
}) => {
  const intl = useIntl();
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  const [pending, setPending] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const doneCount = photos.filter((p) => p.status === 'done').length;
  const failedCount = photos.filter((p) => p.status === 'failed').length;
  const totalCount = photos.length;

  // Revoke blob URLs on unmount so the browser doesn't hold onto
  // the underlying Blobs.
  useEffect(() => {
    const urls = photos.map((p) => p.previewUrl);
    return () => {
      urls.forEach((u) => {
        URL.revokeObjectURL(u);
      });
    };
  }, [photos]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files ? Array.from(e.target.files) : [];
      if (files.length === 0) return;
      setPhotos((prev) => [
        ...prev,
        ...files.map((file, idx) => ({
          file,
          previewUrl: URL.createObjectURL(file),
          key: `${Date.now()}-${idx}-${file.name}`,
          status: 'queued' as PhotoStatus,
        })),
      ]);
      e.target.value = ''; // allow re-picking the same file
    },
    [],
  );

  const handleClear = useCallback(() => {
    setPhotos([]);
  }, []);

  const setPhotoStatus = useCallback((key: string, status: PhotoStatus) => {
    setPhotos((prev) =>
      prev.map((p) => (p.key === key ? { ...p, status } : p)),
    );
  }, []);

  const runUploadPool = useCallback(
    async (drafts: PhotoDraft[]) => {
      const queue: PhotoDraft[] = [...drafts];

      const worker = async () => {
        while (queue.length > 0) {
          const draft = queue.shift();
          if (!draft) return;
          setPhotoStatus(draft.key, 'uploading');
          try {
            const form = new FormData();
            form.append('file', draft.file);
            const media = await api().post<MediaResponse>(
              '/api/v1/media',
              form,
            );
            await apiContributePhoto(albumId, { media_id: media.data.id });
            setPhotoStatus(draft.key, 'done');
          } catch (e) {
            console.error(
              '[albutts] contribute photo upload failed',
              {
                name: draft.file.name,
                size: draft.file.size,
                type: draft.file.type,
              },
              e,
            );
            setPhotoStatus(draft.key, 'failed');
          }
        }
      };

      const workers = Array.from(
        { length: Math.min(UPLOAD_CONCURRENCY, drafts.length) },
        () => worker(),
      );
      await Promise.all(workers);
    },
    [albumId, setPhotoStatus],
  );

  const submit = useCallback(() => {
    if (pending || photos.length === 0) return;
    setPending(true);
    setHasSubmitted(true);
    void (async () => {
      // Reset any prior status (post-retry with more picks etc.).
      setPhotos((prev) => prev.map((p) => ({ ...p, status: 'queued' })));
      const drafts = photos.map((p) => ({
        ...p,
        status: 'queued' as PhotoStatus,
      }));
      await runUploadPool(drafts);
      setPending(false);
    })();
  }, [pending, photos, runUploadPool]);

  const handleRetryFailed = useCallback(() => {
    setPending(true);
    void (async () => {
      const drafts = photos.filter((p) => p.status === 'failed');
      setPhotos((prev) =>
        prev.map((p) =>
          p.status === 'failed' ? { ...p, status: 'queued' } : p,
        ),
      );
      await runUploadPool(drafts);
      setPending(false);
    })();
  }, [photos, runUploadPool]);

  // Auto-close when everything succeeded and there's nothing to fix.
  useEffect(() => {
    if (!hasSubmitted || pending) return;
    if (totalCount > 0 && doneCount === totalCount && failedCount === 0) {
      onContributed();
    }
  }, [
    hasSubmitted,
    pending,
    doneCount,
    failedCount,
    totalCount,
    onContributed,
  ]);

  const canSubmit = photos.length > 0 && !pending;
  const submitLabel = canSubmit
    ? intl.formatMessage(messages.submit, { count: photos.length })
    : intl.formatMessage(messages.submitEmpty);

  const finished = hasSubmitted && !pending && totalCount > 0;

  return (
    <div className='albutts-composer' role='dialog' aria-modal='true'>
      <div className='albutts-composer__panel'>
        <h2 className='albutts-composer__heading'>
          {intl.formatMessage(messages.heading)}
        </h2>

        <label
          className='albutts-composer__label'
          htmlFor='albutts-contribute-file'
        >
          {intl.formatMessage(messages.fileLabel)}
        </label>
        <p className='albutts-composer__hint'>
          {intl.formatMessage(messages.fileHint)}
        </p>
        <input
          id='albutts-contribute-file'
          type='file'
          multiple
          accept='image/*,video/*'
          className='albutts-composer__file'
          onChange={handleFileChange}
          disabled={pending}
        />

        {photos.length > 0 && (
          <>
            <ul className='albutts-composer__thumbs'>
              {photos.map((p) => (
                <li
                  key={p.key}
                  className={`albutts-composer__thumb albutts-composer__thumb--${p.status}`}
                >
                  <img
                    className='albutts-composer__thumb-img'
                    src={p.previewUrl}
                    alt={p.file.name}
                  />
                  <span
                    className={`albutts-composer__chip albutts-composer__chip--${p.status}`}
                    aria-hidden
                  >
                    {chipGlyph(p.status)}
                  </span>
                </li>
              ))}
            </ul>
            {!hasSubmitted && (
              <button
                type='button'
                className='albutts-composer__clear'
                onClick={handleClear}
                disabled={pending}
              >
                {intl.formatMessage(messages.photosClear)}
              </button>
            )}
          </>
        )}

        {hasSubmitted && totalCount > 0 && (
          <p className='albutts-composer__progress' aria-live='polite'>
            {intl.formatMessage(messages.progressLine, {
              done: doneCount,
              total: totalCount,
              failed: failedCount,
            })}
          </p>
        )}

        {finished && failedCount > 0 && (
          <p className='albutts-composer__error' role='alert'>
            {intl.formatMessage(messages.errorPartial, { failed: failedCount })}
          </p>
        )}

        <div className='albutts-composer__actions'>
          {finished ? (
            <>
              {failedCount > 0 && (
                <button
                  type='button'
                  className='albutts-btn albutts-btn--ghost'
                  onClick={handleRetryFailed}
                  disabled={pending}
                >
                  {intl.formatMessage(messages.retryFailed, {
                    count: failedCount,
                  })}
                </button>
              )}
              <button
                type='button'
                className='albutts-btn albutts-btn--primary'
                onClick={onContributed}
                disabled={pending}
              >
                {intl.formatMessage(messages.done)}
              </button>
            </>
          ) : (
            <>
              <button
                type='button'
                className='albutts-btn albutts-btn--ghost'
                onClick={onCancel}
                disabled={pending}
              >
                {intl.formatMessage(messages.cancel)}
              </button>
              <button
                type='button'
                className='albutts-btn albutts-btn--primary'
                onClick={submit}
                disabled={!canSubmit}
              >
                {submitLabel}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

function chipGlyph(status: PhotoStatus): string {
  switch (status) {
    case 'done':
      return '✓';
    case 'failed':
      return '!';
    case 'uploading':
      return '…';
    default:
      return '';
  }
}
