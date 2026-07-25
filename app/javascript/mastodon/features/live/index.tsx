import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import { useParams } from 'react-router-dom';

import Diversity2Icon from '@/material-icons/400-24px/diversity_2-fill.svg?react';
import {
  huddleJoined,
  huddleLeft,
  huddleMinimized,
  huddleExpanded,
} from 'mastodon/actions/huddle';
import { Stage } from 'mastodon/components/stage';
import { me, getAccessToken } from 'mastodon/initial_state';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

const messages = defineMessages({
  heading: { id: 'live.title', defaultMessage: 'Huddle' },
  join: { id: 'live.join', defaultMessage: 'Huddle Up' },
  leave: { id: 'live.leave', defaultMessage: 'Unhuddle' },
  roomDescription: {
    id: 'live.room_description',
    defaultMessage:
      'Huddle is a live video space for the Kronk community to hang out, co-create, share wisdom, stories, art and more. Authentic presence is welcomed in the Huddle.',
  },
});

const JITSI_DOMAIN = 'meet.talitamoss.info';
// Fallback / Main Huddle room. Krew Huddles derive their room from
// the Krew slug (see `useRoomName` below) so each Krew has its own
// isolated Jitsi conference.
const MAIN_ROOM_NAME = 'huddle';

// Sanitise the Krew slug so it lands as a Prosody-safe room name.
// Slugs are already `[a-z0-9-]` in the Krew model, but belt-and-braces.
const roomNameForKrew = (slug: string) =>
  `huddle-krew-${slug.replace(/[^a-z0-9-]/gi, '').toLowerCase()}`;

interface JitsiApi {
  dispose: () => void;
  addListener: (event: string, callback: () => void) => void;
  executeCommand: (command: string, ...args: string[]) => void;
  getNumberOfParticipants: () => number;
  _countInterval?: ReturnType<typeof setInterval>;
}

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
const leaveButtonStyle: React.CSSProperties = {
  padding: '6px 16px',
  fontSize: '13px',
  fontWeight: 600,
  borderRadius: '8px',
  border: 'none',
  backgroundColor: '#e03131',
  color: '#ffffff',
  cursor: 'pointer',
};
const jitsiWrapperStyle: React.CSSProperties = {
  flex: 1,
  minHeight: '400px',
  position: 'relative',
};
const jitsiContainerStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
};

const Live: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  // Route param: `/hub/huddle/krew/:krewSlug` → per-Krew room; bare
  // `/hub/huddle/live` → the Main Huddle. `useParams` returns `{}` on
  // routes without the segment.
  const { krewSlug } = useParams<{ krewSlug?: string }>();
  const roomName = krewSlug ? roomNameForKrew(krewSlug) : MAIN_ROOM_NAME;
  const jitsiContainerRef = useRef<HTMLDivElement>(null);
  const jitsiApiRef = useRef<JitsiApi | null>(null);

  const [inRoom, setInRoom] = useState(false);
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

  // On mount: if returning from a minimized state, trigger auto-rejoin
  useEffect(() => {
    if (!autoJoinInitialisedRef.current) {
      autoJoinInitialisedRef.current = true;
      if (huddleWasMinimized) {
        dispatch(huddleExpanded());
        setAutoJoining(true);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Dispatch huddleJoined when we enter the room
  useEffect(() => {
    if (inRoom) {
      dispatch(huddleJoined());
    }
  }, [inRoom]); // eslint-disable-line react-hooks/exhaustive-deps

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
      if (inRoomRef.current) {
        // Navigation away while in room — minimize to PIP instead of leaving
        dispatch(
          huddleMinimized({ participantCount: participantCountRef.current }),
        );
      }
      if (jitsiApiRef.current) {
        if (jitsiApiRef.current._countInterval) {
          clearInterval(jitsiApiRef.current._countInterval);
        }
        jitsiApiRef.current.dispose();
        jitsiApiRef.current = null;
      }
    };
  }, [dispatch]);

  useEffect(() => {
    if (inRoom) return undefined;

    const fetchRoomInfo = async () => {
      try {
        const roomUrl =
          'https://' +
          JITSI_DOMAIN +
          '/room?room=' +
          roomName +
          '&domain=meet.jitsi';
        const response = await fetch(roomUrl);
        if (!response.ok) {
          setLobbyParticipants([]);
          return;
        }
        const data = (await response.json()) as {
          jid: string;
          display_name: string;
          email: string;
        }[];
        const names = data
          .map((p) => p.display_name)
          .filter((name): name is string => !!name);
        setLobbyParticipants(names);
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
  }, [inRoom, roomName]);

  const [jwtToken, setJwtToken] = useState<string | null>(null);

  const joinRoom = useCallback(async () => {
    if (!apiLoaded) return;
    try {
      const response = await fetch('/api/v1/huddle_token', {
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
        },
      });
      if (response.ok) {
        const data = (await response.json()) as { token: string };
        setJwtToken(data.token);
      }
    } catch {
      // continue without token
    }
    setInRoom(true);
  }, [apiLoaded]);

  // Trigger auto-rejoin once Jitsi API is loaded
  useEffect(() => {
    if (autoJoining && apiLoaded) {
      setAutoJoining(false);
      void joinRoom();
    }
  }, [autoJoining, apiLoaded, joinRoom]);

  const leaveRoom = useCallback(() => {
    if (jitsiApiRef.current) {
      if (jitsiApiRef.current._countInterval) {
        clearInterval(jitsiApiRef.current._countInterval);
      }
      jitsiApiRef.current.dispose();
      jitsiApiRef.current = null;
    }
    setParticipantCount(0);
    setInRoom(false);
    dispatch(huddleLeft());
  }, [dispatch]);

  useEffect(() => {
    if (!inRoom || !apiLoaded || !jitsiContainerRef.current) return;
    if (jitsiApiRef.current) return;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    const JitsiMeetExternalAPI = (window as any).JitsiMeetExternalAPI;
    if (!JitsiMeetExternalAPI) return;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const api = new JitsiMeetExternalAPI(JITSI_DOMAIN, {
      roomName: roomName,
      jwt: jwtToken ?? undefined,
      parentNode: jitsiContainerRef.current,
      width: '100%',
      height: '100%',
      userInfo: {
        displayName: currentUsername ? '@' + currentUsername : 'Kronker',
        avatarUrl: currentAvatar,
      },
      configOverwrite: {
        prejoinPageEnabled: false,
        disableDeepLinking: true,
        prejoinConfig: { enabled: false },
        startWithAudioMuted: false,
        startWithVideoMuted: false,
        subject: 'The Huddle',
        hideConferenceTimer: true,
        defaultLogoUrl: 'https://meet.talitamoss.info/images/tal-watermark.png',
        dynamicBrandingUrl: 'https://meet.talitamoss.info/branding.json',
        disableInviteFunctions: true,
        enableClosePage: false,
        disablePassword: true,
        toolbarButtons: [
          'microphone',
          'camera',
          'chat',
          'desktop',
          'fullscreen',
          'raisehand',
          'tileview',
          'toggle-camera',
          'select-background',
          'settings',
          'participants-pane',
          'filmstrip',
        ],
      },
      interfaceConfigOverwrite: {
        SHOW_JITSI_WATERMARK: true,
        SHOW_BRAND_WATERMARK: false,
        SHOW_POWERED_BY: false,
        HIDE_INVITE_MORE_HEADER: true,
        DEFAULT_REMOTE_DISPLAY_NAME: 'Kronker',
        DEFAULT_LOGO_URL:
          'https://meet.talitamoss.info/images/tal-watermark.png',
        DEFAULT_WELCOME_PAGE_LOGO_URL:
          'https://meet.talitamoss.info/images/tal-watermark.png',
        JITSI_WATERMARK_LINK: 'https://kronk.info',
      },
    }) as JitsiApi;

    jitsiApiRef.current = api;

    api.addListener('videoConferenceJoined', () => {
      if (jitsiApiRef.current) {
        jitsiApiRef.current.executeCommand('password', '');
        if (currentUsername) {
          jitsiApiRef.current.executeCommand(
            'displayName',
            '@' + currentUsername,
          );
        }
      }
    });

    api.addListener('readyToClose', () => {
      leaveRoom();
    });

    const countInterval = setInterval(() => {
      if (jitsiApiRef.current) {
        setParticipantCount(jitsiApiRef.current.getNumberOfParticipants());
      }
    }, 5000);
    api._countInterval = countInterval;
  }, [
    inRoom,
    apiLoaded,
    currentUsername,
    currentAvatar,
    leaveRoom,
    jwtToken,
    roomName,
  ]);

  const handleJoinRoom = useCallback(() => {
    void joinRoom();
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

            <p style={footerStyle}>
              Powered by Jitsi Meet
              <br />
              End-to-end encrypted
            </p>
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
              <button onClick={leaveRoom} style={leaveButtonStyle}>
                {intl.formatMessage(messages.leave)}
              </button>
            </div>
            <div style={jitsiWrapperStyle}>
              <div ref={jitsiContainerRef} style={jitsiContainerStyle} />
            </div>
          </div>
        )}
      </div>

      <Helmet>
        <title>{intl.formatMessage(messages.heading)}</title>
        <meta name='robots' content='noindex' />
      </Helmet>
    </Stage>
  );
};

// eslint-disable-next-line import/no-default-export
export default Live;
