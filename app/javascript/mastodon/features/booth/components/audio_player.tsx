import { useCallback, useEffect, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import PauseIcon from '@/material-icons/400-24px/pause-fill.svg?react';
import PlayArrowIcon from '@/material-icons/400-24px/play_arrow-fill.svg?react';

import { useBoothPlayback } from '../booth_playback_context';
import type { BoothSet } from '../types';

const messages = defineMessages({
  pause: { id: 'booth.player.pause', defaultMessage: 'Pause' },
  play: { id: 'booth.player.play', defaultMessage: 'Play' },
  back: { id: 'booth.player.back_30', defaultMessage: 'Back 30 seconds' },
  seek: { id: 'booth.player.seek', defaultMessage: 'Seek' },
  forward: {
    id: 'booth.player.forward_30',
    defaultMessage: 'Forward 30 seconds',
  },
});

// A shoutout pinned to a moment, drawn on the progress bar.
export interface PlayerMarker {
  id: string;
  at: number;
  label: string;
  avatar: string;
}

interface Props {
  set: BoothSet;
  markers?: PlayerMarker[];
  onMarker?: (marker: PlayerMarker) => void;
}

function formatTime(seconds: number): string {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  return `${m}:${String(sec).padStart(2, '0')}`;
}

const MarkerPin: React.FC<{
  marker: PlayerMarker;
  left: number;
  onSelect?: (marker: PlayerMarker) => void;
}> = ({ marker, left, onSelect }) => {
  const handleClick = useCallback(() => {
    onSelect?.(marker);
  }, [onSelect, marker]);
  return (
    <button
      type='button'
      className='booth-player__marker'
      style={{ left: `${left}%` }}
      title={marker.label}
      aria-label={marker.label}
      onClick={handleClick}
    >
      <img src={marker.avatar} alt='' />
    </button>
  );
};

export const AudioPlayer: React.FC<Props> = ({ set, markers, onMarker }) => {
  const intl = useIntl();
  const {
    activeSet,
    playing,
    currentTime,
    duration,
    play,
    toggle,
    seekPct,
    skip,
  } = useBoothPlayback();

  const progressRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const isActive = activeSet?.id === set.id;
  const displayTime = isActive ? currentTime : 0;
  const displayDuration = isActive ? duration : (set.duration_seconds ?? 0);
  const displayPlaying = isActive && playing;
  const progressPct =
    displayDuration > 0 ? (displayTime / displayDuration) * 100 : 0;

  const getProgressPct = useCallback((clientX: number) => {
    const bar = progressRef.current;
    if (!bar) return 0;
    const rect = bar.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }, []);

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isActive) seekPct(getProgressPct(e.clientX));
    },
    [isActive, seekPct, getProgressPct],
  );

  const handleProgressMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isActive) return;
      setDragging(true);
      seekPct(getProgressPct(e.clientX));
    },
    [isActive, seekPct, getProgressPct],
  );

  useEffect(() => {
    if (!dragging) return undefined;
    const handleMouseMove = (e: MouseEvent) => {
      seekPct(getProgressPct(e.clientX));
    };
    const handleMouseUp = () => {
      setDragging(false);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, seekPct, getProgressPct]);

  const handlePlayPause = useCallback(() => {
    if (!isActive) {
      play(set);
    } else {
      toggle();
    }
  }, [isActive, play, toggle, set]);

  const handleSkipBack = useCallback(() => {
    if (isActive) skip(-30);
  }, [isActive, skip]);

  const handleSkipForward = useCallback(() => {
    if (isActive) skip(30);
  }, [isActive, skip]);

  const handleProgressKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!isActive) return;
      if (e.key === 'ArrowLeft') skip(-10);
      if (e.key === 'ArrowRight') skip(10);
    },
    [isActive, skip],
  );

  return (
    <div className='booth-player'>
      <div className='booth-player__row'>
        <button
          className='booth-player__play-btn'
          onClick={handlePlayPause}
          aria-label={intl.formatMessage(
            displayPlaying ? messages.pause : messages.play,
          )}
          type='button'
        >
          {displayPlaying ? <PauseIcon /> : <PlayArrowIcon />}
        </button>

        <button
          className='booth-player__skip-btn'
          onClick={handleSkipBack}
          aria-label={intl.formatMessage(messages.back)}
          type='button'
        >
          <svg viewBox='0 0 24 24' aria-hidden='true'>
            <path d='M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z' />
          </svg>
          <span>30</span>
        </button>

        <div className='booth-player__progress-wrap'>
          <div
            ref={progressRef}
            className='booth-player__progress'
            onMouseDown={handleProgressMouseDown}
            onClick={handleProgressClick}
            onKeyDown={handleProgressKeyDown}
            role='slider'
            aria-label={intl.formatMessage(messages.seek)}
            aria-valuenow={Math.round(displayTime)}
            aria-valuemin={0}
            aria-valuemax={Math.round(displayDuration)}
            tabIndex={0}
          >
            <div
              className='booth-player__progress-fill'
              style={{ width: `${progressPct}%` }}
            />
            <div
              className='booth-player__progress-thumb'
              style={{ left: `${progressPct}%` }}
            />
          </div>
          {markers && displayDuration > 0 && (
            <div className='booth-player__markers'>
              {markers
                .filter((m) => m.at <= displayDuration)
                .map((m) => (
                  <MarkerPin
                    key={m.id}
                    marker={m}
                    left={(m.at / displayDuration) * 100}
                    onSelect={onMarker}
                  />
                ))}
            </div>
          )}
          <div className='booth-player__times'>
            <span>{formatTime(displayTime)}</span>
            <span>
              {displayDuration > 0 ? formatTime(displayDuration) : '—'}
            </span>
          </div>
        </div>

        <button
          className='booth-player__skip-btn'
          onClick={handleSkipForward}
          aria-label={intl.formatMessage(messages.forward)}
          type='button'
        >
          <svg viewBox='0 0 24 24' aria-hidden='true'>
            <path d='M18 13c0 3.31-2.69 6-6 6s-6-2.69-6-6 2.69-6 6-6v4l5-5-5-5v4c-4.42 0-8 3.58-8 8s3.58 8 8 8 8-3.58 8-8h-2z' />
          </svg>
          <span>30</span>
        </button>
      </div>
    </div>
  );
};
