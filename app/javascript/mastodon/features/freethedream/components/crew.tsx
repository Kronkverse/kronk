import { defineMessages, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import type { FtdCrewRow } from 'mastodon/api_types/freethedream';

import { Section } from './shared';

// Who's in a gang or a fractal, first thing on its page (Tal, 2026-10-15):
// everyone with a hand in it, side by side, each with what they're
// bringing and actualising there. Whoever is on the most comes first. Being
// in a gang is doing something in it; there's no joining a gang.

const messages = defineMessages({
  title: { id: 'freethedream.crew.title', defaultMessage: 'Who’s in it' },
  empty: {
    id: 'freethedream.crew.empty',
    defaultMessage:
      'Nobody yet. Bring something or jump on board below, and you’re in.',
  },
  bringing: {
    id: 'freethedream.crew.bringing',
    defaultMessage: 'Bringing {things}',
  },
  actualising: {
    id: 'freethedream.crew.actualising',
    defaultMessage: 'Actualising {things}',
  },
});

export const Crew: React.FC<{ crew: FtdCrewRow[] }> = ({ crew }) => {
  const intl = useIntl();
  const list = (refs: FtdCrewRow['bringing']) =>
    refs.map((r) => r.title).join(', ');

  return (
    <Section
      title={
        <>
          {intl.formatMessage(messages.title)}{' '}
          {crew.length > 0 && (
            <span className='freethedream-section__count'>{crew.length}</span>
          )}
        </>
      }
    >
      {crew.length === 0 ? (
        <p className='freethedream__quiet'>
          {intl.formatMessage(messages.empty)}
        </p>
      ) : (
        <ul className='freethedream-dreamers'>
          {crew.map((row) => (
            <li key={row.account.id}>
              <Link
                to={`/@${row.account.acct}`}
                className='freethedream-dreamer freethedream-dreamer--crew'
              >
                <img
                  className='freethedream-dreamer__avatar'
                  src={row.account.avatar}
                  alt=''
                />
                <span className='freethedream-dreamer__name'>
                  {row.account.display_name}
                </span>
                {row.bringing.length > 0 && (
                  <span className='freethedream-dreamer__on'>
                    {intl.formatMessage(messages.bringing, {
                      things: list(row.bringing),
                    })}
                  </span>
                )}
                {row.actualising.length > 0 && (
                  <span className='freethedream-dreamer__on'>
                    {intl.formatMessage(messages.actualising, {
                      things: list(row.actualising),
                    })}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
};
