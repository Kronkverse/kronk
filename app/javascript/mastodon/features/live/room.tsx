// Per-Room Huddle lobby — Phase 9.6 discovery slice.
//
// Mounted at `/hub/huddle/room/:id`. Fetches the Room's shape from
// `GET /api/v1/huddle/rooms` (finding by id), presents a minimal
// lobby, and embeds the same Jitsi iframe the Main Huddle uses but
// scoped to the Room's `session_url` (unique per row so two Rooms
// named "Coworking" don't collide on the Jitsi side).
//
// Deliberately leaner than `features/live/index.tsx` — no PiP hook,
// no auto-rejoin state machine. Rooms are come-and-go; the Main
// Huddle carries the "you're always in it" affordance.

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import { useParams } from 'react-router-dom';

import { apiRequestGet } from 'mastodon/api';
import { Stage } from 'mastodon/components/stage';
import { me, getAccessToken } from 'mastodon/initial_state';
import { useAppSelector } from 'mastodon/store';

const JITSI_DOMAIN = 'meet.talitamoss.info';

interface HuddleRoomJSON {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  session_url: string;
  occupancy: number;
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
  jwt?: string;
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
  join: { id: 'huddle.room.join', defaultMessage: 'Huddle Up' },
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
const lobbyStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '18px',
  padding: '40px 20px',
  textAlign: 'center',
};
const iconStyle: CSSProperties = {
  fontSize: '48px',
  lineHeight: 1,
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
};
const joinStyle: CSSProperties = {
  padding: '12px 28px',
  fontSize: '15px',
  fontWeight: 600,
  borderRadius: '999px',
  border: 'none',
  background: 'var(--accent)',
  color: 'var(--text-on-accent, #fff)',
  cursor: 'pointer',
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
  const [room, setRoom] = useState<HuddleRoomJSON | null>(null);
  const [error, setError] = useState(false);
  const [inRoom, setInRoom] = useState(false);
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

  const joinAsync = useCallback(async () => {
    if (!room || !apiLoaded || !jitsiContainerRef.current) return;
    // Fetch a JWT scoped to the current user via the existing huddle
    // token endpoint (shared with the Main Huddle — same Jitsi domain).
    let jwt: string | undefined;
    try {
      const resp = await fetch('/api/v1/huddle_token', {
        headers: { Authorization: `Bearer ${getAccessToken()}` },
      });
      if (resp.ok) {
        const body = (await resp.json()) as { token?: string };
        jwt = body.token;
      }
    } catch {
      // JWT is optional on the Kronk Jitsi deployment; fall through.
    }
    if (!window.JitsiMeetExternalAPI) return;
    const displayName =
      currentAccount?.get('display_name') ??
      currentAccount?.get('username') ??
      'Guest';
    const api = new window.JitsiMeetExternalAPI(JITSI_DOMAIN, {
      roomName: room.session_url,
      parentNode: jitsiContainerRef.current,
      jwt,
      userInfo: { displayName, email: '' },
    });
    jitsiApiRef.current = api;
    setInRoom(true);
  }, [room, apiLoaded, currentAccount]);
  const handleJoin = useCallback(() => {
    void joinAsync();
  }, [joinAsync]);

  const handleLeave = useCallback(() => {
    if (jitsiApiRef.current) {
      jitsiApiRef.current.dispose();
      jitsiApiRef.current = null;
    }
    setInRoom(false);
  }, []);

  if (error) {
    return (
      <Stage>
        <div style={lobbyStyle}>
          <p style={descStyle}>{intl.formatMessage(messages.notFound)}</p>
        </div>
      </Stage>
    );
  }

  if (!room) {
    return (
      <Stage>
        <div style={lobbyStyle}>
          <p style={descStyle}>—</p>
        </div>
      </Stage>
    );
  }

  return (
    <Stage>
      <div style={bodyStyle}>
        {inRoom ? (
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
          </div>
        ) : (
          <div style={lobbyStyle}>
            <span style={iconStyle} aria-hidden>
              {room.icon ?? '💬'}
            </span>
            <h1 style={nameStyle}>{room.name}</h1>
            {room.description && <p style={descStyle}>{room.description}</p>}
            <button
              type='button'
              onClick={handleJoin}
              disabled={!apiLoaded}
              style={joinStyle}
            >
              {intl.formatMessage(messages.join)}
            </button>
          </div>
        )}
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
