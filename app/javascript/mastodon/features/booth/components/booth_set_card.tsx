import { useCallback } from 'react';

import HeadphonesIcon from '@/material-icons/400-24px/headphones.svg?react';
import type { BoothSet } from '../types';

interface Props {
  set: BoothSet;
  onSelect: (set: BoothSet) => void;
  active: boolean;
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export const BoothSetCard: React.FC<Props> = ({ set, onSelect, active }) => {
  const handleClick = useCallback(() => {
    onSelect(set);
  }, [set, onSelect]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelect(set);
      }
    },
    [set, onSelect],
  );

  return (
    <div
      className={`booth-card${active ? ' booth-card--active' : ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role='button'
      tabIndex={0}
      aria-pressed={active}
    >
      <div className='booth-card__cover'>
        {set.cover_url ? (
          <img src={set.cover_url} alt='' />
        ) : (
          <div className='booth-card__cover-placeholder'>
            <HeadphonesIcon />
          </div>
        )}
      </div>

      <div className='booth-card__body'>
        <div className='booth-card__title'>{set.title}</div>
        <div className='booth-card__artist'>{set.artist_name}</div>
        {set.event_name && (
          <div className='booth-card__event'>{set.event_name}</div>
        )}
        <div className='booth-card__meta'>
          {set.genre && <span className='booth-card__genre'>{set.genre}</span>}
          {set.duration_seconds != null && (
            <span className='booth-card__duration'>
              {formatDuration(set.duration_seconds)}
            </span>
          )}
          <span className='booth-card__plays'>
            {set.play_count.toLocaleString()} plays
          </span>
        </div>
      </div>
    </div>
  );
};
