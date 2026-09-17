import { memo, useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import AddPhotoAlternateIcon from '@/material-icons/400-24px/add_photo_alternate.svg?react';
import api from 'mastodon/api';
import { apiContributePhoto } from 'mastodon/api/albutts';
import { ComposeShell } from 'mastodon/components/compose_shell';
import { Icon } from 'mastodon/components/icon';

import { CaptionTextarea } from './caption_textarea';

const messages = defineMessages({
  heading: {
    id: 'albutts.contribute.heading',
    defaultMessage: 'Add photos',
  },
  photosClear: {
    id: 'albutts.contribute.photos_clear',
    defaultMessage: 'Clear',
  },
  captionPlaceholder: {
    id: 'albutts.contribute.caption_placeholder',
    defaultMessage: 'Add a description (optional)',
  },
  photosPick: {
    id: 'albutts.contribute.photos_pick',
    defaultMessage: 'Drag photos or videos here, or click to choose',
  },
  photosPickMore: {
    id: 'albutts.contribute.photos_pick_more',
    defaultMessage:
      '{count, plural, one {# selected · drop or click to add more} other {# selected · drop or click to add more}}',
  },
  photosDropCue: {
    id: 'albutts.contribute.photos_drop_cue',
    defaultMessage: 'Drop to add',
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
  caption: string;
  // Server error message from the failed upload attempt (e.g.
  // "This album is only open to Tal's Mates…"). Populated when
  // status flips to 'failed' so the UI can surface WHY the upload
  // was rejected — was previously just a generic "failed" chip.
  errorMessage?: string;
}

const CAPTION_MAX = 500;

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
  const [dragging, setDragging] = useState(false);

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

  const addPhotoFiles = useCallback((files: File[]) => {
    const accepted = files.filter(
      (f) => f.type.startsWith('image/') || f.type.startsWith('video/'),
    );
    if (accepted.length === 0) return;
    setPhotos((prev) => [
      ...prev,
      ...accepted.map((file, idx) => ({
        file,
        previewUrl: URL.createObjectURL(file),
        key: `${Date.now()}-${idx}-${file.name}`,
        status: 'queued' as PhotoStatus,
        caption: '',
      })),
    ]);
  }, []);

  const handleCaptionChange = useCallback((key: string, value: string) => {
    setPhotos((prev) =>
      prev.map((p) =>
        p.key === key ? { ...p, caption: value.slice(0, CAPTION_MAX) } : p,
      ),
    );
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files ? Array.from(e.target.files) : [];
      addPhotoFiles(files);
      e.target.value = ''; // allow re-picking the same file
    },
    [addPhotoFiles],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
  }, []);
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      addPhotoFiles(Array.from(e.dataTransfer.files));
    },
    [addPhotoFiles],
  );

  const handleClear = useCallback(() => {
    setPhotos([]);
  }, []);

  const setPhotoStatus = useCallback(
    (key: string, status: PhotoStatus, errorMessage?: string) => {
      setPhotos((prev) =>
        prev.map((p) => (p.key === key ? { ...p, status, errorMessage } : p)),
      );
    },
    [],
  );

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
            await apiContributePhoto(albumId, {
              media_id: media.data.id,
              caption: draft.caption.trim() || undefined,
            });
            setPhotoStatus(draft.key, 'done');
          } catch (e) {
            // Extract the server's `error` message from the axios
            // error response so the failed-chip tooltip / row error
            // shows WHY (e.g. "This album is only open to
            // @tal's Mates…") instead of a generic "failed". Both
            // photo POST (403 / 422) and media POST (422) return
            // `{ error: string }` bodies.
            const err = e as {
              response?: { data?: { error?: string } };
              message?: string;
            };
            const serverMsg =
              err.response?.data?.error ?? err.message ?? 'Upload failed';
            console.error(
              '[albutts] contribute photo upload failed',
              {
                name: draft.file.name,
                size: draft.file.size,
                type: draft.file.type,
                serverMsg,
              },
              e,
            );
            setPhotoStatus(draft.key, 'failed', serverMsg);
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

  // Shell CTA + submit: pre-submit → "Add N to album" / apiContributePhoto;
  // post-submit (uploads finished) → "Done" / onContributed.
  const shellSubmitLabel = finished
    ? intl.formatMessage(messages.done)
    : submitLabel;
  const shellSubmit = finished ? onContributed : submit;
  const shellCanSubmit = finished ? !pending : canSubmit;

  return (
    <ComposeShell
      korner='albutts'
      label={intl.formatMessage(messages.heading)}
      submitLabel={shellSubmitLabel}
      submitting={pending}
      canSubmit={shellCanSubmit}
      onSubmit={shellSubmit}
      onCancel={onCancel}
    >
      <div className='albutts-composer'>
        {!hasSubmitted && (
          <div
            className={`albutts-composer__drop-zone${dragging ? ' albutts-composer__drop-zone--dragging' : ''}${pending ? ' albutts-composer__drop-zone--disabled' : ''}`}
            onDragOver={handleDragOver}
            onDragEnter={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              id='albutts-contribute-file'
              type='file'
              multiple
              accept='image/*,video/*'
              className='albutts-composer__file'
              onChange={handleFileChange}
              disabled={pending}
            />
            <label
              htmlFor='albutts-contribute-file'
              className='albutts-composer__drop-zone-label'
            >
              <Icon
                id='add_photo_alternate'
                icon={AddPhotoAlternateIcon}
                className='albutts-composer__drop-zone-icon'
              />
              <span className='albutts-composer__drop-zone-text'>
                {dragging
                  ? intl.formatMessage(messages.photosDropCue)
                  : photos.length > 0
                    ? intl.formatMessage(messages.photosPickMore, {
                        count: photos.length,
                      })
                    : intl.formatMessage(messages.photosPick)}
              </span>
            </label>
          </div>
        )}

        {photos.length > 0 && (
          <>
            <ul className='albutts-composer__picks'>
              {photos.map((p) => (
                <li
                  key={p.key}
                  className={`albutts-composer__pick albutts-composer__pick--${p.status}`}
                >
                  <div className='albutts-composer__pick-thumb'>
                    <img
                      className='albutts-composer__pick-img'
                      src={p.previewUrl}
                      alt={p.caption || p.file.name}
                    />
                    <span
                      className={`albutts-composer__chip albutts-composer__chip--${p.status}`}
                      aria-hidden
                      title={p.status === 'failed' ? p.errorMessage : undefined}
                    >
                      {chipGlyph(p.status)}
                    </span>
                  </div>
                  <div className='albutts-composer__pick-body'>
                    <PickCaptionRow
                      photoKey={p.key}
                      caption={p.caption}
                      disabled={pending || p.status === 'done'}
                      placeholder={intl.formatMessage(
                        messages.captionPlaceholder,
                      )}
                      onChange={handleCaptionChange}
                    />
                    {p.status === 'failed' && p.errorMessage && (
                      <p className='albutts-composer__pick-error' role='alert'>
                        {p.errorMessage}
                      </p>
                    )}
                  </div>
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

        {finished && failedCount > 0 && (
          <div className='albutts-composer__inline-actions'>
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
          </div>
        )}
      </div>
    </ComposeShell>
  );
};

interface PickCaptionRowProps {
  photoKey: string;
  caption: string;
  disabled: boolean;
  placeholder: string;
  onChange: (key: string, value: string) => void;
}

const PickCaptionRow = memo(function PickCaptionRow({
  photoKey,
  caption,
  disabled,
  placeholder,
  onChange,
}: PickCaptionRowProps) {
  const handle = useCallback(
    (value: string) => {
      onChange(photoKey, value);
    },
    [onChange, photoKey],
  );
  return (
    <CaptionTextarea
      className='albutts-composer__pick-caption'
      value={caption}
      onChange={handle}
      placeholder={placeholder}
      maxLength={CAPTION_MAX}
      rows={2}
      disabled={disabled}
    />
  );
});

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
