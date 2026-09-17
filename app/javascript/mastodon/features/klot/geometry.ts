import type { Phase } from 'mastodon/api/klot';

// Ring geometry, ported from tides_prototype.html. Pure math; no DOM
// or React. The React ring component (see components/cycle_ring.tsx)
// uses these helpers to build SVG paths + moon positions.

export const CX = 170;
export const CY = 170;
export const R = 125;

export interface PhaseBand {
  key: Phase;
  a: number; // first day of the band (inclusive)
  b: number; // last day of the band (inclusive)
}

// Same math as Kronk::CyclePhase#phase_for — kept client-side so the
// ring can lay out its arcs before the API round-trip returns.
export const ranges = (
  cycleLength: number,
  periodLength: number,
): PhaseBand[] => {
  const ov = Math.max(periodLength + 3, cycleLength - 14);
  const a = ov - 1;
  const b = ov + 1;

  return [
    { key: 'menstrual', a: 1, b: periodLength },
    { key: 'follicular', a: periodLength + 1, b: a - 1 },
    { key: 'ovulatory', a, b },
    { key: 'luteal', a: b + 1, b: cycleLength },
  ];
};

// Convert a day (or fractional day) to an [x, y] point on the ring.
// day 0 lands at the top (12 o'clock) and progresses clockwise.
export const ptFor = (day: number, cycleLength: number): [number, number] => {
  const angleRad = ((-90 + (day / cycleLength) * 360) * Math.PI) / 180;
  return [CX + R * Math.cos(angleRad), CY + R * Math.sin(angleRad)];
};

export const arcPath = (
  t0: number,
  t1: number,
  cycleLength: number,
): string => {
  const [x0, y0] = ptFor(t0, cycleLength);
  const [x1, y1] = ptFor(t1, cycleLength);
  const large = (t1 - t0) / cycleLength > 0.5 ? 1 : 0;
  return `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${R} ${R} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
};

// Renders a small moon in the given phase shape. Returns an object the
// caller inlines into <svg> — a `<circle>` or a `<circle mask>` pair.
// `uid` disambiguates the mask when multiple moons render.
export const moonMarkup = (
  uid: string,
  cx: number,
  cy: number,
  r: number,
  phase: Phase,
): string => {
  if (phase === 'ovulatory') {
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="var(--klot-moon)"/>`;
  }
  if (phase === 'menstrual') {
    return (
      `<circle cx="${cx}" cy="${cy}" r="${r}" fill="var(--klot-moon)" fill-opacity="0.10"/>` +
      `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--klot-moon)" stroke-opacity="0.42" stroke-width="1.3"/>`
    );
  }
  // follicular = waxing (dark on the left); luteal = waning (dark on the right)
  const bx = cx + (phase === 'follicular' ? -1 : 1) * r * 0.55;
  return (
    `<mask id="${uid}"><circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff"/><circle cx="${bx}" cy="${cy}" r="${r}" fill="#000"/></mask>` +
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="var(--klot-moon)" mask="url(#${uid})"/>`
  );
};

// Canonical 28/5 ring used on the Circle view — friends are placed
// on this shape regardless of the caller's own cycle_length so
// friends' phases sit uniformly against the same lunar shape.
export const CANON_LENGTH = 28;
export const CANON_PERIOD = 5;
