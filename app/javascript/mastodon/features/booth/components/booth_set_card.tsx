import { useCallback, useRef, useState } from 'react';

import HeadphonesIcon from '@/material-icons/400-24px/headphones.svg?react';
import MoreHorizIcon from '@/material-icons/400-24px/more_horiz.svg?react';
import PauseIcon from '@/material-icons/400-24px/pause-fill.svg?react';
import PlayArrowIcon from '@/material-icons/400-24px/play_arrow-fill.svg?react';
import api from 'mastodon/api';
import type { BoothSet } from '../types';

interface Props {
  set: BoothSet;
  onPlay: (set: BoothSet) => void;
  onTogglePlay: () => void;
  onEdit: (set: BoothSet) => void;
  onDelete: (id: string) => void;
  active: boolean;
  playing: boolean;
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export const BoothSetCard: React.FC<Props> = ({
  set,
  onPlay,
  onTogglePlay,
  onEdit,
  onDelete,
  active,
  playing,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleCardClick = useCallback(() => {
    onPlay(set);
  }, [set, onPlay]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (active) {
        onTogglePlay();
      } else {
        onPlay(set);
      }
    },
    [active, set, onPlay, onTogglePlay],
  );

  const handleMenuToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen((prev) => !prev);
  }, []);

  const handleMenuBlur = useCallback((e: React.FocusEvent) => {
    if (!menuRef.current?.contains(e.relatedTarget as Node)) {
      setMenuOpen(false);
    }
  }, []);

  const handleEdit = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setMenuOpen(false);
      onEdit(set);
    },
    [set, onEdit],
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setMenuOpen(false);
      setDeleting(true);
      void api()
        .delete(`/api/v1/booth_sets/${set.id}`)
        .then(() => onDelete(set.id))
        .catch(() => setDeleting(false));
    },
    [set.id, onDelete],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onPlay(set);
      }
    },
    [set, onPlay],
  );

  const coverPosition = `50% ${set.cover_offset_y ?? 50}%`;

  return (
    <div
      className={`booth-card${active ? ' booth-card--active' : ''}${deleting ? ' booth-card--deleting' : ''}`}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      role='button'
      tabIndex={0}
      aria-pressed={active}
    >
      <div className='booth-card__cover'>
        {set.cover_url ? (
          <img src={set.cover_url} alt='' style={{ objectPosition: coverPosition }} />
        ) : (
          <div className='booth-card__cover-placeholder'>
            <HeadphonesIcon />
          </div>
        )}

        <button
          className={`booth-card__play-overlay${active && playing ? ' booth-card__play-overlay--visible' : ''}`}
          onClick={handleOverlayClick}
          aria-label={active && playing ? 'Pause' : `Play ${set.title}`}
          type='button'
        >
          {active && playing ? <PauseIcon /> : <PlayArrowIcon />}
        </button>

        {set.is_owner && (
          <div
            ref={menuRef}
            className='booth-card__menu-wrap'
            onBlur={handleMenuBlur}
          >
            <button
              className='booth-card__menu-btn'
              onClick={handleMenuToggle}
              aria-label='Set options'
              aria-expanded={menuOpen}
              type='button'
              tabIndex={0}
            >
              <MoreHorizIcon />
            </button>
            {menuOpen && (
              <div className='booth-card__menu'>
                <button
                  className='booth-card__menu-item'
                  onMouseDown={handleEdit}
                  type='button'
                >
                  Edit
                </button>
                <button
                  className='booth-card__menu-item booth-card__menu-item--danger'
                  onMouseDown={handleDelete}
                  type='button'
                >
                  Delete
                </button>
              </div>
            )}
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
          {set.genres.map((g) => (
            <span key={g} className='booth-card__genre'>{g}</span>
          ))}
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
