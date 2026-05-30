import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import HeadphonesIcon from '@/material-icons/400-24px/headphones.svg?react';
import PauseIcon from '@/material-icons/400-24px/pause-fill.svg?react';
import PlayArrowIcon from '@/material-icons/400-24px/play_arrow-fill.svg?react';
import api from 'mastodon/api';

import type { BoothSet } from '../types';
import { Waveform } from './waveform';

export interface InlinePlayerHandle {
  togglePlayPause: () => void;
}

interface Props {
  set: BoothSet;
  hidden: boolean;
  onCollapse: () => void;
  onPlayingChange: (playing: boolean) => void;
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
  ({ set, hidden, onCollapse, onPlayingChange }, ref) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [playing, setPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(set.duration_seconds ?? 0);
    const playCountedRef = useRef(false);
    const onPlayingChangeRef = useRef(onPlayingChange);
    onPlayingChangeRef.current = onPlayingChange;

    useEffect(() => {
      const audio = audioRef.current;
      if (!audio) return;
      void audio.play().catch(() => undefined);
      if (!playCountedRef.current) {
        playCountedRef.current = true;
        void api().post(`/api/v1/booth_sets/${set.id}/play`);
      }
    }, [set.id]);

    useEffect(() => {
      const audio = audioRef.current;
      if (!audio) return;
      const onTimeUpdate = () => setCurrentTime(audio.currentTime);
      const onDurationChange = () => setDuration(audio.duration);
      const onPlay = () => {
        setPlaying(true);
        onPlayingChangeRef.current(true);
      };
      const onPause = () => {
        setPlaying(false);
        onPlayingChangeRef.current(false);
      };
      const onEnded = () => {
        setPlaying(false);
        onPlayingChangeRef.current(false);
      };
      audio.addEventListener('timeupdate', onTimeUpdate);
      audio.addEventListener('durationchange', onDurationChange);
      audio.addEventListener('loadedmetadata', onDurationChange);
      audio.addEventListener('play', onPlay);
      audio.addEventListener('pause', onPause);
      audio.addEventListener('ended', onEnded);
      return () => {
        audio.removeEventListener('timeupdate', onTimeUpdate);
        audio.removeEventListener('durationchange', onDurationChange);
        audio.removeEventListener('loadedmetadata', onDurationChange);
        audio.removeEventListener('play', onPlay);
        audio.removeEventListener('pause', onPause);
        audio.removeEventListener('ended', onEnded);
      };
    }, []);

    const handlePlayPause = useCallback(() => {
      const audio = audioRef.current;
      if (!audio) return;
      if (audio.paused) {
        void audio.play();
      } else {
        audio.pause();
      }
    }, []);

    useImperativeHandle(ref, () => ({ togglePlayPause: handlePlayPause }), [
      handlePlayPause,
    ]);

    const handleSkip = useCallback((delta: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      audio.currentTime = Math.max(
        0,
        Math.min(audio.duration || 0, audio.currentTime + delta),
      );
    }, []);

    const handleSeek = useCallback((pct: number) => {
      const audio = audioRef.current;
      if (!audio || !audio.duration) return;
      audio.currentTime = pct * audio.duration;
    }, []);

    const progressPct = duration > 0 ? currentTime / duration : 0;

    return (
      <>
        {/* Always mounted so audio survives collapse */}
        <audio ref={audioRef} src={set.audio_url ?? ''} preload='metadata' />

        {!hidden && (
          <div className='booth-inline-player'>
            <div className='booth-inline-player__artwork'>
              {set.cover_url ? (
                <img src={set.cover_url} alt='' />
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
              </div>
              {set.genres.length > 0 && (
                <div className='booth-inline-player__genres'>
                  {set.genres.map((g) => (
                    <span key={g} className='booth-inline-player__genre'>{g}</span>
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
                onClick={() => handleSkip(-30)}
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
                aria-label={playing ? 'Pause' : 'Play'}
                type='button'
              >
                {playing ? <PauseIcon /> : <PlayArrowIcon />}
              </button>

              <button
                className='booth-inline-player__skip-btn'
                onClick={() => handleSkip(30)}
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
                <span>{formatTime(currentTime)}</span>
                <span>{duration > 0 ? formatTime(duration) : '—'}</span>
              </div>
            </div>
          </div>
        )}
      </>
    );
  },
);

InlinePlayer.displayName = 'InlinePlayer';
