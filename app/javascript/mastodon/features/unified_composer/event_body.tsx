import { useCallback, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { useHistory } from 'react-router-dom';

import api from 'mastodon/api';
import { KornerVisibilityPicker } from 'mastodon/components/korner_visibility_picker';

// Minimal event body for the UnifiedComposer's [Event] tab. Fast-post
// only — title + when + short description + visibility. Users who
// want the full event composer (location pin, image cover, RSVP
// toggles, invitees, Konnect'd korners, recurrence) still reach
// /hub/kalendar/composer directly. This body covers ~80% of
// day-to-day event posting; the direct route covers the last 20%.

const messages = defineMessages({
  title: {
    id: 'unified_composer.event.title_label',
    defaultMessage: 'What',
  },
  titlePlaceholder: {
    id: 'unified_composer.event.title_placeholder',
    defaultMessage: 'Give it a name',
  },
  startLabel: {
    id: 'unified_composer.event.start_label',
    defaultMessage: 'Starts',
  },
  endLabel: {
    id: 'unified_composer.event.end_label',
    defaultMessage: 'Ends (optional)',
  },
  descriptionLabel: {
    id: 'unified_composer.event.description_label',
    defaultMessage: 'Description',
  },
  descriptionPlaceholder: {
    id: 'unified_composer.event.description_placeholder',
    defaultMessage: 'What is it? Who is it for?',
  },
  visibilityLabel: {
    id: 'unified_composer.event.visibility_label',
    defaultMessage: 'Who sees it?',
  },
  submit: {
    id: 'unified_composer.event.submit',
    defaultMessage: 'Post event',
  },
  submitting: {
    id: 'unified_composer.event.submitting',
    defaultMessage: 'Posting…',
  },
  advanced: {
    id: 'unified_composer.event.advanced',
    defaultMessage: 'Full event composer →',
  },
});

interface CreatedEvent {
  id: string;
  slug?: string;
}

export const UnifiedComposerEventBody: React.FC = () => {
  const intl = useIntl();
  const history = useHistory();
  const [title, setTitle] = useState('');
  const [startLocal, setStartLocal] = useState('');
  const [endLocal, setEndLocal] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    !submitting && title.trim().length > 0 && startLocal.length > 0;

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setTitle(e.target.value);
    },
    [],
  );
  const handleStartChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setStartLocal(e.target.value);
    },
    [],
  );
  const handleEndChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setEndLocal(e.target.value);
    },
    [],
  );
  const handleDescriptionChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setDescription(e.target.value);
    },
    [],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!canSubmit) return;
      setSubmitting(true);
      setError(null);
      // datetime-local returns a naive local string. Convert to ISO by
      // asking the JS Date to serialise — good enough for the server
      // to store as UTC; the composer at /hub/kalendar/composer has a
      // proper timezone picker for events that need one.
      const startIso = new Date(startLocal).toISOString();
      const endIso = endLocal ? new Date(endLocal).toISOString() : undefined;
      const payload = {
        title: title.trim(),
        start_time: startIso,
        end_time: endIso,
        description: description.trim() || undefined,
        visibility,
      };
      void api()
        .post<CreatedEvent>('/api/v1/events', payload)
        .then((res) => {
          history.push(`/kalendar/${res.data.slug ?? res.data.id}`);
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : 'Failed to post event');
          setSubmitting(false);
        });
    },
    [canSubmit, title, startLocal, endLocal, description, visibility, history],
  );

  return (
    <form className='unified-composer__event' onSubmit={handleSubmit}>
      <label className='unified-composer__field'>
        <span className='unified-composer__field-label'>
          {intl.formatMessage(messages.title)}
        </span>
        <input
          type='text'
          className='unified-composer__input'
          value={title}
          onChange={handleTitleChange}
          placeholder={intl.formatMessage(messages.titlePlaceholder)}
          maxLength={200}
          required
          disabled={submitting}
        />
      </label>

      <div className='unified-composer__field-row'>
        <label className='unified-composer__field'>
          <span className='unified-composer__field-label'>
            {intl.formatMessage(messages.startLabel)}
          </span>
          <input
            type='datetime-local'
            className='unified-composer__input'
            value={startLocal}
            onChange={handleStartChange}
            required
            disabled={submitting}
          />
        </label>
        <label className='unified-composer__field'>
          <span className='unified-composer__field-label'>
            {intl.formatMessage(messages.endLabel)}
          </span>
          <input
            type='datetime-local'
            className='unified-composer__input'
            value={endLocal}
            onChange={handleEndChange}
            disabled={submitting}
          />
        </label>
      </div>

      <label className='unified-composer__field'>
        <span className='unified-composer__field-label'>
          {intl.formatMessage(messages.descriptionLabel)}
        </span>
        <textarea
          className='unified-composer__textarea'
          value={description}
          onChange={handleDescriptionChange}
          placeholder={intl.formatMessage(messages.descriptionPlaceholder)}
          rows={4}
          maxLength={5000}
          disabled={submitting}
        />
      </label>

      <div className='unified-composer__field'>
        <span className='unified-composer__field-label'>
          {intl.formatMessage(messages.visibilityLabel)}
        </span>
        <KornerVisibilityPicker
          slug='kalendar'
          value={visibility}
          onChange={setVisibility}
          disabled={submitting}
        />
      </div>

      {error && <p className='unified-composer__error'>{error}</p>}

      <div className='unified-composer__actions'>
        <button
          type='submit'
          className='unified-composer__submit'
          disabled={!canSubmit}
        >
          {submitting
            ? intl.formatMessage(messages.submitting)
            : intl.formatMessage(messages.submit)}
        </button>
        <a className='unified-composer__advanced' href='/hub/kalendar/composer'>
          {intl.formatMessage(messages.advanced)}
        </a>
      </div>
    </form>
  );
};
