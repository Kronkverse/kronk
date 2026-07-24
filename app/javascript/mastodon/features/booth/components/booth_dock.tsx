import { useCallback } from 'react';

import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import PauseIcon from '@/material-icons/400-24px/pause-fill.svg?react';
import PlayArrowIcon from '@/material-icons/400-24px/play_arrow-fill.svg?react';

import { useBoothPlayback } from '../booth_playback_context';

import { Waveform } from './waveform';

// BoothDock — the fixed bottom transport for the Booth page, built on the
// shared playback context (survives lens switches). Art, title/artist, a
// back-15/play/forward-15 transport, a seekable waveform scrubber with
// elapsed/total, and a close. There is no queue yet, so the side buttons
// seek ±15s rather than change track.

const initial = (s: string): string => (s.trim().charAt(0) || 'B').toUpperCase();

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
}

export const BoothDock: React.FC = () => {
  const { activeSet, playing, currentTime, duration, toggle, seekPct, skip, clear } =
    useBoothPlayback();

  const handleBack = useCallback(() => {
    skip(-15);
  }, [skip]);
  const handleForward = useCallback(() => {
    skip(15);
  }, [skip]);

  if (!activeSet) return null;

  const progressPct = duration > 0 ? Math.min(1, currentTime / duration) : 0;
  const total = duration > 0 ? duration : (activeSet.duration_seconds ?? 0);

  return (
    <div className='booth-dock' role='region' aria-label='Booth player'>
      <div className='booth-dock__inner'>
        <div className='booth-dock__art'>
          {activeSet.cover_url ? (
            <img
              src={activeSet.cover_url}
              alt=''
              style={{
                objectPosition: `50% ${activeSet.cover_offset_y ?? 50}%`,
              }}
            />
          ) : (
            initial(activeSet.title)
          )}
        </div>

        <div className='booth-dock__meta'>
          <b>{activeSet.title}</b>
          <span>
            {activeSet.artist_name}
            {activeSet.event_name ? ` · ${activeSet.event_name}` : ''}
          </span>
        </div>

        <div className='booth-dock__transport'>
          <button
            type='button'
            className='booth-dock__tbtn'
            onClick={handleBack}
            aria-label='Back 15 seconds'
          >
            <svg viewBox='0 0 24 24' aria-hidden='true'>
              <path d='M6 6h2v12H6zm3 6l9-6v12z' />
            </svg>
          </button>
          <button
            type='button'
            className='booth-dock__tbtn booth-dock__tbtn--main'
            onClick={toggle}
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? <PauseIcon /> : <PlayArrowIcon />}
          </button>
          <button
            type='button'
            className='booth-dock__tbtn'
            onClick={handleForward}
            aria-label='Forward 15 seconds'
          >
            <svg viewBox='0 0 24 24' aria-hidden='true'>
              <path d='M16 6h2v12h-2zm-1 6L6 18V6z' />
            </svg>
          </button>
        </div>

        <div className='booth-dock__scrub'>
          <span className='booth-dock__time'>{formatTime(currentTime)}</span>
          <Waveform
            setId={activeSet.id}
            progressPct={progressPct}
            onSeek={seekPct}
          />
          <span className='booth-dock__time'>{formatTime(total)}</span>
        </div>

        <button
          type='button'
          className='booth-dock__close'
          onClick={clear}
          aria-label='Close player'
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  );
};
