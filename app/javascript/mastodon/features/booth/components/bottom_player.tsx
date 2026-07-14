import { useRef, useState, useCallback, useEffect } from 'react';

import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import HeadphonesIcon from '@/material-icons/400-24px/headphones.svg?react';
import PauseIcon from '@/material-icons/400-24px/pause-fill.svg?react';
import PlayArrowIcon from '@/material-icons/400-24px/play_arrow-fill.svg?react';
import api from 'mastodon/api';

import type { BoothSet } from '../types';

interface Props {
  set: BoothSet;
  onClose: () => void;
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

export const BottomPlayer: React.FC<Props> = ({ set, onClose }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(set.duration_seconds ?? 0);
  const [dragging, setDragging] = useState(false);
  const playCountedRef = useRef(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    void audio.play();
    if (!playCountedRef.current) {
      playCountedRef.current = true;
      void api().post(`/api/v1/booth_sets/${set.id}/play`);
    }
  }, [set.id]);

  const getProgressPct = useCallback((clientX: number) => {
    const bar = progressRef.current;
    if (!bar) return 0;
    const rect = bar.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }, []);

  const seekTo = useCallback((pct: number) => {
    const audio = audioRef.current;
    if (!audio?.duration) return;
    audio.currentTime = pct * audio.duration;
  }, []);

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      seekTo(getProgressPct(e.clientX));
    },
    [seekTo, getProgressPct],
  );

  const handleProgressMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      setDragging(true);
      seekTo(getProgressPct(e.clientX));
    },
    [seekTo, getProgressPct],
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging) return;
      seekTo(getProgressPct(e.clientX));
    };
    const handleMouseUp = () => { setDragging(false); };
    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, seekTo, getProgressPct]);

  const handlePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play();
    } else {
      audio.pause();
    }
  }, []);

  const handleSkip = useCallback((delta: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(
      0,
      Math.min(audio.duration || 0, audio.currentTime + delta),
    );
  }, []);

  const handleSkipBack = useCallback(() => { handleSkip(-30); }, [handleSkip]);
  const handleSkipForward = useCallback(() => { handleSkip(30); }, [handleSkip]);
  const handleProgressKeyDown = useCallback<React.KeyboardEventHandler<HTMLDivElement>>(
    (e) => {
      if (e.key === 'ArrowLeft') handleSkip(-10);
      if (e.key === 'ArrowRight') handleSkip(10);
    },
    [handleSkip],
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTimeUpdate = () => { setCurrentTime(audio.currentTime); };
    const onDurationChange = () => { setDuration(audio.duration); };
    const onPlay = () => { setPlaying(true); };
    const onPause = () => { setPlaying(false); };
    const onEnded = () => { setPlaying(false); };
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

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className='booth-bottom-player'>
      <audio ref={audioRef} src={set.audio_url ?? ''} preload='metadata' />

      <div className='booth-bottom-player__info'>
        <div className='booth-bottom-player__cover'>
          {set.cover_url ? (
            <img src={set.cover_url} alt='' />
          ) : (
            <div className='booth-bottom-player__cover-placeholder'>
              <HeadphonesIcon />
            </div>
          )}
        </div>
        <div className='booth-bottom-player__meta'>
          <div className='booth-bottom-player__title'>{set.title}</div>
          <div className='booth-bottom-player__artist'>
            {set.artist_name}
            {set.event_name ? ` · ${set.event_name}` : ''}
          </div>
          {set.description ? (
            <div className='booth-bottom-player__description'>
              {set.description}
            </div>
          ) : null}
        </div>
      </div>

      <div className='booth-bottom-player__controls-wrap'>
        <div className='booth-bottom-player__controls'>
          <button
            className='booth-bottom-player__skip-btn'
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
            className='booth-bottom-player__play-btn'
            onClick={handlePlayPause}
            aria-label={playing ? 'Pause' : 'Play'}
            type='button'
          >
            {playing ? <PauseIcon /> : <PlayArrowIcon />}
          </button>

          <button
            className='booth-bottom-player__skip-btn'
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

        <div className='booth-bottom-player__progress-wrap'>
          <div
            ref={progressRef}
            className='booth-bottom-player__progress'
            onMouseDown={handleProgressMouseDown}
            onClick={handleProgressClick}
            role='slider'
            aria-label='Seek'
            aria-valuenow={Math.round(currentTime)}
            aria-valuemin={0}
            aria-valuemax={Math.round(duration)}
            tabIndex={0}
            onKeyDown={handleProgressKeyDown}
          >
            <div
              className='booth-bottom-player__progress-fill'
              style={{ width: `${progressPct}%` }}
            />
            <div
              className='booth-bottom-player__progress-thumb'
              style={{ left: `${progressPct}%` }}
            />
          </div>
          <div className='booth-bottom-player__times'>
            <span>{formatTime(currentTime)}</span>
            <span>{duration > 0 ? formatTime(duration) : '—'}</span>
          </div>
        </div>
      </div>

      <button
        className='booth-bottom-player__close-btn'
        onClick={onClose}
        aria-label='Close player'
        type='button'
      >
        <CloseIcon />
      </button>
    </div>
  );
};
