import { describe, expect, it } from 'vitest';

import type { KommonsNode } from './nodes';
import { BUCKETS, bucketTotals } from './nodes';
import { LIMBS, buildTree, buildWires, layoutTree } from './layout';

// The map's one hard invariant: no two nodes may overlap.
//
// Layout is a fan plus a relaxation pass, so overlap is a property of the
// whole arrangement rather than of any one placement — there is no line of
// code to inspect. The failure mode is silent and visual: a korner lands on
// top of another and reads as one node. This is the guard that fires the
// moment someone adds a korner dense enough to break the packing.

const node = (
  id: string,
  bucket: KommonsNode['bucket'],
  parent?: string,
): KommonsNode => ({
  id,
  bucket,
  parent,
  label: id,
  url: `/${id}`,
  lifecycle: 'live',
  openProposals: 0,
});

// Deliberately heavier than the live registry: a korner with more pages than
// any real one, so the test fails before production does.
const fixture = (): KommonsNode[] => {
  const nodes: KommonsNode[] = [];
  for (let i = 0; i < 6; i++) nodes.push(node(`feed-${i}`, 'feed'));
  for (let i = 0; i < 7; i++) nodes.push(node(`profile-${i}`, 'profile'));
  const korners = [
    'kommons',
    'booth',
    'kalendar',
    'huddle',
    'marketplace',
    'kompass',
    'moments',
    'albutts',
    'kuestions',
    'inflow',
    'groups',
    'klot',
    'tides',
    'orbit',
  ];
  korners.forEach((slug, k) => {
    for (let i = 0; i < 5 + (k % 4); i++) {
      nodes.push(node(`${slug}-${i}`, 'hub', slug));
    }
  });
  return nodes;
};

const clearance = (
  a: { cx: number; cy: number; w: number; h: number },
  b: { cx: number; cy: number; w: number; h: number },
): number =>
  Math.max(
    Math.abs(a.cx - b.cx) - (a.w + b.w) / 2,
    Math.abs(a.cy - b.cy) - (a.h + b.h) / 2,
  );

// The bucket list is duplicated across Ruby and TypeScript with nothing
// checking the two agree. When Ruby learned `nudges`, the map did not: the
// nodes shipped over the API and were drawn nowhere, and `bucketTotals`
// wrote NaN into a key it had never declared — no error, no limb, no badge.
// These pin the client half; the Ruby half is `Kronk::NodeRegistry::BUCKETS`.
describe('buckets', () => {
  it('draws a limb for every bucket', () => {
    expect([...LIMBS].sort()).toEqual([...BUCKETS].sort());
  });

  it('spaces the limbs evenly around the core', () => {
    // Angles are derived from LIMBS' length, so this holds for any number of
    // spaces. It caught nothing when written — it exists because the previous
    // angles were hand-placed for three limbs, and adding a fourth left two
    // tight pairs and two wide gaps that only a person looking would notice.
    const tree = buildTree(fixture());
    const lay = layoutTree(tree);

    const angles = LIMBS.map((limb) => lay[limb]?.ang).filter(
      (a): a is number => typeof a === 'number',
    );
    expect(angles).toHaveLength(LIMBS.length);

    const sorted = [...angles].sort((a, b) => a - b);
    const gaps = sorted.map((a, i) =>
      i === 0 ? a + 360 - sorted[sorted.length - 1]! : a - sorted[i - 1]!,
    );

    for (const gap of gaps) {
      expect(gap).toBeCloseTo(360 / LIMBS.length, 5);
    }
  });

  it('counts every bucket without producing NaN', () => {
    const nodes = BUCKETS.map((bucket, i) => ({
      id: `n${i}`,
      bucket,
      label: bucket,
      url: `/${bucket}`,
      lifecycle: 'live' as const,
      openProposals: 2,
    }));

    const totals = bucketTotals(nodes);

    for (const bucket of BUCKETS) {
      expect(totals[bucket], `total for ${bucket}`).toBe(2);
    }
    expect(Object.values(totals).some(Number.isNaN)).toBe(false);
  });
});

describe('layoutTree', () => {
  it('places every node in the registry', () => {
    const nodes = fixture();
    const tree = buildTree(nodes);
    const lay = layoutTree(tree);

    expect(Object.keys(lay).sort()).toEqual(Object.keys(tree).sort());
  });

  it('leaves no two nodes overlapping', () => {
    const lay = layoutTree(buildTree(fixture()));
    const placed = Object.entries(lay);

    let worst = Infinity;
    let pair = '';
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const [aId, a] = placed[i]!;
        const [bId, b] = placed[j]!;
        const c = clearance(a, b);
        if (c < worst) {
          worst = c;
          pair = `${aId} / ${bId}`;
        }
      }
    }

    expect(worst, `closest pair: ${pair}`).toBeGreaterThanOrEqual(0);
  });

  it('draws one wire per linked pair, and none for absent targets', () => {
    const nodes = fixture();
    const [a, b] = nodes;

    // Declared from both ends, as the manifests often do, plus a link to a
    // node that is not on the map at all.
    a!.links = [
      { to: b!.id, kind: 'creates', description: 'a creates b' },
      { to: 'not-a-registered-node', kind: 'related', description: 'dangling' },
    ];
    b!.links = [{ to: a!.id, kind: 'listed_on', description: 'b lists a' }];

    const tree = buildTree(nodes);
    const wires = buildWires(tree, layoutTree(tree), nodes);

    // One wire, not two: a pair linked from both directions is still one
    // relationship, and drawing it twice doubles every line on the map.
    const between = wires.filter(
      (w) =>
        (w.from === a!.id && w.to === b!.id) ||
        (w.from === b!.id && w.to === a!.id),
    );
    expect(between).toHaveLength(1);

    // A link naming an unregistered node is skipped, not guessed at — it
    // would otherwise draw a wire to the world origin.
    expect(wires.some((w) => w.to === 'not-a-registered-node')).toBe(false);
  });

  it('is deterministic — the same registry lays out identically', () => {
    const nodes = fixture();
    const a = layoutTree(buildTree(nodes));
    const b = layoutTree(buildTree(nodes));

    // A map you can learn has to be the same map on every load and every
    // device. Any Math.random() in the layout fails here.
    expect(a).toEqual(b);
  });
});

// buildTree lets a page nest under another node in the *same* bucket, forming a
// sub-branch instead of piling up flat under the limb, and falls back to the
// limb when the named parent isn't present. No core space uses this today — the
// settings.* pages sit flat on the Settings limb — but the capability is general
// (hub is the specialised case of it: korners hold pages), so it is pinned here.
describe('intra-bucket nesting', () => {
  it('nests a node under a same-bucket parent rather than flat under the limb', () => {
    const nodes: KommonsNode[] = [
      node('feed.hub', 'feed'),
      node('feed.hub.a', 'feed', 'feed.hub'),
      node('feed.hub.b', 'feed', 'feed.hub'),
      node('feed.solo', 'feed'),
    ];
    const tree = buildTree(nodes);

    // The limb holds only the un-parented nodes.
    expect(tree.feed?.kids).toContain('feed.hub');
    expect(tree.feed?.kids).toContain('feed.solo');
    expect(tree.feed?.kids).not.toContain('feed.hub.a');

    // The children hang off their same-bucket parent.
    expect(tree['feed.hub']?.kids).toEqual(
      expect.arrayContaining(['feed.hub.a', 'feed.hub.b']),
    );
    expect(tree['feed.hub.a']?.parent).toBe('feed.hub');
  });

  it('falls back to the limb when the declared parent is absent from the bucket', () => {
    const nodes: KommonsNode[] = [node('feed.orphan', 'feed', 'nonexistent')];
    const tree = buildTree(nodes);

    expect(tree.feed?.kids).toContain('feed.orphan');
    expect(tree['feed.orphan']?.parent).toBe('feed');
  });
});
