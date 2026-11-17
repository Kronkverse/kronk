import { useCallback, useEffect, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import PauseIcon from '@/material-icons/400-24px/pause-fill.svg?react';
import PlayArrowIcon from '@/material-icons/400-24px/play_arrow-fill.svg?react';
import RepeatIcon from '@/material-icons/400-24px/repeat.svg?react';
import { KornerActionBar } from 'mastodon/components/korner_action_bar';
import { KornerPill } from 'mastodon/components/korner_pill';

import { useBoothPlayback } from '../booth_playback_context';
import { formatDuration } from '../format';
import type { BoothSample } from '../types';

import { Waveform } from './waveform';

// A sample's own player (docs/spaces/booth.md, Samples): play it, scrub
// it, and loop it, since a loop is heard going round. A sample is short and
// heard on its own page, so it plays here rather than in the dock, which
// pauses while it does.

const messages = defineMessages({
  play: { id: 'booth.player.play', defaultMessage: 'Play' },
  pause: { id: 'booth.player.pause', defaultMessage: 'Pause' },
  loop: { id: 'booth.sample.player.loop', defaultMessage: 'Loop' },
});

export const SamplePlayer: React.FC<{ sample: BoothSample }> = ({ sample }) => {
  const intl = useIntl();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [looping, setLooping] = useState(sample.sample_type === 'loop');
  const [pct, setPct] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const dock = useBoothPlayback();
  const dockPlaying = dock.playing;
  const dockToggle = dock.toggle;

  useEffect(() => {
    if (audioRef.current) audioRef.current.loop = looping;
  }, [looping]);

  const handleToggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      if (dockPlaying) dockToggle();
      void audio.play();
    } else {
      audio.pause();
    }
  }, [dockPlaying, dockToggle]);
  const handleLoop = useCallback(() => {
    setLooping((on) => !on);
  }, []);
  const handleSeek = useCallback((to: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration)) return;
    audio.currentTime = to * audio.duration;
  }, []);
  const handleTime = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setElapsed(audio.currentTime);
    setPct(audio.duration > 0 ? audio.currentTime / audio.duration : 0);
  }, []);
  const handlePlay = useCallback(() => {
    setPlaying(true);
  }, []);
  const handlePause = useCallback(() => {
    setPlaying(false);
  }, []);

  if (!sample.audio_url) return null;

  return (
    <div className='booth-sample-player'>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- music, no words to caption */}
      <audio
        ref={audioRef}
        src={sample.audio_url}
        preload='metadata'
        onTimeUpdate={handleTime}
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handlePause}
      />
      <Waveform
        setId={`sample-${sample.id}`}
        progressPct={pct}
        onSeek={handleSeek}
      />
      <KornerActionBar align='between'>
        <KornerPill
          variant='primary'
          icon={playing ? PauseIcon : PlayArrowIcon}
          iconId={playing ? 'pause' : 'play'}
          label={intl.formatMessage(playing ? messages.pause : messages.play)}
          onClick={handleToggle}
        />
        <span className='booth-sample-player__time'>
          {formatDuration(Math.floor(elapsed)) || '0:00'} /{' '}
          {formatDuration(sample.duration_seconds)}
        </span>
        <KornerPill
          icon={RepeatIcon}
          iconId='repeat'
          label={intl.formatMessage(messages.loop)}
          active={looping}
          onClick={handleLoop}
        />
      </KornerActionBar>
    </div>
  );
};
