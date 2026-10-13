import { useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import type { ApiKlotSelfJSON } from 'mastodon/api/klot';

import { fromIso } from '../dates';

// What the log says about the cycle so far, and the periods it is drawn
// from. Nobody is asked how long their cycle is: it is the average gap
// between the starts of logged periods, so it appears with the second
// one (Kronk::CycleStats on the server).

const messages = defineMessages({
  title: { id: 'klot.summary.title', defaultMessage: 'Your cycle so far' },
  needsOne: {
    id: 'klot.summary.needs_first',
    defaultMessage:
      'Log the day a period starts, today or one from the past, and Klot begins from there.',
  },
  needsTwo: {
    id: 'klot.summary.needs_second',
    defaultMessage:
      'When your next period starts, Klot will know how long your cycle is. Until then it goes by a typical {days} days.',
  },
  cycle: { id: 'klot.summary.cycle', defaultMessage: 'Cycle' },
  cycleValue: {
    id: 'klot.summary.cycle_value',
    defaultMessage: '{days} days',
  },
  cycleRange: {
    id: 'klot.summary.cycle_range',
    defaultMessage:
      '{count, plural, one {from # cycle} other {{shortest} to {longest} days over # cycles}}',
  },
  period: { id: 'klot.summary.period', defaultMessage: 'Period' },
  periodTypical: {
    id: 'klot.summary.period_typical',
    defaultMessage: 'typical, until you log when one ends',
  },
  next: { id: 'klot.summary.next', defaultMessage: 'Next period' },
  nextAround: {
    id: 'klot.summary.next_around',
    defaultMessage: 'around {date}',
  },
  nextWindow: {
    id: 'klot.summary.next_window',
    defaultMessage: 'between {from} and {to}',
  },
  nextLate: {
    id: 'klot.summary.next_late',
    defaultMessage:
      '{days, plural, one {# day late} other {# days late}}, expected {date}',
  },
  periods: { id: 'klot.summary.periods', defaultMessage: 'Periods logged' },
  ongoing: { id: 'klot.summary.ongoing', defaultMessage: 'still going' },
  periodLength: {
    id: 'klot.summary.period_length',
    defaultMessage: '{days, plural, one {# day} other {# days}}',
  },
});

interface Props {
  self: ApiKlotSelfJSON;
  onSelect: (day: string) => void;
}

export const CycleSummary: React.FC<Props> = ({ self, onSelect }) => {
  const intl = useIntl();
  const short = (iso: string) =>
    intl.formatDate(fromIso(iso), { day: 'numeric', month: 'short' });
  const long = (iso: string) =>
    intl.formatDate(fromIso(iso), {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  const handlePeriod = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const day = e.currentTarget.dataset.day;
      if (day) onSelect(day);
    },
    [onSelect],
  );

  const next = self.next_period;

  return (
    <section className='klot-card klot-summary'>
      <h2 className='klot-card__title'>{intl.formatMessage(messages.title)}</h2>

      {self.logs.length === 0 && (
        <p className='klot-card__lead'>
          {intl.formatMessage(messages.needsOne)}
        </p>
      )}
      {self.logs.length > 0 && !self.cycle_known && (
        <p className='klot-card__lead'>
          {intl.formatMessage(messages.needsTwo, { days: self.cycle_length })}
        </p>
      )}

      {self.logs.length > 0 && (
        <dl className='klot-summary__facts'>
          {self.cycle_known && (
            <div className='klot-summary__fact'>
              <dt>{intl.formatMessage(messages.cycle)}</dt>
              <dd>
                {intl.formatMessage(messages.cycleValue, {
                  days: self.cycle_length,
                })}
                <small>
                  {intl.formatMessage(messages.cycleRange, {
                    count: self.cycles_logged,
                    shortest: self.shortest_cycle,
                    longest: self.longest_cycle,
                  })}
                </small>
              </dd>
            </div>
          )}
          <div className='klot-summary__fact'>
            <dt>{intl.formatMessage(messages.period)}</dt>
            <dd>
              {intl.formatMessage(messages.periodLength, {
                days: self.period_length,
              })}
              {!self.period_known && (
                <small>{intl.formatMessage(messages.periodTypical)}</small>
              )}
            </dd>
          </div>
          {next && (
            <div className='klot-summary__fact'>
              <dt>{intl.formatMessage(messages.next)}</dt>
              <dd>
                {next.late_by > 0
                  ? intl.formatMessage(messages.nextLate, {
                      days: next.late_by,
                      date: short(next.expected_on),
                    })
                  : intl.formatMessage(messages.nextAround, {
                      date: short(next.expected_on),
                    })}
                {next.late_by === 0 && next.from !== next.to && (
                  <small>
                    {intl.formatMessage(messages.nextWindow, {
                      from: short(next.from),
                      to: short(next.to),
                    })}
                  </small>
                )}
              </dd>
            </div>
          )}
        </dl>
      )}

      {self.logs.length > 0 && (
        <>
          <h3 className='klot-day__label'>
            {intl.formatMessage(messages.periods)}
          </h3>
          <ul className='klot-card__logs'>
            {self.logs.map((log) => (
              <li key={log.id}>
                <button
                  type='button'
                  className='klot-card__log-row klot-summary__period'
                  data-day={log.started_on}
                  onClick={handlePeriod}
                >
                  <span className='klot-card__log-dot' aria-hidden='true' />
                  <span className='klot-summary__period-dates'>
                    {log.ended_on && log.ended_on !== log.started_on
                      ? `${short(log.started_on)} – ${long(log.ended_on)}`
                      : long(log.started_on)}
                  </span>
                  <span className='klot-summary__period-length'>
                    {log.length
                      ? intl.formatMessage(messages.periodLength, {
                          days: log.length,
                        })
                      : intl.formatMessage(messages.ongoing)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
};
