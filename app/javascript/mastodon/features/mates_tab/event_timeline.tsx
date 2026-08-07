// Mates event timeline — chronological history of the subject's
// social graph, most recent first. Replaces the SVG floating-tile
// timeline (Tal 2026-08-07: "actually needs to be useful"): four
// event kinds derived from the same API payload the list view uses.
//
//   • "Joined Kronk"                         — subject's own signup
//   • "@Inviter brought you in"              — inviter appears
//   • "Became mates with @X"                 — mate bond formed
//   • "@Y joined via your invite"            — invitee arrived
//
// Grouped by month (August 2026, July 2026, …). Each event is a
// row: date + glyph + one-line description with the other party's
// handle as a tap-through link. Rendered as an ordered event stream
// so an empty graph reads "no events yet" rather than as a canvas
// of nothing.

import { useMemo } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import GroupIcon from '@/material-icons/400-24px/group.svg?react';
import KeyIcon from '@/material-icons/400-24px/key.svg?react';
import PersonIcon from '@/material-icons/400-24px/person.svg?react';
import { Icon } from 'mastodon/components/icon';

import type { MatesTimelineData, TimelineMember } from './use_mates_timeline';

type EventKind = 'joined' | 'invited_by' | 'mate_bond' | 'invitee_joined';

interface TimelineEvent {
  key: string;
  kind: EventKind;
  at: string; // ISO date
  other?: TimelineMember; // absent for the subject's own "joined" event
}

const messages = defineMessages({
  joined: {
    id: 'mates_tab.events.joined',
    defaultMessage: 'Joined Kronk',
  },
  invitedBy: {
    id: 'mates_tab.events.invited_by',
    defaultMessage: '{name} brought you in',
  },
  mateBond: {
    id: 'mates_tab.events.mate_bond',
    defaultMessage: 'Became mates with {name}',
  },
  inviteeJoined: {
    id: 'mates_tab.events.invitee_joined',
    defaultMessage: '{name} joined via your invite',
  },
  empty: {
    id: 'mates_tab.events.empty',
    defaultMessage: 'No events yet — your graph history will land here.',
  },
});

const iconFor: Record<EventKind, React.FC<React.SVGProps<SVGSVGElement>>> = {
  joined: PersonIcon,
  invited_by: KeyIcon,
  mate_bond: GroupIcon,
  invitee_joined: KeyIcon,
};

const messageFor: Record<EventKind, { id: string; defaultMessage: string }> = {
  joined: messages.joined,
  invited_by: messages.invitedBy,
  mate_bond: messages.mateBond,
  invitee_joined: messages.inviteeJoined,
};

const monthKey = (iso: string): string => iso.slice(0, 7); // YYYY-MM
const formatMonth = (iso: string): string =>
  new Date(`${iso}-01T00:00:00Z`).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
  });
const formatDay = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });

interface MatesEventTimelineProps {
  data: MatesTimelineData;
  subject: TimelineMember;
}

export const MatesEventTimeline: React.FC<MatesEventTimelineProps> = ({
  data,
  subject,
}) => {
  const events = useMemo<TimelineEvent[]>(() => {
    const out: TimelineEvent[] = [];
    const membersById = new Map(data.members.map((m) => [m.id, m]));

    // 1. subject's own signup
    out.push({
      key: `joined-${subject.id}`,
      kind: 'joined',
      at: subject.joined_at,
    });

    // 2. inviter appears (same date as subject's join)
    if (subject.inviter_id) {
      const inviter = membersById.get(subject.inviter_id);
      if (inviter) {
        out.push({
          key: `invited_by-${inviter.id}`,
          kind: 'invited_by',
          at: subject.joined_at,
          other: inviter,
        });
      }
    }

    // 3. mate bonds
    data.mates.forEach((bond) => {
      const otherId =
        bond.member_a === subject.id
          ? bond.member_b
          : bond.member_b === subject.id
            ? bond.member_a
            : null;
      if (!otherId) return;
      const other = membersById.get(otherId);
      if (!other) return;
      out.push({
        key: `bond-${other.id}`,
        kind: 'mate_bond',
        at: bond.mates_since,
        other,
      });
    });

    // 4. invitees
    data.members.forEach((m) => {
      if (m.inviter_id !== subject.id) return;
      out.push({
        key: `invitee-${m.id}`,
        kind: 'invitee_joined',
        at: m.joined_at,
        other: m,
      });
    });

    // Newest first. Same-day ties keep insertion order, which puts
    // the subject's own join at the tail — before the inviter fires
    // on that same day (since we insert inviter after) — so the two
    // read together at the bottom.
    return out.sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
    );
  }, [data.members, data.mates, subject]);

  if (events.length === 0) {
    return (
      <div className='mates-events__empty'>
        <FormattedMessage {...messages.empty} />
      </div>
    );
  }

  // Group by month for headings.
  const groups: { month: string; entries: TimelineEvent[] }[] = [];
  events.forEach((ev) => {
    const m = monthKey(ev.at);
    const last = groups[groups.length - 1];
    if (last && last.month === m) {
      last.entries.push(ev);
    } else {
      groups.push({ month: m, entries: [ev] });
    }
  });

  return (
    <ol className='mates-events'>
      {groups.map((g) => (
        <li key={g.month} className='mates-events__group'>
          <div className='mates-events__month'>{formatMonth(g.month)}</div>
          <ol className='mates-events__entries'>
            {g.entries.map((ev) => (
              <EventRow key={ev.key} event={ev} />
            ))}
          </ol>
        </li>
      ))}
    </ol>
  );
};

const EventRow: React.FC<{ event: TimelineEvent }> = ({ event }) => {
  const intl = useIntl();
  const IconComponent = iconFor[event.kind];
  const msg = messageFor[event.kind];
  const name = event.other ? (
    <Link className='mates-events__name' to={`/@${event.other.handle}`}>
      {event.other.display_name || `@${event.other.handle}`}
    </Link>
  ) : null;
  return (
    <li className='mates-events__entry'>
      <span className='mates-events__day'>{formatDay(event.at)}</span>
      <span className='mates-events__glyph' aria-hidden>
        <Icon id={event.kind} icon={IconComponent} />
      </span>
      <span className='mates-events__text'>
        {event.other ? (
          <FormattedMessage {...msg} values={{ name }} />
        ) : (
          intl.formatMessage(msg)
        )}
      </span>
    </li>
  );
};
