// Moon-fan layout for the Ж floating menu (kronk_menu.tsx).
//
// The Ж can be dragged anywhere along either side of the viewport and the
// number of moons varies by page (Post, page actions such as Edit, Propose,
// Search, Settings), so a fixed fan per corner could push moons past the
// viewport edge. This picks a fan that fits: it keeps the corner's
// preferred direction when that works, otherwise turns the fan toward the
// free space, tightens the spacing and, if it must, reaches further out.
// A corner holds about five moons on one arc; more than that (a page with
// Edit, Share and Invite as well as the usual four) split across two
// rings, the first moons on the inner one. As a last resort (a viewport
// too small for either) each moon is clamped inside the viewport on its
// own, and may overlap its neighbours.
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
const CENTRE_STEP = 2;

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
}: MoonLayoutInput): MoonPlacement[] => {
  if (count <= 0) return [];

  const half = moonSize / 2;
  const minX = edge + half;
  const maxX = vw - edge - half;
  const minY = edge + half;
  const maxY = vh - edge - half;

  const fits = (
    centre: number,
    step: number,
    radius: number,
    n: number = count,
  ) => {
    const start = centre - ((n - 1) * step) / 2;
    for (let i = 0; i < n; i++) {
      const { x, y } = moonPosition(cx, cy, start + i * step, radius);
      if (x < minX || x > maxX || y < minY || y > maxY) return false;
    }
    return true;
  };

  const fan = (
    centre: number,
    step: number,
    radius: number,
    n: number = count,
  ) => {
    const start = centre - ((n - 1) * step) / 2;
    return Array.from({ length: n }, (_, i) => ({
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

  // Smallest radius first (the fan stays compact), then the widest spacing
  // that fits, then the direction closest to the corner's preference.
  for (const radius of RADII) {
    const narrowest = Math.ceil(minStep(radius, moonSize));
    for (let step = MAX_STEP; step >= narrowest; step -= 2) {
      if (count === 1 && step !== MAX_STEP) break;
      for (const centre of centres) {
        if (fits(centre, step, radius)) {
          return fan(((centre % 360) + 360) % 360, step, radius);
        }
      }
    }
  }

  // Too many for one arc: an inner and an outer ring around the same
  // centre, far enough apart that the rings don't touch, each ring at the
  // widest spacing that fits. The inner ring is shorter, so it takes half
  // the moons at most, fewer if half won't fit on it.
  const widest = (centre: number, radius: number, n: number) => {
    if (n === 1) return fits(centre, MAX_STEP, radius, 1) ? MAX_STEP : null;
    const narrowest = Math.ceil(minStep(radius, moonSize));
    for (let step = MAX_STEP; step >= narrowest; step -= 2) {
      if (fits(centre, step, radius, n)) return step;
    }
    return null;
  };
  for (let inner = Math.floor(count / 2); inner > 0; inner--) {
    const outer = count - inner;
    for (const r1 of RADII) {
      for (const r2 of RADII) {
        if (r2 - r1 < moonSize + GAP) continue;
        for (const centre of centres) {
          const s1 = widest(centre, r1, inner);
          if (s1 === null) continue;
          const s2 = widest(centre, r2, outer);
          if (s2 === null) continue;
          const c = ((centre % 360) + 360) % 360;
          return [...fan(c, s1, r1, inner), ...fan(c, s2, r2, outer)];
        }
      }
    }
  }

  // Nothing fits as a fan: place the preferred fan, then pull each moon
  // inside the viewport and express it back as its own bearing + radius.
  const radius = RADII[0] ?? 88;
  const step = Math.ceil(minStep(radius, moonSize));
  return fan(preferredCentre, step, radius).map((m) => {
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
};
