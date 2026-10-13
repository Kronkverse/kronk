import { useCallback, useMemo } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import classNames from 'classnames';

import type { ApiKlotDayJSON, ApiKlotSelfJSON } from 'mastodon/api/klot';

import { addDays, fromIso, monthGrid, shiftMonth, todayIso } from '../dates';
import type { Month } from '../dates';

// A month of the cycle: bleed days filled, the window the next period is
// expected in outlined, and a dot on any day that has something written
// on it. Tapping a day up to today picks it, and the day card below then
// writes to that day. This is how anything is logged in retrospect.

const messages = defineMessages({
  previous: { id: 'klot.calendar.previous', defaultMessage: 'Month before' },
  next: { id: 'klot.calendar.next', defaultMessage: 'Month after' },
  period: { id: 'klot.calendar.period', defaultMessage: 'Period' },
  expected: {
    id: 'klot.calendar.expected',
    defaultMessage: 'Next period expected',
  },
  noted: { id: 'klot.calendar.noted', defaultMessage: 'Something logged' },
});

// The days each logged period covers. One still going runs to today.
export const periodDays = (self: ApiKlotSelfJSON): Set<string> => {
  const today = todayIso();
  const days = new Set<string>();

  self.logs.forEach((log, index) => {
    const stillGoing = index === 0 && log.ended_on === null && self.bleeding;
    const last =
      log.ended_on ??
      (stillGoing ? today : addDays(log.started_on, self.period_length - 1));
    for (let day = log.started_on; day <= last; day = addDays(day, 1))
      days.add(day);
  });

  return days;
};

interface Props {
  self: ApiKlotSelfJSON;
  days: Record<string, ApiKlotDayJSON>;
  month: Month;
  selected: string;
  onMonth: (month: Month) => void;
  onSelect: (day: string) => void;
}

export const CycleCalendar: React.FC<Props> = ({
  self,
  days,
  month,
  selected,
  onMonth,
  onSelect,
}) => {
  const intl = useIntl();
  const today = todayIso();
  const grid = useMemo(() => monthGrid(month), [month]);
  const bleeds = useMemo(() => periodDays(self), [self]);
  const next = self.next_period;

  const title = intl.formatDate(new Date(month.year, month.month, 1), {
    month: 'long',
    year: 'numeric',
  });
  const weekdays = useMemo(
    () =>
      grid
        .slice(0, 7)
        .map((day) => intl.formatDate(fromIso(day), { weekday: 'narrow' })),
    [grid, intl],
  );

  const handlePrevious = useCallback(() => {
    onMonth(shiftMonth(month, -1));
  }, [month, onMonth]);
  const handleNext = useCallback(() => {
    onMonth(shiftMonth(month, 1));
  }, [month, onMonth]);
  const handleDay = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const day = e.currentTarget.dataset.day;
      if (day) onSelect(day);
    },
    [onSelect],
  );

  return (
    <div className='klot-cal'>
      <div className='klot-cal__head'>
        <button
          type='button'
          className='klot-cal__nav'
          onClick={handlePrevious}
          aria-label={intl.formatMessage(messages.previous)}
        >
          ‹
        </button>
        <span className='klot-cal__title'>{title}</span>
        <button
          type='button'
          className='klot-cal__nav'
          onClick={handleNext}
          aria-label={intl.formatMessage(messages.next)}
        >
          ›
        </button>
      </div>

      <div className='klot-cal__grid'>
        {weekdays.map((name, i) => (
          <span key={i} className='klot-cal__weekday' aria-hidden='true'>
            {name}
          </span>
        ))}

        {grid.map((day) => {
          const date = fromIso(day);
          const entry = days[day];
          const bleeding = bleeds.has(day);
          const expected =
            !bleeding && !!next && day >= next.from && day <= next.to;

          return (
            <button
              key={day}
              type='button'
              data-day={day}
              onClick={handleDay}
              disabled={day > today}
              aria-pressed={day === selected}
              aria-label={intl.formatDate(date, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
              className={classNames('klot-cal__day', {
                'klot-cal__day--outside': date.getMonth() !== month.month,
                'klot-cal__day--period': bleeding,
                'klot-cal__day--spotting': !bleeding && !!entry?.flow,
                'klot-cal__day--expected': expected,
                'klot-cal__day--today': day === today,
                'klot-cal__day--selected': day === selected,
              })}
            >
              {date.getDate()}
              {entry && (entry.symptoms.length > 0 || entry.note !== '') && (
                <span className='klot-cal__dot' aria-hidden='true' />
              )}
            </button>
          );
        })}
      </div>

      <ul className='klot-cal__key'>
        <li className='klot-cal__key-item klot-cal__key-item--period'>
          {intl.formatMessage(messages.period)}
        </li>
        {next && (
          <li className='klot-cal__key-item klot-cal__key-item--expected'>
            {intl.formatMessage(messages.expected)}
          </li>
        )}
        <li className='klot-cal__key-item klot-cal__key-item--noted'>
          {intl.formatMessage(messages.noted)}
        </li>
      </ul>
    </div>
  );
};
