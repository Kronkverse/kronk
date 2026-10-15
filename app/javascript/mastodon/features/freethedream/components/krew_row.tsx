import { defineMessages, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import type { FtdPersonRow, FtdProject } from 'mastodon/api_types/freethedream';
import { RelativeTimestamp } from 'mastodon/components/relative_timestamp';

import { Section } from './shared';

// The emergence's Krew: everyone in it, side by side, whoever did
// something in it most recently first, so you can see who's driving it
// right now. Doing something is adding, bringing, jumping on board, saying
// something or joining; looking at a page doesn't count (Tal, 2026-10-15).
// It's a real Krew (docs/spaces/freethedream.md, "The Krew"): the title
// opens its page, with its chat and posts.

const messages = defineMessages({
  title: { id: 'freethedream.krew', defaultMessage: 'Krew' },
  open: { id: 'freethedream.krew.open', defaultMessage: 'Open the Krew' },
  jobs: {
    id: 'freethedream.person.actualising',
    defaultMessage: 'actualising {count}',
  },
  bringing: {
    id: 'freethedream.person.bringing',
    defaultMessage: 'bringing {count, plural, one {# thing} other {# things}}',
  },
  gone: { id: 'freethedream.krew.gone', defaultMessage: 'Someone' },
});

export const KrewRow: React.FC<{
  krew: FtdProject['krew'];
  people: FtdPersonRow[];
  count: number;
}> = ({ krew, people, count }) => {
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
      aside={
        krew && (
          <Link to={`/hub/krew/${krew.slug}`} className='freethedream__link'>
            {intl.formatMessage(messages.open)}
          </Link>
        )
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
