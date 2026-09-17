import { describe, expect, it } from 'vitest';

import { LIMBS, buildTree } from './layout';
import type { KommonsNode } from './nodes';
import { BUCKETS, bucketTotals } from './nodes';

// buildTree derives the Kommons Directory tree from the node registry. These
// pin the client half of the bucket contract and the tree-assembly rules; the
// Ruby half is `Kronk::NodeRegistry::BUCKETS`.

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

// The bucket list is duplicated across Ruby and TypeScript with nothing
// checking the two agree. When Ruby learned `nudges`, the tree did not: the
// nodes shipped over the API and were drawn nowhere, and `bucketTotals` wrote
// NaN into a key it had never declared — no error, no limb, no badge. These
// pin the client half; the Ruby half is `Kronk::NodeRegistry::BUCKETS`.
describe('buckets', () => {
  it('has a limb for every bucket', () => {
    expect([...LIMBS].sort()).toEqual([...BUCKETS].sort());
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
