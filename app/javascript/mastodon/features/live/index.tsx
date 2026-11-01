import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import { useHistory, useLocation } from 'react-router-dom';

import Diversity2Icon from '@/material-icons/400-24px/diversity_2-fill.svg?react';
import {
  huddleJoined,
  huddleLeft,
  huddleMinimized,
  huddleExpanded,
} from 'mastodon/actions/huddle';
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
import { parseKonnectParam } from 'mastodon/hooks/useKonnect';
import { useKonnectReturn } from 'mastodon/hooks/useKonnectReturn';
import { me } from 'mastodon/initial_state';
import type { Call } from 'mastodon/jitsi';
import {
  createCall,
  getCallPass,
  getCallPresence,
  jitsiHost,
  loadJitsi,
} from 'mastodon/jitsi';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

import { RoomComposer } from './room_composer';
import type { CreatedRoom } from './room_composer';
import { RoomsList } from './rooms_list';

const messages = defineMessages({
  heading: { id: 'live.title', defaultMessage: 'Huddle' },
  join: { id: 'live.join', defaultMessage: 'Huddle Up' },
  leave: { id: 'live.leave', defaultMessage: 'Unhuddle' },
  joinFailed: {
    id: 'live.join_failed',
    defaultMessage: 'Couldn’t get into the Huddle just now. Try again.',
  },
  roomDescription: {
    id: 'live.room_description',
    defaultMessage:
      'Huddle is a live video space for the Kronk community to hang out, co-create, share wisdom, stories, art and more. Authentic presence is welcomed in the Huddle.',
  },
});

// The call lives outside this page (huddle_pip/jitsi_session.ts) so that
// leaving the page doesn't end it: it shrinks into the floating mini window
// (huddle_pip/index.tsx) and comes back here when you return.

// Fills the Stage below the Frame's auto-intro. Stage is a flex column
// with its own scroll, so the body flexes to take the remaining height
// (the Jitsi iframe + lobby need real height to fill).
const bodyStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minHeight: 0,
};
const lobbyContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  flex: 1,
  padding: '40px 20px',
  gap: '24px',
};
const roomIconStyle: React.CSSProperties = {
  width: '80px',
  height: '80px',
  borderRadius: '20px',
  background:
    'linear-gradient(135deg, color-mix(in srgb, var(--accent) 65%, #B8A0FF 35%) 0%, var(--accent) 100%)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};
const roomInfoStyle: React.CSSProperties = {
  textAlign: 'center',
  maxWidth: '340px',
};
const headingStyle: React.CSSProperties = {
  fontSize: '24px',
  fontWeight: 700,
  color: 'var(--primary-text-color)',
  margin: '0 0 10px 0',
};
const descriptionStyle: React.CSSProperties = {
  fontSize: '15px',
  color: 'var(--secondary-text-color)',
  margin: 0,
  lineHeight: 1.6,
};
const participantBoxStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '10px',
  padding: '16px 20px',
  borderRadius: '12px',
  backgroundColor: 'var(--surface-background-color)',
  border: '1px solid var(--background-border-color)',
  width: '100%',
  maxWidth: '320px',
};
const participantHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
};
const greenDotStyle: React.CSSProperties = {
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  backgroundColor: '#44b700',
  boxShadow: '0 0 6px rgba(68, 183, 0, 0.6)',
};
const participantCountLabelStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  color: 'var(--primary-text-color)',
};
const participantNamesStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'center',
  gap: '6px',
};
const nameChipStyle: React.CSSProperties = {
  padding: '4px 10px',
  borderRadius: '16px',
  backgroundColor: 'var(--background-border-color)',
  color: 'var(--primary-text-color)',
  fontSize: '13px',
  fontWeight: 600,
};
const footerStyle: React.CSSProperties = {
  fontSize: '12px',
  color: 'var(--secondary-text-color)',
  opacity: 0.45,
  textAlign: 'center',
  letterSpacing: '0.04em',
  marginTop: '12px',
};
const inRoomContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
};
const inRoomHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 16px',
  borderBottom: '1px solid var(--background-border-color)',
};
const inRoomHeaderLeftStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
};
const inRoomTitleStyle: React.CSSProperties = {
  color: 'var(--primary-text-color)',
  fontWeight: 600,
  fontSize: '15px',
};
const inRoomCountStyle: React.CSSProperties = {
  color: 'var(--secondary-text-color)',
  fontSize: '13px',
};
const joinFailedStyle: React.CSSProperties = {
  fontSize: '14px',
  color: 'var(--warning-red)',
  margin: 0,
};
const jitsiWrapperStyle: React.CSSProperties = {
  flex: 1,
  minHeight: '400px',
  position: 'relative',
};
// The Main Huddle's call, as the mini window knows it (jitsi_session.ts).
const HUDDLE_PLACE = { key: 'huddle', path: '/hub/huddle' };

// `autoOpenComposer` is set by the `/hub/huddle/composer` route (the Ж
// menu's compose target for this korner — see config/korners/
// huddle.yaml; `/hub/huddle/new` redirects there). While it's set the
// New Room composer is open over the lobby; `?konnect=krew:<id>` (or the
// older `?krew=<id>`) Konnects the Room to a Krew and keys its draft to
// that Krew. Cancelling goes back to the record it was opened from, or to
// `/hub/huddle`; creating goes into the new Room.
const Live: React.FC<{
  multiColumn?: boolean;
  autoOpenComposer?: boolean;
}> = ({ autoOpenComposer }) => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const history = useHistory();
  const location = useLocation();
  const konnectFrom = autoOpenComposer
    ? parseKonnectParam(location.search)
    : null;
  const composerKrewId = konnectFrom?.slug === 'krew' ? konnectFrom.id : null;
  const returnToSource = useKonnectReturn();
  const closeComposer = useCallback(() => {
    if (returnToSource('/hub/huddle')) return;
    history.replace('/hub/huddle');
  }, [history, returnToSource]);
  const handleRoomCreated = useCallback(
    (room: CreatedRoom) => {
      history.push(`/hub/huddle/kuddle/${room.id}`);
    },
    [history],
  );
  // The call area on this page: the call is drawn over it.
  const slotRef = useRef<HTMLDivElement>(null);
  const callRef = useRef<Call | null>(null);
  const mountedRef = useRef(true);

  const [inRoom, setInRoom] = useState(false);
  const [call, setCall] = useState<Call | null>(null);
  const [joinFailed, setJoinFailed] = useState(false);
  const [apiLoaded, setApiLoaded] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const [lobbyParticipants, setLobbyParticipants] = useState<string[]>([]);

  // Refs so the unmount cleanup can read the latest values
  const inRoomRef = useRef(false);
  const participantCountRef = useRef(0);

  // Was the huddle minimized when we mounted? (user returned to /huddle)
  const huddleWasMinimized = useAppSelector(
    (state) => state.huddle.active && state.huddle.minimized,
  );
  const [autoJoining, setAutoJoining] = useState(false);
  const autoJoinInitialisedRef = useRef(false);

  const currentAccount = useAppSelector((state) =>
    me ? state.accounts.get(me) : undefined,
  );
  const currentUsername = currentAccount?.get('username');
  const currentAvatar = currentAccount?.get('avatar');

  // Keep refs in sync so cleanup can read latest values
  useEffect(() => {
    inRoomRef.current = inRoom;
  }, [inRoom]);

  useEffect(() => {
    participantCountRef.current = participantCount;
  }, [participantCount]);

  // On mount: coming back from the mini window picks the same call up again.
  // If it has gone (a reload ends it), join afresh. A Kuddle's call in the
  // mini window stays there: it isn't this page's.
  useEffect(() => {
    if (!autoJoinInitialisedRef.current) {
      autoJoinInitialisedRef.current = true;
      if (huddleWasMinimized) {
        const existing = getJitsiSessionFor(HUDDLE_PLACE.key);
        if (existing) {
          callRef.current = existing.call;
          setCall(existing.call);
          setParticipantCount(existing.call.api.getNumberOfParticipants());
          setInRoom(true);
          dispatch(huddleExpanded());
        } else if (!getJitsiSession()) {
          setAutoJoining(true);
          dispatch(huddleExpanded());
        }
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Show the call over this page's call area while you're in it.
  useEffect(() => {
    if (!inRoom) return undefined;
    const el = slotRef.current;
    setJitsiSlot(el);
    return () => {
      setJitsiSlot(null, el ?? undefined);
    };
  }, [inRoom]);

  // How many are in the call, every few seconds.
  useEffect(() => {
    if (!inRoom) return undefined;
    const poll = window.setInterval(() => {
      if (callRef.current) {
        setParticipantCount(callRef.current.api.getNumberOfParticipants());
      }
    }, 5000);
    return () => {
      window.clearInterval(poll);
    };
  }, [inRoom]);

  // Dispatch huddleJoined when we enter the room
  useEffect(() => {
    if (inRoom) {
      dispatch(huddleJoined());
    }
  }, [inRoom]); // eslint-disable-line react-hooks/exhaustive-deps

  // The Jitsi script, once, from the configured server.
  useEffect(() => {
    let cancelled = false;
    loadJitsi()
      .then(() => {
        if (!cancelled) setApiLoaded(true);
        return undefined;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // Leaving the page mid-call keeps the call: it moves into the floating
  // mini window. Otherwise there is nothing to keep.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (inRoomRef.current && getJitsiSessionFor(HUDDLE_PLACE.key)) {
        dispatch(
          huddleMinimized({ participantCount: participantCountRef.current }),
        );
      }
    };
  }, [dispatch]);

  useEffect(() => {
    if (inRoom || !jitsiHost) return undefined;

    // Kronk asks the Jitsi server, which answers only Kronk.
    const fetchRoomInfo = async () => {
      try {
        const { names } = await getCallPresence('huddle');
        setLobbyParticipants(names ?? []);
      } catch {
        setLobbyParticipants([]);
      }
    };

    void fetchRoomInfo();
    const pollInterval = setInterval(() => void fetchRoomInfo(), 10000);

    return () => {
      clearInterval(pollInterval);
      setLobbyParticipants([]);
    };
  }, [inRoom]);

  const joinRoom = useCallback(() => {
    if (!apiLoaded) return;
    setJoinFailed(false);
    setInRoom(true);
  }, [apiLoaded]);

  // Trigger auto-rejoin once Jitsi API is loaded
  useEffect(() => {
    if (autoJoining && apiLoaded) {
      setAutoJoining(false);
      joinRoom();
    }
  }, [autoJoining, apiLoaded, joinRoom]);

  const leaveRoom = useCallback(() => {
    disposeJitsiSession(callRef.current ?? undefined);
    callRef.current = null;
    dispatch(huddleLeft());
    if (!mountedRef.current) return;
    setCall(null);
    setParticipantCount(0);
    setInRoom(false);
  }, [dispatch]);

  // In: a pass for the Main Huddle (a token, on a server that takes them),
  // then the call, on document.body so it can follow you round Kronk.
  // Jitsi's toolbar is hidden; Kronk's controls sit under the call.
  useEffect(() => {
    if (!inRoom || !apiLoaded || callRef.current) return undefined;
    let cancelled = false;
    const failed = () => {
      if (cancelled) return;
      dispatch(huddleLeft());
      setJoinFailed(true);
      setInRoom(false);
    };

    getCallPass('huddle')
      .then((pass) => {
        if (cancelled || callRef.current) return undefined;
        const container = createJitsiContainer();
        const created = createCall({
          parentNode: container,
          pass,
          displayName: currentUsername ? '@' + currentUsername : 'Kronker',
          avatarUrl: currentAvatar,
          subject: 'The Huddle',
        });
        if (!created) {
          container.remove();
          failed();
          return undefined;
        }
        callRef.current = created;
        setCall(created);
        setJitsiSession({ call: created, container, place: HUDDLE_PLACE });
        // Hanging up inside the call, here or in the mini window.
        created.api.addListener('readyToClose', () => {
          if (getJitsiSession()?.call === created) leaveRoom();
        });
        return undefined;
      })
      .catch(failed);

    return () => {
      cancelled = true;
    };
  }, [inRoom, apiLoaded, currentUsername, currentAvatar, leaveRoom, dispatch]);

  const handleJoinRoom = useCallback(() => {
    joinRoom();
  }, [joinRoom]);

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (apiLoaded) {
        e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.boxShadow =
          '0 6px 20px color-mix(in srgb, var(--accent) 50%, transparent)';
      }
    },
    [apiLoaded],
  );

  const handleMouseLeave = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow =
        '0 4px 16px color-mix(in srgb, var(--accent) 30%, transparent)';
    },
    [],
  );

  const joinButtonStyle = useMemo<React.CSSProperties>(
    () => ({
      padding: '14px 48px',
      fontSize: '16px',
      fontWeight: 700,
      borderRadius: '12px',
      border: 'none',
      cursor: apiLoaded ? 'pointer' : 'default',
      background: apiLoaded
        ? 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 65%, #B8A0FF 35%) 0%, var(--accent) 100%)'
        : 'var(--background-border-color)',
      color: '#fff',
      boxShadow: apiLoaded
        ? '0 4px 16px color-mix(in srgb, var(--accent) 30%, transparent)'
        : 'none',
      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      opacity: apiLoaded ? 1 : 0.5,
    }),
    [apiLoaded],
  );

  useEffect(() => {
    if (!me) {
      window.location.href = '/auth/sign_in';
    }
  }, []);

  if (!me) return null;

  return (
    <Stage label={intl.formatMessage(messages.heading)}>
      <div style={bodyStyle}>
        {!inRoom ? (
          <div style={lobbyContainerStyle}>
            <div style={roomIconStyle}>
              <Diversity2Icon
                style={{ width: 44, height: 44, fill: 'white' }}
              />
            </div>

            <div style={roomInfoStyle}>
              <h2 style={headingStyle}>The Huddle</h2>
              <p style={descriptionStyle}>
                {intl.formatMessage(messages.roomDescription)}
              </p>
            </div>

            {lobbyParticipants.length > 0 ? (
              <div style={participantBoxStyle}>
                <div style={participantHeaderStyle}>
                  <div style={greenDotStyle} />
                  <span style={participantCountLabelStyle}>
                    {lobbyParticipants.length}{' '}
                    {lobbyParticipants.length === 1
                      ? 'person in room'
                      : 'people in room'}
                  </span>
                </div>
                <div style={participantNamesStyle}>
                  {lobbyParticipants.map((name, i) => (
                    <span key={i} style={nameChipStyle}>
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <button
              onClick={handleJoinRoom}
              disabled={!apiLoaded}
              style={joinButtonStyle}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              {intl.formatMessage(messages.join)}
            </button>

            {joinFailed && (
              <p style={joinFailedStyle} role='alert'>
                {intl.formatMessage(messages.joinFailed)}
              </p>
            )}

            <p style={footerStyle}>Powered by Jitsi Meet</p>

            {/* Rooms — the open topical Huddle spaces (Coworking,
                Meetings, Music, …) live beneath the Main Huddle
                lobby. The "New Room" affordance is the Ж menu (see
                config/korners/huddle.yaml `compose:`); this list
                is discovery only. Phase 9.6. */}
            <RoomsList />

            <CallRecordings kind='huddle' />
          </div>
        ) : (
          <div style={inRoomContainerStyle}>
            <div style={inRoomHeaderStyle}>
              <div style={inRoomHeaderLeftStyle}>
                <div style={greenDotStyle} />
                <span style={inRoomTitleStyle}>The Huddle</span>
                {participantCount > 0 && (
                  <span style={inRoomCountStyle}>
                    {participantCount}{' '}
                    {participantCount === 1 ? 'person' : 'people'}
                  </span>
                )}
              </div>
            </div>
            {/* The call is drawn over this box (jitsi_session.ts). */}
            <div
              ref={slotRef}
              style={jitsiWrapperStyle}
              data-huddle-slot='docked'
            />
            <CallControls
              call={call}
              onLeave={leaveRoom}
              leaveLabel={intl.formatMessage(messages.leave)}
              inputPicker
            />
          </div>
        )}
      </div>

      {autoOpenComposer && (
        <RoomComposer
          forKrewId={composerKrewId}
          onCancel={closeComposer}
          onCreated={handleRoomCreated}
        />
      )}

      <Helmet>
        <title>{intl.formatMessage(messages.heading)}</title>
        <meta name='robots' content='noindex' />
      </Helmet>
    </Stage>
  );
};

// eslint-disable-next-line import/no-default-export
export default Live;
