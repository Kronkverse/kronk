import { useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { useBoothPlayback } from '../booth_playback_context';
import { formatDuration } from '../format';
import { albumTracks } from '../kinds';
import type { BoothAlbumTrack, BoothSet } from '../types';

// An album's or EP's tracks on its page (docs/spaces/booth.md, Albums), in
// running order. Each one plays from its start; the player carries on to
// the next when a track ends. The one playing is highlighted.

const messages = defineMessages({
  heading: { id: 'booth.album.tracks', defaultMessage: 'Tracks' },
  play: { id: 'booth.album.play_track', defaultMessage: 'Play {title}' },
});

const AlbumTrackRow: React.FC<{
  set: BoothSet;
  track: BoothAlbumTrack;
  index: number;
  current: boolean;
}> = ({ set, track, index, current }) => {
  const intl = useIntl();
  const { playTrack } = useBoothPlayback();

  const handleClick = useCallback(() => {
    playTrack(set, index);
  }, [playTrack, set, index]);

  return (
    <li
      className={
        current
          ? 'booth-tracklist__track booth-tracklist__track--current'
          : 'booth-tracklist__track'
      }
      aria-current={current ? 'true' : undefined}
    >
      <span className='booth-tracklist__time'>{index + 1}</span>
      <button
        type='button'
        className='booth-tracklist__name booth-album__play'
        onClick={handleClick}
        disabled={!track.audio_url}
        aria-label={intl.formatMessage(messages.play, { title: track.title })}
      >
        <span className='booth-tracklist__title'>{track.title}</span>
      </button>
      <span className='booth-album__length'>
        {formatDuration(track.duration_seconds)}
      </span>
    </li>
  );
};

export const AlbumTracks: React.FC<{ set: BoothSet }> = ({ set }) => {
  const intl = useIntl();
  const { activeSet, activeTrackIndex } = useBoothPlayback();
  const tracks = albumTracks(set);

  if (tracks.length === 0) return null;

  const current = activeSet?.id === set.id ? activeTrackIndex : -1;

  return (
    <section className='booth-tracklist booth-album'>
      <h2 className='booth-tracklist__heading'>
        {intl.formatMessage(messages.heading)}
      </h2>
      <ol className='booth-tracklist__list'>
        {tracks.map((track, i) => (
          <AlbumTrackRow
            key={track.id}
            set={set}
            track={track}
            index={i}
            current={i === current}
          />
        ))}
      </ol>
    </section>
  );
};
