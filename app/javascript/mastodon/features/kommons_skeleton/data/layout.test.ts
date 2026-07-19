import { describe, expect, it } from 'vitest';

import type { KommonsNode } from './nodes';
import { buildTree, buildWires, layoutTree } from './layout';

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
