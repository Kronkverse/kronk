import { useCallback } from 'react';

import { Link, useLocation } from 'react-router-dom';

import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import HeadphonesIcon from '@/material-icons/400-24px/headphones.svg?react';
import PauseIcon from '@/material-icons/400-24px/pause-fill.svg?react';
import PlayArrowIcon from '@/material-icons/400-24px/play_arrow-fill.svg?react';

import { useBoothPlayback } from '../booth_playback_context';

export const BoothMiniPlayer: React.FC = () => {
  const { activeSet, playing, currentTime, duration, toggle, clear } =
    useBoothPlayback();
  const location = useLocation();

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      toggle();
    },
    [toggle],
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      clear();
    },
    [clear],
  );

  if (!activeSet) return null;

  // Hide the mini bar while the user is on the booth page — the Booth's own
  // bottom dock owns the visible transport there.
  if (
    location.pathname.startsWith('/hub/booth') ||
    location.pathname.startsWith('/booth')
  )
    return null;

  const progressPct =
    duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div className='booth-mini-player' role='region' aria-label='Booth player'>
      <div
        className='booth-mini-player__progress'
        style={{ width: `${progressPct}%` }}
      />

      <Link to='/hub/booth' className='booth-mini-player__link'>
        <div className='booth-mini-player__artwork'>
          {activeSet.cover_url ? (
            <img
              src={activeSet.cover_url}
              alt=''
              style={{
                objectPosition: `50% ${activeSet.cover_offset_y ?? 50}%`,
              }}
            />
          ) : (
            <HeadphonesIcon />
          )}
        </div>
        <div className='booth-mini-player__meta'>
          <div className='booth-mini-player__title'>{activeSet.title}</div>
          <div className='booth-mini-player__artist'>
            {activeSet.artist_name}
          </div>
        </div>
      </Link>

      <button
        type='button'
        className='booth-mini-player__toggle'
        onClick={handleToggle}
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {playing ? <PauseIcon /> : <PlayArrowIcon />}
      </button>

      <button
        type='button'
        className='booth-mini-player__close'
        onClick={handleClear}
        aria-label='Close player'
      >
        <CloseIcon />
      </button>
    </div>
  );
};
