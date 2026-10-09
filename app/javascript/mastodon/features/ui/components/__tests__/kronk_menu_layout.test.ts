import { layoutMoons, moonPosition } from '../kronk_menu_layout';

const MOON = 46;
const EDGE = 12;
const BTN = 56;

const viewports = [
  { name: 'small phone', vw: 360, vh: 640 },
  { name: 'phone', vw: 390, vh: 844 },
  { name: 'tablet', vw: 768, vh: 1024 },
  { name: 'desktop', vw: 1440, vh: 900 },
];

// Where the Ж can sit: snapped to either side edge, anywhere vertically.
const positions = (vw: number, vh: number) => {
  const left = EDGE + BTN / 2;
  const right = vw - EDGE - BTN / 2;
  const top = EDGE + BTN / 2;
  const bottom = vh - EDGE - BTN / 2;
  const middle = vh / 2;
  return [
    { name: 'top-left corner', cx: left, cy: top, preferred: 140 },
    { name: 'top-right corner', cx: right, cy: top, preferred: 220 },
    { name: 'bottom-left corner', cx: left, cy: bottom, preferred: 70 },
    { name: 'bottom-right corner', cx: right, cy: bottom, preferred: 290 },
    { name: 'mid left edge', cx: left, cy: middle, preferred: 70 },
    { name: 'mid right edge', cx: right, cy: middle, preferred: 290 },
    { name: 'just under the top, left', cx: left, cy: top + 40, preferred: 140 },
    { name: 'just above the bottom, right', cx: right, cy: bottom - 40, preferred: 290 },
  ];
};

describe('layoutMoons', () => {
  for (const { name: vName, vw, vh } of viewports) {
    for (const { name: pName, cx, cy, preferred } of positions(vw, vh)) {
      for (let count = 3; count <= 7; count++) {
        it(`keeps ${count} moons on screen: ${vName}, ${pName}`, () => {
          const moons = layoutMoons({
            cx,
            cy,
            vw,
            vh,
            count,
            preferredCentre: preferred,
            moonSize: MOON,
            edge: EDGE,
          });

          expect(moons).toHaveLength(count);
          for (const m of moons) {
            const { x, y } = moonPosition(cx, cy, m.centre + m.delta, m.radius);
            expect(x - MOON / 2).toBeGreaterThanOrEqual(EDGE - 0.5);
            expect(x + MOON / 2).toBeLessThanOrEqual(vw - EDGE + 0.5);
            expect(y - MOON / 2).toBeGreaterThanOrEqual(EDGE - 0.5);
            expect(y + MOON / 2).toBeLessThanOrEqual(vh - EDGE + 0.5);
          }
        });
      }
    }
  }

  it('keeps the corner preference and original spacing when it fits', () => {
    const moons = layoutMoons({
      cx: 1440 - 40,
      cy: 900 - 40,
      vw: 1440,
      vh: 900,
      count: 3,
      preferredCentre: 290,
    });

    expect(moons.map((m) => m.centre)).toEqual([290, 290, 290]);
    expect(moons.map((m) => m.delta)).toEqual([-50, 0, 50]);
    expect(moons.every((m) => m.radius === 88)).toBe(true);
  });

  it('never lets neighbouring moons overlap on a fan', () => {
    const moons = layoutMoons({
      cx: 40,
      cy: 320,
      vw: 360,
      vh: 640,
      count: 7,
      preferredCentre: 70,
    });

    for (let i = 1; i < moons.length; i++) {
      const a = moons[i - 1];
      const b = moons[i];
      if (!a || !b) continue;
      const pa = moonPosition(40, 320, a.centre + a.delta, a.radius);
      const pb = moonPosition(40, 320, b.centre + b.delta, b.radius);
      expect(Math.hypot(pa.x - pb.x, pa.y - pb.y)).toBeGreaterThanOrEqual(MOON);
    }
  });

  it('returns nothing for no moons', () => {
    expect(
      layoutMoons({ cx: 0, cy: 0, vw: 100, vh: 100, count: 0, preferredCentre: 0 }),
    ).toEqual([]);
  });
});
