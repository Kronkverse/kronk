import { useCallback, useMemo, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import VideoLibraryIcon from '@/material-icons/400-24px/movie.svg?react';
import api from 'mastodon/api';
import { apiCreateFilm } from 'mastodon/api/cinema';
import type { ApiFilmJSON } from 'mastodon/api_types/cinema';
import { ComposeShell } from 'mastodon/components/compose_shell';
import { Icon } from 'mastodon/components/icon';
import type { ReachValue } from 'mastodon/components/reach_dropdown';
import { ReachDropdown } from 'mastodon/components/reach_dropdown';

const messages = defineMessages({
  submit: { id: 'cinema.composer.submit', defaultMessage: 'Post film' },
  submitting: {
    id: 'cinema.composer.submitting',
    defaultMessage: 'Uploading…',
  },
  heading: { id: 'cinema.composer.heading', defaultMessage: 'Post a film' },
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
  onCreated: (film: ApiFilmJSON) => void;
}

export const FilmComposer: React.FC<Props> = ({ onCancel, onCreated }) => {
  const intl = useIntl();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<ReachValue>('public');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSubmit = useMemo(
    () => title.trim().length > 0 && videoFile !== null && !pending,
    [title, videoFile, pending],
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
    if (!canSubmit || !videoFile) return;
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
        onCreated(film);
      } catch (e) {
        setPending(false);
        setError(e instanceof Error ? e.message : 'Could not post the film.');
      }
    })();
  }, [canSubmit, description, onCreated, title, videoFile, visibility]);

  return (
    <ComposeShell
      korner='cinema'
      label={intl.formatMessage(messages.heading)}
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
            ? intl.formatMessage(messages.chosenVideo, { name: videoFile.name })
            : intl.formatMessage(messages.pickVideo)}
        </button>
        <input
          ref={fileInputRef}
          type='file'
          accept='video/mp4'
          hidden
          onChange={handleFileSelected}
        />

        {error && <p className='cinema-composer__error'>{error}</p>}
      </div>
    </ComposeShell>
  );
};
