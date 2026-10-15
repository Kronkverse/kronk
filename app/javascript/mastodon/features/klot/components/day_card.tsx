import { useCallback, useEffect, useMemo, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import type {
  ApiKlotDayJSON,
  ApiKlotLogJSON,
  ApiKlotSelfJSON,
  Flow,
  Symptom,
} from 'mastodon/api/klot';
import { KornerPill } from 'mastodon/components/korner_pill';

import { daysBetween, fromIso, todayIso } from '../dates';
import { FLOWS, FLOW_LABEL, SYMPTOM_GROUPS, SYMPTOM_LABEL } from '../symptoms';

// One day of the cycle: say a period started or ended on it, how heavy
// the bleed was, how the day felt, and a note. It writes to whichever day
// the calendar has picked, today by default, so a bleed or a symptom can
// be logged as it happens or filled in afterwards.

const NOTE_MAX = 500;
// A period can be marked as ended up to this many days after it started
// (CycleLog::MAX_LENGTH on the server).
const MAX_PERIOD = 21;

const messages = defineMessages({
  today: { id: 'klot.day.today', defaultMessage: 'Today' },
  startedToday: {
    id: 'klot.day.started_today',
    defaultMessage: 'My period started today',
  },
  startedThisDay: {
    id: 'klot.day.started_this_day',
    defaultMessage: 'My period started on this day',
  },
  endedToday: {
    id: 'klot.day.ended_today',
    defaultMessage: 'My period ended today',
  },
  endedThisDay: {
    id: 'klot.day.ended_this_day',
    defaultMessage: 'My period ended on this day',
  },
  stillGoing: {
    id: 'klot.day.still_going',
    defaultMessage: 'It is still going',
  },
  remove: {
    id: 'klot.day.remove_period',
    defaultMessage: 'Remove this period',
  },
  periodDay: {
    id: 'klot.day.period_day',
    defaultMessage: 'Day {day} of your period',
  },
  periodDayOf: {
    id: 'klot.day.period_day_of',
    defaultMessage: 'Day {day} of a {length}-day period',
  },
  noPeriod: {
    id: 'klot.day.no_period',
    defaultMessage: 'No period logged on this day.',
  },
  flow: { id: 'klot.day.flow', defaultMessage: 'Bleeding' },
  note: { id: 'klot.day.note', defaultMessage: 'Note' },
  notePlaceholder: {
    id: 'klot.day.note_placeholder',
    defaultMessage: 'Anything you want to remember about this day',
  },
  private: {
    id: 'klot.day.private',
    defaultMessage:
      'Only you see this. People you share with see your phase and nothing else.',
  },
});

// The period that covers `day`, if one does. One still going covers every
// day from its start up to today.
const coveringLog = (
  self: ApiKlotSelfJSON,
  day: string,
): ApiKlotLogJSON | undefined =>
  self.logs.find((log, index) => {
    if (day < log.started_on) return false;
    if (log.ended_on) return day <= log.ended_on;
    return index === 0 && day <= todayIso();
  });

// The latest period that began before `day`, close enough that `day`
// could be its last day.
const periodToEnd = (
  self: ApiKlotSelfJSON,
  day: string,
): ApiKlotLogJSON | undefined =>
  self.logs.find(
    (log) =>
      log.started_on < day && daysBetween(log.started_on, day) < MAX_PERIOD,
  );

interface Props {
  self: ApiKlotSelfJSON;
  day: string;
  entry: ApiKlotDayJSON | undefined;
  busy: boolean;
  onStart: (day: string) => void;
  onEnd: (log: ApiKlotLogJSON, day: string | null) => void;
  onRemove: (log: ApiKlotLogJSON) => void;
  onEntry: (
    day: string,
    changes: Partial<Pick<ApiKlotDayJSON, 'flow' | 'symptoms' | 'note'>>,
  ) => void;
}

export const DayCard: React.FC<Props> = ({
  self,
  day,
  entry,
  busy,
  onStart,
  onEnd,
  onRemove,
  onEntry,
}) => {
  const intl = useIntl();
  const isToday = day === todayIso();
  const log = coveringLog(self, day);
  const earlier = log ? undefined : periodToEnd(self, day);
  const flow = entry?.flow ?? null;
  const symptoms = useMemo(() => entry?.symptoms ?? [], [entry?.symptoms]);

  const [note, setNote] = useState(entry?.note ?? '');
  useEffect(() => {
    setNote(entry?.note ?? '');
  }, [day, entry?.note]);

  const handleStart = useCallback(() => {
    onStart(day);
  }, [day, onStart]);
  const handleEnd = useCallback(() => {
    const target = log ?? earlier;
    if (target) onEnd(target, day);
  }, [day, earlier, log, onEnd]);
  const handleReopen = useCallback(() => {
    if (log) onEnd(log, null);
  }, [log, onEnd]);
  const handleRemove = useCallback(() => {
    if (log) onRemove(log);
  }, [log, onRemove]);

  const handleFlow = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const picked = e.currentTarget.dataset.flow as Flow;
      onEntry(day, { flow: picked === flow ? null : picked });
    },
    [day, flow, onEntry],
  );
  const handleSymptom = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const picked = e.currentTarget.dataset.symptom as Symptom;
      onEntry(day, {
        symptoms: symptoms.includes(picked)
          ? symptoms.filter((s) => s !== picked)
          : [...symptoms, picked],
      });
    },
    [day, onEntry, symptoms],
  );
  const handleNote = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setNote(e.target.value);
    },
    [],
  );
  const handleNoteBlur = useCallback(() => {
    if (note.trim() !== (entry?.note ?? '')) onEntry(day, { note });
  }, [day, entry?.note, note, onEntry]);

  const date = intl.formatDate(fromIso(day), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const periodDay = log ? daysBetween(log.started_on, day) + 1 : null;
  // The last period logged can be reopened; an older one has a later
  // period after it, so it has certainly ended.
  const canReopen = !!log && log.ended_on === day && log === self.logs[0];

  return (
    <section className='klot-card klot-day'>
      <h2 className='klot-card__title'>
        {isToday ? `${intl.formatMessage(messages.today)} · ${date}` : date}
      </h2>

      <p className='klot-day__status'>
        {log && periodDay !== null
          ? log.length
            ? intl.formatMessage(messages.periodDayOf, {
                day: periodDay,
                length: log.length,
              })
            : intl.formatMessage(messages.periodDay, { day: periodDay })
          : intl.formatMessage(messages.noPeriod)}
      </p>

      <div className='klot-day__actions'>
        {!log && (
          <KornerPill
            variant='primary'
            disabled={busy}
            onClick={handleStart}
            label={intl.formatMessage(
              isToday ? messages.startedToday : messages.startedThisDay,
            )}
          />
        )}
        {((log && log.ended_on !== day) || earlier) && (
          <KornerPill
            variant={log?.ended_on === null ? 'primary' : 'default'}
            disabled={busy}
            onClick={handleEnd}
            label={intl.formatMessage(
              isToday ? messages.endedToday : messages.endedThisDay,
            )}
          />
        )}
        {canReopen && (
          <KornerPill
            disabled={busy}
            onClick={handleReopen}
            label={intl.formatMessage(messages.stillGoing)}
          />
        )}
        {log && (
          <button
            type='button'
            className='klot-day__remove'
            disabled={busy}
            onClick={handleRemove}
          >
            {intl.formatMessage(messages.remove)}
          </button>
        )}
      </div>

      <h3 className='klot-day__label'>{intl.formatMessage(messages.flow)}</h3>
      <div className='klot-chips'>
        {FLOWS.map((name) => (
          <button
            key={name}
            type='button'
            data-flow={name}
            aria-pressed={flow === name}
            onClick={handleFlow}
            className='klot-chip klot-chip--flow'
          >
            {intl.formatMessage(FLOW_LABEL[name])}
          </button>
        ))}
      </div>

      {SYMPTOM_GROUPS.map((group) => (
        <div key={group.title.id}>
          <h3 className='klot-day__label'>{intl.formatMessage(group.title)}</h3>
          <div className='klot-chips'>
            {group.items.map((name) => (
              <button
                key={name}
                type='button'
                data-symptom={name}
                aria-pressed={symptoms.includes(name)}
                onClick={handleSymptom}
                className='klot-chip'
              >
                {intl.formatMessage(SYMPTOM_LABEL[name])}
              </button>
            ))}
          </div>
        </div>
      ))}

      <label className='klot-day__note'>
        <span className='klot-day__label'>
          {intl.formatMessage(messages.note)}
        </span>
        <textarea
          className='klot-card__input klot-day__textarea'
          value={note}
          maxLength={NOTE_MAX}
          rows={2}
          placeholder={intl.formatMessage(messages.notePlaceholder)}
          onChange={handleNote}
          onBlur={handleNoteBlur}
        />
      </label>

      <p className='klot-card__hint'>{intl.formatMessage(messages.private)}</p>
    </section>
  );
};
