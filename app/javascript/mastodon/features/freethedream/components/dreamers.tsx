import { defineMessages, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import type { FtdPersonRow } from 'mastodon/api_types/freethedream';
import { RelativeTimestamp } from 'mastodon/components/relative_timestamp';

import { Section } from './shared';

// Everyone in a project, side by side, whoever did something in it most
// recently first, so you can see who's driving it right now. Doing
// something is adding, bringing, claiming, saying something or joining;
// looking at a page doesn't count (Tal, 2026-10-15).

const messages = defineMessages({
  title: { id: 'freethedream.dreamers', defaultMessage: 'Dreamers' },
  jobs: {
    id: 'freethedream.person.jobs',
    defaultMessage: '{count, plural, one {# job} other {# jobs}}',
  },
  bringing: {
    id: 'freethedream.person.bringing',
    defaultMessage: 'bringing {count, plural, one {# thing} other {# things}}',
  },
  gone: { id: 'freethedream.dreamers.gone', defaultMessage: 'Someone' },
});

export const Dreamers: React.FC<{
  people: FtdPersonRow[];
  count: number;
}> = ({ people, count }) => {
  const intl = useIntl();
  if (people.length === 0) return null;

  return (
    <Section
      title={
        <>
          {intl.formatMessage(messages.title)}{' '}
          <span className='freethedream-section__count'>{count}</span>
        </>
      }
    >
      <ul className='freethedream-dreamers'>
        {people.map((row) => {
          const on = [
            row.jobs > 0 &&
              intl.formatMessage(messages.jobs, { count: row.jobs }),
            row.bringing > 0 &&
              intl.formatMessage(messages.bringing, { count: row.bringing }),
          ].filter(Boolean);
          const body = (
            <>
              {row.account && (
                <img
                  className='freethedream-dreamer__avatar'
                  src={row.account.avatar}
                  alt=''
                />
              )}
              <span className='freethedream-dreamer__name'>
                {row.account?.display_name ?? intl.formatMessage(messages.gone)}
              </span>
              {on.length > 0 && (
                <span className='freethedream-dreamer__on'>
                  {on.join(' · ')}
                </span>
              )}
              <span className='freethedream-dreamer__when'>
                <RelativeTimestamp timestamp={row.last_active} />
              </span>
            </>
          );
          return (
            <li key={row.account?.id ?? 'gone'}>
              {row.account ? (
                <Link
                  to={`/@${row.account.acct}`}
                  className='freethedream-dreamer'
                >
                  {body}
                </Link>
              ) : (
                <span className='freethedream-dreamer'>{body}</span>
              )}
            </li>
          );
        })}
      </ul>
    </Section>
  );
};
