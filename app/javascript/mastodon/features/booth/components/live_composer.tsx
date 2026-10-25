import { useCallback, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import api from 'mastodon/api';
import {
  ComposeBody,
  ComposeCheck,
  ComposeField,
  ComposeHint,
  ComposeInput,
  ComposeRow,
  ComposeSection,
  ComposeTitle,
} from 'mastodon/components/compose_fields';
import { ComposeShell } from 'mastodon/components/compose_shell';
import { ReachDropdown } from 'mastodon/components/reach_dropdown';
import type { ReachValue } from 'mastodon/components/reach_dropdown';

import type { BoothLive } from '../types';

import { ComposerSwitch } from './composer_switch';
import { GenreTagInput } from './genre_tag_input';

// Go live, or schedule a live set for later (docs/spaces/booth.md, Live
// sets). "Now" doesn't go live from here: it opens the room with the
// host's get-ready panel, so the set is only "live" once the musician is
// actually in and sounding right. "Later" schedules it, and can tell
// the feed straight away.

const messages = defineMessages({
  label: { id: 'booth.live.composer', defaultMessage: 'Go live' },
  title: { id: 'booth.live.title', defaultMessage: 'Title' },
  titlePlaceholder: {
    id: 'booth.live.title_placeholder',
    defaultMessage: 'Friday night warm-up',
  },
  when: { id: 'booth.live.when', defaultMessage: 'When' },
  now: { id: 'booth.live.now', defaultMessage: 'Now' },
  later: { id: 'booth.live.later', defaultMessage: 'Later' },
  startsAt: { id: 'booth.live.starts_at', defaultMessage: 'Start time' },
  genre: { id: 'booth.upload.genre', defaultMessage: 'Genre (optional)' },
  description: {
    id: 'booth.live.description',
    defaultMessage: 'What you’ll be playing (optional)',
  },
  tellFeed: { id: 'booth.live.tell_feed', defaultMessage: 'Tell my feed' },
  tellFeedNow: {
    id: 'booth.live.tell_feed_now',
    defaultMessage: 'Posts “Live now” with a link when you go live.',
  },
  tellFeedLater: {
    id: 'booth.live.tell_feed_later',
    defaultMessage: 'Posts that you’re playing, with a link to the room.',
  },
  submitNow: { id: 'booth.live.submit_now', defaultMessage: 'Get ready' },
  submitLater: { id: 'booth.live.submit_later', defaultMessage: 'Schedule' },
  submitting: { id: 'booth.live.submitting', defaultMessage: 'Setting up…' },
  pastTime: {
    id: 'booth.live.past_time',
    defaultMessage: 'Pick a time that hasn’t happened yet.',
  },
  error: {
    id: 'booth.live.error',
    defaultMessage: 'Could not set up the live set. Try again.',
  },
});

// `datetime-local` wants local time with no zone: "2026-10-17T20:00".
function inAnHour(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
}

export interface LiveCreated {
  live: BoothLive;
  // For "now": the reach to post "Live now" at once the host goes live.
  announce: ReachValue | null;
}

interface Props {
  onCreated: (result: LiveCreated) => void;
  onCancel: () => void;
}

export const LiveComposer: React.FC<Props> = ({ onCreated, onCancel }) => {
  const intl = useIntl();
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState<'now' | 'later'>('now');
  const [startsAt, setStartsAt] = useState(inAnHour);
  const [genres, setGenres] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [tellFeed, setTellFeed] = useState(true);
  const [reach, setReach] = useState<ReachValue>('public');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTitle = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  }, []);
  const handleWhen = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setWhen(e.target.value === 'later' ? 'later' : 'now');
    setError(null);
  }, []);
  const handleStartsAt = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setStartsAt(e.target.value);
      setError(null);
    },
    [],
  );
  const handleDescription = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setDescription(e.target.value);
    },
    [],
  );
  const handleTellFeed = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setTellFeed(e.target.checked);
    },
    [],
  );

  const handleSubmit = useCallback(() => {
    const later = when === 'later';
    const start = later ? new Date(startsAt) : null;
    if (start && (Number.isNaN(start.getTime()) || start <= new Date())) {
      setError(intl.formatMessage(messages.pastTime));
      return;
    }
    setSubmitting(true);
    setError(null);

    void (async () => {
      try {
        const res = await api().post<BoothLive>('/api/v1/booth_lives', {
          title: title.trim(),
          description,
          genres,
          starts_at: start?.toISOString(),
        });
        if (later && tellFeed) {
          await api()
            .post(`/api/v1/booth_lives/${res.data.id}/share`, {
              visibility: reach,
            })
            .catch(() => undefined);
        }
        onCreated({
          live: res.data,
          announce: !later && tellFeed ? reach : null,
        });
      } catch {
        setError(intl.formatMessage(messages.error));
        setSubmitting(false);
      }
    })();
  }, [
    when,
    startsAt,
    title,
    description,
    genres,
    tellFeed,
    reach,
    intl,
    onCreated,
  ]);

  return (
    <ComposeShell
      korner='booth'
      label={intl.formatMessage(messages.label)}
      switcher={<ComposerSwitch mode='live' />}
      submitLabel={intl.formatMessage(
        when === 'now' ? messages.submitNow : messages.submitLater,
      )}
      submittingLabel={intl.formatMessage(messages.submitting)}
      submitting={submitting}
      canSubmit={title.trim() !== ''}
      onSubmit={handleSubmit}
      onCancel={onCancel}
      konnect={null}
    >
      {error && <ComposeHint error>{error}</ComposeHint>}

      <ComposeTitle
        value={title}
        onChange={handleTitle}
        placeholder={intl.formatMessage(messages.titlePlaceholder)}
        aria-label={intl.formatMessage(messages.title)}
        maxLength={200}
        required
        disabled={submitting}
      />

      <ComposeSection title={intl.formatMessage(messages.when)}>
        <ComposeRow>
          <label
            className='compose-check'
            aria-label={intl.formatMessage(messages.now)}
          >
            <input
              type='radio'
              name='booth-live-when'
              value='now'
              checked={when === 'now'}
              onChange={handleWhen}
              disabled={submitting}
            />
            <span className='compose-check__text'>
              <span className='compose-check__label'>
                {intl.formatMessage(messages.now)}
              </span>
            </span>
          </label>
          <label
            className='compose-check'
            aria-label={intl.formatMessage(messages.later)}
          >
            <input
              type='radio'
              name='booth-live-when'
              value='later'
              checked={when === 'later'}
              onChange={handleWhen}
              disabled={submitting}
            />
            <span className='compose-check__text'>
              <span className='compose-check__label'>
                {intl.formatMessage(messages.later)}
              </span>
            </span>
          </label>
        </ComposeRow>
        {when === 'later' && (
          <ComposeField label={intl.formatMessage(messages.startsAt)}>
            <ComposeInput
              type='datetime-local'
              value={startsAt}
              onChange={handleStartsAt}
              disabled={submitting}
            />
          </ComposeField>
        )}
      </ComposeSection>

      {/* A tag picker (chips and suggestion buttons), not one control,
          so it isn't wrapped in <ComposeField>'s <label>. */}
      <div className='booth-upload-form__field'>
        <span>{intl.formatMessage(messages.genre)}</span>
        <GenreTagInput
          value={genres}
          onChange={setGenres}
          disabled={submitting}
        />
      </div>

      <ComposeBody
        value={description}
        onChange={handleDescription}
        placeholder={intl.formatMessage(messages.description)}
        aria-label={intl.formatMessage(messages.description)}
        rows={3}
        maxLength={2000}
        disabled={submitting}
      />

      <div className='booth-upload-form__feed'>
        <ComposeCheck
          label={intl.formatMessage(messages.tellFeed)}
          checked={tellFeed}
          onChange={handleTellFeed}
          disabled={submitting}
        />
        {tellFeed && (
          <ReachDropdown
            value={reach}
            onChange={setReach}
            disabled={submitting}
          />
        )}
        <ComposeHint>
          {intl.formatMessage(
            when === 'now' ? messages.tellFeedNow : messages.tellFeedLater,
          )}
        </ComposeHint>
      </div>
    </ComposeShell>
  );
};
