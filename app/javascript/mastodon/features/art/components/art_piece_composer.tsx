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
import type {
  ApiArtPieceJSON,
  ArtAvailability,
  ArtKind,
  ArtPieceDetailsJSON,
  ArtSizeUnit,
} from 'mastodon/api_types/art';
import type { ApiComposerDraftJSON } from 'mastodon/api_types/drafts';
import { ComposeShell } from 'mastodon/components/compose_shell';
import { PhotoDropZone } from 'mastodon/components/media';
import type { ReachValue } from 'mastodon/components/reach_dropdown';
import { ReachDropdown } from 'mastodon/components/reach_dropdown';
import { useDraft } from 'mastodon/hooks/useDraft';
import type { KonnectTarget } from 'mastodon/hooks/useKonnect';
import { useKonnect } from 'mastodon/hooks/useKonnect';

import { AVAILABILITIES, AVAILABILITY_MESSAGES } from '../details';
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
  details: { id: 'art.composer.details', defaultMessage: 'Details' },
  medium: {
    id: 'art.composer.medium',
    defaultMessage: 'Medium and materials',
  },
  mediumPlaceholder: {
    id: 'art.composer.medium_placeholder',
    defaultMessage: 'e.g. Oil on linen',
  },
  size: { id: 'art.composer.size', defaultMessage: 'Add size' },
  width: { id: 'art.composer.width', defaultMessage: 'Width' },
  height: { id: 'art.composer.height', defaultMessage: 'Height' },
  unit: { id: 'art.composer.unit', defaultMessage: 'Unit' },
  yearMade: { id: 'art.composer.year_made', defaultMessage: 'Year made' },
  edition: { id: 'art.composer.edition', defaultMessage: 'Edition' },
  editionPlaceholder: {
    id: 'art.composer.edition_placeholder',
    defaultMessage: 'e.g. Original, or 3 of 25',
  },
  availability: { id: 'art.composer.availability', defaultMessage: 'Status' },
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
  details?: DetailsForm;
}

// The details as the form holds them: every field a string, so an empty
// box stays empty rather than becoming 0.
interface DetailsForm {
  medium: string;
  // Size is optional twice over: the switch says whether the piece has one.
  sized: boolean;
  width: string;
  height: string;
  size_unit: ArtSizeUnit;
  year_made: string;
  edition: string;
  availability: ArtAvailability;
}

const detailsFormOf = (piece?: Partial<ArtPieceDetailsJSON>): DetailsForm => ({
  medium: piece?.medium ?? '',
  sized: Boolean(piece?.width ?? piece?.height),
  width: piece?.width?.toString() ?? '',
  height: piece?.height?.toString() ?? '',
  size_unit: piece?.size_unit ?? 'cm',
  year_made: piece?.year_made?.toString() ?? '',
  edition: piece?.edition ?? '',
  availability: piece?.availability ?? 'not_for_sale',
});

const toNumber = (value: string): number | null => {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const detailsPayload = (form: DetailsForm): ArtPieceDetailsJSON => ({
  medium: form.medium.trim() || null,
  // A piece shows width × height; depth isn't asked for (@mangobee,
  // 2026-10-23), so saving clears any.
  width: form.sized ? toNumber(form.width) : null,
  height: form.sized ? toNumber(form.height) : null,
  depth: null,
  size_unit: form.size_unit,
  year_made: toNumber(form.year_made),
  edition: form.edition.trim() || null,
  availability: form.availability,
});

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
  const [details, setDetails] = useState<DetailsForm>(() =>
    detailsFormOf(editingPiece),
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
      setDetails(p.details ?? detailsFormOf());
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
        details,
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
  // One handler for every detail field, keyed by the field's name.
  const handleDetail = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setDetails((was) => ({ ...was, [name]: value }));
    },
    [],
  );

  const handleSized = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const sized = e.target.checked;
    setDetails((was) => ({ ...was, sized }));
  }, []);
  const handleUnit = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const unit = e.currentTarget.value as ArtSizeUnit;
    setDetails((was) => ({ ...was, size_unit: unit }));
  }, []);

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
            ...detailsPayload(details),
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
          ...detailsPayload(details),
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
    details,
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
      konnect={isEdit ? null : konnect}
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

        <fieldset className='art-composer__details'>
          <legend>{intl.formatMessage(messages.details)}</legend>

          <label className='art-composer__detail art-composer__detail--wide'>
            <span>{intl.formatMessage(messages.medium)}</span>
            <input
              type='text'
              name='medium'
              value={details.medium}
              onChange={handleDetail}
              placeholder={intl.formatMessage(messages.mediumPlaceholder)}
              maxLength={160}
              disabled={pending}
            />
          </label>

          <div className='art-composer__detail art-composer__detail--wide'>
            <label className='art-composer__switch'>
              <input
                type='checkbox'
                role='switch'
                checked={details.sized}
                onChange={handleSized}
                disabled={pending}
              />
              <span>{intl.formatMessage(messages.size)}</span>
            </label>
            {details.sized && (
              <div className='art-composer__size'>
                {(['width', 'height'] as const).map((dimension) => (
                  <input
                    key={dimension}
                    type='number'
                    inputMode='decimal'
                    name={dimension}
                    value={details[dimension]}
                    onChange={handleDetail}
                    min={0}
                    step='any'
                    placeholder={intl.formatMessage(messages[dimension])}
                    aria-label={intl.formatMessage(messages[dimension])}
                    disabled={pending}
                  />
                ))}
                <div
                  className='art-composer__unit'
                  role='group'
                  aria-label={intl.formatMessage(messages.unit)}
                >
                  {(['cm', 'in'] as const).map((unit) => (
                    <button
                      key={unit}
                      type='button'
                      value={unit}
                      onClick={handleUnit}
                      aria-pressed={details.size_unit === unit}
                      className={`art-composer__unit-option${details.size_unit === unit ? ' art-composer__unit-option--on' : ''}`}
                      disabled={pending}
                    >
                      {unit}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <label className='art-composer__detail'>
            <span>{intl.formatMessage(messages.yearMade)}</span>
            <input
              type='number'
              inputMode='numeric'
              name='year_made'
              value={details.year_made}
              onChange={handleDetail}
              min={1}
              max={new Date().getFullYear() + 1}
              disabled={pending}
            />
          </label>

          <label className='art-composer__detail'>
            <span>{intl.formatMessage(messages.edition)}</span>
            <input
              type='text'
              name='edition'
              value={details.edition}
              onChange={handleDetail}
              placeholder={intl.formatMessage(messages.editionPlaceholder)}
              maxLength={80}
              disabled={pending}
            />
          </label>

          <label className='art-composer__detail art-composer__detail--wide'>
            <span>{intl.formatMessage(messages.availability)}</span>
            <select
              name='availability'
              value={details.availability}
              onChange={handleDetail}
              disabled={pending}
            >
              {AVAILABILITIES.map((value) => (
                <option key={value} value={value}>
                  {intl.formatMessage(AVAILABILITY_MESSAGES[value])}
                </option>
              ))}
            </select>
          </label>
        </fieldset>

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
