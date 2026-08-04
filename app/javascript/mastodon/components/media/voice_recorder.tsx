import { useCallback, useEffect, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import MicIcon from '@/material-icons/400-24px/mic.svg?react';
import PauseIcon from '@/material-icons/400-24px/pause-fill.svg?react';
import PlayArrowIcon from '@/material-icons/400-24px/play_arrow-fill.svg?react';
import StopIcon from '@/material-icons/400-24px/stop.svg?react';
import { Icon } from 'mastodon/components/icon';

import { useVoiceRecording } from './use_voice_recording';
import { WaveformBars } from './waveform_bars';

const messages = defineMessages({
  record: { id: 'voice_recorder.record', defaultMessage: 'Record voice' },
  stop: { id: 'voice_recorder.stop', defaultMessage: 'Stop recording' },
  play: { id: 'voice_recorder.play', defaultMessage: 'Play' },
  pause: { id: 'voice_recorder.pause', defaultMessage: 'Pause' },
  remove: { id: 'voice_recorder.remove', defaultMessage: 'Remove recording' },
});

export interface VoiceRecorderChange {
  mediaId?: string;
  blob?: Blob;
  blobUrl?: string;
  seconds: number;
  waveform: number[];
}

interface VoiceRecorderProps {
  onChange: (change: VoiceRecorderChange | null) => void;
  // Whether the recorder auto-uploads the blob on stop (default) or
  // waits for the consumer to call `commitUpload()` via the state
  // handed back on onChange. Composer flows typically leave this
  // true; chat threads that only want to upload on send set false.
  autoUpload?: boolean;
  maxSeconds?: number;
  disabled?: boolean;
  className?: string;
}

// Ergonomic single-component recorder. Renders one of three shapes:
//
//   1. Idle    → a "Record voice" mic button.
//   2. Recording → red dot + live-waveform strip + timer + stop button.
//   3. Preview → play/pause + captured-waveform strip + duration + delete.
//
// Consumers pass onChange to be notified whenever the recording
// state settles: gets a change object when a preview is available,
// null when the recording is cleared. Composers use the mediaId
// straight through to their POST; consumers with autoUpload:false
// need to call the exposed hook's commitUpload before submitting.
//
// If you need finer control (custom UI per state, external mic
// button, cross-hook coordination) drop the wrapper and consume
// `useVoiceRecording()` directly.
export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onChange,
  autoUpload,
  maxSeconds,
  disabled,
  className,
}) => {
  const intl = useIntl();
  const {
    mediaId,
    blob,
    blobUrl,
    recording,
    seconds,
    liveWaveform,
    capturedWaveform,
    start,
    stop,
    clear,
  } = useVoiceRecording({ autoUpload, maxSeconds });

  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [previewPlaying, setPreviewPlaying] = useState(false);

  // Fire onChange whenever the settled state changes — the parent
  // sees mediaId once the auto-upload resolves, or the blob
  // immediately when autoUpload is off.
  useEffect(() => {
    if (recording) return;
    if (blob) {
      onChange({
        mediaId,
        blob,
        blobUrl,
        seconds,
        waveform: capturedWaveform,
      });
    } else {
      onChange(null);
    }
    // seconds intentionally omitted from deps: it ticks during
    // recording but we only want to fire on the settled state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blob, mediaId, recording]);

  const handleRemove = useCallback(() => {
    previewAudioRef.current?.pause();
    setPreviewPlaying(false);
    clear();
  }, [clear]);

  const handlePreviewToggle = useCallback(() => {
    const audio = previewAudioRef.current;
    if (!audio) return;
    if (previewPlaying) {
      audio.pause();
      setPreviewPlaying(false);
    } else {
      void audio.play();
      setPreviewPlaying(true);
    }
  }, [previewPlaying]);

  const onPreviewEnded = useCallback(() => {
    setPreviewPlaying(false);
  }, []);

  const rootClass = ['voice-recorder', className ?? '']
    .filter(Boolean)
    .join(' ');

  if (recording) {
    return (
      <div
        className={`${rootClass} voice-recorder--recording`}
        role='status'
        aria-live='polite'
      >
        <span className='voice-recorder__dot' />
        <WaveformBars
          bars={
            liveWaveform.length > 0
              ? liveWaveform
              : Array<number>(40).fill(0.05)
          }
          live
          className='voice-recorder__waveform'
        />
        <span className='voice-recorder__timer'>{seconds}s</span>
        <button
          type='button'
          className='voice-recorder__stop'
          onClick={stop}
          aria-label={intl.formatMessage(messages.stop)}
        >
          <Icon icon={StopIcon} id='stop' />
        </button>
      </div>
    );
  }

  if (blob && blobUrl) {
    return (
      <div className={`${rootClass} voice-recorder--preview`}>
        <button
          type='button'
          className='voice-recorder__play'
          onClick={handlePreviewToggle}
          aria-label={intl.formatMessage(
            previewPlaying ? messages.pause : messages.play,
          )}
        >
          <Icon
            icon={previewPlaying ? PauseIcon : PlayArrowIcon}
            id={previewPlaying ? 'pause' : 'play_arrow'}
          />
        </button>
        <WaveformBars
          bars={
            capturedWaveform.length > 0
              ? capturedWaveform
              : Array<number>(40).fill(0.3)
          }
          className='voice-recorder__waveform'
        />
        <span className='voice-recorder__duration'>{seconds}s</span>
        <button
          type='button'
          className='voice-recorder__remove'
          onClick={handleRemove}
          aria-label={intl.formatMessage(messages.remove)}
        >
          ×
        </button>
        {/* Audio-only recording — no captions to attach. The
            component's controls are the play/pause + waveform + delete
            above; the <audio> element itself never becomes visible or
            focusable. */}
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio
          ref={previewAudioRef}
          src={blobUrl}
          onEnded={onPreviewEnded}
          className='voice-recorder__preview-audio'
        />
      </div>
    );
  }

  return (
    <button
      type='button'
      className={`${rootClass} voice-recorder--idle`}
      onClick={start}
      disabled={disabled}
      aria-label={intl.formatMessage(messages.record)}
    >
      <Icon icon={MicIcon} id='mic' />
      <span className='voice-recorder__label'>
        {intl.formatMessage(messages.record)}
      </span>
    </button>
  );
};
