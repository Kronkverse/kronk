import { useCallback, useMemo, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import VideoLibraryIcon from '@/material-icons/400-24px/movie.svg?react';
import api from 'mastodon/api';
import { apiCreateFilm, apiUpdateFilm } from 'mastodon/api/cinema';
import type { ApiFilmJSON } from 'mastodon/api_types/cinema';
import { ComposeShell } from 'mastodon/components/compose_shell';
import { Icon } from 'mastodon/components/icon';
import type { ReachValue } from 'mastodon/components/reach_dropdown';
import { ReachDropdown } from 'mastodon/components/reach_dropdown';

const messages = defineMessages({
  saveError: {
    id: 'cinema.composer.save_error',
    defaultMessage: 'Could not save the film.',
  },
  postError: {
    id: 'cinema.composer.post_error',
    defaultMessage: 'Could not post the film.',
  },
  submit: { id: 'cinema.composer.submit', defaultMessage: 'Post film' },
  submitting: {
    id: 'cinema.composer.submitting',
    defaultMessage: 'Uploading…',
  },
  heading: { id: 'cinema.composer.heading', defaultMessage: 'Post a film' },
  editHeading: {
    id: 'cinema.composer.edit_heading',
    defaultMessage: 'Edit film',
  },
  save: { id: 'cinema.composer.save', defaultMessage: 'Save' },
  saving: { id: 'cinema.composer.saving', defaultMessage: 'Saving…' },
  deleteFilm: { id: 'cinema.viewer.delete', defaultMessage: 'Delete film' },
  titlePlaceholder: {
    id: 'cinema.composer.title_placeholder',
    defaultMessage: 'Title',
  },
  descriptionPlaceholder: {
    id: 'cinema.composer.description_placeholder',
    defaultMessage: 'A note about the film (optional)',
  },
  pickVideo: {
    id: 'cinema.composer.pick_video',
    defaultMessage: 'Choose an MP4',
  },
  chosenVideo: {
    id: 'cinema.composer.chosen_video',
    defaultMessage: 'Chosen: {name}',
  },
  hint: {
    id: 'cinema.composer.hint',
    defaultMessage:
      'MP4 only in v1 — the video plays back as-is with no transcoding.',
  },
});

interface MediaResponse {
  id: string;
}

interface Props {
  onCancel: () => void;
  onCreated?: (film: ApiFilmJSON) => void;
  // Edit mode: pass the film to prefill the form. Submit then saves the
  // text fields via the update endpoint (the video can't be swapped,
  // so the picker hides) and the form's foot carries Delete.
  film?: ApiFilmJSON;
  onUpdated?: (film: ApiFilmJSON) => void;
  onDelete?: () => void;
  deleting?: boolean;
}

export const FilmComposer: React.FC<Props> = ({
  onCancel,
  onCreated,
  film: editingFilm,
  onUpdated,
  onDelete,
  deleting = false,
}) => {
  const intl = useIntl();
  const isEdit = !!editingFilm;
  const [title, setTitle] = useState(editingFilm?.title ?? '');
  const [description, setDescription] = useState(
    editingFilm?.description ?? '',
  );
  const [visibility, setVisibility] = useState<ReachValue>(
    editingFilm?.visibility ?? 'public',
  );
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSubmit = useMemo(
    () =>
      title.trim().length > 0 &&
      (isEdit || videoFile !== null) &&
      !pending &&
      !deleting,
    [title, isEdit, videoFile, pending, deleting],
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

  const handlePickVideo = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelected = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] ?? null;
      setVideoFile(file);
      e.target.value = '';
    },
    [],
  );

  const submit = useCallback(() => {
    if (!canSubmit) return;
    if (editingFilm) {
      setPending(true);
      setError(null);
      void (async () => {
        try {
          const updated = await apiUpdateFilm(editingFilm.id, {
            title: title.trim(),
            description: description.trim(),
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
    if (!videoFile) return;
    setPending(true);
    setError(null);
    void (async () => {
      try {
        const form = new FormData();
        form.append('file', videoFile);
        const media = await api().post<MediaResponse>('/api/v1/media', form);
        const film = await apiCreateFilm({
          title: title.trim(),
          description: description.trim() || undefined,
          visibility,
          video_media_attachment_id: media.data.id,
        });
        onCreated?.(film);
      } catch (e) {
        setPending(false);
        setError(
          e instanceof Error
            ? e.message
            : intl.formatMessage(messages.postError),
        );
      }
    })();
  }, [
    canSubmit,
    description,
    editingFilm,
    intl,
    onCreated,
    onUpdated,
    title,
    videoFile,
    visibility,
  ]);

  return (
    <ComposeShell
      korner='cinema'
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
      <div className='cinema-composer'>
        <input
          type='text'
          className='cinema-composer__title'
          value={title}
          onChange={handleTitleChange}
          placeholder={intl.formatMessage(messages.titlePlaceholder)}
          maxLength={240}
          disabled={pending}
        />

        <textarea
          className='cinema-composer__description'
          value={description}
          onChange={handleDescriptionChange}
          placeholder={intl.formatMessage(messages.descriptionPlaceholder)}
          maxLength={4000}
          disabled={pending}
        />

        {!isEdit && (
          <>
            <p className='cinema-composer__hint'>
              {intl.formatMessage(messages.hint)}
            </p>

            <button
              type='button'
              className='cinema-composer__pick'
              onClick={handlePickVideo}
              disabled={pending}
            >
              <Icon id='movie' icon={VideoLibraryIcon} />
              {videoFile
                ? intl.formatMessage(messages.chosenVideo, {
                    name: videoFile.name,
                  })
                : intl.formatMessage(messages.pickVideo)}
            </button>
            <input
              ref={fileInputRef}
              type='file'
              accept='video/mp4'
              hidden
              onChange={handleFileSelected}
            />
          </>
        )}

        {error && <p className='cinema-composer__error'>{error}</p>}

        {isEdit && onDelete && (
          <button
            type='button'
            className='compose-shell__delete'
            onClick={onDelete}
            disabled={pending || deleting}
          >
            {intl.formatMessage(messages.deleteFilm)}
          </button>
        )}
      </div>
    </ComposeShell>
  );
};
