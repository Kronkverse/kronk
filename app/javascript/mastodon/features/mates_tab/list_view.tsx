// Mates list view — the only face of /@:acct/mates now that the
// timeline retired (Tal 2026-08-11). A clean contact list: one row
// per person, real avatar left, name + handle stacked, "Mates since
// {date}" (or "Joined {date}" for the inviter / invitees who aren't
// mutuals) below. Tap a row → their profile.
//
// Data source: the same `useMatesTimeline` fetch that used to power
// both views. The outer `<MatesTab>` shell owns the fetch.

import { useMemo } from 'react';

import { defineMessages, FormattedDate, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import type { MatesTimelineData, TimelineMember } from './use_mates_timeline';

interface Row {
  key: string;
  member: TimelineMember;
  // The mutual-follow bond date when it exists; the second-party join
  // date otherwise (covers inviter + invitees). Rendered under the
  // handle as "Mates since …" / "Joined …" and also used to sort the
  // list newest-first.
  sinceDate: string;
  isMate: boolean;
}

const messages = defineMessages({
  empty: {
    id: 'mates_tab.list.empty',
    defaultMessage: 'No community yet — invite someone to get things started.',
  },
  matesSince: {
    id: 'mates_tab.list.mates_since',
    defaultMessage: 'Mates since {date}',
  },
  joined: {
    id: 'mates_tab.list.joined',
    defaultMessage: 'Joined {date}',
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
  const intl = useIntl();

  // Flat list of every non-subject member — mates, inviter, invitees.
  // Sorted by "how recently did this connection happen" (mate bond
  // date if mutual, join date otherwise) so newest additions sit on
  // top.
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    data.members.forEach((m) => {
      if (m.id === subject.id) return;
      const bondDate = bondDateFor(subject.id, m.id, data.mates);
      out.push({
        key: m.id,
        member: m,
        sinceDate: bondDate ?? m.joined_at,
        isMate: bondDate !== null,
      });
    });
    return out.sort(
      (a, b) =>
        new Date(b.sinceDate).getTime() - new Date(a.sinceDate).getTime(),
    );
  }, [data.members, data.mates, subject.id]);

  if (rows.length === 0) {
    return (
      <div className='mates-list__empty'>
        {intl.formatMessage(messages.empty)}
      </div>
    );
  }

  return (
    <ul className='mates-list'>
      {rows.map((r) => (
        <RowItem
          key={r.key}
          member={r.member}
          sinceDate={r.sinceDate}
          isMate={r.isMate}
        />
      ))}
    </ul>
  );
};

interface RowItemProps {
  member: TimelineMember;
  sinceDate: string;
  isMate: boolean;
}

const RowItem: React.FC<RowItemProps> = ({ member, sinceDate, isMate }) => {
  const intl = useIntl();
  const initial =
    member.display_name.trim().charAt(0).toUpperCase() ||
    member.handle.charAt(0).toUpperCase();
  const dateNode = (
    <FormattedDate
      value={sinceDate}
      year='numeric'
      month='short'
      day='numeric'
    />
  );

  return (
    <li className='mates-list__row'>
      <Link
        to={`/@${member.handle}`}
        className='mates-list__row-link'
        aria-label={`${member.display_name} — @${member.handle}`}
      >
        <span className='mates-list__avatar' aria-hidden>
          {member.avatar ? (
            <img
              className='mates-list__avatar-img'
              src={member.avatar}
              alt=''
              loading='lazy'
            />
          ) : (
            initial
          )}
        </span>
        <span className='mates-list__body'>
          <span className='mates-list__name'>{member.display_name}</span>
          <span className='mates-list__handle'>@{member.handle}</span>
          <span className='mates-list__since'>
            {intl.formatMessage(
              isMate ? messages.matesSince : messages.joined,
              {
                date: dateNode,
              },
            )}
          </span>
        </span>
      </Link>
    </li>
  );
};
