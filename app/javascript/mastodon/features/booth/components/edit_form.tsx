import { useState, useCallback, useEffect } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import api from 'mastodon/api';
import {
  ComposeBody,
  ComposeField,
  ComposeHint,
  ComposeInput,
  ComposeTextarea,
  ComposeTitle,
} from 'mastodon/components/compose_fields';
import { ComposeShell } from 'mastodon/components/compose_shell';

import type { BoothSet } from '../types';

import { CoverPositionEditor } from './cover_position_editor';
import { CreditsField, creditsPayload } from './credits_field';
import type { CreditDraft } from './credits_field';
import { GenreTagInput } from './genre_tag_input';
import { KindSelect } from './kind_select';

const messages = defineMessages({
  title: { id: 'booth.upload.title', defaultMessage: 'Title' },
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
  tracklist: {
    id: 'booth.upload.tracklist',
    defaultMessage: 'Track list (optional)',
  },
  tracklistHint: {
    id: 'booth.upload.tracklist_hint',
    defaultMessage:
      'One track per line, e.g. "12:34 Artist - Title". Times are optional.',
  },
  cover: {
    id: 'booth.upload.cover',
    defaultMessage: 'Cover image (optional)',
  },
  save: { id: 'booth.edit.save', defaultMessage: 'Save changes' },
  saving: { id: 'booth.edit.saving', defaultMessage: 'Saving…' },
  error: {
    id: 'booth.edit.error',
    defaultMessage: 'Could not save changes — please try again.',
  },
  removeCover: {
    id: 'booth.edit.remove_cover',
    defaultMessage: 'Remove cover',
  },
  heading: { id: 'booth.edit.heading', defaultMessage: 'Edit set' },
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
  set: BoothSet;
  onSuccess: (updated: BoothSet) => void;
  onCancel: () => void;
}

const COVER_LIMIT = 1 * 1024 * 1024 * 1024;

function formatSize(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${Math.round(bytes / 1_000)} KB`;
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
  // Everyone credited besides the uploader. A set from before credits has
  // none, whatever its old typed artist line says; saving here rebuilds the
  // line from the uploader and these.
  const [credits, setCredits] = useState<CreditDraft[]>(() =>
    set.artists
      .filter((artist) => !artist.uploader)
      .map((artist) => ({ account: artist.account, name: artist.name })),
  );
  // event_id retired 2026-08-15 (Phase 5b). Free-text event_name +
  // event_date stay as context. Real linking happens via
  // <AttachmentPicker> from the event side.
  const [eventName, setEventName] = useState(set.event_name ?? '');
  const [eventDate, setEventDate] = useState(set.event_date ?? '');
  const [genres, setGenres] = useState<string[]>(set.genres);
  const [kind, setKind] = useState(set.kind);
  const [description, setDescription] = useState(set.description);
  const [tracklistText, setTracklistText] = useState(set.tracklist_text ?? '');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  // Free the picked image's blob when it's replaced or the form closes.
  useEffect(
    () => () => {
      if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
    },
    [coverPreviewUrl],
  );
  const [coverError, setCoverError] = useState<string | null>(null);
  const [removeCover, setRemoveCover] = useState(false);
  const [coverOffsetY, setCoverOffsetY] = useState(set.cover_offset_y ?? 50);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleTracklistChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setTracklistText(e.target.value);
    },
    [],
  );

  const handleEventNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setEventName(e.target.value);
    },
    [],
  );

  const handleEventDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setEventDate(e.target.value);
    },
    [],
  );

  const handleRemoveCoverClick = useCallback(() => {
    setRemoveCover(true);
  }, []);

  const handleCoverFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] ?? null;
      if (file && file.size > COVER_LIMIT) {
        setCoverError(
          `File is too large (${formatSize(file.size)}). Maximum is 1 GB.`,
        );
        setCoverFile(null);
        setCoverPreviewUrl(null);
        e.target.value = '';
      } else {
        setCoverError(null);
        setCoverFile(file);
        setRemoveCover(false);
        setCoverPreviewUrl(file ? URL.createObjectURL(file) : null);
      }
    },
    [],
  );

  const handleSubmit = useCallback(() => {
    setSaving(true);
    setError(null);

    void (async () => {
      try {
        const payload: Record<string, unknown> = {
          title,
          collaborators: creditsPayload(credits),
          genres,
          kind,
          cover_offset_y: coverOffsetY,
          event_name: eventName,
          event_date: eventDate,
          // Always sent, so clearing the box clears the list.
          tracklist_text: tracklistText,
        };
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
        setError(intl.formatMessage(messages.error));
        setSaving(false);
      }
    })();
  }, [
    intl,
    title,
    credits,
    eventName,
    eventDate,
    genres,
    kind,
    description,
    tracklistText,
    coverFile,
    coverOffsetY,
    removeCover,
    set.id,
    onSuccess,
  ]);

  return (
    <ComposeShell
      konnect={null}
      korner='booth'
      label={intl.formatMessage(messages.heading)}
      submitLabel={intl.formatMessage(messages.save)}
      submittingLabel={intl.formatMessage(messages.saving)}
      submitting={saving}
      canSubmit={title.trim() !== ''}
      onSubmit={handleSubmit}
      onCancel={onCancel}
    >
      {error && <ComposeHint error>{error}</ComposeHint>}

      <ComposeTitle
        value={title}
        onChange={handleTitleChange}
        placeholder={intl.formatMessage(messages.title)}
        aria-label={intl.formatMessage(messages.title)}
        required
        maxLength={200}
        disabled={saving}
      />

      <CreditsField value={credits} onChange={setCredits} disabled={saving} />

      <KindSelect value={kind} onChange={setKind} disabled={saving} />

      <ComposeField label={intl.formatMessage(messages.event)}>
        <ComposeInput
          value={eventName}
          onChange={handleEventNameChange}
          maxLength={200}
          disabled={saving}
        />
      </ComposeField>

      <ComposeField label={intl.formatMessage(messages.eventDate)}>
        <ComposeInput
          type='date'
          value={eventDate}
          onChange={handleEventDateChange}
          disabled={saving}
        />
      </ComposeField>

      {/* A tag picker (chips and suggestion buttons), not one control, so
          it isn't wrapped in <ComposeField>'s <label>. */}
      <div className='booth-upload-form__field'>
        <span>{intl.formatMessage(messages.genre)}</span>
        <GenreTagInput value={genres} onChange={setGenres} disabled={saving} />
      </div>

      <ComposeBody
        value={description}
        onChange={handleDescriptionChange}
        placeholder={intl.formatMessage(messages.description)}
        aria-label={intl.formatMessage(messages.description)}
        rows={3}
        maxLength={5000}
        disabled={saving}
      />

      <ComposeField
        label={intl.formatMessage(messages.tracklist)}
        hint={intl.formatMessage(messages.tracklistHint)}
      >
        <ComposeTextarea
          value={tracklistText}
          onChange={handleTracklistChange}
          rows={6}
          disabled={saving}
        />
      </ComposeField>

      {/* The cover: a position editor and a file picker, not a kit field. */}
      <div className='booth-upload-form__field'>
        <span>{intl.formatMessage(messages.cover)}</span>

        {(coverPreviewUrl ?? (set.cover_url && !removeCover)) && (
          <CoverPositionEditor
            coverUrl={coverPreviewUrl ?? set.cover_url ?? ''}
            offsetY={coverOffsetY}
            onChange={setCoverOffsetY}
            disabled={saving}
          />
        )}

        {set.cover_url && !removeCover && !coverPreviewUrl && (
          <button
            type='button'
            className='booth-edit-form__remove-cover'
            onClick={handleRemoveCoverClick}
            disabled={saving}
          >
            {intl.formatMessage(messages.removeCover)}
          </button>
        )}

        <label className='booth-upload-form__file-picker'>
          <input
            type='file'
            accept='image/*'
            onChange={handleCoverFileChange}
            disabled={saving}
          />
          <span className='booth-upload-form__file-picker-label'>
            {coverPreviewUrl
              ? intl.formatMessage(messages.replaceFile)
              : intl.formatMessage(messages.pickCover)}
          </span>
        </label>
        {coverError && (
          <span className='booth-upload-form__file-error'>{coverError}</span>
        )}
      </div>
    </ComposeShell>
  );
};
