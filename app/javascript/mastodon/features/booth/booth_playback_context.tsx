import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { PropsWithChildren } from 'react';

import api from 'mastodon/api';

import type { BoothSet } from './types';

interface BoothPlaybackContextValue {
  activeSet: BoothSet | null;
  playing: boolean;
  currentTime: number;
  duration: number;

  // The list a set was started from, so the player can carry on to the
  // next one when it ends (Play next, remembered per browser).
  upNext: BoothSet | null;
  autoNext: boolean;
  setAutoNext: (on: boolean) => void;

  play: (set: BoothSet, queue?: BoothSet[]) => void;
  playFrom: (set: BoothSet, seconds: number) => void;
  toggle: () => void;
  seekPct: (pct: number) => void;
  skip: (delta: number) => void;
  clear: () => void;
}

const AUTO_NEXT_KEY = 'kronk.booth.play_next';

function readAutoNext(): boolean {
  try {
    return window.localStorage.getItem(AUTO_NEXT_KEY) !== '0';
  } catch {
    return true;
  }
}

const BoothPlaybackContext = createContext<BoothPlaybackContextValue | null>(
  null,
);

export const BoothPlaybackProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [activeSet, setActiveSet] = useState<BoothSet | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const playCountedIdRef = useRef<string | null>(null);
  const playIntentRef = useRef<string | null>(null);
  // A start position requested before the set's audio has loaded (a track
  // list timestamp on a set that isn't playing yet). Applied once metadata
  // arrives, then cleared.
  const pendingSeekRef = useRef<number | null>(null);
  const [queue, setQueue] = useState<BoothSet[]>([]);
  const [autoNext, setAutoNextState] = useState(readAutoNext);

  const setAutoNext = useCallback((on: boolean) => {
    setAutoNextState(on);
    try {
      window.localStorage.setItem(AUTO_NEXT_KEY, on ? '1' : '0');
    } catch {
      // Private mode: it resets next visit.
    }
  }, []);

  const play = useCallback(
    (set: BoothSet, nextQueue?: BoothSet[]) => {
      const audio = audioRef.current;
      if (nextQueue) setQueue(nextQueue);

      // Same set already loaded — just resume playback without changing state
      if (activeSet?.id === set.id) {
        if (audio) void audio.play().catch(() => undefined);
        return;
      }

      // Different set — swap active and mark intent so the effect below
      // starts playback once React updates the audio src.
      playIntentRef.current = set.id;
      playCountedIdRef.current = null;
      setCurrentTime(0);
      setDuration(set.duration_seconds ?? 0);
      setActiveSet(set);
    },
    [activeSet],
  );

  const playFrom = useCallback(
    (set: BoothSet, seconds: number) => {
      const audio = audioRef.current;
      if (activeSet?.id === set.id && audio) {
        audio.currentTime = seconds;
        void audio.play().catch(() => undefined);
        return;
      }
      pendingSeekRef.current = seconds;
      play(set);
    },
    [activeSet, play],
  );

  // After activeSet flips, the audio element's src updates. Then start playback
  // if the user requested it via play().
  useEffect(() => {
    if (!activeSet) return;
    if (playIntentRef.current !== activeSet.id) return;
    playIntentRef.current = null;
    const audio = audioRef.current;
    if (audio) void audio.play().catch(() => undefined);
  }, [activeSet]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play().catch(() => undefined);
    } else {
      audio.pause();
    }
  }, []);

  const seekPct = useCallback((pct: number) => {
    const audio = audioRef.current;
    if (!audio?.duration) return;
    audio.currentTime = pct * audio.duration;
  }, []);

  const skip = useCallback((delta: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(
      0,
      Math.min(audio.duration || 0, audio.currentTime + delta),
    );
  }, []);

  const clear = useCallback(() => {
    const audio = audioRef.current;
    if (audio) audio.pause();
    pendingSeekRef.current = null;
    setActiveSet(null);
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    playCountedIdRef.current = null;
  }, []);

  // Fire play_count POST once per set becoming active (not on toggle)
  useEffect(() => {
    if (!activeSet) return;
    if (playCountedIdRef.current === activeSet.id) return;
    playCountedIdRef.current = activeSet.id;
    void api().post(`/api/v1/booth_sets/${activeSet.id}/play`);
  }, [activeSet]);

  // What plays after the current set, if anything: the next one in the
  // list it was started from.
  const activeIndex = activeSet
    ? queue.findIndex((s) => s.id === activeSet.id)
    : -1;
  const upNext =
    activeIndex >= 0 && activeIndex < queue.length - 1
      ? (queue[activeIndex + 1] ?? null)
      : null;

  // The ended listener is wired once; it reads the latest choice here.
  const endedRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    endedRef.current = () => {
      if (autoNext && upNext) play(upNext);
    };
  }, [autoNext, upNext, play]);

  // Wire audio element event listeners once
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    const onTime = () => {
      setCurrentTime(audio.currentTime);
    };
    const onDur = () => {
      setDuration(audio.duration);
    };
    const onMeta = () => {
      setDuration(audio.duration);
      if (pendingSeekRef.current !== null) {
        audio.currentTime = pendingSeekRef.current;
        pendingSeekRef.current = null;
      }
    };
    const onPlay = () => {
      setPlaying(true);
    };
    const onPause = () => {
      setPlaying(false);
    };
    const onEnded = () => {
      setPlaying(false);
      endedRef.current?.();
    };

    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('durationchange', onDur);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('durationchange', onDur);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
    };
  }, []);

  const value: BoothPlaybackContextValue = {
    activeSet,
    playing,
    currentTime,
    duration,
    upNext,
    autoNext,
    setAutoNext,
    play,
    playFrom,
    toggle,
    seekPct,
    skip,
    clear,
  };

  return (
    <BoothPlaybackContext.Provider value={value}>
      {children}
      {/* Audio element lives here — persists across route changes */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        ref={audioRef}
        src={activeSet?.audio_url ?? ''}
        preload='metadata'
      />
    </BoothPlaybackContext.Provider>
  );
};

export function useBoothPlayback(): BoothPlaybackContextValue {
  const ctx = useContext(BoothPlaybackContext);
  if (!ctx) {
    // Outside provider — return a no-op shape so components render without crashing
    return {
      activeSet: null,
      playing: false,
      currentTime: 0,
      duration: 0,
      upNext: null,
      autoNext: false,
      setAutoNext: () => undefined,
      play: () => undefined,
      playFrom: () => undefined,
      toggle: () => undefined,
      seekPct: () => undefined,
      skip: () => undefined,
      clear: () => undefined,
    };
  }
  return ctx;
}
