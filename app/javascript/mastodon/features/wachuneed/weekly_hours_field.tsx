import { useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import type { ApiListingHoursJSON } from 'mastodon/api_types/wachuneed';

// When someone is free, week by week: a row per stretch (a day, from, to),
// in their own time zone. Used by the offering composer; the server cuts
// it into bookable times (Wachuneed::BookingTimes).

const messages = defineMessages({
  day: { id: 'wachuneed.hours.day', defaultMessage: 'Day' },
  from: { id: 'wachuneed.hours.from', defaultMessage: 'From' },
  to: { id: 'wachuneed.hours.to', defaultMessage: 'To' },
  add: { id: 'wachuneed.hours.add', defaultMessage: '+ Add hours' },
  remove: {
    id: 'wachuneed.hours.remove',
    defaultMessage: 'Remove these hours',
  },
});

const A_SUNDAY = Date.UTC(2026, 10, 1);
export const MAX_HOURS = 21;

export const WEEKDAYS_NINE_TO_FIVE: ApiListingHoursJSON[] = [1, 2, 3, 4, 5].map(
  (day) => ({ day, from: '09:00', to: '17:00' }),
);

const Row: React.FC<{
  index: number;
  row: ApiListingHoursJSON;
  onChange: (index: number, row: ApiListingHoursJSON | null) => void;
}> = ({ index, row, onChange }) => {
  const intl = useIntl();
  const dayName = (day: number) =>
    intl.formatDate(A_SUNDAY + day * 86_400_000, {
      weekday: 'short',
      timeZone: 'UTC',
    });

  const handleDay = useCallback<React.ChangeEventHandler<HTMLSelectElement>>(
    (e) => {
      onChange(index, { ...row, day: Number(e.currentTarget.value) });
    },
    [index, row, onChange],
  );
  const handleFrom = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      onChange(index, { ...row, from: e.currentTarget.value });
    },
    [index, row, onChange],
  );
  const handleTo = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      onChange(index, { ...row, to: e.currentTarget.value });
    },
    [index, row, onChange],
  );
  const handleRemove = useCallback(() => {
    onChange(index, null);
  }, [index, onChange]);

  return (
    <li className='wachuneed-rows__row'>
      <select
        className='compose-input compose-input--select'
        value={row.day}
        onChange={handleDay}
        aria-label={intl.formatMessage(messages.day)}
      >
        {[1, 2, 3, 4, 5, 6, 0].map((day) => (
          <option key={day} value={day}>
            {dayName(day)}
          </option>
        ))}
      </select>
      <input
        type='time'
        className='compose-input'
        value={row.from}
        onChange={handleFrom}
        aria-label={intl.formatMessage(messages.from)}
      />
      <input
        type='time'
        className='compose-input'
        value={row.to}
        onChange={handleTo}
        aria-label={intl.formatMessage(messages.to)}
      />
      <button
        type='button'
        className='wachuneed-rows__remove'
        onClick={handleRemove}
        aria-label={intl.formatMessage(messages.remove)}
        title={intl.formatMessage(messages.remove)}
      >
        ×
      </button>
    </li>
  );
};

export const WeeklyHoursField: React.FC<{
  value: ApiListingHoursJSON[];
  onChange: (value: ApiListingHoursJSON[]) => void;
}> = ({ value, onChange }) => {
  const intl = useIntl();

  const handleRow = useCallback(
    (index: number, row: ApiListingHoursJSON | null) => {
      const next = [...value];
      if (row) next[index] = row;
      else next.splice(index, 1);
      onChange(next);
    },
    [value, onChange],
  );
  const handleAdd = useCallback(() => {
    const last = value[value.length - 1];
    onChange([
      ...value,
      last
        ? { ...last, day: (last.day + 1) % 7 }
        : { day: 1, from: '09:00', to: '17:00' },
    ]);
  }, [value, onChange]);

  return (
    <div className='wachuneed-rows'>
      <ul className='wachuneed-rows__list'>
        {value.map((row, index) => (
          <Row
            // Rows have no ids; a stretch is its place in the list.

            key={index}
            index={index}
            row={row}
            onChange={handleRow}
          />
        ))}
      </ul>
      {value.length < MAX_HOURS && (
        <button
          type='button'
          className='wachuneed-rows__add'
          onClick={handleAdd}
        >
          {intl.formatMessage(messages.add)}
        </button>
      )}
    </div>
  );
};
