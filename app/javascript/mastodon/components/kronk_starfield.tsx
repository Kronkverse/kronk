// Kronk starfield — canvas-based twinkling star field, portable
// across surfaces. Shares the visual language of the signup void
// (see `entrypoints/kronk_void.ts`) so anywhere you drop it feels
// like the same cosmos.
//
// React-friendly: mounts a `<canvas>`, drives a rAF loop while
// alive, tears down cleanly on unmount. Star colour derived from
// the caller's `color` prop (defaults to `--text-primary` at
// runtime — same as the void). No token literals in the script.
//
// Density scales with viewport area (n = round(w×h / DENSITY)),
// same heuristic as the void. `pointer-events: none` on the
// canvas so it never intercepts clicks — put a real click-target
// (`<button class='moments-viewer__backdrop'>`) above it if you
// need one, per the Moments viewer.

import { useEffect, useRef } from 'react';

interface Star {
  x: number;
  y: number;
  r: number; // radius, px
  a: number; // base alpha, 0-1
  tw: number; // twinkle phase, radians
  ts: number; // twinkle speed
}

const DENSITY_DIVISOR = 9000;

interface KronkStarfieldProps {
  // CSS color the stars draw in. When omitted, read
  // `--text-primary` off `documentElement` at mount time — matches
  // the void's behaviour.
  color?: string;
  className?: string;
}

function readTokenColor(): string {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue('--text-primary')
    .trim();
  const hex = raw.replace('#', '');
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex;
  const n = Number.parseInt(full, 16);
  if (Number.isNaN(n)) return '236,233,245';
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(',');
}

export const KronkStarfield: React.FC<KronkStarfieldProps> = ({
  color,
  className,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rgb = color ?? readTokenColor();
    let w = 0;
    let h = 0;
    let stars: Star[] = [];
    let raf = 0;

    const seed = (count: number) => {
      const next: Star[] = [];
      for (let i = 0; i < count; i += 1) {
        next.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: Math.random() * 1.15 + 0.25,
          a: Math.random() * 0.5 + 0.12,
          tw: Math.random() * Math.PI * 2,
          ts: Math.random() * 0.9 + 0.25,
        });
      }
      return next;
    };

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const parent = canvas.parentElement;
      // Anchor to parent bounds if any, else the viewport. Moments
      // viewer wraps the field in a fixed-inset backdrop, so parent
      // bounds match the viewport there — but other consumers might
      // want a starfield inside a smaller region.
      w = parent ? parent.clientWidth : window.innerWidth;
      h = parent ? parent.clientHeight : window.innerHeight;
      canvas.style.width = `${String(w)}px`;
      canvas.style.height = `${String(h)}px`;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = seed(Math.round((w * h) / DENSITY_DIVISOR));
    };

    let last = performance.now();
    const frame = (t: number) => {
      const dt = Math.min(50, t - last);
      last = t;
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        s.tw += (dt / 1000) * s.ts;
        const alpha = s.a * (0.62 + 0.38 * Math.sin(s.tw));
        ctx.beginPath();
        ctx.fillStyle = `rgba(${rgb},${String(alpha)})`;
        ctx.arc(s.x, s.y, s.r, 0, 6.2832);
        ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    };

    resize();
    window.addEventListener('resize', resize);
    raf = requestAnimationFrame(frame);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(raf);
    };
  }, [color]);

  return (
    <canvas
      ref={canvasRef}
      className={`kronk-starfield ${className ?? ''}`.trim()}
      aria-hidden
    />
  );
};
