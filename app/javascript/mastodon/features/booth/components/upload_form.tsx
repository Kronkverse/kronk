import { useState, useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { api } from 'mastodon/api';
import type { BoothSet } from '../types';

const messages = defineMessages({
  title: { id: 'booth.upload.title', defaultMessage: 'Title' },
  artist: { id: 'booth.upload.artist', defaultMessage: 'Artist / DJ name' },
  event: { id: 'booth.upload.event', defaultMessage: 'Event name (optional)' },
  eventDate: { id: 'booth.upload.event_date', defaultMessage: 'Event date (optional)' },
  genre: { id: 'booth.upload.genre', defaultMessage: 'Genre (optional)' },
  description: { id: 'booth.upload.description', defaultMessage: 'Description (optional)' },
  audio: { id: 'booth.upload.audio', defaultMessage: 'Audio file' },
  cover: { id: 'booth.upload.cover', defaultMessage: 'Cover image (optional)' },
  submit: { id: 'booth.upload.submit', defaultMessage: 'Upload set' },
  cancel: { id: 'booth.upload.cancel', defaultMessage: 'Cancel' },
  uploading: { id: 'booth.upload.uploading', defaultMessage: 'Uploading…' },
});

interface Props {
  onSuccess: (set: BoothSet) => void;
  onCancel: () => void;
}

async function uploadMedia(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const res = await api().post<{ id: string }>('/api/v1/media', form);
  return res.data.id;
}

export const UploadForm: React.FC<Props> = ({ onSuccess, onCancel }) => {
  const intl = useIntl();
  const [title, setTitle] = useState('');
  const [artistName, setArtistName] = useState('');
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [genre, setGenre] = useState('');
  const [description, setDescription] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!audioFile) return;

      setSubmitting(true);
      setError(null);

      try {
        const audioId = await uploadMedia(audioFile);
        const coverId = coverFile ? await uploadMedia(coverFile) : null;

        const payload: Record<string, string> = {
          title,
          artist_name: artistName,
          audio_id: audioId,
        };
        if (eventName) payload.event_name = eventName;
        if (eventDate) payload.event_date = eventDate;
        if (genre) payload.genre = genre;
        if (description) payload.description = description;
        if (coverId) payload.cover_id = coverId;

        const res = await api().post<BoothSet>('/api/v1/booth_sets', payload);
        onSuccess(res.data);
      } catch {
        setError('Upload failed — please try again.');
        setSubmitting(false);
      }
    },
    [title, artistName, eventName, eventDate, genre, description, audioFile, coverFile, onSuccess],
  );

  return (
    <form className='booth-upload-form' onSubmit={(e) => void handleSubmit(e)}>
      <h3 className='booth-upload-form__heading'>Upload a set</h3>

      {error && <div className='booth-upload-form__error'>{error}</div>}

      <label className='booth-upload-form__field'>
        <span>{intl.formatMessage(messages.title)} *</span>
        <input
          type='text'
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={200}
          disabled={submitting}
        />
      </label>

      <label className='booth-upload-form__field'>
        <span>{intl.formatMessage(messages.artist)} *</span>
        <input
          type='text'
          value={artistName}
          onChange={(e) => setArtistName(e.target.value)}
          required
          maxLength={200}
          disabled={submitting}
        />
      </label>

      <label className='booth-upload-form__field'>
        <span>{intl.formatMessage(messages.event)}</span>
        <input
          type='text'
          value={eventName}
          onChange={(e) => setEventName(e.target.value)}
          maxLength={200}
          disabled={submitting}
        />
      </label>

      <label className='booth-upload-form__field'>
        <span>{intl.formatMessage(messages.eventDate)}</span>
        <input
          type='date'
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
          disabled={submitting}
        />
      </label>

      <label className='booth-upload-form__field'>
        <span>{intl.formatMessage(messages.genre)}</span>
        <input
          type='text'
          value={genre}
          onChange={(e) => setGenre(e.target.value)}
          maxLength={100}
          disabled={submitting}
        />
      </label>

      <label className='booth-upload-form__field'>
        <span>{intl.formatMessage(messages.description)}</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={5000}
          disabled={submitting}
        />
      </label>

      <label className='booth-upload-form__field'>
        <span>{intl.formatMessage(messages.audio)} *</span>
        <input
          type='file'
          accept='audio/*'
          onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)}
          required
          disabled={submitting}
        />
      </label>

      <label className='booth-upload-form__field'>
        <span>{intl.formatMessage(messages.cover)}</span>
        <input
          type='file'
          accept='image/*'
          onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
          disabled={submitting}
        />
      </label>

      <div className='booth-upload-form__actions'>
        <button
          type='button'
          className='booth-upload-form__cancel'
          onClick={onCancel}
          disabled={submitting}
        >
          {intl.formatMessage(messages.cancel)}
        </button>
        <button
          type='submit'
          className='booth-upload-form__submit'
          disabled={submitting || !title || !artistName || !audioFile}
        >
          {submitting
            ? intl.formatMessage(messages.uploading)
            : intl.formatMessage(messages.submit)}
        </button>
      </div>
    </form>
  );
};
