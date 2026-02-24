import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';

import PlayArrowIcon from '@/material-icons/400-24px/play_arrow-fill.svg?react';
import { Column } from 'mastodon/components/column';
import type { ColumnRef } from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { me } from 'mastodon/initial_state';
import { useAppSelector } from 'mastodon/store';

const messages = defineMessages({
  heading: { id: 'live.title', defaultMessage: 'Live' },
  join: { id: 'live.join', defaultMessage: 'Join Room' },
  leave: { id: 'live.leave', defaultMessage: 'Leave' },
  roomDescription: {
    id: 'live.room_description',
    defaultMessage:
      'Hang out with the Kronk community. Drop in, say hi, or just vibe.',
  },
});

const JITSI_DOMAIN = 'meet.talitamoss.info';
const ROOM_NAME = 'kronk';

// Type for the Jitsi Meet External API instance
interface JitsiApi {
  dispose: () => void;
  addListener: (event: string, callback: () => void) => void;
  executeCommand: (command: string, ...args: string[]) => void;
  getNumberOfParticipants: () => number;
  _countInterval?: ReturnType<typeof setInterval>;
}

// Style constants to avoid inline object creation in JSX
const scrollableStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
};
const lobbyContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  flex: 1,
  padding: '40px 20px',
  gap: '32px',
};
const roomIconStyle: React.CSSProperties = {
  width: '96px',
  height: '96px',
  borderRadius: '24px',
  background: 'linear-gradient(135deg, #6364FF 0%, #563ACC 100%)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 8px 32px rgba(99, 100, 255, 0.3)',
};
const roomInfoStyle: React.CSSProperties = {
  textAlign: 'center',
  maxWidth: '320px',
};
const headingStyle: React.CSSProperties = {
  fontSize: '24px',
  fontWeight: 800,
  color: 'var(--primary-text-color)',
  margin: '0 0 8px 0',
  letterSpacing: '-0.02em',
};
const descriptionStyle: React.CSSProperties = {
  fontSize: '15px',
  color: 'var(--secondary-text-color)',
  margin: 0,
  lineHeight: 1.5,
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
  fontWeight: 700,
  color: 'var(--primary-text-color)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
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
const poweredByStyle: React.CSSProperties = {
  fontSize: '12px',
  color: 'var(--secondary-text-color)',
  opacity: 0.6,
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
  border: '1px solid var(--background-border-color)',
  backgroundColor: 'transparent',
  color: 'var(--primary-text-color)',
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

const Live: React.FC<{
  multiColumn: boolean;
}> = ({ multiColumn }) => {
  const intl = useIntl();
  const columnRef = useRef<ColumnRef>(null);
  const jitsiContainerRef = useRef<HTMLDivElement>(null);
  const jitsiApiRef = useRef<JitsiApi | null>(null);

  const [inRoom, setInRoom] = useState(false);
  const [apiLoaded, setApiLoaded] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const [lobbyParticipants, setLobbyParticipants] = useState<string[]>([]);

  const currentAccount = useAppSelector((state) =>
    me ? state.accounts.get(me) : undefined,
  );
  const currentUsername = currentAccount?.get('username');
  const currentAvatar = currentAccount?.get('avatar');

  // Load Jitsi external API script
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
    script.onload = () => { setApiLoaded(true); };
    document.head.appendChild(script);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (jitsiApiRef.current) {
        jitsiApiRef.current.dispose();
        jitsiApiRef.current = null;
      }
    };
  }, []);

  // REST API polling to see who's in the room (replaces hidden Jitsi observer)
  useEffect(() => {
    if (inRoom) return undefined;

    const fetchRoomInfo = async () => {
      try {
        const roomUrl =
          'https://' +
          JITSI_DOMAIN +
          '/room?room=' +
          ROOM_NAME +
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
  }, [inRoom]);

  const joinRoom = useCallback(() => {
    if (!apiLoaded) return;
    setInRoom(true);
  }, [apiLoaded]);

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
  }, []);

  // Initialize Jitsi after container mounts
  useEffect(() => {
    if (!inRoom || !apiLoaded || !jitsiContainerRef.current) return;
    if (jitsiApiRef.current) return;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    const JitsiMeetExternalAPI = (window as any).JitsiMeetExternalAPI;
    if (!JitsiMeetExternalAPI) return;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const api = new JitsiMeetExternalAPI(JITSI_DOMAIN, {
      roomName: ROOM_NAME,
      parentNode: jitsiContainerRef.current,
      width: '100%',
      height: '100%',
      userInfo: {
        displayName: currentUsername ? '@' + currentUsername : 'Kronker',
        avatarUrl: currentAvatar,
      },
      configOverwrite: {
        prejoinPageEnabled: false,
        prejoinConfig: { enabled: false },
        startWithAudioMuted: true,
        startWithVideoMuted: false,
        subject: 'Kronk',
        hideConferenceTimer: true,
        disableInviteFunctions: true,
        enableClosePage: false,
      },
      interfaceConfigOverwrite: {
        SHOW_JITSI_WATERMARK: false,
        SHOW_BRAND_WATERMARK: false,
        SHOW_POWERED_BY: false,
        HIDE_INVITE_MORE_HEADER: true,
        DEFAULT_REMOTE_DISPLAY_NAME: 'Kronker',
      },
    }) as JitsiApi;

    jitsiApiRef.current = api;

    api.addListener('videoConferenceJoined', () => {
      if (jitsiApiRef.current && currentUsername) {
        jitsiApiRef.current.executeCommand(
          'displayName',
          '@' + currentUsername,
        );
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
  }, [inRoom, apiLoaded, currentUsername, currentAvatar, leaveRoom]);

  const handleHeaderClick = useCallback(() => {
    columnRef.current?.scrollTop();
  }, []);

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (apiLoaded) {
        e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.boxShadow = '0 6px 24px rgba(99, 100, 255, 0.5)';
      }
    },
    [apiLoaded],
  );

  const handleMouseLeave = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = '0 4px 16px rgba(99, 100, 255, 0.4)';
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
        ? 'linear-gradient(135deg, #6364FF 0%, #563ACC 100%)'
        : 'var(--background-border-color)',
      color: '#fff',
      boxShadow: apiLoaded ? '0 4px 16px rgba(99, 100, 255, 0.4)' : 'none',
      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      opacity: apiLoaded ? 1 : 0.5,
    }),
    [apiLoaded],
  );

  return (
    <Column
      bindToDocument={!multiColumn}
      ref={columnRef}
      label={intl.formatMessage(messages.heading)}
    >
      <ColumnHeader
        icon='play_arrow'
        iconComponent={PlayArrowIcon}
        title={intl.formatMessage(messages.heading)}
        onClick={handleHeaderClick}
        multiColumn={multiColumn}
      />

      <div className='scrollable' style={scrollableStyle}>
        {!inRoom ? (
          /* Landing / Lobby */
          <div style={lobbyContainerStyle}>
            {/* Room icon */}
            <div style={roomIconStyle}>
              <svg
                width='48'
                height='48'
                viewBox='0 0 24 24'
                fill='none'
                xmlns='http://www.w3.org/2000/svg'
              >
                <path
                  d='M17 10.5V7C17 6.45 16.55 6 16 6H4C3.45 6 3 6.45 3 7V17C3 17.55 3.45 18 4 18H16C16.55 18 17 17.55 17 17V13.5L21 17.5V6.5L17 10.5Z'
                  fill='white'
                />
              </svg>
            </div>

            {/* Room info */}
            <div style={roomInfoStyle}>
              <h2 style={headingStyle}>Kronk Live Room</h2>
              <p style={descriptionStyle}>
                {intl.formatMessage(messages.roomDescription)}
              </p>
            </div>

            {/* Who's in the room */}
            {lobbyParticipants.length > 0 && (
              <div style={participantBoxStyle}>
                <div style={participantHeaderStyle}>
                  <div style={greenDotStyle} />
                  <span style={participantCountLabelStyle}>
                    {lobbyParticipants.length}{' '}
                    {lobbyParticipants.length === 1 ? 'person' : 'people'} in
                    room
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
            )}

            {/* Join button */}
            <button
              onClick={joinRoom}
              disabled={!apiLoaded}
              style={joinButtonStyle}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              {intl.formatMessage(messages.join)}
            </button>

            {/* Powered by */}
            <p style={poweredByStyle}>Powered by Jitsi Meet</p>
          </div>
        ) : (
          /* In-room view */
          <div style={inRoomContainerStyle}>
            <div style={inRoomHeaderStyle}>
              <div style={inRoomHeaderLeftStyle}>
                <div style={greenDotStyle} />
                <span style={inRoomTitleStyle}>Kronk Live Room</span>
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
    </Column>
  );
};

// eslint-disable-next-line import/no-default-export
export default Live;
