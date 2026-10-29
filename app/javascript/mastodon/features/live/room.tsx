// A Huddle Room, called a Kuddle wherever people see it.
//
// Mounted at `/hub/huddle/kuddle/:id` (`/hub/huddle/room/:id` redirects).
// Fetches the Room's shape from `GET /api/v1/huddle/rooms` (finding by id)
// and goes straight into the call: a pass for the Kuddle
// (POST /api/v1/calls/token; the Jitsi room is its `session_url`, unique per
// row so two Rooms named "Coworking" don't collide on the Jitsi side), then
// the call with Kronk's controls under it (mastodon/jitsi.ts,
// components/call_controls.tsx). There is no lobby; tapping the
// Room on `/hub/huddle` (or creating it) is the join. Leaving goes
// back to `/hub/huddle`. The Frame's `← Huddle` badge is the way
// back, so the page draws no back chip of its own.
//
// Deliberately leaner than `features/live/index.tsx` — no PiP hook,
// no auto-rejoin state machine. Rooms are come-and-go; the Main
// Huddle carries the "you're always in it" affordance.
//
// Below the call sit the Kuddle's recordings, for anyone who can see it, and
// its "Attached" block (huddle takes and makes links like every korner with
// records); its host manages it.

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import { useHistory, useParams } from 'react-router-dom';

import { apiRequestGet, apiRequestPost } from 'mastodon/api';
import { AttachmentSection } from 'mastodon/components/attachment_section';
import { CallControls } from 'mastodon/components/call_controls';
import { CallRecordings } from 'mastodon/components/call_recordings';
import { Stage } from 'mastodon/components/stage';
import { me } from 'mastodon/initial_state';
import type { Call } from 'mastodon/jitsi';
import { createCall, getCallPass, loadJitsi } from 'mastodon/jitsi';
import { useAppSelector } from 'mastodon/store';

import { KuddleFollow } from './kuddle_follow';
import type { KuddleFollowState } from './kuddle_follow';

interface HuddleRoomJSON extends KuddleFollowState {
  id: string;
  name: string;
  description: string | null;
  session_url: string;
  occupancy: number;
  is_host?: boolean;
}

const messages = defineMessages({
  leave: { id: 'huddle.room.leave', defaultMessage: 'Unhuddle' },
  notFound: {
    id: 'huddle.room.not_found',
    defaultMessage: 'This Kuddle is not here, or has been retired.',
  },
  joinFailed: {
    id: 'huddle.room.join_failed',
    defaultMessage: 'Couldn’t get into this Kuddle just now.',
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
const headerActionsStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
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
  const callRef = useRef<Call | null>(null);
  const [call, setCall] = useState<Call | null>(null);
  const [joinFailed, setJoinFailed] = useState(false);
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
    let cancelled = false;
    loadJitsi()
      .then(() => {
        if (!cancelled) setApiLoaded(true);
        return undefined;
      })
      .catch(() => {
        if (!cancelled) setJoinFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Leaving the page ends the call (a Kuddle's call doesn't follow you).
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      callRef.current?.dispose();
      callRef.current = null;
    };
  }, []);

  const handleFollowChange = useCallback((state: KuddleFollowState) => {
    setRoom((current) => (current ? { ...current, ...state } : current));
  }, []);

  const handleLeave = useCallback(() => {
    callRef.current?.dispose();
    callRef.current = null;
    setCall(null);
    history.push('/hub/huddle');
  }, [history]);

  // Opening the Room is the join: once the Room and the Jitsi script are
  // both in, get a pass and embed the call. `joinedRef` keeps it to one
  // embed per visit, whatever else about the Room changes meanwhile.
  useEffect(() => {
    if (!room || !apiLoaded || joinedRef.current) return;
    joinedRef.current = true;

    void getCallPass('kuddle', room.id)
      .then((pass) => {
        if (!mountedRef.current || !jitsiContainerRef.current) {
          return undefined;
        }
        const displayName =
          currentAccount?.get('display_name') ??
          currentAccount?.get('username') ??
          'Kronker';
        const created = createCall({
          parentNode: jitsiContainerRef.current,
          pass,
          displayName,
          avatarUrl: currentAccount?.get('avatar'),
          subject: room.name,
        });
        if (!created) {
          setJoinFailed(true);
          return undefined;
        }
        // Hanging up inside Jitsi leaves the Room, same as Unhuddle.
        created.api.addListener('readyToClose', handleLeave);
        callRef.current = created;
        setCall(created);
        // Tell Kronk the Room is in use (keeps it listed first, and keeps
        // the reaper away). Best effort: the call doesn't depend on it.
        void apiRequestPost(`v1/huddle/rooms/${room.id}/join`).catch(() => {
          /* best effort */
        });
        return undefined;
      })
      .catch(() => {
        if (mountedRef.current) setJoinFailed(true);
      });
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
            <span style={nameStyle}>{room.name}</span>
            <div style={headerActionsStyle}>
              <KuddleFollow
                roomId={room.id}
                name={room.name}
                state={room}
                onChange={handleFollowChange}
              />
            </div>
          </div>
          <div style={jitsiWrapStyle}>
            <div ref={jitsiContainerRef} style={jitsiInnerStyle} />
          </div>
          {joinFailed && (
            <p style={descStyle} role='alert'>
              {intl.formatMessage(messages.joinFailed)}
            </p>
          )}
          <CallControls
            call={call}
            onLeave={handleLeave}
            leaveLabel={intl.formatMessage(messages.leave)}
            inputPicker
          />
          <CallRecordings kind='kuddle' id={room.id} />
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
