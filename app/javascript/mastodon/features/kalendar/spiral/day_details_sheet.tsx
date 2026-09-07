import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import api from 'mastodon/api';
import { Icon } from 'mastodon/components/icon';

import { moonPhase, seasonalMarker } from './astronomy';

// The tap-day sheet. Slides up from the bottom when a Spiral tile is
// tapped, showing what's on that day:
//   - Astronomy: new/full moon or equinox/solstice, if any
//   - Birthdays: mates with birthdays on this day (from the map the
//     Spiral already loaded — passed in as a prop, no re-fetch)
//   - Events: Kalendar events starting on this day, fetched on open
//
// Events use the existing GET /api/v1/events?filter=upcoming feed and
// filter client-side to the tapped day. That covers the "future days"
// path (which is 95% of what you tap in a forward-facing calendar); a
// follow-up will extend the API with a date-range param so tapping a
// past day surfaces its history too.

export interface BirthdayEntry {
  account: {
    id: string;
    acct: string;
    display_name: string;
    avatar: string;
  };
  date: string;
  days_until: number;
}

interface EventSummary {
  id: string;
  slug: string | null;
  title: string;
  start_time: string;
  end_time: string | null;
  event_type: string;
  location_name: string | null;
}

interface Props {
  date: Date;
  birthdays: BirthdayEntry[];
  onClose: () => void;
}

const messages = defineMessages({
  close: { id: 'kalendar.day_sheet.close', defaultMessage: 'Close' },
  astronomyHeading: {
    id: 'kalendar.day_sheet.astronomy',
    defaultMessage: 'Sky',
  },
  birthdaysHeading: {
    id: 'kalendar.day_sheet.birthdays',
    defaultMessage: 'Birthdays',
  },
  eventsHeading: {
    id: 'kalendar.day_sheet.events',
    defaultMessage: 'Events',
  },
  eventsEmpty: {
    id: 'kalendar.day_sheet.events_empty',
    defaultMessage: 'Nothing on this day.',
  },
  eventsLoading: {
    id: 'kalendar.day_sheet.events_loading',
    defaultMessage: 'Loading…',
  },
  moonNew: { id: 'kalendar.day_sheet.moon_new', defaultMessage: 'New moon' },
  moonFull: {
    id: 'kalendar.day_sheet.moon_full',
    defaultMessage: 'Full moon',
  },
  marchEquinox: {
    id: 'kalendar.day_sheet.march_equinox',
    defaultMessage: 'March equinox',
  },
  juneSolstice: {
    id: 'kalendar.day_sheet.june_solstice',
    defaultMessage: 'June solstice',
  },
  septemberEquinox: {
    id: 'kalendar.day_sheet.september_equinox',
    defaultMessage: 'September equinox',
  },
  decemberSolstice: {
    id: 'kalendar.day_sheet.december_solstice',
    defaultMessage: 'December solstice',
  },
});

const seasonalLabel = {
  'march-equinox': messages.marchEquinox,
  'june-solstice': messages.juneSolstice,
  'september-equinox': messages.septemberEquinox,
  'december-solstice': messages.decemberSolstice,
} as const;

const sameLocalDate = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export const DayDetailsSheet: React.FC<Props> = ({
  date,
  birthdays,
  onClose,
}) => {
  const intl = useIntl();
  const [events, setEvents] = useState<EventSummary[] | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
    };
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setEvents(null);
    void api()
      .get<EventSummary[]>('/api/v1/events', {
        params: { filter: 'upcoming' },
      })
      .then((res) => {
        if (cancelled) return;
        const filtered = res.data.filter((e) =>
          sameLocalDate(new Date(e.start_time), date),
        );
        setEvents(filtered);
        return undefined;
      })
      .catch(() => {
        if (!cancelled) setEvents([]);
      });
    return () => {
      cancelled = true;
    };
  }, [date]);

  const moon = moonPhase(date);
  const seasonal = seasonalMarker(date);
  const isoDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const dayBirthdays = birthdays.filter((b) => b.date === isoDate);
  const hasAstronomy = moon !== null || seasonal !== null;

  const handleBackdropClick = useCallback(() => {
    onClose();
  }, [onClose]);

  const dayLabel = intl.formatDate(date, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className='day-details-sheet'>
      <button
        type='button'
        className='day-details-sheet__backdrop'
        onClick={handleBackdropClick}
        aria-label={intl.formatMessage(messages.close)}
      />
      <div
        className='day-details-sheet__panel'
        role='dialog'
        aria-modal='true'
        aria-label={dayLabel}
      >
        <div className='day-details-sheet__header'>
          <div className='day-details-sheet__date'>{dayLabel}</div>
          <button
            type='button'
            className='day-details-sheet__close'
            onClick={onClose}
            title={intl.formatMessage(messages.close)}
            aria-label={intl.formatMessage(messages.close)}
          >
            <Icon id='close' icon={CloseIcon} />
          </button>
        </div>

        {hasAstronomy && (
          <section className='day-details-sheet__section'>
            <h3 className='day-details-sheet__section-heading'>
              {intl.formatMessage(messages.astronomyHeading)}
            </h3>
            <ul className='day-details-sheet__astronomy'>
              {moon === 'new' && (
                <li>
                  <span className='kspiral-glyph kspiral-glyph--moon-new' />
                  {intl.formatMessage(messages.moonNew)}
                </li>
              )}
              {moon === 'full' && (
                <li>
                  <span className='kspiral-glyph kspiral-glyph--moon-full' />
                  {intl.formatMessage(messages.moonFull)}
                </li>
              )}
              {seasonal && (
                <li>
                  <span
                    className={`kspiral-glyph kspiral-glyph--${seasonal.startsWith('march') || seasonal.startsWith('september') ? 'equinox' : 'solstice'}`}
                  />
                  {intl.formatMessage(seasonalLabel[seasonal])}
                </li>
              )}
            </ul>
          </section>
        )}

        {dayBirthdays.length > 0 && (
          <section className='day-details-sheet__section'>
            <h3 className='day-details-sheet__section-heading'>
              {intl.formatMessage(messages.birthdaysHeading)}
            </h3>
            <ul className='day-details-sheet__birthdays'>
              {dayBirthdays.map((b) => (
                <li key={b.account.id}>
                  <Link
                    to={`/@${b.account.acct}`}
                    className='day-details-sheet__birthday'
                  >
                    <img
                      className='day-details-sheet__birthday-avatar'
                      src={b.account.avatar}
                      alt=''
                    />
                    <span className='day-details-sheet__birthday-name'>
                      {b.account.display_name || b.account.acct}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className='day-details-sheet__section'>
          <h3 className='day-details-sheet__section-heading'>
            {intl.formatMessage(messages.eventsHeading)}
          </h3>
          {events === null && (
            <div className='day-details-sheet__status'>
              {intl.formatMessage(messages.eventsLoading)}
            </div>
          )}
          {events !== null && events.length === 0 && (
            <div className='day-details-sheet__status'>
              {intl.formatMessage(messages.eventsEmpty)}
            </div>
          )}
          {events !== null && events.length > 0 && (
            <ul className='day-details-sheet__events'>
              {events.map((event) => (
                <li key={event.id}>
                  <Link
                    to={`/hub/kalendar/${event.slug ?? event.id}`}
                    className='day-details-sheet__event'
                  >
                    <span className='day-details-sheet__event-time'>
                      {intl.formatTime(event.start_time)}
                    </span>
                    <span className='day-details-sheet__event-title'>
                      {event.title}
                    </span>
                    {event.location_name && (
                      <span className='day-details-sheet__event-location'>
                        {event.location_name}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};
