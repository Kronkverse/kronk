import { useCallback, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import axios from 'axios';

import api from 'mastodon/api';
import { apiCreateAttachment } from 'mastodon/api/attachments';
import type { FtdProject } from 'mastodon/api_types/freethedream';
import { konnectSearch } from 'mastodon/hooks/useKonnect';
import { useKorner } from 'mastodon/hooks/useKorner';

// A Komponent's New event: a call, nothing more (Tal, 2026-11-11: "Events
// within a komponent can be just scheduling a call, it just needs to be
// really really simple, with the spaces kuddle already set up"). What it
// is, the day, the time and how long; the call is in the Komponent's own
// Kuddle (kuddle_space) and the event is Konnected to the Komponent, as
// the full composer would. More options opens that composer.

const messages = defineMessages({
  heading: {
    id: 'freethedream.call.heading',
    defaultMessage: 'Schedule a call',
  },
  what: { id: 'freethedream.call.what', defaultMessage: 'What it’s about' },
  defaultTitle: {
    id: 'freethedream.call.default_title',
    defaultMessage: '{title} call',
  },
  day: { id: 'freethedream.call.day', defaultMessage: 'Day' },
  time: { id: 'freethedream.call.time', defaultMessage: 'Time' },
  length: { id: 'freethedream.call.length', defaultMessage: 'How long' },
  minutes: {
    id: 'freethedream.call.minutes',
    defaultMessage: '{count} minutes',
  },
  hours: {
    id: 'freethedream.call.hours',
    defaultMessage: '{count, plural, one {# hour} other {# hours}}',
  },
  hint: {
    id: 'freethedream.call.hint',
    defaultMessage:
      'It’s in this Komponent’s Kuddle. Everyone in it joins from the event.',
  },
  schedule: { id: 'freethedream.call.schedule', defaultMessage: 'Schedule' },
  cancel: { id: 'freethedream.call.cancel', defaultMessage: 'Cancel' },
  more: { id: 'freethedream.call.more', defaultMessage: 'More options' },
});

const LENGTHS = [30, 60, 90, 120];

const pad = (n: number) => String(n).padStart(2, '0');
const dayValue = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const timeValue = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

// The next whole hour, so the default is a time people would pick.
const nextHour = () => {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return d;
};

const failure = (e: unknown): string => {
  if (axios.isAxiosError(e)) {
    const data = e.response?.data as { error?: unknown } | undefined;
    if (typeof data?.error === 'string') return data.error;
    return e.message;
  }
  return e instanceof Error ? e.message : String(e);
};

export const ScheduleCall: React.FC<{
  project: FtdProject;
  onDone: () => void;
  onCancel: () => void;
}> = ({ project, onDone, onCancel }) => {
  const intl = useIntl();
  const kalendar = useKorner('kalendar');
  const composer = kalendar?.konnect?.route ?? kalendar?.compose?.route;
  const [start] = useState(nextHour);
  const [title, setTitle] = useState(() =>
    intl.formatMessage(messages.defaultTitle, { title: project.title }),
  );
  const [day, setDay] = useState(() => dayValue(start));
  const [time, setTime] = useState(() => timeValue(start));
  const [length, setLength] = useState(60);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTitle = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  }, []);
  const handleDay = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setDay(e.target.value);
  }, []);
  const handleTime = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTime(e.target.value);
  }, []);
  const handleLength = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setLength(Number(e.target.value));
    },
    [],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const begins = new Date(`${day}T${time}`);
      if (!title.trim() || Number.isNaN(begins.getTime())) return;
      setBusy(true);
      setError(null);
      void (async () => {
        try {
          const res = await api().post<{ id: string }>('/api/v1/events', {
            title: title.trim(),
            start_time: begins.toISOString(),
            end_time: new Date(
              begins.getTime() + length * 60 * 1000,
            ).toISOString(),
            visibility: 'public',
            kuddle_space: `freethedream:${project.id}`,
          });
          await apiCreateAttachment({
            source_slug: 'kalendar',
            source_id: res.data.id,
            target_slug: 'freethedream',
            target_id: project.id,
            kind: 'link',
          });
          onDone();
        } catch (err: unknown) {
          setError(failure(err));
          setBusy(false);
        }
      })();
    },
    [day, time, title, length, project.id, onDone],
  );

  return (
    <form className='freethedream-call' onSubmit={handleSubmit}>
      <h4 className='freethedream-call__heading'>
        {intl.formatMessage(messages.heading)}
      </h4>
      <label className='freethedream-call__field freethedream-call__field--wide'>
        <span>{intl.formatMessage(messages.what)}</span>
        <input
          className='freethedream__input'
          value={title}
          onChange={handleTitle}
          maxLength={180}
          required
        />
      </label>
      <label className='freethedream-call__field'>
        <span>{intl.formatMessage(messages.day)}</span>
        <input
          type='date'
          className='freethedream__input'
          value={day}
          onChange={handleDay}
          required
        />
      </label>
      <label className='freethedream-call__field'>
        <span>{intl.formatMessage(messages.time)}</span>
        <input
          type='time'
          className='freethedream__input'
          value={time}
          step={300}
          onChange={handleTime}
          required
        />
      </label>
      <label className='freethedream-call__field'>
        <span>{intl.formatMessage(messages.length)}</span>
        <select
          className='freethedream__input'
          value={length}
          onChange={handleLength}
        >
          {LENGTHS.map((m) => (
            <option key={m} value={m}>
              {m < 60
                ? intl.formatMessage(messages.minutes, { count: m })
                : intl.formatMessage(messages.hours, { count: m / 60 })}
            </option>
          ))}
        </select>
      </label>
      <p className='freethedream-call__hint'>
        {intl.formatMessage(messages.hint)}
      </p>
      {error && <p className='freethedream-call__error'>{error}</p>}
      <div className='freethedream-call__actions'>
        <button
          type='submit'
          className='freethedream__button'
          disabled={busy || !title.trim()}
        >
          {intl.formatMessage(messages.schedule)}
        </button>
        <button
          type='button'
          className='freethedream__button freethedream__button--quiet'
          onClick={onCancel}
        >
          {intl.formatMessage(messages.cancel)}
        </button>
        {composer && (
          <Link
            className='freethedream-call__more'
            to={{
              pathname: composer,
              search: konnectSearch('freethedream', project.id),
            }}
          >
            {intl.formatMessage(messages.more)}
          </Link>
        )}
      </div>
    </form>
  );
};
