import { useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import type { ApiTicketDateJSON } from 'mastodon/api_types/wachuneed';

// A ticketed listing's dates on its page (docs/spaces/wachuneed.md,
// Tickets): each with when, where and the seats left, picked like a radio.
// Read-only (no `onChange`) when the tickets are sold elsewhere.

const messages = defineMessages({
  heading: { id: 'wachuneed.tickets.dates', defaultMessage: 'Dates' },
  left: {
    id: 'wachuneed.tickets.left',
    defaultMessage: '{count, plural, one {# seat left} other {# seats left}}',
  },
  full: { id: 'wachuneed.tickets.full', defaultMessage: 'Full' },
  none: {
    id: 'wachuneed.tickets.none',
    defaultMessage: 'No dates coming up.',
  },
});

const DateChoice: React.FC<{
  date: ApiTicketDateJSON;
  picked: boolean;
  onPick?: (id: string) => void;
}> = ({ date, picked, onPick }) => {
  const intl = useIntl();
  const full = date.seats_left === 0;
  const handleClick = useCallback(() => {
    onPick?.(date.id);
  }, [date.id, onPick]);

  const format: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  };
  const when = date.ends_at
    ? intl.formatDateTimeRange(
        new Date(date.starts_at),
        new Date(date.ends_at),
        format,
      )
    : intl.formatDate(date.starts_at, format);

  const body = (
    <>
      <span className='wachuneed-ticket-date__when'>{when}</span>
      {date.place && (
        <span className='wachuneed-ticket-date__place'>{date.place}</span>
      )}
      {date.seats_left !== null && (
        <span className='wachuneed-ticket-date__seats'>
          {full
            ? intl.formatMessage(messages.full)
            : intl.formatMessage(messages.left, { count: date.seats_left })}
        </span>
      )}
    </>
  );

  return (
    <li>
      {onPick ? (
        <button
          type='button'
          role='radio'
          aria-checked={picked}
          disabled={full}
          className={
            picked
              ? 'wachuneed-ticket-date wachuneed-ticket-date--on'
              : 'wachuneed-ticket-date'
          }
          onClick={handleClick}
        >
          {body}
        </button>
      ) : (
        <div className='wachuneed-ticket-date'>{body}</div>
      )}
    </li>
  );
};

export const TicketDatesField: React.FC<{
  dates: ApiTicketDateJSON[];
  value: string | null;
  onChange?: (id: string) => void;
}> = ({ dates, value, onChange }) => {
  const intl = useIntl();
  if (dates.length === 0) {
    return (
      <p className='wachuneed__compose-hint'>
        {intl.formatMessage(messages.none)}
      </p>
    );
  }
  return (
    <div className='wachuneed-ticket-dates'>
      <span className='wachuneed__compose-label'>
        {intl.formatMessage(messages.heading)}
      </span>
      <ul
        className='wachuneed-ticket-dates__list'
        role={onChange ? 'radiogroup' : undefined}
        aria-label={intl.formatMessage(messages.heading)}
      >
        {dates.map((date) => (
          <DateChoice
            key={date.id}
            date={date}
            picked={value === date.id}
            onPick={onChange}
          />
        ))}
      </ul>
    </div>
  );
};
