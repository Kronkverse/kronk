// Per-frame paint logic for the Kosmos ambient layer. Geometry (sockets,
// chord curves, colour ramp) lives in orb_geometry.ts and is shared
// with the Kommunity Orb view — a mismatch would drift the background
// sky from the foreground orb, which must not happen.
//
// Design source of truth: docs/kronk_frame.md (Kosmos block) and
// KRONK_ORB_BACKGROUND_BRIEF.md — the ambient projection sweeps a
// horizontal plane through the shared 150-socket Fibonacci sphere,
// painting each chord crossing as a faint star coloured by the chord's
// local gradient. Cycle time is ~10 minutes crown→floor→crown
// (imperceptible by design). If the layer reads as a visualisation,
// it is too bright.

import {
  CHORD_SEGMENTS,
  SPHERE_RADIUS,
  buildOrbLayout,
  readOrbPalette,
} from './orb_geometry';
import type { OrbLayout, OrbPalette } from './orb_geometry';
import type { OrbData } from './use_mates_orb';

// Re-export what the mount component pulls from renderer today so the
// existing kronk_kosmos.tsx doesn't need to change import paths in
// this refactor.
export const readPalette = readOrbPalette;
export type KosmosPalette = OrbPalette;
export type Geometry = OrbLayout;
export const buildGeometry = (orb: OrbData, palette: KosmosPalette): Geometry =>
  buildOrbLayout(orb, palette);

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

// Legacy — kept only so kronk_kosmos.tsx's import doesn't break;
// the depth-sweep animation this drove has been retired in favour of
// a hub-anchored, slowly-rotating cross-section. Value is no longer
// consulted inside the renderer.
export const HALF_CYCLE_MS = 300_000;

// The section plane is now fixed at the graph's hub-Y (densest node)
// instead of sweeping crown→floor. Rotation replaces the sweep: the
// projected slice rotates around the viewport centre once every
// ROTATION_PERIOD_MS. Slow enough that it reads as ambient drift,
// not as motion — matches the brief's threshold-of-perception rule.
const ROTATION_PERIOD_MS = 600_000; // one full turn every ~10 minutes
// How much of the viewport the cross-section fills. The old value
// was 0.44 (a small disc); bumped so the starfield actually fills
// the page rather than crowding into the middle.
const SCALE_FRACTION = 0.85;

interface Star {
  sx: number;
  sy: number;
  r: number;
  g: number;
  b: number;
  a: number;
}

const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
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
  // Section anchor: fixed at the graph's hub-Y (the densest node's
  // vertical coordinate). Rich cross-section on-screen at all times
  // — no more sweeping through empty poles.
  const depth = geo.hubY;
  const rr = Math.sqrt(
    Math.max(0, SPHERE_RADIUS * SPHERE_RADIUS - depth * depth),
  );

  const scale = (Math.min(W, H) * SCALE_FRACTION) / SPHERE_RADIUS;
  const cx = W * 0.5;
  const cy = H * 0.5;
  // Full luminance always — no pole-fading to worry about with a
  // fixed hub-anchored plane.
  const lum = 1;

  // Rotation angle for this frame. Slow, monotonic; freezes on
  // prefers-reduced-motion so nothing drifts for viewers who opted
  // out of motion.
  const theta = params.reduced
    ? 0
    : (params.now / ROTATION_PERIOD_MS) * Math.PI * 2;
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);

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

  // Section horizon: a barely-visible ring at the plane's projected
  // radius. Doesn't need rotation — a circle is rotation-invariant.
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
      // 3D crossing point on the plane, then rotate its (x, z)
      // around the vertical axis by `theta` before projecting.
      const rawX = P0[0] + (P1[0] - P0[0]) * tSeg;
      const rawZ = P0[2] + (P1[2] - P0[2]) * tSeg;
      const rotX = rawX * cosT - rawZ * sinT;
      const rotZ = rawX * sinT + rawZ * cosT;
      const sx = cx + rotX * scale;
      const sy = cy + rotZ * scale;
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
