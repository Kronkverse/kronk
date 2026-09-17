import { useCallback } from 'react';

// BoothArtistChip — a roster tile in the Booth Artists lens. Shows the
// artist's initial, name, and a derived "N sets · P plays" stat (both
// computed client-side from the loaded sets — no dedicated backend).
// Clicking opens the artist detail view.

export interface BoothArtist {
  name: string;
  setCount: number;
  totalPlays: number;
}

export const artistInitial = (s: string): string =>
  (s.trim().charAt(0) || 'B').toUpperCase();

// Shared "N sets · P plays" label — used by both the roster chip and the
// artist-detail hero. Plain strings match the Booth card's convention
// (e.g. `{play_count} plays`).
export const artistStatLabel = (artist: BoothArtist): string =>
  `${artist.setCount} ${artist.setCount === 1 ? 'set' : 'sets'} · ` +
  `${artist.totalPlays.toLocaleString()} plays`;

interface Props {
  artist: BoothArtist;
  onOpen: (name: string) => void;
}

export const BoothArtistChip: React.FC<Props> = ({ artist, onOpen }) => {
  const handleClick = useCallback(() => {
    onOpen(artist.name);
  }, [onOpen, artist.name]);

  return (
    <button
      type='button'
      className='booth-artist-chip'
      onClick={handleClick}
      aria-label={artist.name}
    >
      <span className='booth-artist-chip__avatar' aria-hidden='true'>
        {artistInitial(artist.name)}
      </span>
      <span className='booth-artist-chip__body'>
        <span className='booth-artist-chip__name'>{artist.name}</span>
        <span className='booth-artist-chip__stat'>
          {artistStatLabel(artist)}
        </span>
      </span>
    </button>
  );
};
