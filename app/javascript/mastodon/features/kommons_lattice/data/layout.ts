// Lattice layout — a tidy lateral dendrogram.
//
// The Lattice lays out the Kommons Directory tree: the node ids and proposal
// store come from kommons_tree; this owns the spatial model. A mechanism you
// operate — structure is fixed and orthogonal, branches sprout on demand and
// fold away when you leave them.
//
// Spec: docs/spaces/ (KRONK_KOMMONS_LATTICE.md §1). Every constant here is
// lifted from that spec; where a token exists, the component uses the token.
//
// The `Tree` type is shared with kommons_tree — one source of truth for what
// exists. Imported as a type only, so this stays a pure function with no DOM or
// API dependencies and can be exercised in isolation.

import type { Tree } from '../../kommons_tree/data/layout';

// ── Grid constants (§1) ──────────────────────────────────────────────────────
export const ROW_H = 40;
export const ROW_GAP = 16;
export const ROW_PITCH = ROW_H + ROW_GAP; // 56 — leaves stack on this pitch
export const COL_W = 214;
export const COL_GAP = 76;
export const COL_PITCH = COL_W + COL_GAP; // 290 — depth maps to this x
export const PLANE_PAD = { x: 40, y: 40 };

export interface LatticePos {
  x: number;
  y: number;
  depth: number;
}
export type LatticeLayout = Record<string, LatticePos>;

export interface LatticePlacement {
  pos: LatticeLayout;
  // Content extent (before plane padding), for sizing the scrolling plane.
  width: number;
  height: number;
}

// A node's visible children: its kids only while it is open, otherwise none.
// This is the whole fold model — a closed node contributes just its own row,
// so the lattice is always one readable path plus its immediate options.
const visibleChildren = (
  tree: Tree,
  id: string,
  open: ReadonlySet<string>,
): string[] => (open.has(id) ? (tree[id]?.kids ?? []) : []);

// Classic tidy-tree over the *visible* subtree (§1). Recomputed on every
// open/fold — cheap, never cached. Leaves stack sequentially at ROW_PITCH; a
// parent sits at the midpoint of its first and last child's y. x is purely a
// function of depth, so every level is a clean column. This is what produces
// the characteristic look: Kronk centred on its limbs, Hub centred on its
// korners.
export const layoutLattice = (
  tree: Tree,
  open: ReadonlySet<string>,
  rootId: string,
): LatticePlacement => {
  const pos: LatticeLayout = {};
  let cursorY = 0;

  const walk = (id: string, depth: number): number => {
    const kids = visibleChildren(tree, id, open);
    if (kids.length === 0) {
      const y = cursorY;
      pos[id] = { x: depth * COL_PITCH, y, depth };
      cursorY += ROW_PITCH;
      return y;
    }
    const ys = kids.map((k) => walk(k, depth + 1));
    const first = ys[0] ?? 0;
    const last = ys[ys.length - 1] ?? first;
    const y = (first + last) / 2;
    pos[id] = { x: depth * COL_PITCH, y, depth };
    return y;
  };

  if (tree[rootId]) walk(rootId, 0);

  let width = 0;
  let height = 0;
  for (const p of Object.values(pos)) {
    width = Math.max(width, p.x + COL_W);
    height = Math.max(height, p.y + ROW_H);
  }
  return { pos, width, height };
};
