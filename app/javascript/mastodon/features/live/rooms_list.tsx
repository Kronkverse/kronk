// Rooms list — the open topical Huddle Rooms surface on
// `/hub/huddle`. Sits between the Main Huddle lobby chrome and the
// "Huddle Up" button. Fetches from `GET /api/v1/huddle/rooms` and
// links each Room card to `/hub/huddle/room/:id`, which goes straight
// into that Room's call.
//
// Discovery only. "New Room" is the Ж menu's compose action
// (config/korners/huddle.yaml `compose:`), which opens RoomComposer
// (room_composer.tsx) in the shared <ComposeShell>. Every tile wears the
// Huddle korner's own icon: Rooms have no emoji (decisions.md,
// 2026-10-22).
//
// See docs/spaces/huddle.md § Three categories of Huddle.

import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import { apiRequestGet } from 'mastodon/api';
import { Icon } from 'mastodon/components/icon';
import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';

interface HuddleRoomJSON {
  id: string;
  name: string;
  description: string | null;
  session_url: string;
  occupancy: number;
  last_active_at: string | null;
  created_at: string;
}

const messages = defineMessages({
  heading: {
    id: 'huddle.rooms.heading',
    defaultMessage: 'Rooms',
  },
  empty: {
    id: 'huddle.rooms.empty',
    // Empty-state copy points at the Ж menu per the Korner
    // Standard — no click target inline.
    defaultMessage: 'No rooms yet — start one via the Ж menu.',
  },
  occupancy: {
    id: 'huddle.rooms.occupancy',
    defaultMessage:
      '{count, plural, =0 {empty} one {# here now} other {# here now}}',
  },
});

export const RoomsList: React.FC = () => {
  const intl = useIntl();
  const HuddleIcon = useKornerIcon('huddle');
  const [rooms, setRooms] = useState<HuddleRoomJSON[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequestGet<HuddleRoomJSON[]>('v1/huddle/rooms');
      setRooms(data);
    } catch {
      // Discovery is best-effort — swallow and render empty. A retry
      // would land on the next mount.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRooms();
  }, [fetchRooms]);

  return (
    <section className='huddle-rooms'>
      <header className='huddle-rooms__header'>
        <h2 className='huddle-rooms__heading'>
          {intl.formatMessage(messages.heading)}
        </h2>
      </header>

      {!loading && rooms.length === 0 && (
        <p className='huddle-rooms__empty'>
          {intl.formatMessage(messages.empty)}
        </p>
      )}

      <ul className='huddle-rooms__grid'>
        {rooms.map((r) => (
          <li key={r.id} className='huddle-rooms__card'>
            <Link
              to={`/hub/huddle/room/${r.id}`}
              className='huddle-rooms__card-link'
            >
              <span className='huddle-rooms__card-icon' aria-hidden='true'>
                <Icon id='huddle' icon={HuddleIcon} />
              </span>
              <span className='huddle-rooms__card-body'>
                <span className='huddle-rooms__card-name'>{r.name}</span>
                {r.description && (
                  <span className='huddle-rooms__card-desc'>
                    {r.description}
                  </span>
                )}
                <span className='huddle-rooms__card-occ'>
                  {intl.formatMessage(messages.occupancy, {
                    count: r.occupancy,
                  })}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
};
