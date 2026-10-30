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
// leaving the page mid-call moves it into the floating mini window, and
// coming back picks the same call up. The call itself is
// use_kuddle_call.ts, shared with the frame a Kuddle shows in a space it's
// Konnected to (kuddle_frame.tsx). Leaner than `features/live/index.tsx`
// otherwise: no lobby and no auto-rejoin after a reload.
//
// Below the call sit the Kuddle's recordings, for anyone who can see it, and
// its "Attached" block (huddle takes and makes links like every korner with
// records); its host manages it.

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import { useHistory, useParams } from 'react-router-dom';

import { apiRequestGet } from 'mastodon/api';
import { AttachmentSection } from 'mastodon/components/attachment_section';
import { CallControls } from 'mastodon/components/call_controls';
import { CallRecordings } from 'mastodon/components/call_recordings';
import { Stage } from 'mastodon/components/stage';

import { KuddleFollow } from './kuddle_follow';
import type { KuddleFollowState } from './kuddle_follow';
import { useKuddleCall } from './use_kuddle_call';

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
  const { id } = useParams<{ id: string }>();
  const history = useHistory();
  const [room, setRoom] = useState<HuddleRoomJSON | null>(null);
  const [error, setError] = useState(false);

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

  // Opening the Kuddle is the join; leaving goes back to the Huddle.
  const goToHuddle = useCallback(() => {
    history.push('/hub/huddle');
  }, [history]);
  const { call, leave, joinFailed, slotRef } = useKuddleCall(id, room, {
    path: `/hub/huddle/kuddle/${id}`,
    autoJoin: true,
    onLeft: goToHuddle,
  });

  const handleFollowChange = useCallback((state: KuddleFollowState) => {
    setRoom((current) => (current ? { ...current, ...state } : current));
  }, []);

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
            onLeave={leave}
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
