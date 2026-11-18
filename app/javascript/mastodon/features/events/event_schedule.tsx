import { useCallback, useEffect, useMemo, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';
import type { IntlShape } from 'react-intl';

import { Link } from 'react-router-dom';

import axios from 'axios';

import AddIcon from '@/material-icons/400-24px/add.svg?react';
import api from 'mastodon/api';
import {
  ComposeField,
  ComposeHint,
  ComposeInput,
  ComposeRow,
  ComposeTitle,
} from 'mastodon/components/compose_fields';
import { ComposeShell } from 'mastodon/components/compose_shell';
import { KornerPill } from 'mastodon/components/korner_pill';
import { projectPath } from 'mastodon/features/freethedream/components/shared';
import { useConfirmDialog } from 'mastodon/hooks/useConfirmDialog';

// An event's schedule (docs/spaces/kalendar.md, Schedule; Tal, 2026-11-18):
// what happens when, as a grid with a column for each day and the times
// running down, so a weekend reads side by side and a single day is a
// list. One schedule per event: on its own its host keeps it; Konnected to
// a projekt, anyone in the projekt does, from the projekt's page or the
// event's, and both show the same lines. On a phone the page stays
// vertical and the days scroll sideways, the next one peeking in.

const messages = defineMessages({
  title: { id: 'kalendar.schedule.title', defaultMessage: 'Schedule' },
  add: { id: 'kalendar.schedule.add', defaultMessage: 'Add' },
  addFor: {
    id: 'kalendar.schedule.add_for',
    defaultMessage: 'Add a schedule',
  },
  empty: {
    id: 'kalendar.schedule.empty',
    defaultMessage: 'Nothing on the schedule yet.',
  },
  keptBy: {
    id: 'kalendar.schedule.kept_by',
    defaultMessage: 'Kept by the people in {projekt}.',
  },
  until: { id: 'kalendar.schedule.until', defaultMessage: 'until {time}' },
  newLine: {
    id: 'kalendar.schedule.new_line',
    defaultMessage: 'Add to the schedule',
  },
  editLine: {
    id: 'kalendar.schedule.edit_line',
    defaultMessage: 'Change this line',
  },
  save: { id: 'kalendar.schedule.save', defaultMessage: 'Save' },
  saving: { id: 'kalendar.schedule.saving', defaultMessage: 'Saving…' },
  what: { id: 'kalendar.schedule.what', defaultMessage: 'What happens' },
  day: { id: 'kalendar.schedule.day', defaultMessage: 'Day' },
  starts: { id: 'kalendar.schedule.starts', defaultMessage: 'Starts' },
  ends: { id: 'kalendar.schedule.ends', defaultMessage: 'Ends (optional)' },
  note: { id: 'kalendar.schedule.note', defaultMessage: 'Note (optional)' },
  notePlaceholder: {
    id: 'kalendar.schedule.note_placeholder',
    defaultMessage: 'Where, who, what to bring',
  },
  hint: {
    id: 'kalendar.schedule.hint',
    defaultMessage: 'Times are the event’s own, the same for everyone.',
  },
  remove: {
    id: 'kalendar.schedule.remove',
    defaultMessage: 'Take off the schedule',
  },
  removeTitle: {
    id: 'kalendar.schedule.remove_title',
    defaultMessage: 'Take “{title}” off the schedule?',
  },
  removeConfirm: {
    id: 'kalendar.schedule.remove_confirm',
    defaultMessage: 'Take it off',
  },
});

export interface ScheduleLine {
  id: string;
  day: string;
  start: string;
  end: string | null;
  title: string;
  note: string;
}

export interface Schedule {
  lines: ScheduleLine[];
  can_edit: boolean;
  projekt: {
    id: string;
    slug: string;
    krew_slug: string | null;
    title: string;
  } | null;
}

export const fetchSchedule = async (eventId: string) =>
  (await api().get<Schedule>(`/api/v1/events/${eventId}/schedule`)).data;

// The longest an event's own dates make columns for; a line on a day
// outside them still gets its column.
const MAX_EVENT_DAYS = 14;

const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromDayKey = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
};

// The days the event runs over, as seen here, then any other day a line
// is on: the schedule's columns, in order.
export const scheduleDays = (
  startTime: string,
  endTime: string | null,
  lines: ScheduleLine[],
): string[] => {
  const days = new Set<string>();
  const start = new Date(startTime);
  const end = endTime ? new Date(endTime) : start;
  const cursor = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
  );
  for (let i = 0; i < MAX_EVENT_DAYS && cursor <= end; i++) {
    days.add(dayKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  if (days.size === 0) days.add(dayKey(start));
  lines.forEach((line) => days.add(line.day));
  return Array.from(days).sort();
};

const formatClock = (intl: IntlShape, clock: string) => {
  const [h, m] = clock.split(':').map(Number);
  return intl.formatTime(new Date(2000, 0, 1, h ?? 0, m ?? 0), {
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatDay = (intl: IntlShape, key: string) =>
  intl.formatDate(fromDayKey(key), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

const failure = (e: unknown): string => {
  if (axios.isAxiosError(e)) {
    const data = e.response?.data as { error?: unknown } | undefined;
    if (typeof data?.error === 'string') return data.error;
    return e.message;
  }
  return e instanceof Error ? e.message : String(e);
};

// The grid: a time down the side, a column for each day (a heading over
// each only when there is more than one), and each line in its day's
// column on its start time's row. Lines that start together share a cell.
const ScheduleGrid: React.FC<{
  days: string[];
  lines: ScheduleLine[];
  onPick?: (line: ScheduleLine) => void;
}> = ({ days, lines, onPick }) => {
  const intl = useIntl();
  const starts = useMemo(
    () => Array.from(new Set(lines.map((line) => line.start))).sort(),
    [lines],
  );
  const multi = days.length > 1;
  const headRows = multi ? 1 : 0;

  const cells = useMemo(() => {
    const byCell = new Map<string, ScheduleLine[]>();
    lines.forEach((line) => {
      const key = `${line.day} ${line.start}`;
      byCell.set(key, [...(byCell.get(key) ?? []), line]);
    });
    return byCell;
  }, [lines]);

  return (
    <div
      className={`event-schedule__scroll${multi ? ' event-schedule__scroll--days' : ''}`}
    >
      <div
        className='event-schedule__grid'
        style={{ ['--schedule-days' as string]: days.length }}
      >
        {multi &&
          days.map((day, i) => (
            <div
              key={day}
              className='event-schedule__day'
              style={{ gridColumn: i + 2, gridRow: 1 }}
            >
              {formatDay(intl, day)}
            </div>
          ))}
        {starts.map((start, row) => (
          <div
            key={start}
            className='event-schedule__time'
            style={{ gridColumn: 1, gridRow: row + 1 + headRows }}
          >
            {formatClock(intl, start)}
          </div>
        ))}
        {days.map((day, col) =>
          starts.map((start, row) => {
            const here = cells.get(`${day} ${start}`);
            if (!here) return null;
            return (
              <ul
                key={`${day} ${start}`}
                className='event-schedule__cell'
                style={{ gridColumn: col + 2, gridRow: row + 1 + headRows }}
                aria-label={multi ? formatDay(intl, day) : undefined}
              >
                {here.map((line) => (
                  <li key={line.id}>
                    <ScheduleEntry line={line} onPick={onPick} />
                  </li>
                ))}
              </ul>
            );
          }),
        )}
      </div>
    </div>
  );
};

const ScheduleEntry: React.FC<{
  line: ScheduleLine;
  onPick?: (line: ScheduleLine) => void;
}> = ({ line, onPick }) => {
  const intl = useIntl();
  const handleClick = useCallback(() => {
    onPick?.(line);
  }, [onPick, line]);
  const body = (
    <>
      <span className='event-schedule__what'>{line.title}</span>
      {line.end && (
        <span className='event-schedule__until'>
          {intl.formatMessage(messages.until, {
            time: formatClock(intl, line.end),
          })}
        </span>
      )}
      {line.note && <span className='event-schedule__note'>{line.note}</span>}
    </>
  );
  if (!onPick) return <div className='event-schedule__entry'>{body}</div>;
  return (
    <button
      type='button'
      className='event-schedule__entry event-schedule__entry--edit'
      onClick={handleClick}
    >
      {body}
    </button>
  );
};

// Add or change one line, in the shared composer.
const LineComposer: React.FC<{
  eventId: string;
  line: ScheduleLine | null;
  defaultDay: string;
  onSaved: (schedule: Schedule) => void;
  onCancel: () => void;
}> = ({ eventId, line, defaultDay, onSaved, onCancel }) => {
  const intl = useIntl();
  const [confirmDialog, confirm] = useConfirmDialog();
  const [title, setTitle] = useState(line?.title ?? '');
  const [day, setDay] = useState(line?.day ?? defaultDay);
  const [start, setStart] = useState(line?.start ?? '10:00');
  const [end, setEnd] = useState(line?.end ?? '');
  const [note, setNote] = useState(line?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTitle = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  }, []);
  const handleDay = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setDay(e.target.value);
  }, []);
  const handleStart = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setStart(e.target.value);
  }, []);
  const handleEnd = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEnd(e.target.value);
  }, []);
  const handleNote = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setNote(e.target.value);
  }, []);

  const send = useCallback(
    (request: () => Promise<{ data: Schedule }>) => {
      setBusy(true);
      setError(null);
      void (async () => {
        try {
          onSaved((await request()).data);
        } catch (e: unknown) {
          setError(failure(e));
          setBusy(false);
        }
      })();
    },
    [onSaved],
  );

  const handleSubmit = useCallback(() => {
    const params = { title: title.trim(), day, start, end, note: note.trim() };
    const base = `/api/v1/events/${eventId}/schedule/lines`;
    send(() =>
      line
        ? api().patch<Schedule>(`${base}/${line.id}`, params)
        : api().post<Schedule>(base, params),
    );
  }, [title, day, start, end, note, eventId, line, send]);

  const handleRemove = useCallback(() => {
    if (!line) return;
    void (async () => {
      const ok = await confirm({
        title: intl.formatMessage(messages.removeTitle, { title: line.title }),
        confirmLabel: intl.formatMessage(messages.removeConfirm),
        destructive: true,
      });
      if (!ok) return;
      send(() =>
        api().delete<Schedule>(
          `/api/v1/events/${eventId}/schedule/lines/${line.id}`,
        ),
      );
    })();
  }, [line, confirm, intl, send, eventId]);

  return (
    <ComposeShell
      korner='kalendar'
      label={intl.formatMessage(line ? messages.editLine : messages.newLine)}
      submitLabel={intl.formatMessage(messages.save)}
      submittingLabel={intl.formatMessage(messages.saving)}
      submitting={busy}
      canSubmit={!!title.trim() && !!day && !!start}
      onSubmit={handleSubmit}
      onCancel={onCancel}
      konnect={null}
    >
      <ComposeTitle
        value={title}
        onChange={handleTitle}
        placeholder={intl.formatMessage(messages.what)}
        aria-label={intl.formatMessage(messages.what)}
        maxLength={100}
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
      />
      <ComposeRow>
        <ComposeField label={intl.formatMessage(messages.day)}>
          <ComposeInput type='date' value={day} onChange={handleDay} />
        </ComposeField>
        <ComposeField label={intl.formatMessage(messages.starts)}>
          <ComposeInput
            type='time'
            step={300}
            value={start}
            onChange={handleStart}
          />
        </ComposeField>
        <ComposeField label={intl.formatMessage(messages.ends)}>
          <ComposeInput
            type='time'
            step={300}
            value={end}
            onChange={handleEnd}
          />
        </ComposeField>
      </ComposeRow>
      <ComposeField label={intl.formatMessage(messages.note)}>
        <ComposeInput
          value={note}
          onChange={handleNote}
          placeholder={intl.formatMessage(messages.notePlaceholder)}
          maxLength={280}
        />
      </ComposeField>
      <ComposeHint>{intl.formatMessage(messages.hint)}</ComposeHint>
      {error && <ComposeHint error>{error}</ComposeHint>}
      {line && (
        <KornerPill
          variant='destructive'
          label={intl.formatMessage(messages.remove)}
          onClick={handleRemove}
          disabled={busy}
        />
      )}
      {confirmDialog}
    </ComposeShell>
  );
};

// One event's schedule: the grid, and for whoever keeps it, Add and a tap
// on a line to change it. `schedule` and `onChange` are the caller's, so a
// page can know whether there is anything to show.
export const ScheduleBody: React.FC<{
  eventId: string;
  startTime: string;
  endTime: string | null;
  schedule: Schedule;
  onChange: (schedule: Schedule) => void;
  showAdd?: boolean;
}> = ({ eventId, startTime, endTime, schedule, onChange, showAdd = true }) => {
  const intl = useIntl();
  const [editing, setEditing] = useState<ScheduleLine | 'new' | null>(null);
  const days = useMemo(
    () => scheduleDays(startTime, endTime, schedule.lines),
    [startTime, endTime, schedule.lines],
  );

  const handleAdd = useCallback(() => {
    setEditing('new');
  }, []);
  const handleCancel = useCallback(() => {
    setEditing(null);
  }, []);
  const handleSaved = useCallback(
    (next: Schedule) => {
      setEditing(null);
      onChange(next);
    },
    [onChange],
  );

  const empty = schedule.lines.length === 0;

  return (
    <>
      {empty ? (
        <p className='event-schedule__empty'>
          {intl.formatMessage(messages.empty)}
        </p>
      ) : (
        <ScheduleGrid
          days={days}
          lines={schedule.lines}
          onPick={schedule.can_edit ? setEditing : undefined}
        />
      )}
      {schedule.can_edit && showAdd && (
        <div className='event-schedule__actions'>
          <KornerPill
            icon={AddIcon}
            iconId='add'
            label={intl.formatMessage(empty ? messages.addFor : messages.add)}
            onClick={handleAdd}
          />
        </div>
      )}
      {editing && (
        <LineComposer
          eventId={eventId}
          line={editing === 'new' ? null : editing}
          defaultDay={days[0] ?? dayKey(new Date(startTime))}
          onSaved={handleSaved}
          onCancel={handleCancel}
        />
      )}
    </>
  );
};

// The event page's Schedule section. Nothing at all when there's no
// schedule and the viewer can't start one.
export const EventSchedule: React.FC<{
  eventId: string;
  startTime: string;
  endTime: string | null;
}> = ({ eventId, startTime, endTime }) => {
  const intl = useIntl();
  const [schedule, setSchedule] = useState<Schedule | null>(null);

  useEffect(() => {
    let live = true;
    fetchSchedule(eventId)
      .then((data) => {
        if (live) setSchedule(data);
      })
      .catch(() => {
        if (live) setSchedule(null);
      });
    return () => {
      live = false;
    };
  }, [eventId]);

  if (!schedule) return null;
  if (schedule.lines.length === 0 && !schedule.can_edit) return null;

  return (
    <section className='event-schedule' id='event-schedule'>
      <h3 className='korner-section-heading'>
        {intl.formatMessage(messages.title)}
      </h3>
      {schedule.projekt && (
        <p className='event-schedule__kept'>
          {intl.formatMessage(messages.keptBy, {
            projekt: (
              <Link key='projekt' to={projectPath(schedule.projekt)}>
                {schedule.projekt.title}
              </Link>
            ),
          })}
        </p>
      )}
      <ScheduleBody
        eventId={eventId}
        startTime={startTime}
        endTime={endTime}
        schedule={schedule}
        onChange={setSchedule}
      />
    </section>
  );
};
