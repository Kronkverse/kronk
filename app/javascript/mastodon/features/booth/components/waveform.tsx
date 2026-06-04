import { useCallback, useEffect, useRef } from 'react';

interface Props {
  setId: string;
  progressPct: number;
  onSeek: (pct: number) => void;
}

const NUM_BARS = 100;

function generatePeaks(seed: string): number[] {
  let state =
    seed
      .split('')
      .reduce((acc, ch) => ((acc * 31 + ch.charCodeAt(0)) | 0), 0x12345678) >>>
    0;

  const next = () => {
    state = ((state * 1664525 + 1013904223) | 0) >>> 0;
    return state / 0xffffffff;
  };

  const raw = Array.from({ length: NUM_BARS }, () => next());

  // Smooth with neighbours for a natural waveform look
  const smoothed = raw.map((val, i) => {
    const prev = raw[i - 1] ?? val;
    const nxt = raw[i + 1] ?? val;
    return prev * 0.25 + val * 0.5 + nxt * 0.25;
  });

  // Envelope: fade in/out at the edges (typical mix structure)
  return smoothed.map((val, i) => {
    const pos = i / NUM_BARS;
    const env =
      pos < 0.08
        ? pos / 0.08
        : pos > 0.92
          ? (1 - pos) / 0.08
          : 1;
    return Math.max(0.06, val * env);
  });
}

export const Waveform: React.FC<Props> = ({ setId, progressPct, onSeek }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const peaks = generatePeaks(setId);

  const getPct = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      draggingRef.current = true;
      onSeek(getPct(e.clientX));
    },
    [onSeek, getPct],
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      onSeek(getPct(e.clientX));
    };
    const handleMouseUp = () => {
      draggingRef.current = false;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [onSeek, getPct]);

  return (
    <div
      ref={containerRef}
      className='booth-waveform'
      onMouseDown={handleMouseDown}
      role='slider'
      aria-label='Seek'
      aria-valuenow={Math.round(progressPct * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      tabIndex={0}
    >
      {peaks.map((peak, i) => (
        <div
          key={i}
          className={`booth-waveform__bar${i / NUM_BARS < progressPct ? ' booth-waveform__bar--played' : ''}`}
          style={{ height: `${Math.round(peak * 100)}%` }}
        />
      ))}
    </div>
  );
};
