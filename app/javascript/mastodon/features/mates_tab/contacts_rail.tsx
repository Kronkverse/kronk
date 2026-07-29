// Contacts rail — the right-hand list of the subject's mates + invitees.
// Newest first per brief. Selection scrolls the timeline canvas (via
// the shared subject state) to the matching tile.
//
// Search per brief § Contacts rail: instance-wide. Matches inside the
// subject's rows filter the list in place; matches elsewhere appear
// under a separate heading and, on selection, switch subject to that
// member's line.

import { useMemo, useState, useCallback } from 'react';
import type { ChangeEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';

import { FormattedMessage, useIntl, defineMessages } from 'react-intl';

import type { TimelineMember } from './use_mates_timeline';

type Filter = 'both' | 'mates' | 'invited';

interface TileInfo {
  member: TimelineMember;
  x: number;
  label: string;
  detail?: string;
}

interface ContactsRailProps {
  subject: TimelineMember;
  mates: readonly TileInfo[];
  invitees: readonly TileInfo[];
  allMembers: readonly TimelineMember[];
  onSelect: (id: string) => void;
}

interface RowProps {
  member: TimelineMember;
  meta: string;
  onSelect: (id: string) => void;
}

const messages = defineMessages({
  searchPlaceholder: {
    id: 'mates_tab.rail.search_placeholder',
    defaultMessage: 'Search everyone…',
  },
});

const matches = (member: TimelineMember, query: string): boolean =>
  member.display_name.toLowerCase().includes(query) ||
  member.handle.toLowerCase().includes(query);

const Row = ({ member, meta, onSelect }: RowProps) => {
  const click = useCallback(() => {
    onSelect(member.id);
  }, [member.id, onSelect]);
  return (
    <button
      type='button'
      className='mates-tab__rail-row'
      onClick={click}
      aria-label={`${member.display_name} — ${meta}`}
    >
      <span className='mates-tab__rail-avatar' aria-hidden>
        {member.handle.charAt(0).toUpperCase()}
      </span>
      <span className='mates-tab__rail-body'>
        <span className='mates-tab__rail-name'>{member.display_name}</span>
        <span className='mates-tab__rail-handle'>@{member.handle}</span>
        {member.korners.length > 0 && (
          <span className='mates-tab__rail-korners'>
            {member.korners.slice(0, 2).join(' · ')}
          </span>
        )}
      </span>
      <span className='mates-tab__rail-meta'>{meta}</span>
    </button>
  );
};

export const ContactsRail = ({
  subject,
  mates,
  invitees,
  allMembers,
  onSelect,
}: ContactsRailProps) => {
  const intl = useIntl();
  const [filter, setFilter] = useState<Filter>('both');
  const [query, setQuery] = useState('');
  const trimmedQuery = query.trim().toLowerCase();

  const showBoth = useCallback(() => {
    setFilter('both');
  }, []);
  const showMates = useCallback(() => {
    setFilter('mates');
  }, []);
  const showInvited = useCallback(() => {
    setFilter('invited');
  }, []);

  const onQueryChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
  }, []);

  const clearQuery = useCallback(() => {
    setQuery('');
  }, []);

  const onSearchKey = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setQuery('');
      }
    },
    [],
  );

  const items = useMemo(() => {
    const combined: {
      key: string;
      member: TimelineMember;
      meta: string;
      sortDay: number;
      kind: 'mate' | 'invitee';
    }[] = [];

    if (filter !== 'invited') {
      mates.forEach((tile) => {
        const dateStr = tile.detail?.replace('mate since ', '') ?? '';
        combined.push({
          key: `mate-${tile.member.id}`,
          member: tile.member,
          meta: dateStr,
          sortDay: new Date(dateStr).getTime(),
          kind: 'mate',
        });
      });
    }
    if (filter !== 'mates') {
      invitees.forEach((tile) => {
        combined.push({
          key: `invitee-${tile.member.id}`,
          member: tile.member,
          meta: tile.detail?.replace('joined ', 'joined ') ?? '',
          sortDay: new Date(tile.member.joined_at).getTime(),
          kind: 'invitee',
        });
      });
    }
    return combined.sort((a, b) => b.sortDay - a.sortDay);
  }, [mates, invitees, filter]);

  // Search: subject-row items get filtered in place; anyone matching
  // outside the subject's contacts + not the subject themselves shows
  // up under a separate "Elsewhere" heading.
  const filteredItems = useMemo(() => {
    if (!trimmedQuery) return items;
    return items.filter((item) => matches(item.member, trimmedQuery));
  }, [items, trimmedQuery]);

  const elsewhereMatches = useMemo(() => {
    if (!trimmedQuery) return [];
    const inRail = new Set<string>();
    mates.forEach((tile) => inRail.add(tile.member.id));
    invitees.forEach((tile) => inRail.add(tile.member.id));
    return allMembers
      .filter((m) => m.id !== subject.id)
      .filter((m) => !inRail.has(m.id))
      .filter((m) => matches(m, trimmedQuery))
      .sort(
        (a, b) =>
          new Date(b.joined_at).getTime() - new Date(a.joined_at).getTime(),
      )
      .slice(0, 20); // cap for UI density
  }, [allMembers, mates, invitees, subject.id, trimmedQuery]);

  const hasSubjectMatches = filteredItems.length > 0;
  const hasElsewhere = elsewhereMatches.length > 0;
  const noResults = trimmedQuery && !hasSubjectMatches && !hasElsewhere;

  return (
    <aside className='mates-tab__rail' aria-label='Contacts'>
      <header className='mates-tab__rail-head'>
        <span className='mates-tab__rail-title'>@{subject.handle}</span>
        <div className='mates-tab__rail-search'>
          <input
            type='search'
            className='mates-tab__rail-search-input'
            value={query}
            onChange={onQueryChange}
            onKeyDown={onSearchKey}
            placeholder={intl.formatMessage(messages.searchPlaceholder)}
            aria-label={intl.formatMessage(messages.searchPlaceholder)}
          />
          {query.length > 0 && (
            <button
              type='button'
              className='mates-tab__rail-search-clear'
              onClick={clearQuery}
              aria-label='Clear search'
            >
              ×
            </button>
          )}
        </div>
        <div className='mates-tab__rail-filters' role='tablist'>
          <FilterButton
            active={filter === 'both'}
            onClick={showBoth}
            label={
              <FormattedMessage
                id='mates_tab.filter.both'
                defaultMessage='Both'
              />
            }
          />
          <FilterButton
            active={filter === 'mates'}
            onClick={showMates}
            label={
              <FormattedMessage
                id='mates_tab.filter.mates'
                defaultMessage='Mates'
              />
            }
          />
          <FilterButton
            active={filter === 'invited'}
            onClick={showInvited}
            label={
              <FormattedMessage
                id='mates_tab.filter.invited'
                defaultMessage='Invited'
              />
            }
          />
        </div>
      </header>
      <div className='mates-tab__rail-list'>
        {noResults && (
          <div className='mates-tab__rail-empty'>
            <FormattedMessage
              id='mates_tab.rail.no_results'
              defaultMessage='No one matches "{query}".'
              values={{ query }}
            />
          </div>
        )}

        {!noResults && filteredItems.length === 0 && !trimmedQuery && (
          <div className='mates-tab__rail-empty'>
            <FormattedMessage
              id='mates_tab.rail.empty'
              defaultMessage='No one to show yet.'
            />
          </div>
        )}

        {hasSubjectMatches && (
          <>
            {trimmedQuery && (
              <div className='mates-tab__rail-heading'>
                <FormattedMessage
                  id='mates_tab.rail.in_rail'
                  defaultMessage='In @{handle}’s contacts'
                  values={{ handle: subject.handle }}
                />
              </div>
            )}
            {filteredItems.map((it) => (
              <Row
                key={it.key}
                member={it.member}
                meta={it.meta}
                onSelect={onSelect}
              />
            ))}
          </>
        )}

        {hasElsewhere && (
          <>
            <div className='mates-tab__rail-heading mates-tab__rail-heading--elsewhere'>
              <FormattedMessage
                id='mates_tab.rail.elsewhere'
                defaultMessage='Elsewhere on Kronk'
              />
            </div>
            {elsewhereMatches.map((member) => (
              <Row
                key={`else-${member.id}`}
                member={member}
                meta={`joined ${new Date(member.joined_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}`}
                onSelect={onSelect}
              />
            ))}
          </>
        )}
      </div>
    </aside>
  );
};

const FilterButton = ({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: React.ReactNode;
}) => (
  <button
    type='button'
    role='tab'
    aria-selected={active}
    className={`mates-tab__rail-filter${active ? ' mates-tab__rail-filter--active' : ''}`}
    onClick={onClick}
  >
    {label}
  </button>
);
