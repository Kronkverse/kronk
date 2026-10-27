import { useCallback, useEffect, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { useHistory } from 'react-router-dom';

import OpenInFullIcon from '@/material-icons/400-24px/open_in_full.svg?react';
import { huddleLeft } from 'mastodon/actions/huddle';
import { CallControls } from 'mastodon/components/call_controls';
import { IconButton } from 'mastodon/components/icon_button';
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
  expand: { id: 'huddle.mini.expand', defaultMessage: 'Back to the Huddle' },
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
// bar; under the video are Kronk's call controls (components/
// call_controls.tsx), with a way back to the Huddle.
export const HuddlePip: React.FC = () => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const history = useHistory();

  const active = useAppSelector((state) => state.huddle.active);
  const minimized = useAppSelector((state) => state.huddle.minimized);
  const startCount = useAppSelector((state) => state.huddle.participantCount);

  const [offset, setOffset] = useState<Offset>(readOffset);
  const [count, setCount] = useState(startCount);
  const windowRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const call = getJitsiSession()?.call ?? null;
  const shown = active && minimized && call !== null;

  // Put the call over this window's video area while it's shown.
  useEffect(() => {
    if (!shown) return undefined;
    const el = slotRef.current;
    setJitsiSlot(el);
    return () => {
      setJitsiSlot(null, el ?? undefined);
    };
  }, [shown]);

  // Who's in, as the call reports it. What's on (mic, camera, hand,
  // recording) is the call's own state, which the controls read.
  useEffect(() => {
    const api = shown ? getJitsiSession()?.call.api : undefined;
    if (!api) return undefined;
    setCount(api.getNumberOfParticipants());
    const poll = window.setInterval(() => {
      setCount(api.getNumberOfParticipants());
    }, 5000);
    return () => {
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

      <CallControls call={call} onLeave={handleLeave} compact>
        <IconButton
          className='call-controls__button'
          title={intl.formatMessage(messages.expand)}
          icon='open_in_full'
          iconComponent={OpenInFullIcon}
          onClick={handleExpand}
        />
      </CallControls>
    </div>
  );
};
