import { useCallback, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import ArrowDownwardIcon from '@/material-icons/400-24px/arrow_downward.svg?react';
import ArrowUpwardIcon from '@/material-icons/400-24px/arrow_upward.svg?react';
import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import { Icon } from 'mastodon/components/icon';

import { formatDuration } from '../format';
import { ALBUM_TRACKS_MAX, ALBUM_TRACKS_MIN } from '../kinds';
import type { BoothAlbumTrack } from '../types';

// An album's or EP's tracks on the upload and edit forms (docs/spaces/
// booth.md, Albums): pick several audio files at once, each one a track
// named after its file, then rename them and put them in order. On the
// edit form the album's own tracks come first and new files join them.

export interface AlbumTrackDraft {
  key: string;
  // A track the album already has, or a file still to upload.
  id: string | null;
  file: File | null;
  title: string;
  duration_seconds: number | null;
}

const messages = defineMessages({
  label: { id: 'booth.album.field_label', defaultMessage: 'Tracks' },
  hint: {
    id: 'booth.album.field_hint',
    defaultMessage:
      'Pick the audio files, one per track. Rename them and put them in the order they play. {min} to {max} tracks.',
  },
  pick: { id: 'booth.album.pick', defaultMessage: 'Choose audio files' },
  pickMore: { id: 'booth.album.pick_more', defaultMessage: 'Add more files' },
  trackTitle: {
    id: 'booth.album.track_title',
    defaultMessage: 'Title of track {number}',
  },
  moveUp: { id: 'booth.album.move_up', defaultMessage: 'Move track up' },
  moveDown: { id: 'booth.album.move_down', defaultMessage: 'Move track down' },
  remove: { id: 'booth.album.remove', defaultMessage: 'Remove track' },
  tooLarge: {
    id: 'booth.album.too_large',
    defaultMessage: '{name} is too large. Each file can be up to 4 GB.',
  },
  tooMany: {
    id: 'booth.album.too_many',
    defaultMessage: 'An album or EP can have up to {max} tracks.',
  },
});

const AUDIO_LIMIT = 4 * 1024 * 1024 * 1024;

// "03 - Low Water.mp3" → "Low Water". A leading track number goes, since
// the order is the album's ("3. Intro", "03 Intro"), but "99 Problems"
// keeps its name.
export function trackTitleFromFile(name: string): string {
  const title = name
    .replace(/\.[a-z0-9]{2,5}$/i, '')
    .replace(/[_]+/g, ' ')
    .replace(/^\s*(?:\d{1,3}\s*[-.)]|0\d)\s+/, '')
    .trim();
  return title || name;
}

// How long a picked file plays, read by the browser before it uploads.
// Null if the browser can't tell.
function readDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    const done = (seconds: number | null) => {
      URL.revokeObjectURL(url);
      resolve(seconds);
    };
    audio.preload = 'metadata';
    audio.addEventListener('loadedmetadata', () => {
      done(
        Number.isFinite(audio.duration) && audio.duration > 0
          ? Math.round(audio.duration)
          : null,
      );
    });
    audio.addEventListener('error', () => {
      done(null);
    });
    audio.src = url;
  });
}

export const draftsFromTracks = (
  tracks: BoothAlbumTrack[],
): AlbumTrackDraft[] =>
  tracks.map((track) => ({
    key: `track-${track.id}`,
    id: track.id,
    file: null,
    title: track.title,
    duration_seconds: track.duration_seconds,
  }));

export const albumReady = (tracks: AlbumTrackDraft[]): boolean =>
  tracks.length >= ALBUM_TRACKS_MIN &&
  tracks.length <= ALBUM_TRACKS_MAX &&
  tracks.every((track) => track.title.trim() !== '');

const TrackRow: React.FC<{
  track: AlbumTrackDraft;
  index: number;
  count: number;
  disabled?: boolean;
  onTitle: (key: string, title: string) => void;
  onMove: (key: string, by: number) => void;
  onRemove: (key: string) => void;
}> = ({ track, index, count, disabled, onTitle, onMove, onRemove }) => {
  const intl = useIntl();

  const handleTitle = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onTitle(track.key, e.target.value);
    },
    [onTitle, track.key],
  );
  const handleUp = useCallback(() => {
    onMove(track.key, -1);
  }, [onMove, track.key]);
  const handleDown = useCallback(() => {
    onMove(track.key, 1);
  }, [onMove, track.key]);
  const handleRemove = useCallback(() => {
    onRemove(track.key);
  }, [onRemove, track.key]);

  return (
    <li className='booth-album-field__track'>
      <span className='booth-album-field__number'>{index + 1}</span>
      <input
        type='text'
        value={track.title}
        onChange={handleTitle}
        maxLength={200}
        required
        disabled={disabled}
        aria-label={intl.formatMessage(messages.trackTitle, {
          number: index + 1,
        })}
      />
      <span className='booth-album-field__length'>
        {formatDuration(track.duration_seconds)}
      </span>
      <button
        type='button'
        onClick={handleUp}
        disabled={disabled || index === 0}
        aria-label={intl.formatMessage(messages.moveUp)}
        title={intl.formatMessage(messages.moveUp)}
      >
        <Icon id='arrow-up' icon={ArrowUpwardIcon} />
      </button>
      <button
        type='button'
        onClick={handleDown}
        disabled={disabled || index === count - 1}
        aria-label={intl.formatMessage(messages.moveDown)}
        title={intl.formatMessage(messages.moveDown)}
      >
        <Icon id='arrow-down' icon={ArrowDownwardIcon} />
      </button>
      <button
        type='button'
        onClick={handleRemove}
        disabled={disabled}
        aria-label={intl.formatMessage(messages.remove)}
        title={intl.formatMessage(messages.remove)}
      >
        <Icon id='close' icon={CloseIcon} />
      </button>
    </li>
  );
};

interface Props {
  value: AlbumTrackDraft[];
  onChange: Dispatch<SetStateAction<AlbumTrackDraft[]>>;
  disabled?: boolean;
}

export const AlbumTracksField: React.FC<Props> = ({
  value,
  onChange,
  disabled,
}) => {
  const intl = useIntl();
  const [error, setError] = useState<string | null>(null);
  const nextKey = useRef(0);

  const handleFiles = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const picked = Array.from(e.target.files ?? []);
      e.target.value = '';
      const tooLarge = picked.find((file) => file.size > AUDIO_LIMIT);
      const fitting = picked.filter((file) => file.size <= AUDIO_LIMIT);
      const room = Math.max(0, ALBUM_TRACKS_MAX - value.length);
      const added = fitting.slice(0, room).map((file) => {
        nextKey.current += 1;
        return {
          key: `file-${nextKey.current}`,
          id: null,
          file,
          title: trackTitleFromFile(file.name),
          duration_seconds: null,
        };
      });

      setError(
        tooLarge
          ? intl.formatMessage(messages.tooLarge, { name: tooLarge.name })
          : fitting.length > room
            ? intl.formatMessage(messages.tooMany, { max: ALBUM_TRACKS_MAX })
            : null,
      );
      onChange((tracks) => [...tracks, ...added]);

      // Each file's length arrives on its own; fill it in when it does.
      added.forEach((draft) => {
        void readDuration(draft.file).then((seconds) => {
          if (seconds !== null) {
            onChange((tracks) =>
              tracks.map((track) =>
                track.key === draft.key
                  ? { ...track, duration_seconds: seconds }
                  : track,
              ),
            );
          }
          return undefined;
        });
      });
    },
    [intl, onChange, value.length],
  );

  const handleTitle = useCallback(
    (key: string, title: string) => {
      onChange((tracks) =>
        tracks.map((track) =>
          track.key === key ? { ...track, title } : track,
        ),
      );
    },
    [onChange],
  );

  const handleMove = useCallback(
    (key: string, by: number) => {
      onChange((tracks) => {
        const from = tracks.findIndex((track) => track.key === key);
        const to = from + by;
        const moving = tracks[from];
        if (!moving || to < 0 || to >= tracks.length) return tracks;
        const next = tracks.filter((track) => track.key !== key);
        next.splice(to, 0, moving);
        return next;
      });
    },
    [onChange],
  );

  const handleRemove = useCallback(
    (key: string) => {
      onChange((tracks) => tracks.filter((track) => track.key !== key));
      setError(null);
    },
    [onChange],
  );

  return (
    <div className='booth-upload-form__field booth-album-field'>
      <span>{intl.formatMessage(messages.label)} *</span>
      {value.length > 0 && (
        <ol className='booth-album-field__list'>
          {value.map((track, i) => (
            <TrackRow
              key={track.key}
              track={track}
              index={i}
              count={value.length}
              disabled={disabled}
              onTitle={handleTitle}
              onMove={handleMove}
              onRemove={handleRemove}
            />
          ))}
        </ol>
      )}
      {value.length < ALBUM_TRACKS_MAX && (
        <label className='booth-upload-form__file-picker'>
          <input
            type='file'
            accept='audio/*'
            multiple
            onChange={handleFiles}
            disabled={disabled}
          />
          <span className='booth-upload-form__file-picker-label'>
            {intl.formatMessage(
              value.length > 0 ? messages.pickMore : messages.pick,
            )}
          </span>
        </label>
      )}
      <small className='booth-upload-form__hint'>
        {intl.formatMessage(messages.hint, {
          min: ALBUM_TRACKS_MIN,
          max: ALBUM_TRACKS_MAX,
        })}
      </small>
      {error && (
        <span className='booth-upload-form__file-error' role='alert'>
          {error}
        </span>
      )}
    </div>
  );
};
