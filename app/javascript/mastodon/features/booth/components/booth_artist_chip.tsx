import { useCallback } from 'react';

// BoothArtistChip — a roster tile in the Booth Artists lens. Shows the
// artist's face (or initial, for someone who is not on Kronk), name, and
// how many sets they're on. No plays: those are for the artist, not a
// ranking. Clicking opens the artist detail view.

export interface BoothArtist {
  // What the artist's page is addressed by: `@acct` for a Kronk account,
  // the name itself for someone who is not on Kronk.
  key: string;
  name: string;
  // Kronk accounts only.
  acct?: string;
  avatar?: string;
  setCount: number;
}

export const artistInitial = (s: string): string =>
  (s.trim().charAt(0) || 'B').toUpperCase();

// Shared "N sets" label — used by both the roster chip and the
// artist-detail hero.
export const artistStatLabel = (artist: BoothArtist): string =>
  `${artist.setCount} ${artist.setCount === 1 ? 'set' : 'sets'}`;

interface Props {
  artist: BoothArtist;
  onOpen: (key: string) => void;
}

export const BoothArtistChip: React.FC<Props> = ({ artist, onOpen }) => {
  const handleClick = useCallback(() => {
    onOpen(artist.key);
  }, [onOpen, artist.key]);

  return (
    <button
      type='button'
      className='booth-artist-chip'
      onClick={handleClick}
      aria-label={artist.name}
    >
      <span className='booth-artist-chip__avatar' aria-hidden='true'>
        {artist.avatar ? (
          <img src={artist.avatar} alt='' />
        ) : (
          artistInitial(artist.name)
        )}
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
