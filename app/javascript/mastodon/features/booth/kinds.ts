import { defineMessages } from 'react-intl';
import type { IntlShape, MessageDescriptor } from 'react-intl';

import type { BoothAlbumTrack, BoothKind, BoothSet } from './types';

// The kinds of set, in the order the upload form and Musik offer them.

export const KINDS: readonly BoothKind[] = [
  'mix',
  'live_recording',
  'track',
  'podcast',
  'spoken_word',
  'album',
  'ep',
];

// The kinds made of several tracks, each its own file, instead of one
// recording (`BoothSet::ALBUM_KINDS`).
export const ALBUM_KINDS: readonly BoothKind[] = ['album', 'ep'];
export const RECORDING_KINDS: readonly BoothKind[] = KINDS.filter(
  (kind) => !ALBUM_KINDS.includes(kind),
);

export const ALBUM_TRACKS_MIN = 2;
export const ALBUM_TRACKS_MAX = 30;

export const isAlbumKind = (kind: BoothKind): boolean =>
  ALBUM_KINDS.includes(kind);

// An album or EP that has its tracks to play.
export const albumTracks = (set: BoothSet): BoothAlbumTrack[] =>
  isAlbumKind(set.kind) ? (set.tracks ?? []) : [];

const messages = defineMessages({
  mix: { id: 'booth.kind.mix', defaultMessage: 'Mix' },
  live_recording: {
    id: 'booth.kind.live_recording',
    defaultMessage: 'Live recording',
  },
  track: { id: 'booth.kind.track', defaultMessage: 'Track' },
  podcast: { id: 'booth.kind.podcast', defaultMessage: 'Podcast' },
  spoken_word: { id: 'booth.kind.spoken_word', defaultMessage: 'Spoken word' },
  album: { id: 'booth.kind.album', defaultMessage: 'Album' },
  ep: { id: 'booth.kind.ep', defaultMessage: 'EP' },
});

const albumMessages = defineMessages({
  withCount: {
    id: 'booth.kind.with_track_count',
    defaultMessage: '{kind} · {count, plural, one {# track} other {# tracks}}',
  },
});

export const kindMessage = (kind: BoothKind): MessageDescriptor =>
  messages[kind];

// "Album · 9 tracks" for an album or EP, the kind alone for anything else.
export const kindLabel = (set: BoothSet, intl: IntlShape): string => {
  const kind = intl.formatMessage(kindMessage(set.kind));
  const tracks = albumTracks(set);
  return tracks.length > 0
    ? intl.formatMessage(albumMessages.withCount, {
        kind,
        count: tracks.length,
      })
    : kind;
};
