// Contacts rail — the right-hand list of the subject's mates + invitees.
// Newest first per brief. Selection scrolls the timeline canvas (via
// the shared subject state) to the matching tile.

import { useMemo, useState, useCallback } from 'react';

import { FormattedMessage } from 'react-intl';

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
  onSelect: (id: string) => void;
}

interface RowProps {
  member: TimelineMember;
  meta: string;
  onSelect: (id: string) => void;
}

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
  onSelect,
}: ContactsRailProps) => {
  const [filter, setFilter] = useState<Filter>('both');

  const showBoth = useCallback(() => {
    setFilter('both');
  }, []);
  const showMates = useCallback(() => {
    setFilter('mates');
  }, []);
  const showInvited = useCallback(() => {
    setFilter('invited');
  }, []);

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

  return (
    <aside className='mates-tab__rail' aria-label='Contacts'>
      <header className='mates-tab__rail-head'>
        <span className='mates-tab__rail-title'>@{subject.handle}</span>
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
        {items.length === 0 ? (
          <div className='mates-tab__rail-empty'>
            <FormattedMessage
              id='mates_tab.rail.empty'
              defaultMessage='No one to show yet.'
            />
          </div>
        ) : (
          items.map((it) => (
            <Row
              key={it.key}
              member={it.member}
              meta={it.meta}
              onSelect={onSelect}
            />
          ))
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
