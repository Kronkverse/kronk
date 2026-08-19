import { useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import { apiRequestGet } from 'mastodon/api';

// Kalendar "Birthdays" face — the viewer's Mates' upcoming birthdays,
// synthesized server-side from each Mate's `birthday` profile field
// (GET /api/v1/kalendar/birthdays). Read-only + always current; no stored
// events. A quiet list, soonest first.

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

const messages = defineMessages({
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

export const KalendarBirthdaysView: React.FC = () => {
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
      <div className='kalendar-birthdays__status'>
        {intl.formatMessage(messages.loading)}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className='kalendar-birthdays__status'>
        {intl.formatMessage(messages.empty)}
      </div>
    );
  }

  return (
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
              : intl.formatMessage(messages.inDays, { days: entry.days_until });

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
              {intl.formatDate(entry.date, { month: 'short', day: 'numeric' })}
            </span>
            <span className='kalendar-birthdays__countdown'>{countdown}</span>
          </Link>
        );
      })}
    </div>
  );
};
