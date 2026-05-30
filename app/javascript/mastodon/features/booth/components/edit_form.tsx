import { useState, useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import api from 'mastodon/api';
import type { BoothSet } from '../types';

const messages = defineMessages({
  title: { id: 'booth.upload.title', defaultMessage: 'Title' },
  artist: { id: 'booth.upload.artist', defaultMessage: 'Artist / DJ name' },
  event: { id: 'booth.upload.event', defaultMessage: 'Event name (optional)' },
  eventDate: {
    id: 'booth.upload.event_date',
    defaultMessage: 'Event date (optional)',
  },
  genre: { id: 'booth.upload.genre', defaultMessage: 'Genre (optional)' },
  description: {
    id: 'booth.upload.description',
    defaultMessage: 'Description (optional)',
  },
  cover: {
    id: 'booth.upload.cover',
    defaultMessage: 'Cover image (optional)',
  },
  save: { id: 'booth.edit.save', defaultMessage: 'Save changes' },
  cancel: { id: 'booth.upload.cancel', defaultMessage: 'Cancel' },
  removeCover: {
    id: 'booth.edit.remove_cover',
    defaultMessage: 'Remove cover',
  },
  heading: { id: 'booth.edit.heading', defaultMessage: 'Edit set' },
});

interface Props {
  set: BoothSet;
  onSuccess: (updated: BoothSet) => void;
  onCancel: () => void;
}

async function uploadMedia(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const res = await api().post<{ id: string }>('/api/v1/media', form);
  return res.data.id;
}

export const EditForm: React.FC<Props> = ({ set, onSuccess, onCancel }) => {
  const intl = useIntl();
  const [title, setTitle] = useState(set.title);
  const [artistName, setArtistName] = useState(set.artist_name);
  const [eventName, setEventName] = useState(set.event_name ?? '');
  const [eventDate, setEventDate] = useState(set.event_date ?? '');
  const [genre, setGenre] = useState(set.genre ?? '');
  const [description, setDescription] = useState(set.description ?? '');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [removeCover, setRemoveCover] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSaving(true);
      setError(null);

      try {
        const payload: Record<string, string> = {
          title,
          artist_name: artistName,
        };
        if (eventName) payload.event_name = eventName;
        if (eventDate) payload.event_date = eventDate;
        if (genre) payload.genre = genre;
        if (description) payload.description = description;

        if (removeCover) {
          payload.remove_cover = 'true';
        } else if (coverFile) {
          payload.cover_id = await uploadMedia(coverFile);
        }

        const res = await api().patch<BoothSet>(
          `/api/v1/booth_sets/${set.id}`,
          payload,
        );
        onSuccess(res.data);
      } catch {
        setError('Could not save changes — please try again.');
        setSaving(false);
      }
    },
    [
      title,
      artistName,
      eventName,
      eventDate,
      genre,
      description,
      coverFile,
      removeCover,
      set.id,
      onSuccess,
    ],
  );

  return (
    <form
      className='booth-upload-form'
      onSubmit={(e) => void handleSubmit(e)}
    >
      <h3 className='booth-upload-form__heading'>
        {intl.formatMessage(messages.heading)}
      </h3>

      {error && <div className='booth-upload-form__error'>{error}</div>}

      <label className='booth-upload-form__field'>
        <span>{intl.formatMessage(messages.title)} *</span>
        <input
          type='text'
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={200}
          disabled={saving}
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
          disabled={saving}
        />
      </label>

      <label className='booth-upload-form__field'>
        <span>{intl.formatMessage(messages.event)}</span>
        <input
          type='text'
          value={eventName}
          onChange={(e) => setEventName(e.target.value)}
          maxLength={200}
          disabled={saving}
        />
      </label>

      <label className='booth-upload-form__field'>
        <span>{intl.formatMessage(messages.eventDate)}</span>
        <input
          type='date'
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
          disabled={saving}
        />
      </label>

      <label className='booth-upload-form__field'>
        <span>{intl.formatMessage(messages.genre)}</span>
        <input
          type='text'
          value={genre}
          onChange={(e) => setGenre(e.target.value)}
          maxLength={100}
          disabled={saving}
        />
      </label>

      <label className='booth-upload-form__field'>
        <span>{intl.formatMessage(messages.description)}</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={5000}
          disabled={saving}
        />
      </label>

      <div className='booth-upload-form__field'>
        <span>{intl.formatMessage(messages.cover)}</span>
        {set.cover_url && !removeCover && (
          <div className='booth-edit-form__current-cover'>
            <img src={set.cover_url} alt='' />
            <button
              type='button'
              className='booth-edit-form__remove-cover'
              onClick={() => setRemoveCover(true)}
              disabled={saving}
            >
              {intl.formatMessage(messages.removeCover)}
            </button>
          </div>
        )}
        <input
          type='file'
          accept='image/*'
          onChange={(e) => {
            setCoverFile(e.target.files?.[0] ?? null);
            setRemoveCover(false);
          }}
          disabled={saving}
        />
      </div>

      <div className='booth-upload-form__actions'>
        <button
          type='button'
          className='booth-upload-form__cancel'
          onClick={onCancel}
          disabled={saving}
        >
          {intl.formatMessage(messages.cancel)}
        </button>
        <button
          type='submit'
          className='booth-upload-form__submit'
          disabled={saving || !title || !artistName}
        >
          {saving ? 'Saving…' : intl.formatMessage(messages.save)}
        </button>
      </div>
    </form>
  );
};
