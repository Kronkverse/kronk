import { describe, expect, it } from 'vitest';

import type { MapNode, Tree } from '../../kommons_tree/data/layout';

import { COL_PITCH, ROW_H, ROW_PITCH, layoutLattice } from './layout';

// The lattice's whole reason to exist is that it is predictable — every row on
// a grid pitch, every parent centred on its children. These pin the layout
// against the reference figures in the spec (KRONK_KOMMONS_LATTICE.md §1): at
// boot 4 rows; Hub open → 18 rows, Hub at y 476, korners spanning 112–840; Hub
// + Booth → 24 rows across 4 columns. The tree here matches the prototype's
// shape (3 limbs, 14 korners, Booth with 6 pages) so the numbers are the spec's;
// the real view renders the live registry tree through the same function.

const KORNERS = [
  'kommons',
  'booth',
  'kalendar',
  'huddle',
  'market',
  'map',
  'seeds',
  'moments',
  'kuestions',
  'nudges',
  'tides',
  'albutts',
  'orbit',
  'groups',
]; // 14
const BOOTH_PAGES = [
  'booth.index',
  'booth.set',
  'booth.p2',
  'booth.p3',
  'booth.p4',
  'booth.p5',
]; // 6

const node = (id: string, kids: string[] = [], parent?: string): MapNode => ({
  id,
  label: id,
  parent,
  kids,
  count: 0,
});

const fixture = (): Tree => {
  const t: Tree = {};
  t.kronk = node('kronk', ['feed', 'profile', 'hub']);
  t.feed = node('feed', [], 'kronk');
  t.profile = node('profile', [], 'kronk');
  t.hub = node('hub', KORNERS, 'kronk');
  for (const k of KORNERS)
    t[k] = node(k, k === 'booth' ? BOOTH_PAGES : [], 'hub');
  for (const p of BOOTH_PAGES) t[p] = node(p, [], 'booth');
  return t;
};

describe('layoutLattice', () => {
  it('boots to the core and its limbs — 4 rows (1 + 3)', () => {
    const { pos } = layoutLattice(fixture(), new Set(['kronk']), 'kronk');

    expect(Object.keys(pos).sort()).toEqual([
      'feed',
      'hub',
      'kronk',
      'profile',
    ]);
    // Leaves stack on the pitch; Hub is closed at boot, so it is a leaf too.
    expect(pos.feed?.y).toBe(0);
    expect(pos.profile?.y).toBe(ROW_PITCH); // 56
    expect(pos.hub?.y).toBe(ROW_PITCH * 2); // 112
    // The core sits at the midpoint of its first and last visible child.
    expect(pos.kronk?.y).toBe(ROW_PITCH); // (0 + 112) / 2 = 56
    // Depth maps straight to a column.
    expect(pos.kronk?.x).toBe(0);
    expect(pos.feed?.x).toBe(COL_PITCH);
  });

  it('centres Hub on its korners — 18 rows, Hub at y 476, korners 112–840', () => {
    const { pos } = layoutLattice(
      fixture(),
      new Set(['kronk', 'hub']),
      'kronk',
    );

    expect(Object.keys(pos)).toHaveLength(18); // 1 core + 3 limbs + 14 korners
    const kornerYs = KORNERS.map((k) => pos[k]?.y ?? Number.NaN);
    expect(Math.min(...kornerYs)).toBe(112);
    expect(Math.max(...kornerYs)).toBe(840);
    expect(pos.hub?.y).toBe(476); // midpoint of 112..840
  });

  it('grows a fourth column when a korner opens — 24 rows across 4 columns', () => {
    const { pos } = layoutLattice(
      fixture(),
      new Set(['kronk', 'hub', 'booth']),
      'kronk',
    );

    expect(Object.keys(pos)).toHaveLength(24); // 18 + 6 Booth pages
    const depths = [...new Set(Object.values(pos).map((p) => p.depth))].sort(
      (a, b) => a - b,
    );
    expect(depths).toEqual([0, 1, 2, 3]);
  });

  // Hub kids overflow → two-column split (Tal 2026-08-12): once the
  // kid list crosses the split threshold, the block splits across two
  // adjacent columns so it doesn't force the viewport to zoom cards
  // down to unreadable. The right column sits at depth+3 (skipping
  // depth+2) so a Hand in the left half can still expand its Fingers
  // without colliding with the right column.
  it('splits Hub into two columns once the kid list is long enough', () => {
    const t: Tree = {};
    const kornerCount = 16; // > threshold
    const kornerIds = Array.from({ length: kornerCount }, (_, i) => `k${i}`);
    t.kronk = node('kronk', ['hub']);
    t.hub = node('hub', kornerIds, 'kronk');
    for (const k of kornerIds) t[k] = node(k, [], 'hub');
    const { pos } = layoutLattice(t, new Set(['kronk', 'hub']), 'kronk');

    // Two distinct depths for the kids — the standard depth+1 (=2) and
    // the skipped-column depth+3 (=4).
    const kidDepths = new Set(kornerIds.map((k) => pos[k]?.depth));
    expect(kidDepths).toEqual(new Set([2, 4]));

    const half = Math.ceil(kornerCount / 2);
    // Alphabetical (i.e. array-order for the synthetic ids) is preserved
    // column-major: first half is the left column, second half is the
    // right column.
    expect(pos.k0?.depth).toBe(2); // first kid → left
    expect(pos[kornerIds[half - 1] ?? '']?.depth).toBe(2); // last of first half → left
    expect(pos[kornerIds[half] ?? '']?.depth).toBe(4); // first of second half → right
    expect(pos[kornerIds[kornerCount - 1] ?? '']?.depth).toBe(4); // last kid → right

    // Both columns start at the same y and stack sequentially.
    expect(pos.k0?.y).toBe(0);
    expect(pos[kornerIds[half] ?? '']?.y).toBe(0);

    // Hub centres on the whole block (min y → max y of all kids).
    const kidYs = kornerIds.map((k) => pos[k]?.y ?? Number.NaN);
    expect(pos.hub?.y).toBe((Math.min(...kidYs) + Math.max(...kidYs)) / 2);
  });
});

describe('invariants', () => {
  const open = new Set(['kronk', 'hub', 'booth']);

  it('leaves no two rows in a column within ROW_H of each other', () => {
    const { pos } = layoutLattice(fixture(), open, 'kronk');

    const byColumn = new Map<number, number[]>();
    for (const p of Object.values(pos)) {
      const ys = byColumn.get(p.x) ?? [];
      ys.push(p.y);
      byColumn.set(p.x, ys);
    }

    let worst = Number.POSITIVE_INFINITY;
    for (const ys of byColumn.values()) {
      const sorted = [...ys].sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i++) {
        worst = Math.min(worst, (sorted[i] ?? 0) - (sorted[i - 1] ?? 0));
      }
    }
    expect(worst).toBeGreaterThanOrEqual(ROW_H);
  });

  it('sits every parent at the midpoint of its visible children', () => {
    const tree = fixture();
    const { pos } = layoutLattice(tree, open, 'kronk');

    for (const [id, p] of Object.entries(pos)) {
      const kids = open.has(id) ? (tree[id]?.kids ?? []) : [];
      if (kids.length === 0) continue;
      const ys = kids.map((k) => pos[k]?.y ?? 0);
      const midpoint = ((ys[0] ?? 0) + (ys[ys.length - 1] ?? 0)) / 2;
      expect(p.y, `parent ${id}`).toBeCloseTo(midpoint, 5);
    }
  });
});
