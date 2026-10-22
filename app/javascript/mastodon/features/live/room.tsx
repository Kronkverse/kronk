// A Huddle Room — Phase 9.6 discovery slice.
//
// Mounted at `/hub/huddle/room/:id`. Fetches the Room's shape from
// `GET /api/v1/huddle/rooms` (finding by id) and goes straight into
// the call: the same Jitsi iframe the Main Huddle uses, scoped to the
// Room's `session_url` (unique per row so two Rooms named "Coworking"
// don't collide on the Jitsi side). There is no lobby; tapping the
// Room on `/hub/huddle` (or creating it) is the join. Leaving goes
// back to `/hub/huddle`. The Frame's `← Huddle` badge is the way
// back, so the page draws no back chip of its own.
//
// Deliberately leaner than `features/live/index.tsx` — no PiP hook,
// no auto-rejoin state machine. Rooms are come-and-go; the Main
// Huddle carries the "you're always in it" affordance.
//
// Below the call sits the Room's "Attached" block (huddle takes and makes
// links like every korner with records); its host manages it.

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import { useHistory, useParams } from 'react-router-dom';

import { apiRequestGet, apiRequestPost } from 'mastodon/api';
import { AttachmentSection } from 'mastodon/components/attachment_section';
import { Stage } from 'mastodon/components/stage';
import { jitsiDomain, me } from 'mastodon/initial_state';
import { useAppSelector } from 'mastodon/store';

// Huddle's Jitsi host, from the server (config/initializers/1_kronk_jitsi.rb).
const JITSI_DOMAIN = jitsiDomain;

interface HuddleRoomJSON {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  session_url: string;
  occupancy: number;
  is_host?: boolean;
}

interface JitsiApi {
  dispose: () => void;
  addListener: (event: string, callback: () => void) => void;
  executeCommand: (command: string, ...args: string[]) => void;
  getNumberOfParticipants: () => number;
}

interface JitsiOptions {
  roomName: string;
  parentNode: HTMLDivElement;
  userInfo?: { displayName: string; email: string };
  configOverwrite?: Record<string, unknown>;
  interfaceConfigOverwrite?: Record<string, unknown>;
}

type JitsiConstructor = new (domain: string, options: JitsiOptions) => JitsiApi;

declare global {
  interface Window {
    JitsiMeetExternalAPI?: JitsiConstructor;
  }
}

const messages = defineMessages({
  leave: { id: 'huddle.room.leave', defaultMessage: 'Unhuddle' },
  notFound: {
    id: 'huddle.room.not_found',
    defaultMessage: 'Room not found or has been retired.',
  },
});

const bodyStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minHeight: 0,
};
const nameStyle: CSSProperties = {
  fontSize: '24px',
  fontWeight: 700,
  color: 'var(--primary-text-color)',
  margin: 0,
};
const descStyle: CSSProperties = {
  color: 'var(--secondary-text-color)',
  fontSize: '14px',
  maxWidth: '340px',
  margin: 0,
  padding: '40px 20px',
  alignSelf: 'center',
  textAlign: 'center',
};
const inRoomWrapStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
};
const inRoomHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 16px',
  borderBottom: '1px solid var(--background-border-color)',
};
const leaveStyle: CSSProperties = {
  padding: '6px 16px',
  fontSize: '13px',
  fontWeight: 600,
  borderRadius: '8px',
  border: 'none',
  background: '#e03131',
  color: '#fff',
  cursor: 'pointer',
};
const jitsiWrapStyle: CSSProperties = { flex: 1, minHeight: '400px' };
const jitsiInnerStyle: CSSProperties = { width: '100%', height: '100%' };

export const LiveRoom: React.FC = () => {
  const intl = useIntl();
  const { id } = useParams<{ id: string }>();
  const history = useHistory();
  const [room, setRoom] = useState<HuddleRoomJSON | null>(null);
  const [error, setError] = useState(false);
  const joinedRef = useRef(false);
  const [apiLoaded, setApiLoaded] = useState(false);
  const jitsiContainerRef = useRef<HTMLDivElement>(null);
  const jitsiApiRef = useRef<JitsiApi | null>(null);
  const currentAccount = useAppSelector((state) =>
    me ? state.accounts.get(me) : undefined,
  );

  useEffect(() => {
    let cancelled = false;
    apiRequestGet<HuddleRoomJSON[]>('v1/huddle/rooms')
      .then((rooms) => {
        if (cancelled) return;
        const found = rooms.find((r) => r.id === id);
        if (found) setRoom(found);
        else setError(true);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (
      document.querySelector(
        'script[src="https://' + JITSI_DOMAIN + '/external_api.js"]',
      )
    ) {
      setApiLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://' + JITSI_DOMAIN + '/external_api.js';
    script.async = true;
    script.onload = () => {
      setApiLoaded(true);
    };
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    return () => {
      if (jitsiApiRef.current) {
        jitsiApiRef.current.dispose();
        jitsiApiRef.current = null;
      }
    };
  }, []);

  const handleLeave = useCallback(() => {
    if (jitsiApiRef.current) {
      jitsiApiRef.current.dispose();
      jitsiApiRef.current = null;
    }
    history.push('/hub/huddle');
  }, [history]);

  // Opening the Room is the join: once the Room and the Jitsi script are
  // both in, embed the call. `joinedRef` keeps it to one embed per visit.
  useEffect(() => {
    if (!room || !apiLoaded || joinedRef.current) return undefined;
    joinedRef.current = true;
    let cancelled = false;

    const join = () => {
      if (
        cancelled ||
        !window.JitsiMeetExternalAPI ||
        !jitsiContainerRef.current
      )
        return;
      const displayName =
        currentAccount?.get('display_name') ??
        currentAccount?.get('username') ??
        'Guest';
      const api = new window.JitsiMeetExternalAPI(JITSI_DOMAIN, {
        roomName: room.session_url,
        parentNode: jitsiContainerRef.current,
        userInfo: { displayName, email: '' },
      });
      // Hanging up inside Jitsi leaves the Room, same as Unhuddle.
      api.addListener('readyToClose', handleLeave);
      jitsiApiRef.current = api;
      // Tell Kronk the Room is in use (keeps it listed first, and keeps the
      // reaper away). Best effort: the call itself doesn't depend on it.
      void apiRequestPost(`v1/huddle/rooms/${room.id}/join`).catch(() => {
        /* best effort */
      });
    };
    join();

    return () => {
      cancelled = true;
      // Torn down before the embed happened: let the next run try again.
      if (!jitsiApiRef.current) joinedRef.current = false;
    };
  }, [room, apiLoaded, currentAccount, handleLeave]);

  if (error) {
    return (
      <Stage>
        <p style={descStyle}>{intl.formatMessage(messages.notFound)}</p>
      </Stage>
    );
  }

  if (!room) return <Stage />;

  return (
    <Stage>
      <div style={bodyStyle}>
        <div style={inRoomWrapStyle}>
          <div style={inRoomHeaderStyle}>
            <span style={nameStyle}>
              {room.icon} {room.name}
            </span>
            <button type='button' onClick={handleLeave} style={leaveStyle}>
              {intl.formatMessage(messages.leave)}
            </button>
          </div>
          <div style={jitsiWrapStyle}>
            <div ref={jitsiContainerRef} style={jitsiInnerStyle} />
          </div>
          <AttachmentSection
            korner='huddle'
            recordId={room.id}
            canManage={room.is_host ?? false}
          />
        </div>
      </div>
      <Helmet>
        <title>{room.name} · Huddle</title>
        <meta name='robots' content='noindex' />
      </Helmet>
    </Stage>
  );
};

// eslint-disable-next-line import/no-default-export
export default LiveRoom;
