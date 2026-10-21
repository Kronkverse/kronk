import { useCallback, useEffect, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { useHistory } from 'react-router-dom';

import CallEndIcon from '@/material-icons/400-24px/call_end.svg?react';
import MicIcon from '@/material-icons/400-24px/mic.svg?react';
import MicOffIcon from '@/material-icons/400-24px/mic_off.svg?react';
import OpenInFullIcon from '@/material-icons/400-24px/open_in_full.svg?react';
import VideocamIcon from '@/material-icons/400-24px/videocam.svg?react';
import VideocamOffIcon from '@/material-icons/400-24px/videocam_off.svg?react';
import { huddleLeft } from 'mastodon/actions/huddle';
import { Icon } from 'mastodon/components/icon';
import {
  disposeJitsiSession,
  getJitsiSession,
  placeJitsiSession,
  setJitsiSlot,
} from 'mastodon/features/huddle_pip/jitsi_session';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

const messages = defineMessages({
  title: { id: 'huddle.mini.title', defaultMessage: 'Huddle' },
  count: {
    id: 'huddle.mini.count',
    defaultMessage:
      '{count, plural, one {# in the call} other {# in the call}}',
  },
  mute: { id: 'huddle.mini.mute', defaultMessage: 'Mute' },
  unmute: { id: 'huddle.mini.unmute', defaultMessage: 'Unmute' },
  cameraOff: {
    id: 'huddle.mini.camera_off',
    defaultMessage: 'Turn camera off',
  },
  cameraOn: { id: 'huddle.mini.camera_on', defaultMessage: 'Turn camera on' },
  expand: { id: 'huddle.mini.expand', defaultMessage: 'Back to the Huddle' },
  leave: { id: 'huddle.mini.leave', defaultMessage: 'Leave' },
  drag: { id: 'huddle.mini.drag', defaultMessage: 'Move the Huddle window' },
});

// Where the window sits, kept between visits on this device. Measured from
// the bottom-right corner, so it stays put as the screen changes size.
const POSITION_KEY = 'kronk.huddle.mini.position';
interface Offset {
  right: number;
  bottom: number;
}
// Clear of the space rail on a wide screen; a phone has none.
const defaultOffset = (): Offset =>
  window.innerWidth >= 630
    ? { right: 96, bottom: 20 }
    : { right: 12, bottom: 12 };

const readOffset = (): Offset => {
  try {
    const raw = window.localStorage.getItem(POSITION_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<Offset>) : null;
    if (
      parsed &&
      typeof parsed.right === 'number' &&
      typeof parsed.bottom === 'number'
    ) {
      return { right: parsed.right, bottom: parsed.bottom };
    }
  } catch {
    // A blocked or broken store just means the default corner.
  }
  return defaultOffset();
};

const saveOffset = (offset: Offset) => {
  try {
    window.localStorage.setItem(POSITION_KEY, JSON.stringify(offset));
  } catch {
    // Not kept; it still moves for this visit.
  }
};

// The Huddle while you're elsewhere in Kronk: the call itself, small and
// floating, like a video player's picture-in-picture (Tal, 2026-10-19), not
// a pill. The video is the same Jitsi call, moved over this window's video
// area (jitsi_session.ts), so mic and camera carry on. Drag it by its top
// bar; the buttons mute, turn the camera off, go back to the Huddle, leave.
export const HuddlePip: React.FC = () => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const history = useHistory();

  const active = useAppSelector((state) => state.huddle.active);
  const minimized = useAppSelector((state) => state.huddle.minimized);
  const startCount = useAppSelector((state) => state.huddle.participantCount);

  const [offset, setOffset] = useState<Offset>(readOffset);
  const [count, setCount] = useState(startCount);
  const [audioMuted, setAudioMuted] = useState(false);
  const [videoMuted, setVideoMuted] = useState(false);
  const windowRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const shown = active && minimized && getJitsiSession() !== null;

  // Put the call over this window's video area while it's shown.
  useEffect(() => {
    if (!shown) return undefined;
    const el = slotRef.current;
    setJitsiSlot(el);
    return () => {
      setJitsiSlot(null, el ?? undefined);
    };
  }, [shown]);

  // Who's in, and what's on, as the call reports it.
  useEffect(() => {
    const api = shown ? getJitsiSession()?.api : undefined;
    if (!api) return undefined;
    let live = true;
    setCount(api.getNumberOfParticipants());
    void api.isAudioMuted?.().then((muted) => {
      if (live) setAudioMuted(muted);
    });
    void api.isVideoMuted?.().then((muted) => {
      if (live) setVideoMuted(muted);
    });
    api.addListener('audioMuteStatusChanged', (data) => {
      if (live) setAudioMuted(Boolean((data as { muted?: boolean }).muted));
    });
    api.addListener('videoMuteStatusChanged', (data) => {
      if (live) setVideoMuted(Boolean((data as { muted?: boolean }).muted));
    });
    const poll = window.setInterval(() => {
      setCount(api.getNumberOfParticipants());
    }, 5000);
    return () => {
      live = false;
      window.clearInterval(poll);
    };
  }, [shown]);

  // Dragging by the top bar. The window moves as the pointer does, and the
  // call follows it; it can't be dragged off the screen.
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest('button')) return;
      const el = windowRef.current;
      if (!el) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      const start = { x: e.clientX, y: e.clientY, ...offset };
      const rect = el.getBoundingClientRect();
      const handle = e.currentTarget;

      const move = (ev: PointerEvent) => {
        const maxRight = window.innerWidth - rect.width;
        const maxBottom = window.innerHeight - rect.height;
        const next = {
          right: Math.min(
            Math.max(0, start.right - (ev.clientX - start.x)),
            maxRight,
          ),
          bottom: Math.min(
            Math.max(0, start.bottom - (ev.clientY - start.y)),
            maxBottom,
          ),
        };
        setOffset(next);
        placeJitsiSession();
      };
      const up = () => {
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', up);
        handle.removeEventListener('pointercancel', up);
        setOffset((current) => {
          saveOffset(current);
          return current;
        });
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', up);
      handle.addEventListener('pointercancel', up);
    },
    [offset],
  );

  const toggleAudio = useCallback(() => {
    getJitsiSession()?.api.executeCommand('toggleAudio');
  }, []);
  const toggleVideo = useCallback(() => {
    getJitsiSession()?.api.executeCommand('toggleVideo');
  }, []);
  const handleExpand = useCallback(() => {
    history.push('/huddle');
  }, [history]);
  const handleLeave = useCallback(() => {
    disposeJitsiSession();
    dispatch(huddleLeft());
  }, [dispatch]);

  if (!shown) return null;

  return (
    <div
      ref={windowRef}
      className='huddle-mini'
      style={{ right: offset.right, bottom: offset.bottom }}
      role='region'
      aria-label={intl.formatMessage(messages.title)}
    >
      <div
        className='huddle-mini__bar'
        onPointerDown={handlePointerDown}
        title={intl.formatMessage(messages.drag)}
      >
        <span className='huddle-mini__dot' aria-hidden='true' />
        <span className='huddle-mini__title'>
          {intl.formatMessage(messages.title)}
        </span>
        {count > 0 && (
          <span className='huddle-mini__count'>
            {intl.formatMessage(messages.count, { count })}
          </span>
        )}
      </div>

      {/* The call is drawn over this box (jitsi_session.ts). */}
      <div
        ref={slotRef}
        className='huddle-mini__video'
        data-huddle-slot='floating'
      />

      <div className='huddle-mini__controls'>
        <button
          type='button'
          className={`huddle-mini__button${audioMuted ? ' huddle-mini__button--off' : ''}`}
          onClick={toggleAudio}
          aria-pressed={audioMuted}
          title={intl.formatMessage(
            audioMuted ? messages.unmute : messages.mute,
          )}
          aria-label={intl.formatMessage(
            audioMuted ? messages.unmute : messages.mute,
          )}
        >
          <Icon
            id={audioMuted ? 'mic_off' : 'mic'}
            icon={audioMuted ? MicOffIcon : MicIcon}
          />
        </button>
        <button
          type='button'
          className={`huddle-mini__button${videoMuted ? ' huddle-mini__button--off' : ''}`}
          onClick={toggleVideo}
          aria-pressed={videoMuted}
          title={intl.formatMessage(
            videoMuted ? messages.cameraOn : messages.cameraOff,
          )}
          aria-label={intl.formatMessage(
            videoMuted ? messages.cameraOn : messages.cameraOff,
          )}
        >
          <Icon
            id={videoMuted ? 'videocam_off' : 'videocam'}
            icon={videoMuted ? VideocamOffIcon : VideocamIcon}
          />
        </button>
        <button
          type='button'
          className='huddle-mini__button'
          onClick={handleExpand}
          title={intl.formatMessage(messages.expand)}
          aria-label={intl.formatMessage(messages.expand)}
        >
          <Icon id='open_in_full' icon={OpenInFullIcon} />
        </button>
        <button
          type='button'
          className='huddle-mini__button huddle-mini__button--leave'
          onClick={handleLeave}
          title={intl.formatMessage(messages.leave)}
          aria-label={intl.formatMessage(messages.leave)}
        >
          <Icon id='call_end' icon={CallEndIcon} />
        </button>
      </div>
    </div>
  );
};
