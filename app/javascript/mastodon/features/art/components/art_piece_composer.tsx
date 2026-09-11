import { useCallback, useMemo, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import AddPhotoAlternateIcon from '@/material-icons/400-24px/add_photo_alternate.svg?react';
import api from 'mastodon/api';
import { apiAddPhoto, apiCreatePiece } from 'mastodon/api/art';
import type { ApiArtPieceJSON, ArtKind } from 'mastodon/api_types/art';
import { ComposeShell } from 'mastodon/components/compose_shell';
import { Icon } from 'mastodon/components/icon';
import type { ReachValue } from 'mastodon/components/reach_dropdown';
import { ReachDropdown } from 'mastodon/components/reach_dropdown';

const messages = defineMessages({
  cancel: { id: 'art.composer.cancel', defaultMessage: 'Cancel' },
  submit: { id: 'art.composer.submit', defaultMessage: 'Post piece' },
  submitting: { id: 'art.composer.submitting', defaultMessage: 'Posting…' },
  title: { id: 'art.composer.heading', defaultMessage: 'Post a piece' },
  titlePlaceholder: {
    id: 'art.composer.title_placeholder',
    defaultMessage: 'Title',
  },
  descriptionPlaceholder: {
    id: 'art.composer.description_placeholder',
    defaultMessage: 'A note about the work (optional)',
  },
  kindLabel: { id: 'art.composer.kind_label', defaultMessage: 'Kind' },
  addPhotos: { id: 'art.composer.add_photos', defaultMessage: 'Add photos' },
  photosHint: {
    id: 'art.composer.photos_hint',
    defaultMessage: 'Add photos of the work — the first one becomes the cover.',
  },
  uploading: {
    id: 'art.composer.uploading',
    defaultMessage: '{done} of {total} uploaded',
  },
  failed: {
    id: 'art.composer.failed',
    defaultMessage:
      "Piece saved, but {count, plural, one {# photo} other {# photos}} didn't upload. Try again from the piece's page.",
  },
});

const KINDS: readonly ArtKind[] = [
  'painting',
  'sculpture',
  'print',
  'drawing',
  'ceramic',
  'photograph',
  'other',
];

const kindMessages = defineMessages({
  painting: { id: 'art.kind.painting', defaultMessage: 'Painting' },
  sculpture: { id: 'art.kind.sculpture', defaultMessage: 'Sculpture' },
  print: { id: 'art.kind.print', defaultMessage: 'Print' },
  drawing: { id: 'art.kind.drawing', defaultMessage: 'Drawing' },
  ceramic: { id: 'art.kind.ceramic', defaultMessage: 'Ceramic' },
  photograph: { id: 'art.kind.photograph', defaultMessage: 'Photograph' },
  other: { id: 'art.kind.other', defaultMessage: 'Other' },
});

interface PhotoDraft {
  key: string;
  file: File;
  preview: string;
}

interface MediaResponse {
  id: string;
}

interface Props {
  onCancel: () => void;
  onCreated: (piece: ApiArtPieceJSON) => void;
}

export const ArtPieceComposer: React.FC<Props> = ({ onCancel, onCreated }) => {
  const intl = useIntl();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState<ArtKind>('painting');
  const [visibility, setVisibility] = useState<ReachValue>('public');
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  const [pending, setPending] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [failedCount, setFailedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSubmit = useMemo(
    () => title.trim().length > 0 && !pending,
    [title, pending],
  );

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setTitle(e.target.value);
    },
    [],
  );
  const handleDescriptionChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setDescription(e.target.value);
    },
    [],
  );
  const handleKindChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setKind(e.target.value as ArtKind);
    },
    [],
  );

  const handleAddPhotos = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFilesSelected = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length === 0) return;
      const drafts: PhotoDraft[] = files.map((file) => ({
        key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        preview: URL.createObjectURL(file),
      }));
      setPhotos((prev) => [...prev, ...drafts]);
      // Allow re-picking the same file in a subsequent tap
      e.target.value = '';
    },
    [],
  );

  const removePhoto = useCallback((key: string) => {
    setPhotos((prev) => {
      const target = prev.find((p) => p.key === key);
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter((p) => p.key !== key);
    });
  }, []);

  const submit = useCallback(() => {
    if (!canSubmit) return;
    setPending(true);
    setError(null);
    setFailedCount(0);
    setUploadProgress(
      photos.length > 0 ? { done: 0, total: photos.length } : null,
    );

    void (async () => {
      let piece: ApiArtPieceJSON;
      try {
        piece = await apiCreatePiece({
          title: title.trim(),
          description: description.trim() || undefined,
          kind,
          visibility,
        });
      } catch (e) {
        setPending(false);
        setUploadProgress(null);
        setError(e instanceof Error ? e.message : 'Could not post the piece.');
        return;
      }

      // Serial uploads — Art pieces typically have a handful of photos, and
      // ordering matters (first upload = cover). A pool would race ordering.
      let done = 0;
      let failed = 0;
      for (let i = 0; i < photos.length; i += 1) {
        const draft = photos[i];
        if (!draft) continue;
        try {
          const form = new FormData();
          form.append('file', draft.file);
          const media = await api().post<MediaResponse>('/api/v1/media', form);
          await apiAddPhoto(piece.id, {
            media_id: media.data.id,
            position: i,
          });
          done += 1;
        } catch {
          failed += 1;
        }
        setUploadProgress({ done: done + failed, total: photos.length });
      }
      setFailedCount(failed);
      // Re-fetch is unnecessary — the piece row exists; the detail page
      // will fetch fresh photo rows on mount. Hand the caller the piece
      // and let it navigate.
      onCreated(piece);
    })();
  }, [canSubmit, description, kind, onCreated, photos, title, visibility]);

  return (
    <ComposeShell
      korner='art'
      label={intl.formatMessage(messages.title)}
      onCancel={onCancel}
      onSubmit={submit}
      submitLabel={intl.formatMessage(messages.submit)}
      submittingLabel={intl.formatMessage(messages.submitting)}
      submitting={pending}
      canSubmit={canSubmit}
      headerAction={
        <ReachDropdown
          value={visibility}
          onChange={setVisibility}
          disabled={pending}
        />
      }
    >
      <div className='art-composer'>
        <input
          type='text'
          className='art-composer__title'
          value={title}
          onChange={handleTitleChange}
          placeholder={intl.formatMessage(messages.titlePlaceholder)}
          maxLength={240}
          disabled={pending}
        />

        <div className='art-composer__kind'>
          <label htmlFor='art-composer-kind'>
            {intl.formatMessage(messages.kindLabel)}
          </label>
          <select
            id='art-composer-kind'
            value={kind}
            onChange={handleKindChange}
            disabled={pending}
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {intl.formatMessage(kindMessages[k])}
              </option>
            ))}
          </select>
        </div>

        <textarea
          className='art-composer__description'
          value={description}
          onChange={handleDescriptionChange}
          placeholder={intl.formatMessage(messages.descriptionPlaceholder)}
          maxLength={4000}
          disabled={pending}
        />

        <p className='art-composer__hint'>
          {intl.formatMessage(messages.photosHint)}
        </p>

        {photos.length > 0 && (
          <ul className='art-composer__photos'>
            {photos.map((p) => (
              <PhotoDraftTile
                key={p.key}
                draft={p}
                disabled={pending}
                onRemove={removePhoto}
              />
            ))}
          </ul>
        )}

        <button
          type='button'
          className='art-composer__add-photos'
          onClick={handleAddPhotos}
          disabled={pending}
        >
          <Icon id='add_photo_alternate' icon={AddPhotoAlternateIcon} />
          {intl.formatMessage(messages.addPhotos)}
        </button>
        <input
          ref={fileInputRef}
          type='file'
          accept='image/*'
          multiple
          hidden
          onChange={handleFilesSelected}
        />

        {uploadProgress && uploadProgress.total > 0 && (
          <p className='art-composer__progress'>
            {intl.formatMessage(messages.uploading, uploadProgress)}
          </p>
        )}
        {failedCount > 0 && (
          <p className='art-composer__error'>
            {intl.formatMessage(messages.failed, { count: failedCount })}
          </p>
        )}
        {error && <p className='art-composer__error'>{error}</p>}
      </div>
    </ComposeShell>
  );
};

interface PhotoDraftTileProps {
  draft: PhotoDraft;
  disabled: boolean;
  onRemove: (key: string) => void;
}

const PhotoDraftTile: React.FC<PhotoDraftTileProps> = ({
  draft,
  disabled,
  onRemove,
}) => {
  const handleClick = useCallback(() => {
    onRemove(draft.key);
  }, [onRemove, draft.key]);

  return (
    <li className='art-composer__photo'>
      <img src={draft.preview} alt='' />
      <button
        type='button'
        className='art-composer__photo-remove'
        onClick={handleClick}
        disabled={disabled}
        aria-label='Remove'
      >
        ×
      </button>
    </li>
  );
};
