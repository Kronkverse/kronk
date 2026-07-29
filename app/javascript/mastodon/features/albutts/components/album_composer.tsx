import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import api from 'mastodon/api';
import { apiContributePhoto, apiCreateAlbum } from 'mastodon/api/albutts';
import type { AlbumVisibility, ApiAlbumJSON } from 'mastodon/api_types/albutts';

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
  visibilityPublic: {
    id: 'albutts.composer.visibility_public',
    defaultMessage: 'Kronk',
  },
  visibilityPublicHelp: {
    id: 'albutts.composer.visibility_public_help',
    defaultMessage: 'Everyone on Kronk',
  },
  visibilityOrbit: {
    id: 'albutts.composer.visibility_orbit',
    defaultMessage: 'Orbit',
  },
  visibilityOrbitHelp: {
    id: 'albutts.composer.visibility_orbit_help',
    defaultMessage: 'Your mates and their mates',
  },
  visibilityMates: {
    id: 'albutts.composer.visibility_mates',
    defaultMessage: 'Mates',
  },
  visibilityMatesHelp: {
    id: 'albutts.composer.visibility_mates_help',
    defaultMessage: 'Your mutual connections only',
  },
  visibilitySelfOnly: {
    id: 'albutts.composer.visibility_self_only',
    defaultMessage: 'Just me',
  },
  visibilitySelfOnlyHelp: {
    id: 'albutts.composer.visibility_self_only_help',
    defaultMessage: 'On your profile only — not in anyone else’s feed',
  },
  visibilityKrew: {
    id: 'albutts.composer.visibility_krew',
    defaultMessage: 'A krew',
  },
  krewNote: {
    id: 'albutts.composer.krew_note',
    defaultMessage:
      'Krew-scoped albums are landing in a follow-up — pick a different scope for now.',
  },
  photosLabel: {
    id: 'albutts.composer.photos_label',
    defaultMessage: 'Photos',
  },
  photosHint: {
    id: 'albutts.composer.photos_hint',
    defaultMessage:
      'Pick one or more — they’re optional at this step; you can always add more later.',
  },
  photosPickMore: {
    id: 'albutts.composer.photos_pick_more',
    defaultMessage: 'Add more',
  },
  photosClear: {
    id: 'albutts.composer.photos_clear',
    defaultMessage: 'Clear',
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
  uploading: {
    id: 'albutts.composer.uploading',
    defaultMessage: 'Uploading photo {current} of {total}…',
  },
  error: {
    id: 'albutts.composer.error',
    defaultMessage: "Couldn't create — try again.",
  },
  photoErrorPartial: {
    id: 'albutts.composer.photo_error_partial',
    defaultMessage:
      "The album is created, but {failed, plural, one {# photo} other {# photos}} didn't upload. Open the browser console to see why, or retry from the album page.",
  },
  continueToAlbum: {
    id: 'albutts.composer.continue_to_album',
    defaultMessage: 'Continue to album',
  },
});

const TITLE_MAX = 240;
const DESCRIPTION_MAX = 4000;

interface MediaResponse {
  id: string;
}

interface AlbumComposerProps {
  onCancel: () => void;
  onCreated: (album: ApiAlbumJSON) => void;
}

interface PhotoDraft {
  file: File;
  previewUrl: string;
  key: string; // stable React key for re-orderable list rendering
}

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
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [failedCount, setFailedCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

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

  const handleTitle = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value.slice(0, TITLE_MAX));
  }, []);

  const handleDescription = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setDescription(e.target.value.slice(0, DESCRIPTION_MAX));
    },
    [],
  );

  const handlePublic = useCallback(() => {
    setVisibility('public');
  }, []);
  const handleOrbit = useCallback(() => {
    setVisibility('orbit');
  }, []);
  const handleMates = useCallback(() => {
    setVisibility('mates');
  }, []);
  const handleSelfOnly = useCallback(() => {
    setVisibility('self_only');
  }, []);
  const handleKrew = useCallback(() => {
    setVisibility('krew');
  }, []);

  const handlePhotosChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files ? Array.from(e.target.files) : [];
      if (files.length === 0) return;
      setPhotos((prev) => [
        ...prev,
        ...files.map((file, idx) => ({
          file,
          previewUrl: URL.createObjectURL(file),
          key: `${Date.now()}-${idx}-${file.name}`,
        })),
      ]);
      // Reset the input so re-picking the same file counts as a new
      // change event.
      e.target.value = '';
    },
    [],
  );

  const handleClearPhotos = useCallback(() => {
    setPhotos([]);
  }, []);

  const [createdAlbum, setCreatedAlbum] = useState<ApiAlbumJSON | null>(null);

  const submit = useCallback(() => {
    if (!canSubmit) return;
    setPending(true);
    setError(null);
    setFailedCount(0);
    setProgress(
      photos.length > 0 ? { current: 0, total: photos.length } : null,
    );

    void (async () => {
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
        setProgress(null);
        return;
      }

      let failed = 0;
      for (let i = 0; i < photos.length; i += 1) {
        const draft = photos[i];
        if (!draft) continue;
        setProgress({ current: i + 1, total: photos.length });
        try {
          const form = new FormData();
          form.append('file', draft.file);
          const media = await api().post<MediaResponse>('/api/v1/media', form);
          await apiContributePhoto(album.id, { media_id: media.data.id });
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
          failed += 1;
        }
      }

      setPending(false);
      setProgress(null);
      setCreatedAlbum(album);

      if (failed > 0) {
        // Keep the composer open so the user actually sees the error
        // and can decide what to do. The "Continue to album" affordance
        // dismisses on their terms.
        setFailedCount(failed);
      } else {
        onCreated(album);
      }
    })();
  }, [canSubmit, description, onCreated, photos, trimmed, visibility]);

  const handleContinue = useCallback(() => {
    if (createdAlbum) onCreated(createdAlbum);
  }, [createdAlbum, onCreated]);

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
        />

        <div className='albutts-composer__label'>
          {intl.formatMessage(messages.visibilityLabel)}
        </div>
        <div className='albutts-composer__visibility'>
          <VisibilityOption
            active={visibility === 'public'}
            label={intl.formatMessage(messages.visibilityPublic)}
            help={intl.formatMessage(messages.visibilityPublicHelp)}
            onSelect={handlePublic}
          />
          <VisibilityOption
            active={visibility === 'orbit'}
            label={intl.formatMessage(messages.visibilityOrbit)}
            help={intl.formatMessage(messages.visibilityOrbitHelp)}
            onSelect={handleOrbit}
          />
          <VisibilityOption
            active={visibility === 'mates'}
            label={intl.formatMessage(messages.visibilityMates)}
            help={intl.formatMessage(messages.visibilityMatesHelp)}
            onSelect={handleMates}
          />
          <VisibilityOption
            active={visibility === 'self_only'}
            label={intl.formatMessage(messages.visibilitySelfOnly)}
            help={intl.formatMessage(messages.visibilitySelfOnlyHelp)}
            onSelect={handleSelfOnly}
          />
          <VisibilityOption
            active={visibility === 'krew'}
            label={intl.formatMessage(messages.visibilityKrew)}
            onSelect={handleKrew}
          />
        </div>
        {visibility === 'krew' && (
          <p className='albutts-composer__hint'>
            {intl.formatMessage(messages.krewNote)}
          </p>
        )}

        <label
          className='albutts-composer__label'
          htmlFor='albutts-composer-photos'
        >
          {intl.formatMessage(messages.photosLabel)}
        </label>
        <p className='albutts-composer__hint'>
          {intl.formatMessage(messages.photosHint)}
        </p>
        <input
          id='albutts-composer-photos'
          type='file'
          multiple
          accept='image/*,video/*'
          className='albutts-composer__file'
          onChange={handlePhotosChange}
          disabled={pending}
        />
        {photos.length > 0 && (
          <>
            <ul className='albutts-composer__thumbs'>
              {photos.map((p) => (
                <li key={p.key} className='albutts-composer__thumb'>
                  <img
                    className='albutts-composer__thumb-img'
                    src={p.previewUrl}
                    alt={p.file.name}
                  />
                </li>
              ))}
            </ul>
            <button
              type='button'
              className='albutts-composer__clear'
              onClick={handleClearPhotos}
              disabled={pending}
            >
              {intl.formatMessage(messages.photosClear)}
            </button>
          </>
        )}

        {progress && (
          <p className='albutts-composer__progress' aria-live='polite'>
            {intl.formatMessage(messages.uploading, {
              current: progress.current,
              total: progress.total,
            })}
          </p>
        )}

        {error && (
          <p className='albutts-composer__error' role='alert'>
            {intl.formatMessage(messages.error)}
          </p>
        )}
        {failedCount > 0 && !error && (
          <p className='albutts-composer__error' role='alert'>
            {intl.formatMessage(messages.photoErrorPartial, {
              failed: failedCount,
            })}
          </p>
        )}

        <div className='albutts-composer__actions'>
          {createdAlbum && failedCount > 0 ? (
            <button
              type='button'
              className='albutts-btn albutts-btn--primary'
              onClick={handleContinue}
            >
              {intl.formatMessage(messages.continueToAlbum)}
            </button>
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

interface VisibilityOptionProps {
  active: boolean;
  label: string;
  help?: string;
  onSelect: () => void;
}

const VisibilityOption: React.FC<VisibilityOptionProps> = ({
  active,
  label,
  help,
  onSelect,
}) => (
  <button
    type='button'
    className={`albutts-composer__visibility-opt ${active ? 'albutts-composer__visibility-opt--active' : ''}`}
    aria-pressed={active}
    aria-label={help ? `${label} — ${help}` : label}
    onClick={onSelect}
  >
    {label}
  </button>
);
