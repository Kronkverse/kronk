// A Kuddle in a space it's Konnected to (Tal, 2026-10-30: "konnecting a
// huddle should put a frame into the space"): its name and who's in it,
// and one tap to join. The call then sits in the frame, with Kronk's
// controls under it; leaving the page keeps you in it, in the floating
// mini window, whose Back comes here (use_kuddle_call.ts, the same call
// the Kuddle's own page shows). Opened right after making a Kuddle from
// this space, it joins straight away (`wantsKuddleJoin`).

import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Link, useLocation } from 'react-router-dom';

import { apiRequestGet } from 'mastodon/api';
import { CallControls } from 'mastodon/components/call_controls';
import { KornerPill } from 'mastodon/components/korner_pill';

import { useKuddleCall } from './use_kuddle_call';

interface KuddleJSON {
  id: string;
  name: string;
  description: string | null;
  occupancy: number;
}

const messages = defineMessages({
  kind: { id: 'huddle.frame.kind', defaultMessage: 'Kuddle' },
  join: { id: 'huddle.frame.join', defaultMessage: 'Join the call' },
  here: {
    id: 'huddle.frame.here',
    defaultMessage:
      '{count, plural, =0 {Nobody here yet} one {# here now} other {# here now}}',
  },
  open: { id: 'huddle.frame.open', defaultMessage: 'Open the Kuddle' },
  diskonnect: { id: 'huddle.frame.diskonnect', defaultMessage: 'Diskonnect' },
  leave: { id: 'huddle.room.leave', defaultMessage: 'Unhuddle' },
  joinFailed: {
    id: 'huddle.room.join_failed',
    defaultMessage: 'Couldn’t get into this Kuddle just now.',
  },
});

// Making a Kuddle from a space comes back here and joins it at once.
const JOIN_KEY = 'kronk.kuddle.join';
export const wantsKuddleJoin = (roomId: string) => {
  try {
    sessionStorage.setItem(JOIN_KEY, roomId);
  } catch {
    /* private mode: the frame just waits for a tap */
  }
};
const takeJoinWish = (roomId: string) => {
  try {
    if (sessionStorage.getItem(JOIN_KEY) !== roomId) return false;
    sessionStorage.removeItem(JOIN_KEY);
    return true;
  } catch {
    return false;
  }
};

export const KuddleFrame: React.FC<{
  roomId: string;
  // The Konnection, for whoever may undo it here.
  link?: string;
  onDiskonnect?: (link: string) => void;
}> = ({ roomId, link, onDiskonnect }) => {
  const intl = useIntl();
  const { pathname } = useLocation();
  const [room, setRoom] = useState<KuddleJSON | null>(null);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiRequestGet<KuddleJSON[]>('v1/huddle/rooms')
      .then((rooms) => {
        if (cancelled) return;
        const found = rooms.find((r) => r.id === roomId);
        if (found) setRoom(found);
        else setGone(true);
      })
      .catch(() => {
        if (!cancelled) setGone(true);
      });
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  const [autoJoin] = useState(() => takeJoinWish(roomId));
  const { call, join, leave, joinFailed, slotRef } = useKuddleCall(
    roomId,
    room,
    { path: pathname, autoJoin },
  );
  const handleJoin = useCallback(() => {
    join();
  }, [join]);
  const handleDiskonnect = useCallback(() => {
    if (link) onDiskonnect?.(link);
  }, [link, onDiskonnect]);

  // A retired Kuddle has nothing to join; the Konnection stays in Attached.
  if (gone || !room) return null;

  return (
    <section className='kuddle-frame'>
      <header className='kuddle-frame__head'>
        <span className='kuddle-frame__kind'>
          {intl.formatMessage(messages.kind)}
        </span>
        <Link
          to={`/hub/huddle/kuddle/${room.id}`}
          className='kuddle-frame__name'
          title={intl.formatMessage(messages.open)}
        >
          {room.name}
        </Link>
        {!call && (
          <span className='kuddle-frame__here'>
            {intl.formatMessage(messages.here, { count: room.occupancy })}
          </span>
        )}
        {onDiskonnect && link && !call && (
          <button
            type='button'
            className='kuddle-frame__diskonnect'
            onClick={handleDiskonnect}
          >
            {intl.formatMessage(messages.diskonnect)}
          </button>
        )}
      </header>

      {call ? (
        <>
          {/* The call is drawn over this box (jitsi_session.ts). */}
          <div
            ref={slotRef}
            className='kuddle-frame__call'
            data-huddle-slot='docked'
          />
          <CallControls
            call={call}
            onLeave={leave}
            leaveLabel={intl.formatMessage(messages.leave)}
            inputPicker
          />
        </>
      ) : (
        <div className='kuddle-frame__idle'>
          {room.description && (
            <p className='kuddle-frame__about'>{room.description}</p>
          )}
          <KornerPill
            variant='primary'
            label={intl.formatMessage(messages.join)}
            onClick={handleJoin}
          />
          {joinFailed && (
            <p className='kuddle-frame__error' role='alert'>
              {intl.formatMessage(messages.joinFailed)}
            </p>
          )}
        </div>
      )}
    </section>
  );
};
