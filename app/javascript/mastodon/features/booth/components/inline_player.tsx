import { forwardRef, useCallback, useEffect, useImperativeHandle } from 'react';

import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import HeadphonesIcon from '@/material-icons/400-24px/headphones.svg?react';
import PauseIcon from '@/material-icons/400-24px/pause-fill.svg?react';
import PlayArrowIcon from '@/material-icons/400-24px/play_arrow-fill.svg?react';

import { useBoothPlayback } from '../booth_playback_context';
import type { BoothSet } from '../types';

import { Waveform } from './waveform';

export interface InlinePlayerHandle {
  togglePlayPause: () => void;
}

interface Props {
  set: BoothSet;
  hidden: boolean;
  autoPlay: boolean;
  onCollapse: () => void;
  onPlayingChange: (playing: boolean) => void;
}

function formatDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
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

export const InlinePlayer = forwardRef<InlinePlayerHandle, Props>(
  ({ set, hidden, autoPlay, onCollapse, onPlayingChange }, ref) => {
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

    // If our set is the currently active one, prefer the live-audio time and
    // duration. Otherwise fall back to the set's metadata so the UI still
    // displays sensible defaults before playback begins.
    const isActive = activeSet?.id === set.id;
    const displayTime = isActive ? currentTime : 0;
    const displayDuration = isActive
      ? duration
      : (set.duration_seconds ?? 0);
    const displayPlaying = isActive && playing;
    const progressPct = displayDuration > 0 ? displayTime / displayDuration : 0;

    // If this component mounts with autoPlay=true (user clicked Play on the
    // card) and our set isn't already the active one, start playback.
    useEffect(() => {
      if (autoPlay && !isActive) {
        play(set);
      }
      // Only run once per set change to avoid restart loops
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [set.id]);

    useImperativeHandle(
      ref,
      () => ({
        togglePlayPause: () => {
          if (!isActive) {
            play(set);
          } else {
            toggle();
          }
        },
      }),
      [isActive, play, toggle, set],
    );

    const handlePlayPause = useCallback(() => {
      if (!isActive) {
        play(set);
      } else {
        toggle();
      }
    }, [isActive, play, toggle, set]);

    const handleSkipBack = useCallback(() => {
      skip(-30);
    }, [skip]);

    const handleSkipForward = useCallback(() => {
      skip(30);
    }, [skip]);

    const handleSeek = useCallback(
      (pct: number) => {
        seekPct(pct);
      },
      [seekPct],
    );

    // Notify parent when playback state flips so it can style the card overlay
    // without needing to consume the context itself.
    useEffect(() => {
      if (isActive) {
        onPlayingChange(playing);
      }
    }, [isActive, playing, onPlayingChange]);

    if (hidden) return null;

    return (
      <div className='booth-inline-player'>
        <div className='booth-inline-player__artwork'>
          {set.cover_url ? (
            <img
              src={set.cover_url}
              alt=''
              style={{ objectPosition: `50% ${set.cover_offset_y ?? 50}%` }}
            />
          ) : (
            <div className='booth-inline-player__artwork-placeholder'>
              <HeadphonesIcon />
            </div>
          )}
          <button
            className='booth-inline-player__collapse-btn'
            onClick={onCollapse}
            aria-label='Collapse player'
            type='button'
          >
            <CloseIcon />
          </button>
        </div>

        <div className='booth-inline-player__info'>
          <div className='booth-inline-player__title'>{set.title}</div>
          <div className='booth-inline-player__artist'>
            {set.artist_name}
            {set.event_name ? ` · ${set.event_name}` : ''}
            {set.event_date ? ` · ${formatDate(set.event_date)}` : ''}
          </div>
          {set.genres.length > 0 && (
            <div className='booth-inline-player__genres'>
              {set.genres.map((g) => (
                <span key={g} className='booth-inline-player__genre'>
                  {g}
                </span>
              ))}
            </div>
          )}
          {set.description && (
            <p className='booth-inline-player__description'>
              {set.description}
            </p>
          )}
        </div>

        <div className='booth-inline-player__controls'>
          <button
            className='booth-inline-player__skip-btn'
            onClick={handleSkipBack}
            aria-label='Back 30 seconds'
            type='button'
          >
            <svg viewBox='0 0 24 24' aria-hidden='true'>
              <path d='M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z' />
            </svg>
            <span>30</span>
          </button>

          <button
            className='booth-inline-player__play-btn'
            onClick={handlePlayPause}
            aria-label={displayPlaying ? 'Pause' : 'Play'}
            type='button'
          >
            {displayPlaying ? <PauseIcon /> : <PlayArrowIcon />}
          </button>

          <button
            className='booth-inline-player__skip-btn'
            onClick={handleSkipForward}
            aria-label='Forward 30 seconds'
            type='button'
          >
            <svg viewBox='0 0 24 24' aria-hidden='true'>
              <path d='M18 13c0 3.31-2.69 6-6 6s-6-2.69-6-6 2.69-6 6-6v4l5-5-5-5v4c-4.42 0-8 3.58-8 8s3.58 8 8 8 8-3.58 8-8h-2z' />
            </svg>
            <span>30</span>
          </button>
        </div>

        <div className='booth-inline-player__seek-wrap'>
          <Waveform
            setId={set.id}
            progressPct={progressPct}
            onSeek={handleSeek}
          />
          <div className='booth-inline-player__times'>
            <span>{formatTime(displayTime)}</span>
            <span>
              {displayDuration > 0 ? formatTime(displayDuration) : '—'}
            </span>
          </div>
        </div>
      </div>
    );
  },
);

InlinePlayer.displayName = 'InlinePlayer';
