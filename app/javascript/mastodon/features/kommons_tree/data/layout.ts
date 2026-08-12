// The Kommons Directory tree model — pure functions, no React, no DOM.
//
// `buildTree` derives the tree of Kronk's pages from the node registry: nodes
// know only their bucket and parent korner, and the tree is assembled from
// that, so adding a korner or a page changes the tree without anyone authoring
// a position. The Lattice view (kommons_lattice) consumes this Tree and lays it
// out spatially; this module owns only the structure.

import type { KommonsNode } from './nodes';
import { bucketNodes, listKorners } from './nodes';

export const ROOT_ID = 'root';

// The top-level buckets, in canonical order. This drives the order branches
// are laid out in, so it stays stable rather than shuffling per render.
//
// This list must agree with `Kronk::NodeRegistry::BUCKETS` on the Ruby side;
// `layout.test.ts` asserts it. Deriving the limbs from the manifests instead
// is the point of docs/rebuild/decisions.md's one-mechanism decision.
export const LIMBS = [
  'hub',
  'nudges',
  'feed',
  'profile',
  'settings',
  'kronk',
] as const;
export type Limb = (typeof LIMBS)[number];

export interface MapNode {
  id: string;
  label: string;
  parent?: string;
  kids: string[];
  url?: string;
  lifecycle?: string;
  count: number;
  // The slug of the korner this node IS (set on `korner:<slug>` nodes).
  korner?: string;
  // The slug of the space to open when this node is clicked, for pillars that
  // are a space in their own right (feed/profile/nudges/settings). Distinct
  // from `korner` so it doesn't make a pillar look like a Hub tenant.
  space?: string;
}

export type Tree = Record<string, MapNode>;

// ── Tree assembly ──────────────────────────────────────────────────────────
//
// Kronk's registry has no coordinates and no explicit root — nodes know only
// their bucket and parent korner. The tree is derived from that, so adding a
// korner or a page changes the tree without anyone authoring a position.

export const buildTree = (nodes: KommonsNode[]): Tree => {
  const tree: Tree = {};
  const add = (n: MapNode) => {
    tree[n.id] = n;
  };

  add({ id: ROOT_ID, label: 'Kronk', kids: [...LIMBS], count: 0 });

  // These pillars are a space in their own right: clicking them opens a Space
  // page rather than drilling into internal pages. Hub is excluded (it contains
  // the korners — navigating would hide them); Kronk is excluded (org markdown
  // space, no manifest to drive a Space page yet).
  const SPACE_LIMBS = new Set(['feed', 'profile', 'nudges', 'settings']);
  for (const limb of LIMBS) {
    add({
      id: limb,
      label: limbLabel(limb),
      parent: ROOT_ID,
      kids: [],
      count: 0,
      space: SPACE_LIMBS.has(limb) ? limb : undefined,
    });
  }

  // feed/profile/nudges/settings hold their pages directly — but a page may
  // declare a `parent` that is another node in the same bucket (the settings.*
  // pages nest under `settings.root`), forming a sub-branch instead of piling up
  // flat under the limb. (hub is the general case of this: korners hold pages.)
  // Two passes — create every node, then wire each under its parent, falling
  // back to the limb when the parent isn't a node in this bucket.
  for (const limb of [
    'feed',
    'profile',
    'nudges',
    'settings',
    'kronk',
  ] as const) {
    const inBucket = bucketNodes(nodes, limb);
    for (const n of inBucket) {
      add({
        id: n.id,
        label: n.label,
        parent: limb,
        kids: [],
        url: n.url,
        lifecycle: n.lifecycle,
        count: n.openProposals,
      });
    }
    for (const n of inBucket) {
      const node = tree[n.id];
      if (!node) continue;
      const parentId = n.parent && tree[n.parent] ? n.parent : limb;
      node.parent = parentId;
      tree[parentId]?.kids.push(n.id);
    }
  }

  // Anatomy: the Hub arm holds korners. Fingers are real, navigable pages —
  // parameterised routes (…/:id) are internal templates, not fingers. A korner
  // with one Finger stays a Finger itself (clicking opens its Space page); a
  // korner with several Fingers becomes a Hand that holds them and expands
  // (e.g. Kommons → Proposals / Directory / Proposer).
  for (const korner of listKorners(nodes)) {
    const kornerId = `korner:${korner.slug}`;
    const fingers = bucketNodes(nodes, 'hub', korner.slug).filter(
      (n) => n.url && !n.url.includes(':'),
    );
    const isHand = fingers.length > 1;
    add({
      id: kornerId,
      label: korner.label,
      parent: 'hub',
      kids: [],
      count: korner.openProposals,
      // A Hand has no destination of its own — it expands to its Fingers. A
      // single-page korner is a Finger that opens its Space page.
      korner: isHand ? undefined : korner.slug,
    });
    tree.hub?.kids.push(kornerId);

    if (isHand) {
      for (const n of fingers) {
        add({
          id: n.id,
          label: n.label,
          parent: kornerId,
          kids: [],
          url: n.url,
          lifecycle: n.lifecycle,
          count: n.openProposals,
        });
        tree[kornerId]?.kids.push(n.id);
      }
    }
  }

  // Hub's own pages (the grid, its settings) hang off the limb directly.
  for (const n of nodes.filter((x) => x.bucket === 'hub' && !x.parent)) {
    add({
      id: n.id,
      label: n.label,
      parent: 'hub',
      kids: [],
      url: n.url,
      lifecycle: n.lifecycle,
      count: n.openProposals,
    });
    tree.hub?.kids.push(n.id);
  }

  // Hub is the biggest bucket in the tree — every korner plus Hub's own
  // pages. Alphabetise its kids so users can find one by name (before
  // this the order was manifest-registration order, which meant nothing
  // to a caller). Applied here rather than at layout time because it
  // affects any consumer of the tree, not just the Lattice.
  const hubKids = tree.hub?.kids;
  if (hubKids) {
    hubKids.sort((a, b) => {
      const la = tree[a]?.label ?? a;
      const lb = tree[b]?.label ?? b;
      return la.localeCompare(lb, undefined, { sensitivity: 'base' });
    });
  }

  rollUp(tree, ROOT_ID);
  return tree;
};

const LIMB_LABEL: Record<Limb, string> = {
  feed: 'Feed',
  profile: 'Profile',
  nudges: 'Nudges',
  hub: 'Hub',
  settings: 'Settings',
  kronk: 'Kronk',
};

// A record rather than a ternary chain: the chain's final branch was an
// unconditional 'Hub', so adding a limb silently labelled it Hub instead of
// failing. A Record<Limb, string> cannot compile with a limb missing.
const limbLabel = (limb: Limb) => LIMB_LABEL[limb];

// A branch's badge is the sum of its subtree, so density of conversation is
// visible across the whole tree without drilling in.
const rollUp = (tree: Tree, id: string): number => {
  const n = tree[id];
  if (!n) return 0;
  if (n.kids.length === 0) return n.count;
  n.count = n.kids.reduce((a, k) => a + rollUp(tree, k), 0);
  return n.count;
};
