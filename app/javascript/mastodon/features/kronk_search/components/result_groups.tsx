import { defineMessages, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import type {
  ApiKronkSearchHit,
  ApiSearchResults,
} from 'mastodon/api/kronk_search';
import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';

// Renders result groups by object type per spec §"Universal search
// results". Each group shows a heading + count + up to N compact
// entries; deeper drill-in ("See all") is a follow-up once
// per-type endpoints exist.
//
// Each row links to its subject: a person → their profile, a post →
// the status, a kategory → its timeline. (Richer inline rows — avatars,
// an inline follow/orbit action — are a follow-up; the link is what
// makes results actually usable.)

const messages = defineMessages({
  accountsHeader: {
    id: 'kronk_search.results.accounts',
    defaultMessage: '{count, plural, one {# person} other {# people}}',
  },
  statusesHeader: {
    id: 'kronk_search.results.statuses',
    defaultMessage: '{count, plural, one {# post} other {# posts}}',
  },
  hashtagsHeader: {
    id: 'kronk_search.results.hashtags',
    defaultMessage: '{count, plural, one {# kategory} other {# kategories}}',
  },
  eventsHeader: {
    id: 'kronk_search.results.events',
    defaultMessage: '{count, plural, one {# event} other {# events}}',
  },
  proposalsHeader: {
    id: 'kronk_search.results.proposals',
    defaultMessage: '{count, plural, one {# proposal} other {# proposals}}',
  },
  boothSetsHeader: {
    id: 'kronk_search.results.booth_sets',
    defaultMessage: '{count, plural, one {# set} other {# sets}}',
  },
  listingsHeader: {
    id: 'kronk_search.results.listings',
    defaultMessage: '{count, plural, one {# listing} other {# listings}}',
  },
  krewsHeader: {
    id: 'kronk_search.results.krews',
    defaultMessage: '{count, plural, one {# krew} other {# krews}}',
  },
  empty: {
    id: 'kronk_search.results.empty',
    defaultMessage: 'No results found for this query.',
  },
});

interface Props {
  results: ApiSearchResults | null;
}

interface AccountShape {
  id?: string;
  acct?: string;
  display_name?: string;
}

interface StatusShape {
  id?: string;
  content?: string;
  spoiler_text?: string;
  account?: AccountShape;
}

interface TagShape {
  name?: string;
}

// Small icon-first row for a Kronk-native hit — one look across every
// korner-native type. `korner` drives the icon via `useKornerIcon` so
// a Kalendar event reads with the spiral, a Krew with the group glyph,
// etc.
const KronkHitRow: React.FC<{ hit: ApiKronkSearchHit }> = ({ hit }) => {
  const KornerIcon = useKornerIcon(hit.korner);
  return (
    <Link to={hit.url} className='kronk-search__kronk-hit'>
      <KornerIcon className='kronk-search__kronk-hit-icon' />
      <span className='kronk-search__kronk-hit-body'>
        <span className='kronk-search__kronk-hit-title'>{hit.title}</span>
        {hit.subtitle && (
          <span className='kronk-search__kronk-hit-subtitle'>
            {hit.subtitle}
          </span>
        )}
      </span>
    </Link>
  );
};

export const ResultGroups: React.FC<Props> = ({ results }) => {
  const intl = useIntl();

  if (!results) return null;

  const accounts = results.accounts as AccountShape[];
  const statuses = results.statuses as StatusShape[];
  const hashtags = results.hashtags as TagShape[];
  const events = results.events ?? [];
  const proposals = results.proposals ?? [];
  const boothSets = results.booth_sets ?? [];
  const listings = results.listings ?? [];
  const krews = results.krews ?? [];

  const total =
    accounts.length +
    statuses.length +
    hashtags.length +
    events.length +
    proposals.length +
    boothSets.length +
    listings.length +
    krews.length;

  if (total === 0) {
    return (
      <p className='kronk-search__empty'>
        {intl.formatMessage(messages.empty)}
      </p>
    );
  }

  return (
    <div className='kronk-search__result-groups'>
      {accounts.length > 0 && (
        <section className='kronk-search__group'>
          <h3 className='kronk-search__group-heading'>
            {intl.formatMessage(messages.accountsHeader, {
              count: accounts.length,
            })}
          </h3>
          <ul className='kronk-search__group-list'>
            {accounts.map((a) => (
              <li key={a.id ?? a.acct}>
                <Link to={`/@${a.acct}`} className='kronk-search__account'>
                  <strong>{a.display_name ?? a.acct}</strong>
                  <span className='kronk-search__account-acct'>@{a.acct}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {statuses.length > 0 && (
        <section className='kronk-search__group'>
          <h3 className='kronk-search__group-heading'>
            {intl.formatMessage(messages.statusesHeader, {
              count: statuses.length,
            })}
          </h3>
          <ul className='kronk-search__group-list'>
            {statuses.map((s) => (
              <li key={s.id}>
                <Link
                  to={`/@${s.account?.acct}/${s.id}`}
                  className='kronk-search__status'
                >
                  <span className='kronk-search__status-author'>
                    @{s.account?.acct}
                  </span>
                  <p className='kronk-search__status-body'>
                    {s.spoiler_text && s.spoiler_text.length > 0
                      ? s.spoiler_text
                      : (s.content ?? '').replace(/<[^>]+>/g, '').slice(0, 140)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {hashtags.length > 0 && (
        <section className='kronk-search__group'>
          <h3 className='kronk-search__group-heading'>
            {intl.formatMessage(messages.hashtagsHeader, {
              count: hashtags.length,
            })}
          </h3>
          <ul className='kronk-search__group-list'>
            {hashtags.map((t) => (
              <li key={t.name}>
                <Link
                  to={`/tags/${t.name}`}
                  className='kronk-search__kategory kategory-pill'
                >
                  {t.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {events.length > 0 && (
        <KronkGroup
          headingLabel={intl.formatMessage(messages.eventsHeader, {
            count: events.length,
          })}
          hits={events}
        />
      )}
      {proposals.length > 0 && (
        <KronkGroup
          headingLabel={intl.formatMessage(messages.proposalsHeader, {
            count: proposals.length,
          })}
          hits={proposals}
        />
      )}
      {boothSets.length > 0 && (
        <KronkGroup
          headingLabel={intl.formatMessage(messages.boothSetsHeader, {
            count: boothSets.length,
          })}
          hits={boothSets}
        />
      )}
      {listings.length > 0 && (
        <KronkGroup
          headingLabel={intl.formatMessage(messages.listingsHeader, {
            count: listings.length,
          })}
          hits={listings}
        />
      )}
      {krews.length > 0 && (
        <KronkGroup
          headingLabel={intl.formatMessage(messages.krewsHeader, {
            count: krews.length,
          })}
          hits={krews}
        />
      )}
    </div>
  );
};

const KronkGroup: React.FC<{
  headingLabel: string;
  hits: ApiKronkSearchHit[];
}> = ({ headingLabel, hits }) => (
  <section className='kronk-search__group'>
    <h3 className='kronk-search__group-heading'>{headingLabel}</h3>
    <ul className='kronk-search__group-list'>
      {hits.map((hit) => (
        <li key={`${hit.korner}-${hit.id}`}>
          <KronkHitRow hit={hit} />
        </li>
      ))}
    </ul>
  </section>
);
