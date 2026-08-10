import { useState, useCallback, useMemo, useRef } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import api from 'mastodon/api';
import { DraftRestoredPill } from 'mastodon/components/draft_restored_pill';
import { useComposerDraft } from 'mastodon/hooks/useComposerDraft';

import type { BoothSet } from '../types';

import { EventCombobox } from './event_combobox';
import type { EventSelection } from './event_combobox';
import { GenreTagInput } from './genre_tag_input';

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
  audio: { id: 'booth.upload.audio', defaultMessage: 'Audio file' },
  cover: {
    id: 'booth.upload.cover',
    defaultMessage: 'Cover image (optional)',
  },
  submit: { id: 'booth.upload.submit', defaultMessage: 'Upload set' },
  cancel: { id: 'booth.upload.cancel', defaultMessage: 'Cancel' },
  cancelUpload: {
    id: 'booth.upload.cancel_upload',
    defaultMessage: 'Cancel upload',
  },
  pickAudio: {
    id: 'booth.upload.pick_audio',
    defaultMessage: 'Choose audio file',
  },
  pickCover: {
    id: 'booth.upload.pick_cover',
    defaultMessage: 'Choose cover image',
  },
  replaceFile: {
    id: 'booth.upload.replace_file',
    defaultMessage: 'Replace',
  },
});

interface Props {
  onSuccess: (set: BoothSet) => void;
  onCancel: () => void;
}

type UploadStage = 'audio' | 'cover' | 'saving' | null;

const AUDIO_LIMIT = 4 * 1024 * 1024 * 1024;
const COVER_LIMIT = 1 * 1024 * 1024 * 1024;

function formatEta(remainingBytes: number, speedBps: number): string {
  if (speedBps <= 0) return '';
  const secs = Math.ceil(remainingBytes / speedBps);
  if (secs < 60) return `~${secs}s`;
  const mins = Math.ceil(secs / 60);
  return `~${mins}m`;
}

function formatSize(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${Math.round(bytes / 1_000)} KB`;
}

interface UploadMediaOptions {
  onProgress: (pct: number, eta: string) => void;
  signal: AbortSignal;
}

async function uploadMedia(
  file: File,
  opts: UploadMediaOptions,
): Promise<string> {
  const form = new FormData();
  form.append('file', file);

  const startTime = Date.now();

  const res = await api().post<{ id: string }>('/api/v2/media', form, {
    signal: opts.signal,
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
  const [eventId, setEventId] = useState<string | null>(null);
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [genres, setGenres] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [stage, setStage] = useState<UploadStage>(null);
  const [uploadPct, setUploadPct] = useState(0);
  const [uploadEta, setUploadEta] = useState('');
  const [error, setError] = useState<string | null>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const stageRef = useRef<UploadStage>(null);

  // Draft auto-save: preserve the set metadata across an accidental
  // navigate-away / refresh (docs/rebuild/decisions.md 2026-08-10). The audio +
  // cover Files can't ride in localStorage; the text does.
  const draftSnapshot = useMemo(
    () => ({ title, artistName, description, genres }),
    [title, artistName, description, genres],
  );
  const handleRestore = useCallback(
    (d: typeof draftSnapshot) => {
      setTitle(d.title);
      setArtistName(d.artistName);
      setDescription(d.description);
      setGenres(d.genres);
    },
    // setters are stable; the closure captures nothing that changes.
    [],
  );
  const draft = useComposerDraft('booth:upload', draftSnapshot, handleRestore, {
    enabled: !submitting && (title.trim() !== '' || description.trim() !== ''),
  });
  const discardDraft = draft.discard;
  const handleDiscardDraft = useCallback(() => {
    setTitle('');
    setArtistName('');
    setDescription('');
    setGenres([]);
    discardDraft();
  }, [discardDraft]);

  const stageLabel =
    stage === 'audio'
      ? 'Uploading audio'
      : stage === 'cover'
        ? 'Uploading cover'
        : stage === 'saving'
          ? 'Saving…'
          : '';

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setTitle(e.target.value);
    },
    [],
  );

  const handleArtistChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setArtistName(e.target.value);
    },
    [],
  );

  const handleDescriptionChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setDescription(e.target.value);
    },
    [],
  );

  const handleEventLink = useCallback((data: EventSelection) => {
    setEventId(data.id);
    setEventName(data.name);
    setEventDate(data.date);
  }, []);

  const handleEventNameChange = useCallback((name: string) => {
    setEventId(null);
    setEventName(name);
  }, []);

  const handleEventClear = useCallback(() => {
    setEventId(null);
    setEventName('');
    setEventDate('');
  }, []);

  const handleEventDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setEventDate(e.target.value);
    },
    [],
  );

  const handleAudioFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] ?? null;
      if (file && file.size > AUDIO_LIMIT) {
        setAudioError(
          `File is too large (${formatSize(file.size)}). Maximum is 4 GB.`,
        );
        setAudioFile(null);
        e.target.value = '';
      } else {
        setAudioError(null);
        setAudioFile(file);
      }
    },
    [],
  );

  const handleCoverFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] ?? null;
      if (file && file.size > COVER_LIMIT) {
        setCoverError(
          `File is too large (${formatSize(file.size)}). Maximum is 1 GB.`,
        );
        setCoverFile(null);
        e.target.value = '';
      } else {
        setCoverError(null);
        setCoverFile(file);
      }
    },
    [],
  );

  const handleCancelUpload = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setSubmitting(false);
    setStage(null);
    stageRef.current = null;
    setUploadPct(0);
    setUploadEta('');
    setError(null);
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!audioFile) return;

      const controller = new AbortController();
      abortControllerRef.current = controller;

      setSubmitting(true);
      setError(null);

      void (async () => {
        try {
          const updateStage = (s: UploadStage) => {
            stageRef.current = s;
            setStage(s);
          };

          updateStage('audio');
          setUploadPct(0);
          const audioId = await uploadMedia(audioFile, {
            signal: controller.signal,
            onProgress: (pct, eta) => {
              setUploadPct(pct);
              setUploadEta(eta);
            },
          });

          let coverId: string | null = null;
          if (coverFile) {
            updateStage('cover');
            setUploadPct(0);
            coverId = await uploadMedia(coverFile, {
              signal: controller.signal,
              onProgress: (pct, eta) => {
                setUploadPct(pct);
                setUploadEta(eta);
              },
            });
          }

          updateStage('saving');
          const payload: Record<string, unknown> = {
            title,
            artist_name: artistName,
            audio_id: audioId,
            genres,
          };
          if (eventId) payload.event_id = eventId;
          if (eventName) payload.event_name = eventName;
          if (eventDate) payload.event_date = eventDate;
          if (description) payload.description = description;
          if (coverId) payload.cover_id = coverId;

          const res = await api().post<BoothSet>(
            '/api/v1/booth_sets',
            payload,
            {
              signal: controller.signal,
            },
          );
          discardDraft();
          onSuccess(res.data);
        } catch (err) {
          if ((err as { name?: string }).name === 'CanceledError') return;
          const axiosErr = err as {
            response?: { status?: number; data?: { error?: string } };
          };
          const detail = axiosErr.response?.data?.error;
          const status = axiosErr.response?.status;
          const stageName = stageRef.current ?? 'upload';
          setError(
            detail
              ? `Failed at ${stageName}: ${detail}`
              : status
                ? `Failed at ${stageName} (${status}) — please try again.`
                : `Failed at ${stageName} — please try again.`,
          );
          setSubmitting(false);
          setStage(null);
          stageRef.current = null;
        }
      })();
    },
    [
      title,
      artistName,
      eventId,
      eventName,
      eventDate,
      genres,
      description,
      audioFile,
      coverFile,
      onSuccess,
      discardDraft,
    ],
  );

  return (
    <form className='booth-upload-form' onSubmit={handleSubmit}>
      <h3 className='booth-upload-form__heading'>Upload a set</h3>
      {draft.restored && <DraftRestoredPill onDiscard={handleDiscardDraft} />}

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
              style={{
                width: stage === 'saving' ? '100%' : `${uploadPct}%`,
              }}
            />
          </div>
          {audioFile && stage === 'audio' && (
            <div className='booth-upload-form__progress-size'>
              {formatSize(Math.round((audioFile.size * uploadPct) / 100))} /{' '}
              {formatSize(audioFile.size)}
            </div>
          )}
          {stage !== 'saving' && (
            <button
              type='button'
              className='booth-upload-form__cancel-upload'
              onClick={handleCancelUpload}
            >
              {intl.formatMessage(messages.cancelUpload)}
            </button>
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
              onChange={handleTitleChange}
              required
              maxLength={200}
            />
          </label>

          <label className='booth-upload-form__field'>
            <span>{intl.formatMessage(messages.artist)} *</span>
            <input
              type='text'
              value={artistName}
              onChange={handleArtistChange}
              required
              maxLength={200}
            />
          </label>

          <div className='booth-upload-form__field'>
            <span>{intl.formatMessage(messages.event)}</span>
            <EventCombobox
              eventId={eventId}
              eventName={eventName}
              onLink={handleEventLink}
              onNameChange={handleEventNameChange}
              onClear={handleEventClear}
            />
          </div>

          {!eventId && (
            <label className='booth-upload-form__field'>
              <span>{intl.formatMessage(messages.eventDate)}</span>
              <input
                type='date'
                value={eventDate}
                onChange={handleEventDateChange}
              />
            </label>
          )}

          <div className='booth-upload-form__field'>
            <span>{intl.formatMessage(messages.genre)}</span>
            <GenreTagInput value={genres} onChange={setGenres} />
          </div>

          <label className='booth-upload-form__field'>
            <span>{intl.formatMessage(messages.description)}</span>
            <textarea
              value={description}
              onChange={handleDescriptionChange}
              rows={3}
              maxLength={5000}
            />
          </label>

          <div className='booth-upload-form__field'>
            <span>{intl.formatMessage(messages.audio)} *</span>
            <label className='booth-upload-form__file-picker'>
              <input
                ref={audioInputRef}
                type='file'
                accept='audio/*'
                onChange={handleAudioFileChange}
                required
              />
              <span className='booth-upload-form__file-picker-label'>
                {audioFile
                  ? intl.formatMessage(messages.replaceFile)
                  : intl.formatMessage(messages.pickAudio)}
              </span>
            </label>
            {audioFile && (
              <span className='booth-upload-form__file-info'>
                {audioFile.name} · {formatSize(audioFile.size)}
              </span>
            )}
            {audioError && (
              <span className='booth-upload-form__file-error'>
                {audioError}
              </span>
            )}
          </div>

          <div className='booth-upload-form__field'>
            <span>{intl.formatMessage(messages.cover)}</span>
            <label className='booth-upload-form__file-picker'>
              <input
                type='file'
                accept='image/*'
                onChange={handleCoverFileChange}
              />
              <span className='booth-upload-form__file-picker-label'>
                {coverFile
                  ? intl.formatMessage(messages.replaceFile)
                  : intl.formatMessage(messages.pickCover)}
              </span>
            </label>
            {coverFile && (
              <span className='booth-upload-form__file-info'>
                {coverFile.name} · {formatSize(coverFile.size)}
              </span>
            )}
            {coverError && (
              <span className='booth-upload-form__file-error'>
                {coverError}
              </span>
            )}
          </div>

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
