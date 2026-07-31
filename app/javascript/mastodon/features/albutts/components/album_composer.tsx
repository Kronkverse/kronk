import { memo, useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import AddPhotoAlternateIcon from '@/material-icons/400-24px/add_photo_alternate.svg?react';
import api from 'mastodon/api';
import { apiContributePhoto, apiCreateAlbum } from 'mastodon/api/albutts';
import type { AlbumVisibility, ApiAlbumJSON } from 'mastodon/api_types/albutts';
import { Icon } from 'mastodon/components/icon';
import { KornerVisibilityPicker } from 'mastodon/components/korner_visibility_picker';

import { CaptionTextarea } from './caption_textarea';

const messages = defineMessages({
  heading: {
    id: 'albutts.composer.heading',
    defaultMessage: 'Start an album',
  },
  titleLabel: {
    id: 'albutts.composer.title_label',
    defaultMessage: 'Title',
  },
  titlePlaceholder: {
    id: 'albutts.composer.title_placeholder',
    defaultMessage: 'What is this album?',
  },
  descriptionLabel: {
    id: 'albutts.composer.description_label',
    defaultMessage: 'Description (optional)',
  },
  visibilityLabel: {
    id: 'albutts.composer.visibility_label',
    defaultMessage: 'Who can see it?',
  },
  krewNote: {
    id: 'albutts.composer.krew_note',
    defaultMessage:
      'Krew-scoped albums are landing in a follow-up — pick a different scope for now.',
  },
  photosClear: {
    id: 'albutts.composer.photos_clear',
    defaultMessage: 'Clear',
  },
  captionPlaceholder: {
    id: 'albutts.composer.caption_placeholder',
    defaultMessage: 'Add a description (optional)',
  },
  photosPick: {
    id: 'albutts.composer.photos_pick',
    defaultMessage: 'Drag photos or videos here, or click to choose',
  },
  photosPickMore: {
    id: 'albutts.composer.photos_pick_more',
    defaultMessage:
      '{count, plural, one {# selected · drop or click to add more} other {# selected · drop or click to add more}}',
  },
  photosDropCue: {
    id: 'albutts.composer.photos_drop_cue',
    defaultMessage: 'Drop to add',
  },
  cancel: {
    id: 'albutts.composer.cancel',
    defaultMessage: 'Cancel',
  },
  create: {
    id: 'albutts.composer.create',
    defaultMessage: 'Create album',
  },
  createWithPhotos: {
    id: 'albutts.composer.create_with_photos',
    defaultMessage:
      'Create album & add {count, plural, one {# photo} other {# photos}}',
  },
  progressLine: {
    id: 'albutts.composer.progress_line',
    defaultMessage:
      '{done} of {total} uploaded{failed, plural, =0 {} one { · # failed} other { · # failed}}',
  },
  retryFailed: {
    id: 'albutts.composer.retry_failed',
    defaultMessage: 'Retry {count} failed',
  },
  error: {
    id: 'albutts.composer.error',
    defaultMessage: "Couldn't create the album — try again.",
  },
  photoErrorPartial: {
    id: 'albutts.composer.photo_error_partial',
    defaultMessage:
      "The album is created, but {failed, plural, one {# photo} other {# photos}} didn't upload. Retry them below or continue and add later.",
  },
  continueToAlbum: {
    id: 'albutts.composer.continue_to_album',
    defaultMessage: 'Continue to album',
  },
  chipQueued: {
    id: 'albutts.composer.chip_queued',
    defaultMessage: 'Queued',
  },
  chipUploading: {
    id: 'albutts.composer.chip_uploading',
    defaultMessage: 'Uploading…',
  },
  chipDone: {
    id: 'albutts.composer.chip_done',
    defaultMessage: 'Uploaded',
  },
  chipFailed: {
    id: 'albutts.composer.chip_failed',
    defaultMessage: 'Failed',
  },
});

const TITLE_MAX = 240;
const DESCRIPTION_MAX = 4000;
// Krew stays a placeholder in the picker until the krew picker lands
// (Slice 3-and-a-half of the Albutts build).
const KREW_DISABLED = ['krew'] as const;
// Concurrency cap on the upload pool. Four keeps browser socket count
// reasonable (major browsers cap ~6 per host) and matches the load
// Mastodon media processing can absorb without queue backup.
const UPLOAD_CONCURRENCY = 4;

interface MediaResponse {
  id: string;
}

interface AlbumComposerProps {
  onCancel: () => void;
  onCreated: (album: ApiAlbumJSON) => void;
}

type PhotoStatus = 'queued' | 'uploading' | 'done' | 'failed';

interface PhotoDraft {
  file: File;
  previewUrl: string;
  key: string;
  status: PhotoStatus;
  caption: string;
}

const CAPTION_MAX = 500;

export const AlbumComposer: React.FC<AlbumComposerProps> = ({
  onCancel,
  onCreated,
}) => {
  const intl = useIntl();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<AlbumVisibility>('public');
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdAlbum, setCreatedAlbum] = useState<ApiAlbumJSON | null>(null);
  const [dragging, setDragging] = useState(false);

  // Revoke blob URLs on unmount / list churn so the browser doesn't
  // hold onto the underlying Blobs after the composer closes.
  useEffect(() => {
    const urls = photos.map((p) => p.previewUrl);
    return () => {
      urls.forEach((u) => {
        URL.revokeObjectURL(u);
      });
    };
  }, [photos]);

  const trimmed = title.trim();
  const canSubmit = trimmed !== '' && !pending && visibility !== 'krew';

  const doneCount = photos.filter((p) => p.status === 'done').length;
  const failedCount = photos.filter((p) => p.status === 'failed').length;
  const inflightCount = photos.filter((p) => p.status === 'uploading').length;

  const handleTitle = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value.slice(0, TITLE_MAX));
  }, []);

  const handleDescription = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setDescription(e.target.value.slice(0, DESCRIPTION_MAX));
    },
    [],
  );

  const handleVisibilityChange = useCallback((next: string) => {
    setVisibility(next as AlbumVisibility);
  }, []);

  // Accept only images and videos. Drag-and-drop hands us the entire
  // OS clipboard including e.g. text/uri-list, so filter to media types
  // before enqueueing.
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

  const handlePhotosChange = useCallback(
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

  const handleClearPhotos = useCallback(() => {
    setPhotos([]);
  }, []);

  // Move a photo through the status machine. Reads by key so
  // concurrent workers don't stomp on each other's indices.
  const setPhotoStatus = useCallback((key: string, status: PhotoStatus) => {
    setPhotos((prev) =>
      prev.map((p) => (p.key === key ? { ...p, status } : p)),
    );
  }, []);

  // Concurrency-limited upload pool. Spawns N workers that pull off a
  // shared queue until it's drained. Each worker runs the two-step
  // upload (POST /api/v1/media → POST /api/v1/albutts/albums/:id/photos)
  // and reports back per-photo status.
  const runUploadPool = useCallback(
    async (albumId: string, drafts: PhotoDraft[]) => {
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
            console.error(
              '[albutts] photo upload failed',
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
    [setPhotoStatus],
  );

  const submit = useCallback(() => {
    if (!canSubmit) return;
    setPending(true);
    setError(null);

    void (async () => {
      // Reset any prior status (e.g. after a failed run + more picks).
      setPhotos((prev) => prev.map((p) => ({ ...p, status: 'queued' })));

      let album: ApiAlbumJSON;
      try {
        album = await apiCreateAlbum({
          title: trimmed,
          description: description.trim() || undefined,
          visibility,
        });
      } catch (e) {
        console.error('[albutts] create album failed', e);
        setError('create_failed');
        setPending(false);
        return;
      }

      setCreatedAlbum(album);

      const drafts = photos.map((p) => ({
        ...p,
        status: 'queued' as PhotoStatus,
      }));
      await runUploadPool(album.id, drafts);

      setPending(false);
    })();
  }, [canSubmit, description, photos, runUploadPool, trimmed, visibility]);

  // Retry only the photos currently in `failed` status.
  const handleRetryFailed = useCallback(() => {
    if (!createdAlbum) return;
    setPending(true);
    void (async () => {
      const drafts = photos.filter((p) => p.status === 'failed');
      // Optimistically reset the failed set to queued so the UI reflects
      // the in-flight retry.
      setPhotos((prev) =>
        prev.map((p) =>
          p.status === 'failed' ? { ...p, status: 'queued' } : p,
        ),
      );
      await runUploadPool(createdAlbum.id, drafts);
      setPending(false);
    })();
  }, [createdAlbum, photos, runUploadPool]);

  const handleContinue = useCallback(() => {
    if (createdAlbum) onCreated(createdAlbum);
  }, [createdAlbum, onCreated]);

  // Auto-close the composer when a submit finished successfully with
  // zero failures. If any failed, we stay open so the user can retry
  // or continue on their own terms.
  useEffect(() => {
    if (!createdAlbum) return;
    if (pending) return;
    if (
      failedCount === 0 &&
      (photos.length === 0 || doneCount === photos.length)
    ) {
      onCreated(createdAlbum);
    }
  }, [createdAlbum, doneCount, failedCount, onCreated, pending, photos.length]);

  const submitLabel =
    photos.length === 0
      ? intl.formatMessage(messages.create)
      : intl.formatMessage(messages.createWithPhotos, { count: photos.length });

  return (
    <div className='albutts-composer' role='dialog' aria-modal='true'>
      <div className='albutts-composer__panel'>
        <h2 className='albutts-composer__heading'>
          {intl.formatMessage(messages.heading)}
        </h2>

        <label
          className='albutts-composer__label'
          htmlFor='albutts-composer-title'
        >
          {intl.formatMessage(messages.titleLabel)}
        </label>
        <input
          id='albutts-composer-title'
          type='text'
          className='albutts-composer__input'
          value={title}
          onChange={handleTitle}
          maxLength={TITLE_MAX}
          placeholder={intl.formatMessage(messages.titlePlaceholder)}
          disabled={!!createdAlbum}
        />

        <label
          className='albutts-composer__label'
          htmlFor='albutts-composer-description'
        >
          {intl.formatMessage(messages.descriptionLabel)}
        </label>
        <textarea
          id='albutts-composer-description'
          className='albutts-composer__textarea'
          value={description}
          onChange={handleDescription}
          maxLength={DESCRIPTION_MAX}
          disabled={!!createdAlbum}
        />

        <div className='albutts-composer__label'>
          {intl.formatMessage(messages.visibilityLabel)}
        </div>
        <KornerVisibilityPicker
          slug='albutts'
          value={visibility}
          onChange={handleVisibilityChange}
          disabled={!!createdAlbum}
          disabledScopes={KREW_DISABLED}
        />
        {visibility === 'krew' && !createdAlbum && (
          <p className='albutts-composer__hint'>
            {intl.formatMessage(messages.krewNote)}
          </p>
        )}

        {!createdAlbum && (
          <div
            className={`albutts-composer__drop-zone${dragging ? ' albutts-composer__drop-zone--dragging' : ''}${pending ? ' albutts-composer__drop-zone--disabled' : ''}`}
            onDragOver={handleDragOver}
            onDragEnter={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              id='albutts-composer-photos'
              type='file'
              multiple
              accept='image/*,video/*'
              className='albutts-composer__file'
              onChange={handlePhotosChange}
              disabled={pending}
            />
            <label
              htmlFor='albutts-composer-photos'
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
                  <div
                    className='albutts-composer__pick-thumb'
                    title={intl.formatMessage(chipMessage(p.status, messages))}
                  >
                    <img
                      className='albutts-composer__pick-img'
                      src={p.previewUrl}
                      alt={p.caption || p.file.name}
                    />
                    <span
                      className={`albutts-composer__chip albutts-composer__chip--${p.status}`}
                      aria-hidden
                    >
                      {chipGlyph(p.status)}
                    </span>
                  </div>
                  <PickCaptionRow
                    photoKey={p.key}
                    caption={p.caption}
                    disabled={pending || p.status === 'done'}
                    placeholder={intl.formatMessage(
                      messages.captionPlaceholder,
                    )}
                    onChange={handleCaptionChange}
                  />
                </li>
              ))}
            </ul>
            {!createdAlbum && (
              <button
                type='button'
                className='albutts-composer__clear'
                onClick={handleClearPhotos}
                disabled={pending}
              >
                {intl.formatMessage(messages.photosClear)}
              </button>
            )}
          </>
        )}

        {createdAlbum && photos.length > 0 && (
          <p className='albutts-composer__progress' aria-live='polite'>
            {intl.formatMessage(messages.progressLine, {
              done: doneCount,
              total: photos.length,
              failed: failedCount,
            })}
            {inflightCount > 0 && ' · uploading'}
          </p>
        )}

        {error && (
          <p className='albutts-composer__error' role='alert'>
            {intl.formatMessage(messages.error)}
          </p>
        )}
        {createdAlbum && failedCount > 0 && !pending && (
          <p className='albutts-composer__error' role='alert'>
            {intl.formatMessage(messages.photoErrorPartial, {
              failed: failedCount,
            })}
          </p>
        )}

        <div className='albutts-composer__actions'>
          {createdAlbum ? (
            <>
              {failedCount > 0 && !pending && (
                <button
                  type='button'
                  className='albutts-btn albutts-btn--ghost'
                  onClick={handleRetryFailed}
                >
                  {intl.formatMessage(messages.retryFailed, {
                    count: failedCount,
                  })}
                </button>
              )}
              <button
                type='button'
                className='albutts-btn albutts-btn--primary'
                onClick={handleContinue}
                disabled={pending}
              >
                {intl.formatMessage(messages.continueToAlbum)}
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

// Small memoized row so `CaptionTextarea`'s per-photo `onChange` can
// bind the photo's `key` once instead of an inline arrow on every
// render (react/jsx-no-bind).
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

function chipMessage(
  status: PhotoStatus,
  m: typeof messages,
): (typeof messages)[keyof typeof messages] {
  switch (status) {
    case 'done':
      return m.chipDone;
    case 'failed':
      return m.chipFailed;
    case 'uploading':
      return m.chipUploading;
    default:
      return m.chipQueued;
  }
}
