import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import PauseIcon from '@/material-icons/400-24px/pause-fill.svg?react';
import PlayArrowIcon from '@/material-icons/400-24px/play_arrow-fill.svg?react';
import { Icon } from 'mastodon/components/icon';

import { WaveformBars } from './waveform_bars';

const PLAYER_BARS = 30;

// Fallback amplitude curve for played-back voice memos that don't
// carry captured amplitude data with them (received messages, older
// records). A gentle sinusoid at 4 cycles reads as "voice-like"
// without pretending to be a real waveform.
const decorativeWaveform = Array.from({ length: PLAYER_BARS }, (_, i) => {
  const x = i / (PLAYER_BARS - 1);
  return 0.2 + 0.65 * Math.abs(Math.sin(x * Math.PI * 4 + 0.8));
});

interface VoicePlayerProps {
  src: string;
  // Optional captured amplitudes — if provided, the waveform mirrors
  // the actual audio; otherwise the decorative fallback renders.
  waveform?: number[];
  // Applies the `--sent` modifier — for right-aligned chat bubbles
  // that need the inverted colour treatment. Consumers unrelated to
  // chat leave it off.
  sent?: boolean;
  // Extra class on the root — for consumers that need to stack extra
  // styling (e.g. Moments viewer overlay positioning).
  className?: string;
}

export const VoicePlayer: React.FC<VoicePlayerProps> = ({
  src,
  waveform,
  sent,
  className,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = new Audio(src);
    audioRef.current = audio;
    audio.onloadedmetadata = () => {
      setDuration(audio.duration);
    };
    audio.ontimeupdate = () => {
      setElapsed(audio.currentTime);
      setProgress(audio.duration > 0 ? audio.currentTime / audio.duration : 0);
    };
    audio.onended = () => {
      setPlaying(false);
      setElapsed(0);
      setProgress(0);
    };
    return () => {
      audio.pause();
      audio.src = '';
    };
  }, [src]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      void audio.play();
      setPlaying(true);
    }
  }, [playing]);

  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const bars = useMemo(() => waveform ?? decorativeWaveform, [waveform]);

  return (
    <div
      className={[
        'voice-player',
        sent ? 'voice-player--sent' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <button
        type='button'
        className='voice-player__play'
        onClick={toggle}
        aria-label={playing ? 'Pause' : 'Play'}
      >
        <Icon
          icon={playing ? PauseIcon : PlayArrowIcon}
          id={playing ? 'pause' : 'play_arrow'}
        />
      </button>
      <WaveformBars
        bars={bars}
        progress={progress}
        className='voice-player__waveform'
      />
      <span className='voice-player__time'>
        {fmtTime(playing || elapsed > 0 ? elapsed : duration)}
      </span>
    </div>
  );
};
