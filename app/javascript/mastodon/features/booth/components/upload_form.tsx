import { useState, useCallback, useRef } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import api from 'mastodon/api';
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
});

interface Props {
  onSuccess: (set: BoothSet) => void;
  onCancel: () => void;
}

type UploadStage = 'audio' | 'cover' | 'saving' | null;

function formatEta(remainingBytes: number, speedBps: number): string {
  if (speedBps <= 0) return '';
  const secs = Math.ceil(remainingBytes / speedBps);
  if (secs < 60) return `~${secs}s`;
  const mins = Math.ceil(secs / 60);
  return `~${mins}m`;
}

function formatSize(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${Math.round(bytes / 1_000)} KB`;
}

interface UploadMediaOptions {
  onProgress: (pct: number, eta: string) => void;
}

async function uploadMedia(file: File, opts: UploadMediaOptions): Promise<string> {
  const form = new FormData();
  form.append('file', file);

  const startTime = Date.now();

  const res = await api().post<{ id: string }>('/api/v1/media', form, {
    onUploadProgress: (event) => {
      if (!event.total) return;
      const pct = Math.round((event.loaded / event.total) * 100);
      const elapsed = (Date.now() - startTime) / 1000;
      const speed = elapsed > 0 ? event.loaded / elapsed : 0;
      const eta = speed > 0 ? formatEta(event.total - event.loaded, speed) : '';
      opts.onProgress(pct, eta);
    },
  });

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
  const [stage, setStage] = useState<UploadStage>(null);
  const [uploadPct, setUploadPct] = useState(0);
  const [uploadEta, setUploadEta] = useState('');
  const [error, setError] = useState<string | null>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const stageLabel = stage === 'audio'
    ? 'Uploading audio'
    : stage === 'cover'
      ? 'Uploading cover'
      : stage === 'saving'
        ? 'Saving…'
        : '';

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!audioFile) return;

      setSubmitting(true);
      setError(null);

      try {
        setStage('audio');
        setUploadPct(0);
        const audioId = await uploadMedia(audioFile, {
          onProgress: (pct, eta) => {
            setUploadPct(pct);
            setUploadEta(eta);
          },
        });

        let coverId: string | null = null;
        if (coverFile) {
          setStage('cover');
          setUploadPct(0);
          coverId = await uploadMedia(coverFile, {
            onProgress: (pct, eta) => {
              setUploadPct(pct);
              setUploadEta(eta);
            },
          });
        }

        setStage('saving');
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
        setStage(null);
      }
    },
    [title, artistName, eventName, eventDate, genre, description, audioFile, coverFile, onSuccess],
  );

  return (
    <form className='booth-upload-form' onSubmit={(e) => void handleSubmit(e)}>
      <h3 className='booth-upload-form__heading'>Upload a set</h3>

      {error && <div className='booth-upload-form__error'>{error}</div>}

      {submitting && (
        <div className='booth-upload-form__progress-wrap'>
          <div className='booth-upload-form__progress-label'>
            <span>{stageLabel}</span>
            {stage !== 'saving' && (
              <span className='booth-upload-form__progress-stats'>
                {uploadPct}%{uploadEta ? ` · ${uploadEta} remaining` : ''}
              </span>
            )}
          </div>
          <div className='booth-upload-form__progress-track'>
            <div
              className='booth-upload-form__progress-fill'
              style={{ width: stage === 'saving' ? '100%' : `${uploadPct}%` }}
            />
          </div>
          {audioFile && stage === 'audio' && (
            <div className='booth-upload-form__progress-size'>
              {formatSize(Math.round((audioFile.size * uploadPct) / 100))} / {formatSize(audioFile.size)}
            </div>
          )}
        </div>
      )}

      {!submitting && (
        <>
          <label className='booth-upload-form__field'>
            <span>{intl.formatMessage(messages.title)} *</span>
            <input
              type='text'
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={200}
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
            />
          </label>

          <label className='booth-upload-form__field'>
            <span>{intl.formatMessage(messages.event)}</span>
            <input
              type='text'
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              maxLength={200}
            />
          </label>

          <label className='booth-upload-form__field'>
            <span>{intl.formatMessage(messages.eventDate)}</span>
            <input
              type='date'
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
            />
          </label>

          <label className='booth-upload-form__field'>
            <span>{intl.formatMessage(messages.genre)}</span>
            <input
              type='text'
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              maxLength={100}
            />
          </label>

          <label className='booth-upload-form__field'>
            <span>{intl.formatMessage(messages.description)}</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={5000}
            />
          </label>

          <label className='booth-upload-form__field'>
            <span>{intl.formatMessage(messages.audio)} *</span>
            <input
              ref={audioInputRef}
              type='file'
              accept='audio/*'
              onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)}
              required
            />
            {audioFile && (
              <span className='booth-upload-form__file-info'>
                {audioFile.name} · {formatSize(audioFile.size)}
              </span>
            )}
          </label>

          <label className='booth-upload-form__field'>
            <span>{intl.formatMessage(messages.cover)}</span>
            <input
              type='file'
              accept='image/*'
              onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
            />
          </label>

          <div className='booth-upload-form__actions'>
            <button
              type='button'
              className='booth-upload-form__cancel'
              onClick={onCancel}
            >
              {intl.formatMessage(messages.cancel)}
            </button>
            <button
              type='submit'
              className='booth-upload-form__submit'
              disabled={!title || !artistName || !audioFile}
            >
              {intl.formatMessage(messages.submit)}
            </button>
          </div>
        </>
      )}
    </form>
  );
};
