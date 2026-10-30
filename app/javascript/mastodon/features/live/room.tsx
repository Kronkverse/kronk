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
// The call follows you, as the Main Huddle's does (docs/spaces/huddle.md):
// it lives on document.body (huddle_pip/jitsi_session.ts), so leaving the
// page mid-call moves it into the floating mini window, and coming back
// picks the same call up. Leaner than `features/live/index.tsx` otherwise:
// no lobby and no auto-rejoin after a reload.
//
// Below the call sit the Kuddle's recordings, for anyone who can see it, and
// its "Attached" block (huddle takes and makes links like every korner with
// records); its host manages it.

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import { useHistory, useParams } from 'react-router-dom';

import {
  huddleExpanded,
  huddleJoined,
  huddleLeft,
  huddleMinimized,
} from 'mastodon/actions/huddle';
import { apiRequestGet, apiRequestPost } from 'mastodon/api';
import { AttachmentSection } from 'mastodon/components/attachment_section';
import { CallControls } from 'mastodon/components/call_controls';
import { CallRecordings } from 'mastodon/components/call_recordings';
import { Stage } from 'mastodon/components/stage';
import {
  createJitsiContainer,
  disposeJitsiSession,
  getJitsiSession,
  getJitsiSessionFor,
  setJitsiSession,
  setJitsiSlot,
} from 'mastodon/features/huddle_pip/jitsi_session';
import { me } from 'mastodon/initial_state';
import type { Call } from 'mastodon/jitsi';
import { createCall, getCallPass, loadJitsi } from 'mastodon/jitsi';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

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

export const LiveRoom: React.FC = () => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const { id } = useParams<{ id: string }>();
  const placeKey = `kuddle:${id}`;
  const history = useHistory();
  const [room, setRoom] = useState<HuddleRoomJSON | null>(null);
  const [error, setError] = useState(false);
  const joinedRef = useRef(false);
  const [apiLoaded, setApiLoaded] = useState(false);
  // The call area on this page: the call is drawn over it.
  const slotRef = useRef<HTMLDivElement>(null);
  const callRef = useRef<Call | null>(null);
  const [call, setCall] = useState<Call | null>(null);
  const [joinFailed, setJoinFailed] = useState(false);
  const currentAccount = useAppSelector((state) =>
    me ? state.accounts.get(me) : undefined,
  );

  useEffect(() => {
    let cancelled = false;
    setRoom(null);
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

  // Coming back from the mini window picks this Kuddle's call up again.
  // Leaving the page mid-call keeps it: it moves into the mini window.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    const existing = getJitsiSessionFor(placeKey);
    joinedRef.current = false;
    callRef.current = null;
    setCall(null);
    if (existing) {
      joinedRef.current = true;
      callRef.current = existing.call;
      setCall(existing.call);
      dispatch(huddleExpanded());
    }
    return () => {
      mountedRef.current = false;
      const ours = getJitsiSessionFor(placeKey);
      if (ours && ours.call === callRef.current) {
        dispatch(
          huddleMinimized({
            participantCount: ours.call.api.getNumberOfParticipants(),
          }),
        );
      }
    };
  }, [placeKey, dispatch]);

  // The call ended away from this page (hung up from the mini window before
  // coming back, say): nothing to show.
  const huddleActive = useAppSelector((state) => state.huddle.active);
  useEffect(() => {
    if (huddleActive || !callRef.current) return;
    if (getJitsiSession()?.call === callRef.current) return;
    callRef.current = null;
    setCall(null);
  }, [huddleActive]);

  // Show the call over this page's call area while you're in it. The area
  // is drawn once the Room is in, which can be after the call (coming back
  // from the mini window).
  const roomShown = room !== null;
  useEffect(() => {
    if (!call || !roomShown) return undefined;
    const el = slotRef.current;
    setJitsiSlot(el);
    return () => {
      setJitsiSlot(null, el ?? undefined);
    };
  }, [call, roomShown]);

  const handleFollowChange = useCallback((state: KuddleFollowState) => {
    setRoom((current) => (current ? { ...current, ...state } : current));
  }, []);

  // Unhuddle, here or (hanging up inside the call) in the mini window.
  const handleLeave = useCallback(() => {
    disposeJitsiSession(callRef.current ?? undefined);
    callRef.current = null;
    dispatch(huddleLeft());
    if (!mountedRef.current) return;
    setCall(null);
    history.push('/hub/huddle');
  }, [dispatch, history]);

  // Opening the Room is the join: once the Room and the Jitsi script are
  // both in, get a pass and embed the call. `joinedRef` keeps it to one
  // embed per visit, whatever else about the Room changes meanwhile.
  useEffect(() => {
    if (!room || !apiLoaded || joinedRef.current) return;
    joinedRef.current = true;

    void getCallPass('kuddle', room.id)
      .then((pass) => {
        if (!mountedRef.current) return undefined;
        const displayName =
          currentAccount?.get('display_name') ??
          currentAccount?.get('username') ??
          'Kronker';
        const container = createJitsiContainer();
        const created = createCall({
          parentNode: container,
          pass,
          displayName,
          avatarUrl: currentAccount?.get('avatar'),
          subject: room.name,
        });
        if (!created) {
          container.remove();
          setJoinFailed(true);
          return undefined;
        }
        // Hanging up inside Jitsi leaves the Room, same as Unhuddle.
        created.api.addListener('readyToClose', () => {
          if (getJitsiSession()?.call === created) handleLeave();
        });
        callRef.current = created;
        setCall(created);
        // One call at a time: this ends a call already in the mini window.
        setJitsiSession({
          call: created,
          container,
          place: {
            key: `kuddle:${room.id}`,
            path: `/hub/huddle/kuddle/${room.id}`,
            name: room.name,
          },
        });
        dispatch(huddleJoined());
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
  }, [room, apiLoaded, currentAccount, handleLeave, dispatch]);

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
          {/* The call is drawn over this box (jitsi_session.ts). */}
          <div ref={slotRef} style={jitsiWrapStyle} data-huddle-slot='docked' />
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
