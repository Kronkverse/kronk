// Shared orb geometry — the sphere layout, chord curves, and colour
// ramp that both the ambient Kosmos background layer and the direct
// Kommunity view (KronkOrb, three.js) build on. Extracted so both
// renderers agree on socket positions, chord curves, and colour
// indexing — a mismatch would drift the background sky from the
// foreground orb, which is the one thing that must never happen.
//
// Source of truth: KRONK_ORB_DATA_BRIEF.md. Numeric constants match
// both the mockups (kronk-orb.html, kronk-orb-background.html) and
// the brief's construction section.

import type { OrbData } from './use_mates_orb';

// ── Sphere + chord constants ───────────────────────────────────────
export const SPHERE_RADIUS = 100;
export const SOCKET_COUNT = 150;
export const CHORD_SEGMENTS = 20;
export const RAMP_STOPS = 10;

export const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

// (A+B) * 0.26 ≡ midpoint × 0.52 — the control point pulled ~48%
// toward the sphere's core so every chord bows through the interior
// rather than cutting straight across.
export const CHORD_CTRL_TOWARD_CENTRE = 0.26;

// ── Types ──────────────────────────────────────────────────────────
export type Vec3 = readonly [number, number, number];
export type RGB = readonly [number, number, number];

export interface ChordCurve {
  readonly pts: readonly (readonly [number, number, number, number])[]; // x, y, z, t along [0,1]
  readonly ylo: number;
  readonly yhi: number;
  readonly cA: RGB;
  readonly cB: RGB;
  readonly seed: number;
}

export interface AccountPlacement {
  readonly id: string;
  readonly pos: Vec3;
  readonly col: RGB;
  readonly rampIdx: number;
  readonly connections: number;
}

export interface OrbLayout {
  readonly sockets: readonly Vec3[];
  readonly placements: readonly AccountPlacement[];
  readonly chords: readonly ChordCurve[];
  readonly maxConnections: number;
}

// ── Palette (reads --kosmos-* CSS custom properties) ───────────────
// The kosmos-* tokens carry the shared colour identity for both the
// ambient background and the direct Kommunity view. Kommunity uses
// `void` for its stage backdrop and `ramp` for node/chord colouring;
// Kosmos additionally uses `horizon` and `thread` for its sweep
// visuals. Reading via getComputedStyle keeps tokens.yaml as the
// single source of truth — palette shifts re-tint both views.
export interface OrbPalette {
  readonly ramp: readonly RGB[];
  readonly void: RGB;
  readonly horizon: RGB;
  readonly thread: RGB;
}

const hexToRgb = (hex: string): RGB => {
  const h = hex.trim().replace(/^#/, '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
};

export const readOrbPalette = (): OrbPalette => {
  const cs = getComputedStyle(document.documentElement);
  const read = (name: string): string => cs.getPropertyValue(name).trim();
  const ramp: RGB[] = [];
  for (let i = 0; i < RAMP_STOPS; i++) {
    ramp.push(hexToRgb(read(`--kosmos-ramp-${i}`) || '#38b2a3'));
  }
  return {
    ramp,
    void: hexToRgb(read('--kosmos-void') || '#0b0c11'),
    horizon: hexToRgb(read('--kosmos-horizon') || '#7241ff'),
    thread: hexToRgb(read('--kosmos-thread') || '#8c7cdc'),
  };
};

// ── Fibonacci sockets on the unit sphere, scaled by R ──────────────
export const computeSockets = (): Vec3[] => {
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
  return sockets;
};

// ── Assign accounts to sockets + pick their ramp colour ────────────
// Even-stride placement so occupied sockets spread across the whole
// sphere. Persisted per-account socket_index is a future upgrade
// (Orb brief §Open — position-as-identity).
export const buildOrbLayout = (
  orb: OrbData,
  palette: OrbPalette,
): OrbLayout => {
  const sockets = computeSockets();
  const accounts = orb.accounts.slice(0, SOCKET_COUNT);
  const maxConnections = accounts.reduce(
    (m, a) => (a.connections > m ? a.connections : m),
    1,
  );

  const stride = SOCKET_COUNT / accounts.length;
  const used = new Set<number>();
  const pos = new Map<string, Vec3>();
  const col = new Map<string, RGB>();
  const placements: AccountPlacement[] = [];

  accounts.forEach((acc, i) => {
    let s = Math.round(i * stride) % SOCKET_COUNT;
    while (used.has(s)) s = (s + 1) % SOCKET_COUNT;
    used.add(s);
    const socket = sockets[s];
    if (!socket) return;
    const rampIdx = Math.min(
      RAMP_STOPS - 1,
      Math.round(
        (Math.log(1 + acc.connections) / Math.log(1 + maxConnections)) *
          (RAMP_STOPS - 1),
      ),
    );
    const colour = palette.ramp[rampIdx];
    if (!colour) return;
    pos.set(acc.id, socket);
    col.set(acc.id, colour);
    placements.push({
      id: acc.id,
      pos: socket,
      col: colour,
      rampIdx,
      connections: acc.connections,
    });
  });

  // Quadratic bezier per follow, control pulled toward the core.
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

  return { sockets, placements, chords, maxConnections };
};
