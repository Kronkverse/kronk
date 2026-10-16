import { useCallback, useEffect, useMemo, useState } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import {
  apiDeleteKlotLog,
  apiGetKlotDays,
  apiGetKlotSelf,
  apiPatchKlotLog,
  apiPostKlotLog,
  apiPutKlotDay,
} from 'mastodon/api/klot';
import type {
  ApiKlotDayJSON,
  ApiKlotLogJSON,
  ApiKlotSelfJSON,
} from 'mastodon/api/klot';
import { LoadingState } from 'mastodon/components/loading_state';
import { useConfirmThen } from 'mastodon/hooks/useConfirmDialog';

import { CycleCalendar } from './components/cycle_calendar';
import { CycleRing } from './components/cycle_ring';
import { CycleSummary } from './components/cycle_summary';
import { DayCard } from './components/day_card';
import { SharedWith } from './components/shared_with';
import { monthGrid, monthOf, todayIso } from './dates';
import type { Month } from './dates';
import { PHASES } from './phases';

// My cycle (docs/spaces/klot.md). Top to bottom: where you are now, the
// day card (a period started or ended, bleeding, symptoms, a note), the
// calendar that picks which day the card writes to, what the log says
// about your cycle, and who you share your phase with.
//
// Nothing asks how long your cycle is. It is worked out from the periods
// you log, from the second one on.

const messages = defineMessages({
  emptyPhase: {
    id: 'klot.mine.empty',
    defaultMessage: 'Log a period below to see your phase.',
  },
  failed: {
    id: 'klot.mine.failed',
    defaultMessage: 'That did not save. Please try again.',
  },
  loadFailed: {
    id: 'klot.mine.load_failed',
    defaultMessage: 'Your cycle did not load. Please try again.',
  },
  removeConfirm: {
    id: 'klot.mine.remove_confirm',
    defaultMessage: 'Remove this period from your log?',
  },
});

type DayChanges = Partial<Pick<ApiKlotDayJSON, 'flow' | 'symptoms' | 'note'>>;

export const KlotMineView = () => {
  const intl = useIntl();
  const [confirmDialog, confirmThen] = useConfirmThen();
  const [self, setSelf] = useState<ApiKlotSelfJSON | null>(null);
  const [days, setDays] = useState<Record<string, ApiKlotDayJSON>>({});
  const [selected, setSelected] = useState(todayIso);
  const [month, setMonth] = useState<Month>(() => monthOf(todayIso()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGetKlotSelf()
      .then(setSelf)
      .catch(() => {
        setError(intl.formatMessage(messages.loadFailed));
      });
  }, [intl]);

  // The days written on, for the month on show (its grid runs a little
  // into the months either side).
  const grid = useMemo(() => monthGrid(month), [month]);
  const from = grid[0];
  const to = grid[grid.length - 1];
  useEffect(() => {
    if (!from || !to) return;
    let stale = false;
    apiGetKlotDays(from, to)
      .then((list) => {
        if (stale) return;
        setDays((prev) => {
          const next = { ...prev };
          list.forEach((entry) => {
            next[entry.day] = entry;
          });
          return next;
        });
      })
      .catch(() => undefined);
    return () => {
      stale = true;
    };
  }, [from, to]);

  // A change to the log: wait for it, show the new state, say so if it
  // did not take.
  const change = useCallback(
    (request: Promise<ApiKlotSelfJSON>) => {
      setBusy(true);
      setError(null);
      request
        .then(setSelf)
        .catch(() => {
          setError(intl.formatMessage(messages.failed));
        })
        .finally(() => {
          setBusy(false);
        });
    },
    [intl],
  );

  const handleStart = useCallback(
    (day: string) => {
      change(apiPostKlotLog(day));
    },
    [change],
  );
  const handleEnd = useCallback(
    (log: ApiKlotLogJSON, day: string | null) => {
      change(apiPatchKlotLog(log.id, { ended_on: day ?? '' }));
    },
    [change],
  );
  const handleRemove = useCallback(
    (log: ApiKlotLogJSON) => {
      confirmThen(intl.formatMessage(messages.removeConfirm), 'remove', () => {
        change(apiDeleteKlotLog(log.id));
      });
    },
    [change, intl, confirmThen],
  );

  // How a day was: shown at once, then saved. A day emptied of everything
  // is dropped.
  const handleEntry = useCallback(
    (day: string, changes: DayChanges) => {
      const before = days[day];
      const next: ApiKlotDayJSON = {
        day,
        flow: before?.flow ?? null,
        symptoms: before?.symptoms ?? [],
        note: before?.note ?? '',
        ...changes,
      };
      setDays((prev) => ({ ...prev, [day]: next }));
      setError(null);
      apiPutKlotDay(day, next)
        .then((saved) => {
          setDays((prev) => ({ ...prev, [day]: saved }));
        })
        .catch(() => {
          setDays((prev) =>
            before
              ? { ...prev, [day]: before }
              : Object.fromEntries(
                  Object.entries(prev).filter(([key]) => key !== day),
                ),
          );
          setError(intl.formatMessage(messages.failed));
        });
    },
    [days, intl],
  );

  // Picking a day from the list of periods also turns the calendar to it.
  const handleSelect = useCallback((day: string) => {
    setSelected(day);
    setMonth(monthOf(day));
  }, []);

  if (!self) {
    return error ? <p className='klot__error'>{error}</p> : <LoadingState />;
  }

  const phaseKey = self.phase;
  const phaseCopy = phaseKey ? PHASES[phaseKey] : null;
  const accentStyle = phaseCopy
    ? ({ '--klot-accent': phaseCopy.colorVar } as React.CSSProperties)
    : undefined;

  return (
    <div className='klot-mine' style={accentStyle}>
      {confirmDialog}
      <div className='klot-mine__ringwrap'>
        <CycleRing
          cycleLength={self.cycle_length}
          periodLength={self.period_length}
          activePhase={phaseKey}
          currentDay={self.day_of_cycle}
        />
        <div className='klot-mine__ring-center'>
          {phaseCopy ? (
            <>
              <div className='klot-mine__c-phase'>{phaseCopy.name}</div>
              <div className='klot-mine__c-day'>
                {self.cycle_known ? (
                  <FormattedMessage
                    id='klot.mine.day_label'
                    defaultMessage='Day {day} · {cycle}-day cycle'
                    values={{
                      day: self.day_of_cycle,
                      cycle: self.cycle_length,
                    }}
                  />
                ) : (
                  <FormattedMessage
                    id='klot.mine.day_label_estimate'
                    defaultMessage='Day {day} · an estimate for now'
                    values={{ day: self.day_of_cycle }}
                  />
                )}
              </div>
              <div className='klot-mine__c-tag'>{phaseCopy.tag}</div>
            </>
          ) : (
            <div className='klot-mine__c-empty'>
              <FormattedMessage {...messages.emptyPhase} />
            </div>
          )}
        </div>
      </div>

      <DayCard
        self={self}
        day={selected}
        entry={days[selected]}
        busy={busy}
        onStart={handleStart}
        onEnd={handleEnd}
        onRemove={handleRemove}
        onEntry={handleEntry}
      />

      {error && (
        <p className='klot__error' role='alert'>
          {error}
        </p>
      )}

      <section className='klot-card'>
        <CycleCalendar
          self={self}
          days={days}
          month={month}
          selected={selected}
          onMonth={setMonth}
          onSelect={setSelected}
        />
      </section>

      <CycleSummary self={self} onSelect={handleSelect} />

      {phaseCopy && (
        <section className='klot-card klot-card--phase'>
          <div className='klot-card__phase-head'>
            <span className='klot-card__phase-name'>{phaseCopy.name}</span>
            <span className='klot-card__phase-tag'>{phaseCopy.tag}</span>
          </div>
          <p className='klot-card__phase-body'>{phaseCopy.body}</p>
          {phaseCopy.note && (
            <p className='klot-card__phase-note'>{phaseCopy.note}</p>
          )}
        </section>
      )}

      <SharedWith />
    </div>
  );
};
