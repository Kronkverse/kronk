import { useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { useBoothPlayback } from '../booth_playback_context';
import type { BoothSet, BoothTrack } from '../types';

const messages = defineMessages({
  heading: { id: 'booth.tracklist.heading', defaultMessage: 'Track list' },
  playFrom: {
    id: 'booth.tracklist.play_from',
    defaultMessage: 'Play from {time}',
  },
});

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

// The track that owns `time`: the last entry whose start is at or before
// it. Untimed entries never become current, since there's no way to know
// where they fall.
function currentTrackIndex(tracks: BoothTrack[], time: number): number {
  let index = -1;
  tracks.forEach((track, i) => {
    if (track.start_seconds !== null && track.start_seconds <= time) index = i;
  });
  return index;
}

const TrackTime: React.FC<{
  set: BoothSet;
  seconds: number;
}> = ({ set, seconds }) => {
  const intl = useIntl();
  const { playFrom } = useBoothPlayback();
  const label = formatTime(seconds);

  const handleClick = useCallback(() => {
    playFrom(set, seconds);
  }, [playFrom, set, seconds]);

  if (!set.audio_url) {
    return <span className='booth-tracklist__time'>{label}</span>;
  }

  return (
    <button
      type='button'
      className='booth-tracklist__time booth-tracklist__time--seek'
      onClick={handleClick}
      title={intl.formatMessage(messages.playFrom, { time: label })}
      aria-label={intl.formatMessage(messages.playFrom, { time: label })}
    >
      {label}
    </button>
  );
};

export const Tracklist: React.FC<{ set: BoothSet }> = ({ set }) => {
  const intl = useIntl();
  const { activeSet, currentTime } = useBoothPlayback();
  const tracks = set.tracklist ?? [];

  if (tracks.length === 0) return null;

  const current =
    activeSet?.id === set.id ? currentTrackIndex(tracks, currentTime) : -1;

  return (
    <section className='booth-tracklist'>
      <h2 className='booth-tracklist__heading'>
        {intl.formatMessage(messages.heading)}
      </h2>
      <ol className='booth-tracklist__list'>
        {tracks.map((track, i) => (
          <li
            key={i}
            className={
              i === current
                ? 'booth-tracklist__track booth-tracklist__track--current'
                : 'booth-tracklist__track'
            }
            aria-current={i === current ? 'true' : undefined}
          >
            {track.start_seconds !== null && (
              <TrackTime set={set} seconds={track.start_seconds} />
            )}
            <span className='booth-tracklist__name'>
              {track.artist && (
                <span className='booth-tracklist__artist'>{track.artist}</span>
              )}
              <span className='booth-tracklist__title'>{track.title}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
};
