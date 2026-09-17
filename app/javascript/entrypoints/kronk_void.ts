// The ambient starfield behind the signup screens (Screen 1 = account,
// Screen 2 = thresholds ceremony). Plain TS — no React, no framework
// bindings, no styling module — attached via `vite_typescript_tag`
// from the void layout.
//
// Star colour is read from `--text-primary` at boot; no colour literals
// live in this script. Density scales with viewport area. Exports a
// `warp` trigger the ceremony script (layer 7) can call on each ring
// crossing to streak the stars radially outward.

import ready from '../mastodon/ready';

interface Star {
  x: number;
  y: number;
  r: number;
  a: number;
  tw: number;
  ts: number;
}

const STAR_DENSITY_DIVISOR = 9000;
const WARP_MS = 900;

function starColour(): string {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue('--text-primary')
    .trim();

  // The token is a hex — 3 or 6 digits. Skip the `#`, expand shorthand,
  // fall back to a mid-grey if the token isn't parseable so the canvas
  // still draws something rather than throwing.
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

function seed(count: number, w: number, h: number): Star[] {
  const stars: Star[] = [];
  for (let i = 0; i < count; i += 1) {
    stars.push({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.15 + 0.25,
      a: Math.random() * 0.5 + 0.12,
      tw: Math.random() * Math.PI * 2,
      ts: Math.random() * 0.9 + 0.25,
    });
  }
  return stars;
}

interface WarpApi {
  trigger: () => void;
}

// Attach the module and return an object with `trigger()` so callers
// (the ceremony script in layer 7) can pulse the field on ring
// crossings.
function attach(canvas: HTMLCanvasElement): WarpApi | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const rgb = starColour();
  let w = 0;
  let h = 0;
  let stars: Star[] = [];
  let warpT = 0;

  const resize = () => {
    const dpr = window.devicePixelRatio || 1;
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    stars = seed(Math.round((w * h) / STAR_DENSITY_DIVISOR), w, h);
  };

  window.addEventListener('resize', resize);
  resize();

  let last = performance.now();
  const frame = (t: number) => {
    const dt = Math.min(50, t - last);
    last = t;
    ctx.clearRect(0, 0, w, h);

    const ox = w / 2;
    const oy = h * 0.42;

    let warp = 0;
    if (warpT > 0) {
      warpT = Math.max(0, warpT - dt);
      const p = 1 - warpT / WARP_MS;
      warp = Math.sin(Math.min(1, p) * Math.PI) * 1.6;
    }

    for (const s of stars) {
      s.tw += (dt / 1000) * s.ts;

      if (warp > 0) {
        const dx = s.x - ox;
        const dy = s.y - oy;
        const k = 1 + warp * 0.012;
        s.x = ox + dx * k;
        s.y = oy + dy * k;
        if (s.x < -60 || s.x > w + 60 || s.y < -60 || s.y > h + 60) {
          s.x = ox + (Math.random() - 0.5) * w * 0.35;
          s.y = oy + (Math.random() - 0.5) * h * 0.35;
          s.r = Math.random() * 1.15 + 0.25;
          s.a = Math.random() * 0.5 + 0.12;
        }
      }

      const alpha = s.a * (0.62 + 0.38 * Math.sin(s.tw));
      ctx.beginPath();
      if (warp > 0.25) {
        const dx = s.x - ox;
        const dy = s.y - oy;
        const len = Math.hypot(dx, dy) || 1;
        const tail = Math.min(26, warp * len * 0.035);
        ctx.strokeStyle = `rgba(${rgb},${alpha * 0.8})`;
        ctx.lineWidth = s.r * 1.1;
        ctx.lineCap = 'round';
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - (dx / len) * tail, s.y - (dy / len) * tail);
        ctx.stroke();
      } else {
        ctx.fillStyle = `rgba(${rgb},${alpha})`;
        ctx.arc(s.x, s.y, s.r, 0, 6.2832);
        ctx.fill();
      }
    }

    requestAnimationFrame(frame);
  };

  requestAnimationFrame(frame);

  return { trigger: () => (warpT = WARP_MS) };
}

declare global {
  interface Window {
    kronkVoid?: WarpApi;
  }
}

void ready(() => {
  const canvas = document.querySelector<HTMLCanvasElement>('#kronk-void');
  if (!canvas) return;

  const api = attach(canvas);
  if (api) window.kronkVoid = api;
}).catch((e: unknown) => {
  throw e;
});
