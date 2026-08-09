// Mates list view — the default face of /@:acct/mates. A plain
// contact list, in the Signal / iPhone Contacts style: one row per
// person, avatar left, name + handle stacked, subtle divider between
// rows. No filter chips, no in-page search (the Ж-menu / floating
// bubble owns platform-wide search), no dates, no relationship
// badges — just a scannable roster of everyone in this subject's
// community. Tap a row → their profile.
//
// Data source: the same `useMatesTimeline` fetch that powers the
// event-timeline view. The outer `<MatesTab>` shell owns the fetch,
// so both views share it.

import { useMemo } from 'react';

import { defineMessages, FormattedMessage } from 'react-intl';

import { Link } from 'react-router-dom';

import type { MatesTimelineData, TimelineMember } from './use_mates_timeline';

interface Row {
  key: string;
  member: TimelineMember;
  // Kept only to sort — most-recent connection first (mate bond date
  // when we have one; otherwise the other member's join date, which
  // covers the inviter + invitees). Not rendered.
  sortDate: string;
}

const messages = defineMessages({
  empty: {
    id: 'mates_tab.list.empty',
    defaultMessage: 'No community yet — invite someone to get things started.',
  },
});

const bondDateFor = (
  subjectId: string,
  otherId: string,
  bonds: MatesTimelineData['mates'],
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
  // Flat list of every non-subject member in the community — mates,
  // inviter, invitees, all treated identically for display. Sorted by
  // "how recently did this connection happen" so the newest additions
  // sit at the top.
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    data.members.forEach((m) => {
      if (m.id === subject.id) return;
      const bondDate = bondDateFor(subject.id, m.id, data.mates);
      out.push({
        key: m.id,
        member: m,
        sortDate: bondDate ?? m.joined_at,
      });
    });
    return out.sort(
      (a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime(),
    );
  }, [data.members, data.mates, subject.id]);

  if (rows.length === 0) {
    return (
      <div className='mates-list__empty'>
        <FormattedMessage {...messages.empty} />
      </div>
    );
  }

  return (
    <ul className='mates-list'>
      {rows.map((r) => (
        <RowItem key={r.key} member={r.member} />
      ))}
    </ul>
  );
};

const RowItem: React.FC<{ member: TimelineMember }> = ({ member }) => {
  const initial =
    member.display_name.trim().charAt(0).toUpperCase() ||
    member.handle.charAt(0).toUpperCase();
  return (
    <li className='mates-list__row'>
      <Link
        to={`/@${member.handle}`}
        className='mates-list__row-link'
        aria-label={`${member.display_name} — @${member.handle}`}
      >
        <span className='mates-list__avatar' aria-hidden>
          {initial}
        </span>
        <span className='mates-list__body'>
          <span className='mates-list__name'>{member.display_name}</span>
          <span className='mates-list__handle'>@{member.handle}</span>
        </span>
      </Link>
    </li>
  );
};
