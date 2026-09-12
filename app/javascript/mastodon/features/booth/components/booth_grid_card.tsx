import { useCallback, useEffect, useRef, useState } from 'react';

import MoreHorizIcon from '@/material-icons/400-24px/more_horiz.svg?react';
import PauseIcon from '@/material-icons/400-24px/pause-fill.svg?react';
import PlayArrowIcon from '@/material-icons/400-24px/play_arrow-fill.svg?react';
import api from 'mastodon/api';
import {
  StandardCard,
  CardMedia,
  CardTitle,
  CardMeta,
} from 'mastodon/components/standard_card';

import { useBoothPlayback } from '../booth_playback_context';
import type { BoothSet } from '../types';

// BoothGridCard — the Musik-lens gallery tile. Cover with a waveform
// strip + duration + hover play, then title/artist/genre/plays. Clicking
// the body opens the set's detail page; the play button drives the shared
// dock. Owner/moderator actions live behind a compact "…" menu so the
// edit/share/delete flows stay reachable from the grid.
//
// Sits on <StandardCard variant='flow'> as of 2026-09-12 (the card standard,
// docs/kronk_card_standard.md). The tile used to be a <button> wrapping the
// whole cover and body, which is why its title and artist were <span>s — a
// heading is not allowed inside a button. The card itself is the tap target
// now (role=link + Enter/Space, the same pattern the ten feed cards use), so
// the parts can be the standard's slots and the title can be a heading.
// The play control and the owner menu sit over the media and stop
// propagation, as they already did.
//
// Flow rather than grid, even though this is a gallery tile: a Booth tile
// frames its cover rather than the card, its cover is 16:10 rather than
// square, and it shows more than a grid tile draws (artist, genre, event,
// plays). Making it match the other tiles is a design decision, not a
// migration — so the slots land here and the look is untouched.

const initial = (s: string): string =>
  (s.trim().charAt(0) || 'B').toUpperCase();

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
}

// Deterministic cover-strip bars from the set id (decorative; the dock
// carries the real seekable waveform).
function coverBars(seed: string, n: number): number[] {
  let state =
    seed
      .split('')
      .reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) | 0, 0x9e3779b9) >>> 0;
  return Array.from({ length: n }, () => {
    state = ((state * 1664525 + 1013904223) | 0) >>> 0;
    return 0.2 + (state / 0xffffffff) * 0.8;
  });
}

interface Props {
  set: BoothSet;
  onOpen: (set: BoothSet) => void;
  onEdit: (set: BoothSet) => void;
  onDelete: (id: string) => void;
  onShare: (set: BoothSet) => void;
}

export const BoothGridCard: React.FC<Props> = ({
  set,
  onOpen,
  onEdit,
  onDelete,
  onShare,
}) => {
  const { play, toggle, activeSet, playing } = useBoothPlayback();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isActive = activeSet?.id === set.id;
  const isPlaying = isActive && playing;
  const canManage = set.is_owner === true || set.can_moderate === true;
  const duration = formatDuration(set.duration_seconds);
  const bars = coverBars(set.id, 40);

  const handleOpen = useCallback(() => {
    onOpen(set);
  }, [onOpen, set]);

  const handlePlay = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isActive) {
        toggle();
      } else {
        play(set);
      }
    },
    [isActive, toggle, play, set],
  );

  const handleMenuToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen((v) => !v);
    setConfirmingDelete(false);
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setConfirmingDelete(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
    };
  }, [menuOpen]);

  const handleEdit = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setMenuOpen(false);
      onEdit(set);
    },
    [onEdit, set],
  );

  const handleShare = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setMenuOpen(false);
      onShare(set);
    },
    [onShare, set],
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!confirmingDelete) {
        setConfirmingDelete(true);
        return;
      }
      void api()
        .delete(`/api/v1/booth_sets/${set.id}`)
        .then(() => {
          setMenuOpen(false);
          onDelete(set.id);
        })
        .catch(() => {
          setConfirmingDelete(false);
        });
    },
    [confirmingDelete, onDelete, set.id],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onOpen(set);
      }
    },
    [onOpen, set],
  );

  return (
    <StandardCard
      as='div'
      variant='flow'
      className={`booth-card${isActive ? ' booth-card--active' : ''}`}
      role='link'
      tabIndex={0}
      onClick={handleOpen}
      onKeyDown={handleKeyDown}
      aria-label={`Open ${set.title} by ${set.artist_name}`}
    >
      <CardMedia className='booth-card__cover'>
        {set.cover_url ? (
          <img
            className='booth-card__art'
            src={set.cover_url}
            alt=''
            style={{ objectPosition: `50% ${set.cover_offset_y ?? 50}%` }}
          />
        ) : (
          <span className='booth-card__mark' aria-hidden='true'>
            {initial(set.title)}
          </span>
        )}
        <span className='booth-card__scrim' aria-hidden='true' />
        <span className='booth-card__wave' aria-hidden='true'>
          {bars.map((b, i) => (
            <span
              key={i}
              className='booth-card__wave-bar'
              style={{ height: `${Math.round(b * 100)}%` }}
            />
          ))}
        </span>
        {duration && <span className='booth-card__dur'>{duration}</span>}
      </CardMedia>

      <CardTitle className='booth-card__title'>{set.title}</CardTitle>

      <CardMeta className='booth-card__meta'>
        <span className='booth-card__artist'>{set.artist_name}</span>
        {set.genres[0] && (
          <span className='booth-card__tag'>{set.genres[0]}</span>
        )}
        {set.event_name && (
          <span className='booth-card__tag booth-card__tag--night'>
            {set.event_name}
          </span>
        )}
        <span className='booth-card__plays'>{set.play_count} plays</span>
      </CardMeta>

      <button
        type='button'
        className='booth-card__play'
        onClick={handlePlay}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
      </button>

      {canManage && (
        <div className='booth-card__menu' ref={menuRef}>
          <button
            type='button'
            className='booth-card__menu-trigger'
            onClick={handleMenuToggle}
            aria-label='Set options'
            aria-expanded={menuOpen}
          >
            <MoreHorizIcon />
          </button>
          {menuOpen && (
            <div className='booth-card__menu-list' role='menu'>
              <button
                type='button'
                className='booth-card__menu-item'
                onClick={handleShare}
                role='menuitem'
              >
                Share to feed
              </button>
              <button
                type='button'
                className='booth-card__menu-item'
                onClick={handleEdit}
                role='menuitem'
              >
                Edit
              </button>
              <button
                type='button'
                className='booth-card__menu-item booth-card__menu-item--danger'
                onClick={handleDelete}
                role='menuitem'
              >
                {confirmingDelete ? 'Confirm delete' : 'Delete'}
              </button>
            </div>
          )}
        </div>
      )}
    </StandardCard>
  );
};
