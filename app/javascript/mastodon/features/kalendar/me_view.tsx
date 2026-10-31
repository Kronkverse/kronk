import { useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import { apiRequestGet } from 'mastodon/api';

// Kalendar "Me" face (was "Birthdays" until 2026-09-08) — the viewer's
// Mates' upcoming birthdays,
// synthesized server-side from each Mate's `birthday` profile field
// (GET /api/v1/kalendar/birthdays). Read-only + always current; no stored
// events. A quiet list, soonest first.
//
// Above them, your accepted Wachuneed bookings both ways, soonest first
// (GET /api/v1/kalendar/bookings; docs/spaces/wachuneed.md, Booking): what
// you booked and what was booked from you, each with the other person.
// Only the two of them see a booking. Left out when there are none.

interface BirthdayAccount {
  id: string;
  acct: string;
  display_name: string;
  avatar: string;
}

interface BirthdayEntry {
  account: BirthdayAccount;
  date: string;
  days_until: number;
}

interface BookingEntry {
  id: string;
  starts_at: string;
  ends_at: string | null;
  title: string;
  listing: { id: string; slug: string | null };
  side: 'seller' | 'buyer';
  with: BirthdayAccount;
}

const messages = defineMessages({
  bookings: {
    id: 'kalendar.bookings.heading',
    defaultMessage: 'Bookings',
  },
  bookedFrom: {
    id: 'kalendar.bookings.booked_from',
    defaultMessage: 'with {name}',
  },
  heading: {
    id: 'kalendar.birthdays.heading',
    defaultMessage: 'Mate birthdays',
  },
  loading: { id: 'kalendar.birthdays.loading', defaultMessage: 'Loading…' },
  empty: {
    id: 'kalendar.birthdays.empty',
    defaultMessage: 'No birthdays coming up among your Mates.',
  },
  today: { id: 'kalendar.birthdays.today', defaultMessage: 'Today' },
  tomorrow: { id: 'kalendar.birthdays.tomorrow', defaultMessage: 'Tomorrow' },
  inDays: {
    id: 'kalendar.birthdays.in_days',
    defaultMessage: 'in {days, plural, one {# day} other {# days}}',
  },
});

const Bookings: React.FC = () => {
  const intl = useIntl();
  const [bookings, setBookings] = useState<BookingEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    void apiRequestGet<BookingEntry[]>('v1/kalendar/bookings')
      .then((data) => {
        if (!cancelled) setBookings(data);
        return undefined;
      })
      .catch(() => {
        // Non-blocking: the birthdays still show.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (bookings.length === 0) return null;

  return (
    <div className='kalendar-birthdays kalendar-bookings'>
      <h2 className='kalendar-birthdays__heading'>
        {intl.formatMessage(messages.bookings)}
      </h2>
      {bookings.map((booking) => (
        <Link
          key={booking.id}
          to={`/hub/wachuneed/listings/${booking.listing.slug ?? booking.listing.id}`}
          className='kalendar-birthdays__row'
        >
          <img
            className='kalendar-birthdays__avatar'
            src={booking.with.avatar}
            alt=''
          />
          <span className='kalendar-birthdays__name'>
            {booking.title}{' '}
            <span className='kalendar-bookings__with'>
              {intl.formatMessage(messages.bookedFrom, {
                name: booking.with.display_name || booking.with.acct,
              })}
            </span>
          </span>
          <span className='kalendar-birthdays__date'>
            {intl.formatDate(booking.starts_at, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
          </span>
          <span className='kalendar-birthdays__countdown'>
            {intl.formatTime(booking.starts_at, {
              hour: 'numeric',
              minute: '2-digit',
            })}
          </span>
        </Link>
      ))}
    </div>
  );
};

export const KalendarMeView: React.FC = () => {
  const intl = useIntl();
  const [entries, setEntries] = useState<BirthdayEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void apiRequestGet<BirthdayEntry[]>('v1/kalendar/birthdays')
      .then((data) => {
        if (!cancelled) setEntries(data);
        return undefined;
      })
      .catch(() => {
        if (!cancelled) setEntries([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (entries === null) {
    return (
      <>
        <Bookings />
        <div className='kalendar-birthdays__status'>
          {intl.formatMessage(messages.loading)}
        </div>
      </>
    );
  }

  if (entries.length === 0) {
    return (
      <>
        <Bookings />
        <div className='kalendar-birthdays__status'>
          {intl.formatMessage(messages.empty)}
        </div>
      </>
    );
  }

  return (
    <>
      <Bookings />
      <div className='kalendar-birthdays'>
        <h2 className='kalendar-birthdays__heading'>
          {intl.formatMessage(messages.heading)}
        </h2>
        {entries.map((entry) => {
          const countdown =
            entry.days_until === 0
              ? intl.formatMessage(messages.today)
              : entry.days_until === 1
                ? intl.formatMessage(messages.tomorrow)
                : intl.formatMessage(messages.inDays, {
                    days: entry.days_until,
                  });

          return (
            <Link
              key={entry.account.id}
              to={`/@${entry.account.acct}`}
              className='kalendar-birthdays__row'
            >
              <img
                className='kalendar-birthdays__avatar'
                src={entry.account.avatar}
                alt=''
              />
              <span className='kalendar-birthdays__name'>
                {entry.account.display_name || entry.account.acct}
              </span>
              <span className='kalendar-birthdays__date'>
                {intl.formatDate(entry.date, {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
              <span className='kalendar-birthdays__countdown'>{countdown}</span>
            </Link>
          );
        })}
      </div>
    </>
  );
};
