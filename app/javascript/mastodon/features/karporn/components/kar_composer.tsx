import { useCallback, useMemo, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import AddPhotoAlternateIcon from '@/material-icons/400-24px/add_photo_alternate.svg?react';
import api from 'mastodon/api';
import { apiAddPhoto, apiCreateKar, apiUpdateKar } from 'mastodon/api/karporn';
import type { ApiComposerDraftJSON } from 'mastodon/api_types/drafts';
import type { ApiKarJSON } from 'mastodon/api_types/karporn';
import {
  ComposeBody,
  ComposeField,
  ComposeHint,
  ComposeInput,
  ComposeRow,
  ComposeTitle,
} from 'mastodon/components/compose_fields';
import { ComposeShell } from 'mastodon/components/compose_shell';
import { Icon } from 'mastodon/components/icon';
import type { ReachValue } from 'mastodon/components/reach_dropdown';
import { ReachDropdown } from 'mastodon/components/reach_dropdown';
import { useDraft } from 'mastodon/hooks/useDraft';
import type { KonnectTarget } from 'mastodon/hooks/useKonnect';
import { useKonnect } from 'mastodon/hooks/useKonnect';

const messages = defineMessages({
  removePhoto: {
    id: 'karporn.composer.remove_photo',
    defaultMessage: 'Remove photo',
  },
  saveError: {
    id: 'karporn.composer.save_error',
    defaultMessage: 'Could not save the car.',
  },
  postError: {
    id: 'karporn.composer.post_error',
    defaultMessage: 'Could not post the car.',
  },
  submit: { id: 'karporn.composer.submit', defaultMessage: 'Post car' },
  submitting: { id: 'karporn.composer.submitting', defaultMessage: 'Posting…' },
  heading: { id: 'karporn.composer.heading', defaultMessage: 'Post a car' },
  editHeading: {
    id: 'karporn.composer.edit_heading',
    defaultMessage: 'Edit car',
  },
  save: { id: 'karporn.composer.save', defaultMessage: 'Save' },
  saving: { id: 'karporn.composer.saving', defaultMessage: 'Saving…' },
  deleteKar: { id: 'karporn.viewer.delete', defaultMessage: 'Delete post' },
  titlePlaceholder: {
    id: 'karporn.composer.title_placeholder',
    defaultMessage: 'Title',
  },
  descriptionPlaceholder: {
    id: 'karporn.composer.description_placeholder',
    defaultMessage: 'A note about the car (optional)',
  },
  year: { id: 'karporn.composer.year', defaultMessage: 'Year' },
  make: { id: 'karporn.composer.make', defaultMessage: 'Make' },
  model: { id: 'karporn.composer.model', defaultMessage: 'Model' },
  addPhotos: {
    id: 'karporn.composer.add_photos',
    defaultMessage: 'Add photos',
  },
  photosHint: {
    id: 'karporn.composer.photos_hint',
    defaultMessage: 'Add photos of the car — the first one becomes the cover.',
  },
  uploading: {
    id: 'karporn.composer.uploading',
    defaultMessage: '{done} of {total} uploaded',
  },
  failed: {
    id: 'karporn.composer.failed',
    defaultMessage:
      "Car saved, but {count, plural, one {# photo} other {# photos}} didn't upload. Try again from the car's page.",
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

// What a car draft keeps (docs/design.md, Drafts). Photos aren't kept:
// they upload only once the car is posted, so until then they are files
// on this device, not uploads a draft can point at.
interface KarDraftParams {
  title?: string;
  description?: string;
  year?: string;
  make?: string;
  model?: string;
  visibility?: ReachValue;
  konnections?: KonnectTarget[];
}

interface Props {
  onCancel: () => void;
  onCreated?: (kar: ApiKarJSON) => void;
  // Edit mode: pass the car to prefill the form. Submit then saves the
  // text fields via the update endpoint (photos are managed
  // separately, so the photo picker hides) and the form's foot carries
  // Delete.
  kar?: ApiKarJSON;
  onUpdated?: (kar: ApiKarJSON) => void;
  onDelete?: () => void;
  deleting?: boolean;
}

const CURRENT_YEAR = new Date().getFullYear();

export const KarComposer: React.FC<Props> = ({
  onCancel,
  onCreated,
  kar: editingKar,
  onUpdated,
  onDelete,
  deleting = false,
}) => {
  const intl = useIntl();
  const isEdit = !!editingKar;
  const [title, setTitle] = useState(editingKar?.title ?? '');
  const [description, setDescription] = useState(editingKar?.description ?? '');
  const [year, setYear] = useState<string>(
    String(editingKar?.year ?? CURRENT_YEAR),
  );
  const [make, setMake] = useState(editingKar?.make ?? '');
  const [model, setModel] = useState(editingKar?.model ?? '');
  const [visibility, setVisibility] = useState<ReachValue>(
    editingKar?.visibility ?? 'public',
  );
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  const [pending, setPending] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [failedCount, setFailedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // What the new car will be Konnected to (decisions.md, 2026-10-23).
  const konnect = useKonnect('karporn');
  const restoreKonnect = konnect.restore;
  const commitKonnect = konnect.commit;

  // Drafts: what you've written is saved as you go, here and on the
  // server, and comes back when the composer opens again. Editing a car
  // already posted keeps no draft.
  const applyDraft = useCallback(
    (d: ApiComposerDraftJSON<KarDraftParams> | null) => {
      const p = d?.params ?? {};
      setTitle(p.title ?? '');
      setDescription(p.description ?? '');
      setYear(p.year ?? String(CURRENT_YEAR));
      setMake(p.make ?? '');
      setModel(p.model ?? '');
      setVisibility(p.visibility ?? 'public');
      restoreKonnect(p.konnections);
      setPhotos((prev) => {
        prev.forEach((ph) => {
          URL.revokeObjectURL(ph.preview);
        });
        return [];
      });
      setError(null);
    },
    [restoreKonnect],
  );

  const draft = useDraft<KarDraftParams>({
    korner: 'karporn',
    kind: 'kar',
    snapshot: {
      params: {
        title,
        description,
        year,
        make,
        model,
        visibility,
        konnections: konnect.saved,
      },
    },
    hasContent:
      title.trim() !== '' ||
      description.trim() !== '' ||
      make.trim() !== '' ||
      model.trim() !== '',
    apply: applyDraft,
    describe: (d) => d.params.title,
    active: !isEdit,
    paused: pending,
  });

  const finishDraft = draft.finish;

  const canSubmit = useMemo(() => {
    if (pending || deleting) return false;
    if (title.trim() === '') return false;
    if (make.trim() === '') return false;
    if (model.trim() === '') return false;
    const y = Number.parseInt(year, 10);
    if (Number.isNaN(y) || y < 1885 || y > CURRENT_YEAR + 2) return false;
    return true;
  }, [title, make, model, year, pending, deleting]);

  const handleTitle = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  }, []);
  const handleDescription = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setDescription(e.target.value);
    },
    [],
  );
  const handleYear = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setYear(e.target.value);
  }, []);
  const handleMake = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setMake(e.target.value);
  }, []);
  const handleModel = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setModel(e.target.value);
  }, []);
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

    if (editingKar) {
      void (async () => {
        try {
          const updated = await apiUpdateKar(editingKar.id, {
            title: title.trim(),
            description: description.trim(),
            year: Number.parseInt(year, 10),
            make: make.trim(),
            model: model.trim(),
          });
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

    setFailedCount(0);
    setUploadProgress(
      photos.length > 0 ? { done: 0, total: photos.length } : null,
    );

    void (async () => {
      let kar: ApiKarJSON;
      try {
        kar = await apiCreateKar({
          title: title.trim(),
          description: description.trim() || undefined,
          year: Number.parseInt(year, 10),
          make: make.trim(),
          model: model.trim(),
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

      await commitKonnect('karporn', kar.id);

      let done = 0;
      let failed = 0;
      for (let i = 0; i < photos.length; i += 1) {
        const draft = photos[i];
        if (!draft) continue;
        try {
          const form = new FormData();
          form.append('file', draft.file);
          const media = await api().post<MediaResponse>('/api/v1/media', form);
          await apiAddPhoto(kar.id, { media_id: media.data.id, position: i });
          done += 1;
        } catch {
          failed += 1;
        }
        setUploadProgress({ done: done + failed, total: photos.length });
      }
      setFailedCount(failed);
      finishDraft();
      onCreated?.(kar);
    })();
  }, [
    canSubmit,
    commitKonnect,
    description,
    editingKar,
    finishDraft,
    intl,
    make,
    model,
    onCreated,
    onUpdated,
    photos,
    title,
    visibility,
    year,
  ]);

  return (
    <ComposeShell
      korner='karporn'
      label={intl.formatMessage(
        isEdit ? messages.editHeading : messages.heading,
      )}
      onCancel={onCancel}
      onSubmit={submit}
      submitLabel={intl.formatMessage(isEdit ? messages.save : messages.submit)}
      submittingLabel={intl.formatMessage(
        isEdit ? messages.saving : messages.submitting,
      )}
      submitting={pending}
      canSubmit={canSubmit}
      draft={draft}
      konnect={isEdit ? null : konnect}
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
      <ComposeTitle
        value={title}
        onChange={handleTitle}
        placeholder={intl.formatMessage(messages.titlePlaceholder)}
        maxLength={240}
        disabled={pending}
      />

      <ComposeBody
        value={description}
        onChange={handleDescription}
        placeholder={intl.formatMessage(messages.descriptionPlaceholder)}
        maxLength={4000}
        disabled={pending}
      />

      <ComposeRow>
        <ComposeField label={intl.formatMessage(messages.year)}>
          <ComposeInput
            type='number'
            value={year}
            onChange={handleYear}
            min={1885}
            max={CURRENT_YEAR + 2}
            step={1}
            disabled={pending}
          />
        </ComposeField>
        <ComposeField label={intl.formatMessage(messages.make)}>
          <ComposeInput
            value={make}
            onChange={handleMake}
            maxLength={120}
            disabled={pending}
          />
        </ComposeField>
        <ComposeField label={intl.formatMessage(messages.model)}>
          <ComposeInput
            value={model}
            onChange={handleModel}
            maxLength={120}
            disabled={pending}
          />
        </ComposeField>
      </ComposeRow>

      {!isEdit && (
        <ComposeHint>{intl.formatMessage(messages.photosHint)}</ComposeHint>
      )}

      {photos.length > 0 && (
        <ul className='karporn-composer__photos'>
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

      {!isEdit && (
        <>
          <button
            type='button'
            className='karporn-composer__add-photos'
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
        </>
      )}

      {uploadProgress && uploadProgress.total > 0 && (
        <ComposeHint>
          {intl.formatMessage(messages.uploading, uploadProgress)}
        </ComposeHint>
      )}
      {failedCount > 0 && (
        <ComposeHint error>
          {intl.formatMessage(messages.failed, { count: failedCount })}
        </ComposeHint>
      )}
      {error && <ComposeHint error>{error}</ComposeHint>}

      {isEdit && onDelete && (
        <button
          type='button'
          className='compose-shell__delete'
          onClick={onDelete}
          disabled={pending || deleting}
        >
          {intl.formatMessage(messages.deleteKar)}
        </button>
      )}
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
  const intl = useIntl();
  const handleClick = useCallback(() => {
    onRemove(draft.key);
  }, [onRemove, draft.key]);

  return (
    <li className='karporn-composer__photo'>
      <img src={draft.preview} alt='' />
      <button
        type='button'
        className='karporn-composer__photo-remove'
        onClick={handleClick}
        disabled={disabled}
        aria-label={intl.formatMessage(messages.removePhoto)}
      >
        ×
      </button>
    </li>
  );
};
