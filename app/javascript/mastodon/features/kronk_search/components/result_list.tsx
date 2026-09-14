import { defineMessages, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import type {
  ApiKronkSearchHit,
  ApiSearchResults,
} from 'mastodon/api/kronk_search';
import { Icon } from 'mastodon/components/icon';
import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';

// One mixed list, newest first (Tal 2026-09-14: "one mixed list,
// chronological order").
//
// Results used to come back grouped by type — all the people, then all the
// posts — which asks you to know what kind of thing you are looking for
// before you have found it. Searching is the opposite of that: you remember a
// word, not a category. So everything lands in one run and each row says what
// it is.
//
// Every row wears the icon of the space it lives in, read from that space's
// own manifest through `useKornerIcon` — the same glyph the korner uses in
// the Hub and in its own chrome. Nothing is hardcoded here, so a korner
// shipped next month is badged correctly in search the day it lands.
//
// The two types that belong to no korner borrow the space they live in: a
// post takes the Feed glyph, a person takes the Profile one. A kategory has
// no space at all and falls through to the accent circle, which is the
// honest answer rather than an invented icon.

const messages = defineMessages({
  post: { id: 'kronk_search.kind.post', defaultMessage: 'Post' },
  person: { id: 'kronk_search.kind.person', defaultMessage: 'Person' },
  kategory: { id: 'kronk_search.kind.kategory', defaultMessage: 'Kategory' },
  event: { id: 'kronk_search.kind.event', defaultMessage: 'Event' },
  proposal: { id: 'kronk_search.kind.proposal', defaultMessage: 'Proposal' },
  set: { id: 'kronk_search.kind.set', defaultMessage: 'Set' },
  listing: { id: 'kronk_search.kind.listing', defaultMessage: 'Listing' },
  krew: { id: 'kronk_search.kind.krew', defaultMessage: 'Krew' },
  empty: {
    id: 'kronk_search.results.empty',
    defaultMessage: 'No results found for this query.',
  },
});

interface AccountShape {
  id?: string;
  acct?: string;
  display_name?: string;
  created_at?: string;
}

interface StatusShape {
  id?: string;
  content?: string;
  spoiler_text?: string;
  created_at?: string;
  account?: AccountShape;
}

interface TagShape {
  name?: string;
}

// What a row needs to draw itself, whatever it started life as.
interface Row {
  key: string;
  // The korner whose icon badges this row. Undefined for a kategory.
  korner?: string;
  kind: keyof typeof messages;
  title: string;
  subtitle: string | null;
  url: string;
  // Milliseconds, for the sort. Undated rows sink to the bottom rather than
  // floating to the top on a falsy date.
  at: number;
}

const plainText = (html: string): string =>
  html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const timeOf = (iso: string | null | undefined): number =>
  iso ? new Date(iso).getTime() : 0;

const ResultRow: React.FC<{ row: Row }> = ({ row }) => {
  const intl = useIntl();
  const KornerIcon = useKornerIcon(row.korner);

  return (
    <Link to={row.url} className='kronk-search__row'>
      <span className='kronk-search__row-badge'>
        <Icon id={`space-${row.korner ?? 'none'}`} icon={KornerIcon} />
        {intl.formatMessage(messages[row.kind])}
      </span>
      <span className='kronk-search__row-body'>
        <span className='kronk-search__row-title'>{row.title}</span>
        {row.subtitle && (
          <span className='kronk-search__row-subtitle'>{row.subtitle}</span>
        )}
      </span>
    </Link>
  );
};

const kronkRows = (
  hits: ApiKronkSearchHit[] | undefined,
  kind: Row['kind'],
): Row[] =>
  (hits ?? []).map((hit) => ({
    key: `${kind}-${hit.id}`,
    korner: hit.korner,
    kind,
    title: hit.title,
    subtitle: hit.subtitle,
    url: hit.url,
    at: timeOf(hit.at),
  }));

export const ResultList: React.FC<{ results: ApiSearchResults | null }> = ({
  results,
}) => {
  const intl = useIntl();

  if (!results) return null;

  const accounts = results.accounts as AccountShape[];
  const statuses = results.statuses as StatusShape[];
  const hashtags = results.hashtags as TagShape[];

  const rows: Row[] = [
    ...accounts.map((account) => ({
      key: `person-${account.id ?? account.acct ?? ''}`,
      korner: 'profile',
      kind: 'person' as const,
      title: account.display_name?.trim() ?? `@${account.acct ?? ''}`,
      subtitle: account.acct ? `@${account.acct}` : null,
      url: `/@${account.acct ?? ''}`,
      at: timeOf(account.created_at),
    })),
    ...statuses.map((status) => ({
      key: `post-${status.id ?? ''}`,
      korner: 'feed',
      kind: 'post' as const,
      title:
        plainText(status.spoiler_text ?? '') || plainText(status.content ?? ''),
      subtitle: status.account?.acct ? `@${status.account.acct}` : null,
      url: `/@${status.account?.acct ?? ''}/${status.id ?? ''}`,
      at: timeOf(status.created_at),
    })),
    ...hashtags.map((tag) => ({
      key: `kategory-${tag.name ?? ''}`,
      korner: undefined,
      kind: 'kategory' as const,
      title: `#${tag.name ?? ''}`,
      subtitle: null,
      url: `/tags/${tag.name ?? ''}`,
      at: 0,
    })),
    ...kronkRows(results.events, 'event'),
    ...kronkRows(results.proposals, 'proposal'),
    ...kronkRows(results.booth_sets, 'set'),
    ...kronkRows(results.listings, 'listing'),
    ...kronkRows(results.krews, 'krew'),
  ].sort((a, b) => b.at - a.at);

  if (rows.length === 0) {
    return (
      <p className='kronk-search__empty'>
        {intl.formatMessage(messages.empty)}
      </p>
    );
  }

  return (
    <ul className='kronk-search__results'>
      {rows.map((row) => (
        <li key={row.key}>
          <ResultRow row={row} />
        </li>
      ))}
    </ul>
  );
};
