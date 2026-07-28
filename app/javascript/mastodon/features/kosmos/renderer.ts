// Pure geometry + per-frame paint logic for the Kosmos ambient layer.
// No React, no DOM references beyond the passed 2D context. Split out
// from the mount component so the canvas math is testable in
// isolation and the mount stays a thin lifecycle shell.
//
// Design source of truth: docs/kronk_frame.md (Kosmos block) and
// KRONK_ORB_DATA_BRIEF.md — the ambient projection sweeps a horizontal
// plane through a 150-socket Fibonacci sphere of accounts, painting
// each chord crossing as a faint star coloured by the chord's local
// gradient. Cycle time is ~10 minutes crown→floor→crown (imperceptible
// by design). If the layer reads as a visualisation, it is too bright.

import type { OrbData } from './use_mates_orb';

// ── Constants shared with the Orb view ─────────────────────────────
export const SPHERE_RADIUS = 100;
export const SOCKET_COUNT = 150;
export const CHORD_SEGMENTS = 20;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const CHORD_CTRL_TOWARD_CENTRE = 0.26; // (A+B) * 0.26 ≡ midpoint × 0.52 — brief matches mockup

// ── Aesthetic constants (matched to the Kosmos brief) ──────────────
const FADE_FRACTION = 0.24; // per-star breathe envelope width (chord-span fraction)
const PEAK_ALPHA_CEILING = 0.34; // ambient ceiling; brightness knob multiplies above this
const REVEAL_GAIN = 1.6; // how much the brightness knob amplifies the ceiling
const SHIMMER_AMPLITUDE = 0.18; // + 0.82 base = [0.82, 1.00]
const THREAD_MAX_DIST_PX = 46; // whisper-faint constellation hint
const THREAD_ALPHA_SCALE = 0.07;
const THREAD_MAX_LINKS_PER_STAR = 2;
const VIGNETTE_INNER = 0.16; // fraction of min(W,H)
const VIGNETTE_OUTER = 0.7; // fraction of max(W,H)
const VIGNETTE_ALPHA = 0.6;
export const HALF_CYCLE_MS = 300_000; // 300s crown→floor; full breath ~10 min

// ── Types ──────────────────────────────────────────────────────────
type Vec3 = readonly [number, number, number];
type RGB = readonly [number, number, number];

interface ChordCurve {
  readonly pts: readonly (readonly [number, number, number, number])[]; // x, y, z, t
  readonly ylo: number;
  readonly yhi: number;
  readonly cA: RGB;
  readonly cB: RGB;
  readonly seed: number;
}

export interface Geometry {
  readonly chords: readonly ChordCurve[];
}

interface Star {
  sx: number;
  sy: number;
  r: number;
  g: number;
  b: number;
  a: number;
}

// ── Helpers ────────────────────────────────────────────────────────
const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

const hexToRgb = (hex: string): RGB => {
  const h = hex.trim().replace(/^#/, '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
};

// Read the 10-stop colour ramp + surface tokens from CSS custom
// properties at build time. Reading through getComputedStyle keeps
// tokens.yaml as the single source of truth — a palette shift in the
// tokens file re-tints the sky without a code change.
export interface KosmosPalette {
  readonly ramp: readonly RGB[];
  readonly void: RGB;
  readonly horizon: RGB;
  readonly thread: RGB;
}

export const readPalette = (): KosmosPalette => {
  const cs = getComputedStyle(document.documentElement);
  const read = (name: string): string => cs.getPropertyValue(name).trim();
  const ramp: RGB[] = [];
  for (let i = 0; i < 10; i++) {
    ramp.push(hexToRgb(read(`--kosmos-ramp-${i}`) || '#38b2a3'));
  }
  return {
    ramp,
    void: hexToRgb(read('--kosmos-void') || '#0b0c11'),
    horizon: hexToRgb(read('--kosmos-horizon') || '#7241ff'),
    thread: hexToRgb(read('--kosmos-thread') || '#8c7cdc'),
  };
};

// ── One-time geometry build ────────────────────────────────────────
export const buildGeometry = (
  orb: OrbData,
  palette: KosmosPalette,
): Geometry => {
  // 1. Fibonacci sockets on the unit sphere, scaled by R.
  const sockets: Vec3[] = [];
  for (let i = 0; i < SOCKET_COUNT; i++) {
    const y = 1 - (i / (SOCKET_COUNT - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const t = GOLDEN_ANGLE * i;
    sockets.push([
      Math.cos(t) * r * SPHERE_RADIUS,
      y * SPHERE_RADIUS,
      Math.sin(t) * r * SPHERE_RADIUS,
    ]);
  }

  // 2. Place accounts across the sphere in rank order with an even
  //    stride so occupied sockets never bunch on one side. Persisted
  //    per-account socket_index is a future upgrade (Orb brief §Open).
  const accounts = orb.accounts.slice(0, SOCKET_COUNT);
  const maxConnections = accounts.reduce(
    (m, a) => (a.connections > m ? a.connections : m),
    1,
  );
  const stride = SOCKET_COUNT / accounts.length;
  const used = new Set<number>();
  const pos = new Map<string, Vec3>();
  const col = new Map<string, RGB>();
  accounts.forEach((acc, i) => {
    let s = Math.round(i * stride) % SOCKET_COUNT;
    while (used.has(s)) s = (s + 1) % SOCKET_COUNT;
    used.add(s);
    const socket = sockets[s];
    if (!socket) return;
    pos.set(acc.id, socket);
    const rampIdx = Math.min(
      9,
      Math.round(
        (Math.log(1 + acc.connections) / Math.log(1 + maxConnections)) * 9,
      ),
    );
    const colour = palette.ramp[rampIdx];
    if (colour) col.set(acc.id, colour);
  });

  // 3. Quadratic bezier per follow, control point pulled toward the
  //    sphere's core so every chord bows through the interior.
  const chords: ChordCurve[] = [];
  orb.follows.forEach(([src, dst], idx) => {
    const A = pos.get(src);
    const B = pos.get(dst);
    if (!A || !B) return;
    const cA = col.get(src);
    const cB = col.get(dst);
    if (!cA || !cB) return;
    const ctrl: Vec3 = [
      (A[0] + B[0]) * CHORD_CTRL_TOWARD_CENTRE,
      (A[1] + B[1]) * CHORD_CTRL_TOWARD_CENTRE,
      (A[2] + B[2]) * CHORD_CTRL_TOWARD_CENTRE,
    ];
    const pts: [number, number, number, number][] = [];
    let ylo = Infinity;
    let yhi = -Infinity;
    for (let k = 0; k <= CHORD_SEGMENTS; k++) {
      const t = k / CHORD_SEGMENTS;
      const mt = 1 - t;
      const x = mt * mt * A[0] + 2 * mt * t * ctrl[0] + t * t * B[0];
      const y = mt * mt * A[1] + 2 * mt * t * ctrl[1] + t * t * B[1];
      const z = mt * mt * A[2] + 2 * mt * t * ctrl[2] + t * t * B[2];
      pts.push([x, y, z, t]);
      if (y < ylo) ylo = y;
      if (y > yhi) yhi = y;
    }
    chords.push({ pts, ylo, yhi, cA, cB, seed: idx * 12.9898 });
  });

  return { chords };
};

// ── Frame parameters (external to the renderer; the mount owns them) ──
export interface FrameParams {
  readonly now: number; // performance.now()
  readonly phase: number; // half-cycles; % 2 gives the triangle wave
  readonly brightness: number; // 0..1 from the Kosmos brightness knob
  readonly showThreads: boolean;
  readonly reduced: boolean; // prefers-reduced-motion respected
}

// ── Per-frame paint ────────────────────────────────────────────────
export const renderFrame = (
  ctx: CanvasRenderingContext2D,
  geo: Geometry,
  palette: KosmosPalette,
  W: number,
  H: number,
  dpr: number,
  params: FrameParams,
): void => {
  // Reduced-motion path: freeze on the core frame (fullest slice,
  // fully lit) rather than an arbitrary phase-at-load-time. Ceremony
  // decisions in the veil moment still apply — brightness still
  // modulates.
  const p = params.reduced
    ? 0.5
    : (() => {
        const tri = params.phase % 2;
        return tri < 1 ? tri : 2 - tri;
      })();
  const eased = 0.5 - 0.5 * Math.cos(p * Math.PI); // dwell at the poles
  const depth = SPHERE_RADIUS - eased * 2 * SPHERE_RADIUS;
  const rr = Math.sqrt(
    Math.max(0, SPHERE_RADIUS * SPHERE_RADIUS - depth * depth),
  );

  const scale = (Math.min(W, H) * 0.44) / SPHERE_RADIUS;
  const cx = W * 0.5;
  const cy = H * 0.5;
  const lum = Math.pow(Math.sin(p * Math.PI), 0.8); // 0 at poles → 1 mid

  // Alpha ceiling floats with the brightness knob. At rest the layer
  // sits at PEAK_ALPHA_CEILING (barely visible). Full reveal lifts it
  // by REVEAL_GAIN.
  const ceiling = PEAK_ALPHA_CEILING * (1 + params.brightness * REVEAL_GAIN);

  // Base: paint the void, then switch to additive for the stars.
  const [vr, vg, vb] = palette.void;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = `rgb(${vr},${vg},${vb})`;
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter';

  // Section horizon: a barely-visible ring at the sweep-plane's
  // projected radius. Alpha rises with luminance so it fades near
  // the poles alongside the stars.
  const [hr, hg, hb] = palette.horizon;
  ctx.strokeStyle = `rgba(${hr},${hg},${hb},${(0.018 + 0.03 * lum).toFixed(3)})`;
  ctx.lineWidth = 1 * dpr;
  ctx.beginPath();
  ctx.arc(cx, cy, rr * scale, 0, Math.PI * 2);
  ctx.stroke();

  // Gather visible chord crossings.
  const stars: Star[] = [];
  for (const ch of geo.chords) {
    if (depth <= ch.ylo || depth >= ch.yhi) continue;

    const spanU = (depth - ch.ylo) / Math.max(1e-3, ch.yhi - ch.ylo);
    const env =
      smoothstep(0, FADE_FRACTION, spanU) *
      (1 - smoothstep(1 - FADE_FRACTION, 1, spanU));
    if (env < 0.02) continue;

    const twk =
      0.82 + SHIMMER_AMPLITUDE * Math.sin(params.now * 0.00022 + ch.seed);

    for (let k = 0; k < CHORD_SEGMENTS; k++) {
      const P0 = ch.pts[k];
      const P1 = ch.pts[k + 1];
      if (!P0 || !P1) continue;
      const y0 = P0[1] - depth;
      const y1 = P1[1] - depth;
      if (y0 === 0 || y0 * y1 > 0) continue; // no crossing in this segment
      const tSeg = y0 / (y0 - y1);
      const sx = cx + (P0[0] + (P1[0] - P0[0]) * tSeg) * scale;
      const sy = cy + (P0[2] + (P1[2] - P0[2]) * tSeg) * scale;
      const tt = P0[3] + (P1[3] - P0[3]) * tSeg;
      stars.push({
        sx,
        sy,
        r: ch.cA[0] + (ch.cB[0] - ch.cA[0]) * tt,
        g: ch.cA[1] + (ch.cB[1] - ch.cA[1]) * tt,
        b: ch.cA[2] + (ch.cB[2] - ch.cA[2]) * tt,
        a: env * lum * twk,
      });
    }
  }

  // Threads: suggestion-of-constellation, capped and whisper-faint.
  if (params.showThreads) {
    const maxD = THREAD_MAX_DIST_PX * dpr;
    const maxD2 = maxD * maxD;
    const [tr, tg, tb] = palette.thread;
    ctx.lineWidth = 0.6 * dpr;
    for (let i = 0; i < stars.length; i++) {
      const si = stars[i];
      if (!si) continue;
      let links = 0;
      for (
        let j = i + 1;
        j < stars.length && links < THREAD_MAX_LINKS_PER_STAR;
        j++
      ) {
        const sj = stars[j];
        if (!sj) continue;
        const dx = si.sx - sj.sx;
        const dy = si.sy - sj.sy;
        const d2 = dx * dx + dy * dy;
        if (d2 >= maxD2) continue;
        const a =
          (1 - Math.sqrt(d2) / maxD) *
          THREAD_ALPHA_SCALE *
          Math.min(si.a, sj.a) *
          (1 + params.brightness);
        if (a < 0.004) continue;
        ctx.strokeStyle = `rgba(${tr},${tg},${tb},${a.toFixed(4)})`;
        ctx.beginPath();
        ctx.moveTo(si.sx, si.sy);
        ctx.lineTo(sj.sx, sj.sy);
        ctx.stroke();
        links++;
      }
    }
  }

  // The stars themselves: tiny soft glow + a slightly warmer core.
  // Peak alpha is a ceiling, not a target — most points paint dimmer.
  for (const s of stars) {
    const a = s.a * ceiling;
    if (a < 0.01) continue;
    const rad = (0.45 + 0.7 * s.a) * dpr;
    const cr = s.r | 0;
    const cg = s.g | 0;
    const cb = s.b | 0;
    const glow = ctx.createRadialGradient(s.sx, s.sy, 0, s.sx, s.sy, rad * 2.6);
    glow.addColorStop(0, `rgba(${cr},${cg},${cb},${a.toFixed(4)})`);
    glow.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(s.sx, s.sy, rad * 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(${Math.min(255, cr + 40)},${Math.min(255, cg + 40)},${Math.min(255, cb + 55)},${(a * 0.9).toFixed(4)})`;
    ctx.beginPath();
    ctx.arc(s.sx, s.sy, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  // Vignette: keep the corners dark so chrome and feed text always win.
  ctx.globalCompositeOperation = 'source-over';
  const vig = ctx.createRadialGradient(
    cx,
    cy,
    Math.min(W, H) * VIGNETTE_INNER,
    cx,
    cy,
    Math.max(W, H) * VIGNETTE_OUTER,
  );
  vig.addColorStop(0, `rgba(${vr},${vg},${vb},0)`);
  vig.addColorStop(1, `rgba(${vr},${vg},${vb},${VIGNETTE_ALPHA})`);
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
};
