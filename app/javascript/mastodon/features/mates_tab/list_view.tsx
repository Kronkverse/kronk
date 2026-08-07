// Mates list view — the default face of /@:acct/mates. A clean,
// scannable list of the subject's Mates + inviter + invitees, with a
// search box and a small filter chip row. Rows tap through to the
// person's profile. No SVG, no timeline — just names, dates, and
// relationships (Tal 2026-08-07: "just a simple list of mates").
//
// Data source: the same `useMatesTimeline` fetch that powers the
// event-timeline view. The outer `<MatesTab>` shell owns the fetch
// so both views share it.

import { useCallback, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import type {
  MateBond,
  MatesTimelineData,
  TimelineMember,
} from './use_mates_timeline';

type Filter = 'all' | 'mates' | 'invited' | 'inviter';

interface Row {
  key: string;
  member: TimelineMember;
  badge: 'mate' | 'invitee' | 'inviter';
  since: string; // ISO date used for sort + display
}

const messages = defineMessages({
  searchPlaceholder: {
    id: 'mates_tab.list.search_placeholder',
    defaultMessage: 'Search your community…',
  },
  searchClear: {
    id: 'mates_tab.list.search_clear',
    defaultMessage: 'Clear search',
  },
  filterAll: { id: 'mates_tab.list.filter_all', defaultMessage: 'All' },
  filterMates: { id: 'mates_tab.list.filter_mates', defaultMessage: 'Mates' },
  filterInvited: {
    id: 'mates_tab.list.filter_invited',
    defaultMessage: 'You invited',
  },
  filterInviter: {
    id: 'mates_tab.list.filter_inviter',
    defaultMessage: 'Invited you',
  },
  badgeMate: { id: 'mates_tab.list.badge_mate', defaultMessage: 'Mate' },
  badgeInvitee: {
    id: 'mates_tab.list.badge_invitee',
    defaultMessage: 'You invited',
  },
  badgeInviter: {
    id: 'mates_tab.list.badge_inviter',
    defaultMessage: 'Invited you',
  },
  metaMatesSince: {
    id: 'mates_tab.list.meta_mates_since',
    defaultMessage: 'Mates since {date}',
  },
  metaJoined: {
    id: 'mates_tab.list.meta_joined',
    defaultMessage: 'Joined {date}',
  },
  empty: {
    id: 'mates_tab.list.empty',
    defaultMessage: 'No community yet — invite someone to get things started.',
  },
  noResults: {
    id: 'mates_tab.list.no_results',
    defaultMessage: 'No one matches "{query}".',
  },
});

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

const bondDateFor = (
  subjectId: string,
  otherId: string,
  bonds: readonly MateBond[],
): string | null => {
  const bond = bonds.find(
    (b) =>
      (b.member_a === subjectId && b.member_b === otherId) ||
      (b.member_b === subjectId && b.member_a === otherId),
  );
  return bond?.mates_since ?? null;
};

interface MatesListViewProps {
  data: MatesTimelineData;
  subject: TimelineMember;
}

export const MatesListView: React.FC<MatesListViewProps> = ({
  data,
  subject,
}) => {
  const intl = useIntl();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const handleFilter = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      setFilter(event.currentTarget.dataset.filter as Filter);
    },
    [],
  );

  const onQueryChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
  }, []);

  const clearQuery = useCallback(() => {
    setQuery('');
  }, []);

  // Build a flat, sorted row set from the API shape. Each member other
  // than the subject falls into one of three buckets:
  //   inviter → the one Kronker who brought this subject in (may be null)
  //   invitee → subjects the person invited in
  //   mate    → mutual-follow bond, sorted by bond date
  // Some members are both inviter+mate (or invitee+mate) — the row shows
  // the strongest badge; secondary relationships aren't collapsed today.
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    data.members.forEach((m) => {
      if (m.id === subject.id) return;
      if (m.id === subject.inviter_id) {
        out.push({
          key: `inviter-${m.id}`,
          member: m,
          badge: 'inviter',
          since: m.joined_at,
        });
        return;
      }
      if (m.inviter_id === subject.id) {
        out.push({
          key: `invitee-${m.id}`,
          member: m,
          badge: 'invitee',
          since: m.joined_at,
        });
        return;
      }
      const since = bondDateFor(subject.id, m.id, data.mates);
      if (since) {
        out.push({ key: `mate-${m.id}`, member: m, badge: 'mate', since });
      }
    });
    return out.sort(
      (a, b) => new Date(b.since).getTime() - new Date(a.since).getTime(),
    );
  }, [data.members, data.mates, subject.id, subject.inviter_id]);

  const trimmedQuery = query.trim().toLowerCase();

  const filtered = useMemo<Row[]>(() => {
    const byFilter = rows.filter((r) => {
      if (filter === 'mates') return r.badge === 'mate';
      if (filter === 'invited') return r.badge === 'invitee';
      if (filter === 'inviter') return r.badge === 'inviter';
      return true;
    });
    if (!trimmedQuery) return byFilter;
    return byFilter.filter(
      (r) =>
        r.member.display_name.toLowerCase().includes(trimmedQuery) ||
        r.member.handle.toLowerCase().includes(trimmedQuery),
    );
  }, [rows, filter, trimmedQuery]);

  return (
    <div className='mates-list'>
      <div className='mates-list__toolbar'>
        <div className='mates-list__search'>
          <input
            type='search'
            className='mates-list__search-input'
            value={query}
            onChange={onQueryChange}
            placeholder={intl.formatMessage(messages.searchPlaceholder)}
            aria-label={intl.formatMessage(messages.searchPlaceholder)}
          />
          {query.length > 0 && (
            <button
              type='button'
              className='mates-list__search-clear'
              onClick={clearQuery}
              aria-label={intl.formatMessage(messages.searchClear)}
            >
              ×
            </button>
          )}
        </div>

        <div className='mates-list__filters' role='tablist'>
          <FilterChip
            filter='all'
            active={filter === 'all'}
            onClick={handleFilter}
            label={intl.formatMessage(messages.filterAll)}
          />
          <FilterChip
            filter='mates'
            active={filter === 'mates'}
            onClick={handleFilter}
            label={intl.formatMessage(messages.filterMates)}
          />
          <FilterChip
            filter='invited'
            active={filter === 'invited'}
            onClick={handleFilter}
            label={intl.formatMessage(messages.filterInvited)}
          />
          {subject.inviter_id && (
            <FilterChip
              filter='inviter'
              active={filter === 'inviter'}
              onClick={handleFilter}
              label={intl.formatMessage(messages.filterInviter)}
            />
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className='mates-list__empty'>
          {trimmedQuery ? (
            <FormattedMessage {...messages.noResults} values={{ query }} />
          ) : (
            <FormattedMessage {...messages.empty} />
          )}
        </div>
      ) : (
        <ul className='mates-list__rows'>
          {filtered.map((r) => (
            <RowItem key={r.key} row={r} />
          ))}
        </ul>
      )}
    </div>
  );
};

interface FilterChipProps {
  filter: Filter;
  active: boolean;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  label: string;
}

const FilterChip: React.FC<FilterChipProps> = ({
  filter,
  active,
  onClick,
  label,
}) => (
  <button
    type='button'
    role='tab'
    aria-selected={active}
    data-filter={filter}
    className={`mates-list__filter${active ? ' mates-list__filter--active' : ''}`}
    onClick={onClick}
  >
    {label}
  </button>
);

const RowItem: React.FC<{ row: Row }> = ({ row }) => {
  const intl = useIntl();
  const { member, badge, since } = row;
  const badgeMessage =
    badge === 'inviter'
      ? messages.badgeInviter
      : badge === 'invitee'
        ? messages.badgeInvitee
        : messages.badgeMate;
  const metaMessage =
    badge === 'mate' ? messages.metaMatesSince : messages.metaJoined;
  return (
    <li className='mates-list__row'>
      <Link
        to={`/@${member.handle}`}
        className='mates-list__row-link'
        aria-label={`${member.display_name} — @${member.handle}`}
      >
        <span className='mates-list__avatar' aria-hidden>
          {member.display_name.trim().charAt(0).toUpperCase() ||
            member.handle.charAt(0).toUpperCase()}
        </span>
        <span className='mates-list__body'>
          <span className='mates-list__name'>{member.display_name}</span>
          <span className='mates-list__handle'>@{member.handle}</span>
          <span className='mates-list__meta'>
            <FormattedMessage
              {...metaMessage}
              values={{ date: formatDate(since) }}
            />
          </span>
        </span>
        <span className={`mates-list__badge mates-list__badge--${badge}`}>
          {intl.formatMessage(badgeMessage)}
        </span>
      </Link>
    </li>
  );
};
