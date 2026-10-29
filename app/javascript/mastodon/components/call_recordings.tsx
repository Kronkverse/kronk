import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { apiRequestDelete, apiRequestGet } from 'mastodon/api';
import { KornerActionBar } from 'mastodon/components/korner_action_bar';
import { KornerMeta } from 'mastodon/components/korner_meta';
import { KornerPill } from 'mastodon/components/korner_pill';
import { useConfirmDialog } from 'mastodon/hooks/useConfirmDialog';
import type { CallKind } from 'mastodon/jitsi';

// A call's recordings (docs/spaces/huddle.md, Recordings): the one thing a
// call leaves behind. GET /api/v1/calls/recordings lists the ready ones the
// viewer may see, each with short-lived signed URLs to play and to save;
// whoever moderates the call can delete one. Says nothing when there are
// none, so a call that was never recorded looks as it always did.

const messages = defineMessages({
  heading: { id: 'calls.recordings.heading', defaultMessage: 'Recordings' },
  play: { id: 'calls.recordings.play', defaultMessage: 'Play' },
  playLabel: {
    id: 'calls.recordings.play_label',
    defaultMessage: 'Play the recording from {date}',
  },
  hide: { id: 'calls.recordings.hide', defaultMessage: 'Hide' },
  download: { id: 'calls.recordings.download', defaultMessage: 'Download' },
  downloadSound: {
    id: 'calls.recordings.download_sound',
    defaultMessage: 'Download sound',
  },
  downloadSoundLabel: {
    id: 'calls.recordings.download_sound_label',
    defaultMessage: 'Download the sound of the recording from {date}',
  },
  downloadLabel: {
    id: 'calls.recordings.download_label',
    defaultMessage: 'Download the recording from {date}',
  },
  remove: { id: 'calls.recordings.delete', defaultMessage: 'Delete' },
  removeLabel: {
    id: 'calls.recordings.delete_label',
    defaultMessage: 'Delete the recording from {date}',
  },
  removeTitle: {
    id: 'calls.recordings.delete_title',
    defaultMessage: 'Delete this recording?',
  },
  removeBody: {
    id: 'calls.recordings.delete_body',
    defaultMessage: 'It goes for everyone, and can’t be brought back.',
  },
  length: { id: 'calls.recordings.length', defaultMessage: '{length} long' },
  audio: { id: 'calls.recordings.audio', defaultMessage: 'Sound only' },
  video: { id: 'calls.recordings.video', defaultMessage: 'Video' },
});

export interface CallRecording {
  id: string;
  kind: CallKind;
  // A recording can come as video, audio, or both (`pair_id` is the other
  // file of the same recording).
  media: 'video' | 'audio';
  pair_id: string | null;
  created_at: string;
  duration: number | null;
  size: number;
  filename: string;
  content_type: string;
  url: string;
  download_url: string;
  can_delete: boolean;
}

// The ready recordings of one call, refetched when it changes. Empty while
// loading, when there's nothing the viewer may see, or while `enabled` is
// false (nothing is asked).
export const useCallRecordings = (
  kind: CallKind,
  id?: string,
  enabled = true,
): [CallRecording[], (removed: string) => void] => {
  const [recordings, setRecordings] = useState<CallRecording[]>([]);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    apiRequestGet<CallRecording[]>(
      'v1/calls/recordings',
      id === undefined ? { kind } : { kind, id },
    )
      .then((list) => {
        if (!cancelled) setRecordings(list);
        return undefined;
      })
      .catch(() => {
        if (!cancelled) setRecordings([]);
      });
    return () => {
      cancelled = true;
    };
  }, [kind, id, enabled]);

  const forget = useCallback((removed: string) => {
    setRecordings((current) => current.filter((r) => r.id !== removed));
  }, []);

  return [recordings, forget];
};

// 3725 → "1:02:05", 754 → "12:34".
export const recordingLength = (seconds: number | null): string | null => {
  if (!seconds || seconds <= 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
};

// One recording as people see it: the video, with its sound file when
// Kronk kept both (`pair_id`), or a file on its own.
interface RecordingEntry {
  recording: CallRecording;
  sound: CallRecording | null;
}

const recordingEntries = (recordings: CallRecording[]): RecordingEntry[] => {
  const byId = new Map(recordings.map((r) => [r.id, r]));
  const shown = new Set<string>();
  const entries: RecordingEntry[] = [];
  for (const r of recordings) {
    if (shown.has(r.id)) continue;
    shown.add(r.id);
    const other = r.pair_id ? byId.get(r.pair_id) : undefined;
    if (other && !shown.has(other.id) && other.media !== r.media) {
      shown.add(other.id);
      entries.push(
        r.media === 'audio'
          ? { recording: other, sound: r }
          : { recording: r, sound: other },
      );
    } else {
      entries.push({ recording: r, sound: null });
    }
  }
  return entries;
};

const RecordingItem: React.FC<{
  recording: CallRecording;
  sound: CallRecording | null;
  onRemoved: (id: string) => void;
}> = ({ recording, sound, onRemoved }) => {
  const intl = useIntl();
  const [confirmDialog, confirm] = useConfirmDialog();
  const [playing, setPlaying] = useState(false);
  const date = intl.formatDate(recording.created_at, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  const length = recordingLength(recording.duration);

  const handlePlay = useCallback(() => {
    setPlaying((current) => !current);
  }, []);

  const handleDownload = useCallback(() => {
    // A signed URL that answers "save as", so the page stays put.
    window.location.assign(recording.download_url);
  }, [recording.download_url]);
  const handleDownloadSound = useCallback(() => {
    if (sound) window.location.assign(sound.download_url);
  }, [sound]);

  const handleRemove = useCallback(() => {
    void (async () => {
      const ok = await confirm({
        title: intl.formatMessage(messages.removeTitle),
        message: intl.formatMessage(messages.removeBody),
        confirmLabel: intl.formatMessage(messages.remove),
        destructive: true,
      });
      if (!ok) return;
      // Deleting a recording deletes its sound file too.
      for (const file of sound ? [recording, sound] : [recording]) {
        try {
          await apiRequestDelete(`v1/calls/recordings/${file.id}`);
          onRemoved(file.id);
        } catch {
          // Still there; it stays listed.
        }
      }
    })();
  }, [confirm, intl, recording, sound, onRemoved]);

  return (
    <li className='call-recordings__item'>
      <KornerMeta
        items={[
          date,
          !sound &&
            intl.formatMessage(
              recording.media === 'audio' ? messages.audio : messages.video,
            ),
          length && intl.formatMessage(messages.length, { length }),
        ]}
      />
      {/* A call's recording has no captions to offer. */}
      {playing && recording.media === 'audio' && (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio
          className='call-recordings__player call-recordings__player--audio'
          src={recording.url}
          controls
          autoPlay
          preload='metadata'
        />
      )}
      {playing && recording.media !== 'audio' && (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video
          className='call-recordings__player'
          src={recording.url}
          controls
          autoPlay
          preload='metadata'
        />
      )}
      <KornerActionBar>
        <KornerPill
          variant='primary'
          label={intl.formatMessage(playing ? messages.hide : messages.play)}
          ariaLabel={
            playing
              ? undefined
              : intl.formatMessage(messages.playLabel, { date })
          }
          active={playing}
          onClick={handlePlay}
        />
        <KornerPill
          label={intl.formatMessage(messages.download)}
          ariaLabel={intl.formatMessage(messages.downloadLabel, { date })}
          onClick={handleDownload}
        />
        {sound && (
          <KornerPill
            label={intl.formatMessage(messages.downloadSound)}
            ariaLabel={intl.formatMessage(messages.downloadSoundLabel, {
              date,
            })}
            onClick={handleDownloadSound}
          />
        )}
        {recording.can_delete && (
          <KornerPill
            variant='destructive'
            label={intl.formatMessage(messages.remove)}
            ariaLabel={intl.formatMessage(messages.removeLabel, { date })}
            onClick={handleRemove}
          />
        )}
      </KornerActionBar>
      {confirmDialog}
    </li>
  );
};

// A list of recordings, with Play, Download and (for whoever may) Delete.
export const CallRecordingList: React.FC<{
  recordings: CallRecording[];
  onRemoved: (id: string) => void;
}> = ({ recordings, onRemoved }) => {
  const intl = useIntl();

  if (recordings.length === 0) return null;

  return (
    <section className='call-recordings'>
      <h3 className='korner-section-heading'>
        {intl.formatMessage(messages.heading)}
      </h3>
      <ul className='call-recordings__list'>
        {recordingEntries(recordings).map(({ recording, sound }) => (
          <RecordingItem
            key={recording.id}
            recording={recording}
            sound={sound}
            onRemoved={onRemoved}
          />
        ))}
      </ul>
    </section>
  );
};

// A call's recordings, fetched for it.
export const CallRecordings: React.FC<{ kind: CallKind; id?: string }> = ({
  kind,
  id,
}) => {
  const [recordings, forget] = useCallRecordings(kind, id);

  return <CallRecordingList recordings={recordings} onRemoved={forget} />;
};
