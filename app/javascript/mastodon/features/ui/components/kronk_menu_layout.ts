// Moon-fan layout for the Ж floating menu (kronk_menu.tsx).
//
// The Ж can be dragged anywhere along either side of the viewport and the
// number of moons varies by page (Post, page actions such as Edit, Share,
// Search, Settings), so a fixed fan per corner could push moons past the
// viewport edge. This picks a fan that fits: it keeps the corner's
// preferred direction when that works, otherwise turns the fan toward the
// free space, tightens the spacing and, if it must, reaches further out.
// When no single arc fits where the Ж is parked, the Ж steps in from the
// side wall (and the top or bottom edge, if it must), as far as it takes,
// and the moons fan around it there (Tal 2026-10-15: "move out from the
// side wall to create enough space for however many moons it needs"). It
// goes back when the menu closes. As a last resort (a viewport too small
// even for that) each moon is clamped inside the viewport on its own.
//
// Pure geometry, no DOM: easy to test for every position and moon count.

// Compass bearings, as in the SCSS: 0° = up, 90° = right, 180° = down.
export interface MoonPlacement {
  // Shared fan centre the spiral animation swings from.
  centre: number;
  // This moon's offset from the centre (signed, degrees).
  delta: number;
  // Distance from the Ж centre to the moon centre (px).
  radius: number;
}

export interface MoonLayout {
  moons: MoonPlacement[];
  // How far the Ж steps in from its side wall while open (px, signed:
  // positive is right and down). 0 when the moons fit where it is parked.
  dx: number;
  dy: number;
}

export interface MoonLayoutInput {
  // Centre of the Ж, in viewport px.
  cx: number;
  cy: number;
  // Viewport size.
  vw: number;
  vh: number;
  count: number;
  // The corner's preferred fan direction, used when it fits.
  preferredCentre: number;
  // Moon diameter and the gap kept clear of the viewport edge.
  moonSize?: number;
  edge?: number;
}

const DEFAULT_MOON = 46; // 2.9rem, see .kronk-menu__moon
const DEFAULT_EDGE = 12;
const GAP = 6; // px between neighbouring moons, at minimum
const MAX_STEP = 50; // the original spacing; never wider than this
const RADII = [88, 100, 112, 126, 142];
const CENTRE_STEP = 4;
const SHIFT_STEP = 16; // px the Ж steps in at a time while looking for room

const rad = (deg: number) => (deg * Math.PI) / 180;

const norm180 = (deg: number) => {
  const d = (((deg + 180) % 360) + 360) % 360;
  return d - 180;
};

export const moonPosition = (
  cx: number,
  cy: number,
  bearing: number,
  radius: number,
) => ({
  x: cx + radius * Math.sin(rad(bearing)),
  y: cy - radius * Math.cos(rad(bearing)),
});

// Narrowest spacing at which neighbouring moons at `radius` don't touch.
const minStep = (radius: number, moonSize: number) =>
  (2 * Math.asin(Math.min(1, (moonSize + GAP) / (2 * radius))) * 180) / Math.PI;

export const layoutMoons = ({
  cx,
  cy,
  vw,
  vh,
  count,
  preferredCentre,
  moonSize = DEFAULT_MOON,
  edge = DEFAULT_EDGE,
}: MoonLayoutInput): MoonLayout => {
  if (count <= 0) return { moons: [], dx: 0, dy: 0 };

  const half = moonSize / 2;
  const minX = edge + half;
  const maxX = vw - edge - half;
  const minY = edge + half;
  const maxY = vh - edge - half;

  const fits = (
    x0: number,
    y0: number,
    centre: number,
    step: number,
    radius: number,
  ) => {
    const start = centre - ((count - 1) * step) / 2;
    for (let i = 0; i < count; i++) {
      const { x, y } = moonPosition(x0, y0, start + i * step, radius);
      if (x < minX || x > maxX || y < minY || y > maxY) return false;
    }
    return true;
  };

  const fan = (centre: number, step: number, radius: number) => {
    const start = centre - ((count - 1) * step) / 2;
    return Array.from({ length: count }, (_, i) => ({
      centre,
      delta: start + i * step - centre,
      radius,
    }));
  };

  // Centres to try, nearest to the preferred direction first.
  const centres: number[] = [preferredCentre];
  for (let off = CENTRE_STEP; off <= 180; off += CENTRE_STEP) {
    centres.push(preferredCentre + off, preferredCentre - off);
  }

  // One arc around the Ж at (x0, y0): smallest radius first (the fan stays
  // compact), then the widest spacing that fits, then the direction
  // closest to the corner's preference.
  const arcAt = (x0: number, y0: number): MoonPlacement[] | null => {
    for (const radius of RADII) {
      const narrowest = Math.ceil(minStep(radius, moonSize));
      for (let step = MAX_STEP; step >= narrowest; step -= 2) {
        if (count === 1 && step !== MAX_STEP) break;
        // Off the wall a fan can go nearly all the way round: keep its
        // two ends apart as well.
        if (count > 1 && 360 - (count - 1) * step < narrowest) continue;
        for (const centre of centres) {
          if (fits(x0, y0, centre, step, radius)) {
            return fan(((centre % 360) + 360) % 360, step, radius);
          }
        }
      }
    }
    return null;
  };

  // Where it is parked first, then a step at a time in from the side wall,
  // toward the middle of the screen. Off the wall the moons can go most of
  // the way round; if a top or bottom edge still cuts the circle (lots of
  // moons, a small phone), it steps away from that edge too.
  const inX = cx <= vw / 2 ? 1 : -1;
  const inY = cy <= vh / 2 ? 1 : -1;
  const roomX = Math.abs(vw / 2 - cx);
  const roomY = Math.abs(vh / 2 - cy);
  const room = Math.max(roomX, roomY);
  for (let shift = 0; shift <= room; shift += SHIFT_STEP) {
    const dx = inX * Math.min(shift, roomX) || 0; // never -0
    const sideways = arcAt(cx + dx, cy);
    if (sideways) return { moons: sideways, dx, dy: 0 };
    const dy = inY * Math.min(shift, roomY) || 0;
    const both = dy === 0 ? null : arcAt(cx + dx, cy + dy);
    if (both) return { moons: both, dx, dy };
  }

  // Nothing fits as a fan: place the preferred fan, then pull each moon
  // inside the viewport and express it back as its own bearing + radius.
  const radius = RADII[0] ?? 88;
  const step = Math.ceil(minStep(radius, moonSize));
  const moons = fan(preferredCentre, step, radius).map((m) => {
    const p = moonPosition(cx, cy, m.centre + m.delta, m.radius);
    const x = Math.min(maxX, Math.max(minX, p.x));
    const y = Math.min(maxY, Math.max(minY, p.y));
    const bearing = (Math.atan2(x - cx, cy - y) * 180) / Math.PI;
    return {
      centre: m.centre,
      delta: norm180(bearing - m.centre),
      radius: Math.hypot(x - cx, y - cy),
    };
  });
  return { moons, dx: 0, dy: 0 };
};
