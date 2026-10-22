import { useCallback, useMemo, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import api from 'mastodon/api';
import {
  apiAddPhoto,
  apiCreatePiece,
  apiDeletePhoto,
  apiGetPiece,
  apiUpdatePiece,
} from 'mastodon/api/art';
import type { ApiArtPieceJSON, ArtKind } from 'mastodon/api_types/art';
import type { ApiComposerDraftJSON } from 'mastodon/api_types/drafts';
import { ComposeShell } from 'mastodon/components/compose_shell';
import { PhotoDropZone } from 'mastodon/components/media';
import type { ReachValue } from 'mastodon/components/reach_dropdown';
import { ReachDropdown } from 'mastodon/components/reach_dropdown';
import { useDraft } from 'mastodon/hooks/useDraft';
import type { KonnectTarget } from 'mastodon/hooks/useKonnect';
import { useKonnect } from 'mastodon/hooks/useKonnect';

import { ART_KIND_MESSAGES, sortedArtKinds } from '../kinds';

const messages = defineMessages({
  removePhoto: {
    id: 'art.composer.remove_photo',
    defaultMessage: 'Remove photo',
  },
  saveError: {
    id: 'art.composer.save_error',
    defaultMessage: 'Could not save the piece.',
  },
  postError: {
    id: 'art.composer.post_error',
    defaultMessage: 'Could not post the piece.',
  },
  cancel: { id: 'art.composer.cancel', defaultMessage: 'Cancel' },
  submit: { id: 'art.composer.submit', defaultMessage: 'Post piece' },
  submitting: { id: 'art.composer.submitting', defaultMessage: 'Posting…' },
  title: { id: 'art.composer.heading', defaultMessage: 'Post a piece' },
  editTitle: { id: 'art.composer.edit_heading', defaultMessage: 'Edit piece' },
  save: { id: 'art.composer.save', defaultMessage: 'Save' },
  saving: { id: 'art.composer.saving', defaultMessage: 'Saving…' },
  deletePiece: { id: 'art.detail.delete', defaultMessage: 'Delete piece' },
  titlePlaceholder: {
    id: 'art.composer.title_placeholder',
    defaultMessage: 'Title',
  },
  descriptionPlaceholder: {
    id: 'art.composer.description_placeholder',
    defaultMessage: 'A note about the work (optional)',
  },
  kindLabel: { id: 'art.composer.kind_label', defaultMessage: 'Kind' },
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

interface PhotoDraft {
  key: string;
  file: File;
  preview: string;
}

interface MediaResponse {
  id: string;
}

// What a piece draft keeps (docs/design.md, Drafts). The photos aren't
// kept: they upload only when the piece is posted, so until then they are
// files on this device and nothing the server has.
interface ArtPieceDraftParams {
  title?: string;
  description?: string;
  kind?: ArtKind;
  visibility?: ReachValue;
  konnections?: KonnectTarget[];
}

interface Props {
  onCancel: () => void;
  onCreated?: (piece: ApiArtPieceJSON) => void;
  // Edit mode: pass the piece to prefill the form, its photos included.
  // Submit saves the text fields, takes off the photos you removed and
  // uploads the ones you added; the form's foot carries Delete.
  piece?: ApiArtPieceJSON;
  onUpdated?: (piece: ApiArtPieceJSON) => void;
  onDelete?: () => void;
  deleting?: boolean;
}

export const ArtPieceComposer: React.FC<Props> = ({
  onCancel,
  onCreated,
  piece: editingPiece,
  onUpdated,
  onDelete,
  deleting = false,
}) => {
  const intl = useIntl();
  const isEdit = !!editingPiece;
  const [title, setTitle] = useState(editingPiece?.title ?? '');
  const [description, setDescription] = useState(
    editingPiece?.description ?? '',
  );
  const [kind, setKind] = useState<ArtKind>(editingPiece?.kind ?? 'painting');
  const [visibility, setVisibility] = useState<ReachValue>(
    editingPiece?.visibility ?? 'public',
  );
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  // Edit mode: the piece's photos, and the ids to take off on save.
  const [saved, setSaved] = useState(editingPiece?.photos ?? []);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const savedPhotos = useMemo(
    () => saved.filter((p) => !removedIds.includes(p.id)),
    [saved, removedIds],
  );
  const [pending, setPending] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [failedCount, setFailedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const kinds = useMemo(() => sortedArtKinds(intl), [intl]);
  // What the new piece will be Konnected to (decisions.md, 2026-10-23).
  const konnect = useKonnect('art');
  const restoreKonnect = konnect.restore;
  const commitKonnect = konnect.commit;

  // Drafts: a new piece is saved as you go, here and on the server, and
  // comes back when the composer opens again. Editing one doesn't keep one.
  const applyDraft = useCallback(
    (d: ApiComposerDraftJSON<ArtPieceDraftParams> | null) => {
      const p = d?.params ?? {};
      setTitle(p.title ?? '');
      setDescription(p.description ?? '');
      setKind(p.kind ?? 'painting');
      setVisibility(p.visibility ?? 'public');
      restoreKonnect(p.konnections);
      // Photos picked for another draft don't belong to this one.
      setPhotos((prev) => {
        prev.forEach((photo) => {
          URL.revokeObjectURL(photo.preview);
        });
        return [];
      });
      setError(null);
    },
    [restoreKonnect],
  );

  const draft = useDraft<ArtPieceDraftParams>({
    korner: 'art',
    kind: 'piece',
    context: null,
    snapshot: {
      params: {
        title,
        description,
        kind,
        visibility,
        konnections: konnect.saved,
      },
    },
    hasContent: title.trim() !== '' || description.trim() !== '',
    apply: applyDraft,
    describe: (d) => d.params.title,
    active: !isEdit,
    paused: pending,
  });

  const finishDraft = draft.finish;

  const canSubmit = useMemo(
    () => title.trim().length > 0 && !pending && !deleting,
    [title, pending, deleting],
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

  const handleFiles = useCallback((files: File[]) => {
    const drafts: PhotoDraft[] = files.map((file) => ({
      key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      preview: URL.createObjectURL(file),
    }));
    setPhotos((prev) => [...prev, ...drafts]);
  }, []);

  const removePhoto = useCallback((key: string) => {
    setPhotos((prev) => {
      const target = prev.find((p) => p.key === key);
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter((p) => p.key !== key);
    });
  }, []);

  const removeSavedPhoto = useCallback((id: string) => {
    setRemovedIds((prev) => [...prev, id]);
  }, []);

  // Uploads each picked photo and adds it to the piece, in order (the
  // first photo is the cover, so a pool would race it). Returns how many
  // failed. With no starting position the server adds each at the end.
  const uploadPhotos = useCallback(
    async (pieceId: string, from: number | null) => {
      setFailedCount(0);
      setUploadProgress(
        photos.length > 0 ? { done: 0, total: photos.length } : null,
      );
      let done = 0;
      let failed = 0;
      for (let i = 0; i < photos.length; i += 1) {
        const draft = photos[i];
        if (!draft) continue;
        try {
          const form = new FormData();
          form.append('file', draft.file);
          const media = await api().post<MediaResponse>('/api/v1/media', form);
          await apiAddPhoto(pieceId, {
            media_id: media.data.id,
            ...(from === null ? {} : { position: from + i }),
          });
          done += 1;
        } catch {
          failed += 1;
        }
        setUploadProgress({ done: done + failed, total: photos.length });
      }
      setFailedCount(failed);
      return failed;
    },
    [photos],
  );

  const submit = useCallback(() => {
    if (!canSubmit) return;
    setPending(true);
    setError(null);

    if (editingPiece) {
      void (async () => {
        try {
          await apiUpdatePiece(editingPiece.id, {
            title: title.trim(),
            description: description.trim(),
            kind,
          });
          for (const id of removedIds) await apiDeletePhoto(id);
          const failed = await uploadPhotos(editingPiece.id, null);
          const updated = await apiGetPiece(editingPiece.id);
          if (failed > 0) {
            // Stay open so the failure is seen, showing what did save.
            setSaved(updated.photos);
            setRemovedIds([]);
            setPhotos([]);
            setPending(false);
            return;
          }
          onUpdated?.(updated);
        } catch (e) {
          setPending(false);
          setError(
            e instanceof Error
              ? e.message
              : intl.formatMessage(messages.saveError),
          );
        }
      })();
      return;
    }

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
        setError(
          e instanceof Error
            ? e.message
            : intl.formatMessage(messages.postError),
        );
        return;
      }
      finishDraft();

      await commitKonnect('art', piece.id);
      await uploadPhotos(piece.id, 0);
      // Re-fetch is unnecessary — the piece row exists; the detail page
      // will fetch fresh photo rows on mount. Hand the caller the piece
      // and let it navigate.
      onCreated?.(piece);
    })();
  }, [
    canSubmit,
    commitKonnect,
    description,
    editingPiece,
    finishDraft,
    intl,
    kind,
    onCreated,
    onUpdated,
    removedIds,
    title,
    uploadPhotos,
    visibility,
  ]);

  return (
    <ComposeShell
      korner='art'
      label={intl.formatMessage(isEdit ? messages.editTitle : messages.title)}
      onCancel={onCancel}
      onSubmit={submit}
      draft={draft}
      konnect={isEdit ? undefined : konnect}
      submitLabel={intl.formatMessage(isEdit ? messages.save : messages.submit)}
      submittingLabel={intl.formatMessage(
        isEdit ? messages.saving : messages.submitting,
      )}
      submitting={pending}
      canSubmit={canSubmit}
      headerAction={
        // Reach is locked while editing: the update endpoints don't
        // re-scope the item's projected feed post, so narrowing reach
        // here would only look private (no reach without consent).
        <ReachDropdown
          value={visibility}
          onChange={setVisibility}
          disabled={pending || isEdit}
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
            {kinds.map((k) => (
              <option key={k} value={k}>
                {intl.formatMessage(ART_KIND_MESSAGES[k])}
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

        {savedPhotos.length + photos.length > 0 && (
          <ul className='art-composer__photos'>
            {savedPhotos.map((p) => (
              <PhotoTile
                key={`saved-${p.id}`}
                id={p.id}
                src={p.url}
                disabled={pending}
                onRemove={removeSavedPhoto}
              />
            ))}
            {photos.map((p) => (
              <PhotoTile
                key={p.key}
                id={p.key}
                src={p.preview}
                disabled={pending}
                onRemove={removePhoto}
              />
            ))}
          </ul>
        )}

        <PhotoDropZone onFiles={handleFiles} disabled={pending} />

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

        {isEdit && onDelete && (
          <button
            type='button'
            className='compose-shell__delete'
            onClick={onDelete}
            disabled={pending || deleting}
          >
            {intl.formatMessage(messages.deletePiece)}
          </button>
        )}
      </div>
    </ComposeShell>
  );
};

// A photo in the picker: one already on the piece (edit mode) or one
// picked on this device. × takes it off.
interface PhotoTileProps {
  id: string;
  src: string | null;
  disabled: boolean;
  onRemove: (id: string) => void;
}

const PhotoTile: React.FC<PhotoTileProps> = ({
  id,
  src,
  disabled,
  onRemove,
}) => {
  const intl = useIntl();
  const handleClick = useCallback(() => {
    onRemove(id);
  }, [onRemove, id]);

  return (
    <li className='art-composer__photo'>
      {src && <img src={src} alt='' />}
      <button
        type='button'
        className='art-composer__photo-remove'
        onClick={handleClick}
        disabled={disabled}
        aria-label={intl.formatMessage(messages.removePhoto)}
      >
        ×
      </button>
    </li>
  );
};
