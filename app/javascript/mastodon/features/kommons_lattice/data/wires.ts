// Lattice connectors — orthogonal elbows (spec §2).
//
// Stroked, uniform-width right angles with a fixed corner radius. One wire per
// open parent → visible child. A wire is `on` when both ends sit on the active
// path.

import type { Tree } from '../../kommons_tree/data/layout';

import type { LatticeLayout, LatticePos } from './layout';
import { COL_GAP, COL_PITCH, COL_W, ROW_H } from './layout';

export interface LatticeWire {
  id: string;
  from: string;
  to: string;
  d: string;
  on: boolean;
}

// From the parent's right edge to the child's left edge, turning at the
// horizontal midpoint of the column gap. The radius is clamped so closely
// stacked siblings don't produce corners that overshoot and read as wobble.
const elbow = (parent: LatticePos, child: LatticePos): string => {
  const x1 = parent.x + COL_W;
  const y1 = parent.y + ROW_H / 2;
  const x2 = child.x;
  const y2 = child.y + ROW_H / 2;

  // Degenerate to a straight line when nearly level — the quadratics collapse.
  if (Math.abs(y2 - y1) < 1) return `M ${x1},${y1} L ${x2},${y2}`;

  const mx = x1 + COL_GAP * 0.5;
  const r = Math.min(11, Math.abs(y2 - y1) / 2, COL_GAP * 0.4);
  const s = y2 > y1 ? 1 : -1;

  return (
    `M ${x1},${y1} L ${mx - r},${y1} Q ${mx},${y1} ${mx},${y1 + s * r} ` +
    `L ${mx},${y2 - s * r} Q ${mx},${y2} ${mx + r},${y2} L ${x2},${y2}`
  );
};

// Hub's split-column kids all share a single vertical trunk between the
// two card columns. Every wire exits Hub going right, meets the trunk,
// travels up or down along it, then branches horizontally — left toward
// the left-column card's right edge, or right toward the right-column
// card's left edge — so visually the trunk reads as a spine with cards
// fanning out on both sides. See `docs/spaces/kommons_lattice.md` §1
// (Hub two-column split) + §2.
const hubBranch = (
  parent: LatticePos,
  child: LatticePos,
  trunkX: number,
): string => {
  const x1 = parent.x + COL_W;
  const y1 = parent.y + ROW_H / 2;
  const y2 = child.y + ROW_H / 2;

  // Left column: connect to card's RIGHT edge (branch travels leftward
  // from the trunk into the card). Right column: connect to card's LEFT
  // edge (branch travels rightward from the trunk into the card).
  const isLeftColumn = child.x < trunkX;
  const x2 = isLeftColumn ? child.x + COL_W : child.x;

  // Nearly-level shortcut — the two vertical quadratics collapse.
  if (Math.abs(y2 - y1) < 1) return `M ${x1},${y1} L ${x2},${y2}`;

  const r = Math.min(11, Math.abs(y2 - y1) / 2, COL_GAP * 0.4);
  const s = y2 > y1 ? 1 : -1;
  // Direction of the final horizontal segment (left = -1, right = +1)
  // controls which side of the trunk the branch's exit corner rounds.
  const dir = isLeftColumn ? -1 : 1;

  return (
    `M ${x1},${y1} L ${trunkX - r},${y1} Q ${trunkX},${y1} ${trunkX},${y1 + s * r} ` +
    `L ${trunkX},${y2 - s * r} Q ${trunkX},${y2} ${trunkX + dir * r},${y2} ` +
    `L ${x2},${y2}`
  );
};

// Compute the trunk x for Hub's split-column layout: sits in the middle
// of the gap between the left column's right edge and the right column's
// left edge. Returns `undefined` when Hub isn't in split mode (only one
// column of kids), which tells `latticeWires` to fall back to the
// standard elbow.
const hubTrunkX = (
  parent: LatticePos,
  kids: string[],
  pos: LatticeLayout,
): number | undefined => {
  let nearRight = -Infinity;
  let farLeft = Infinity;
  for (const k of kids) {
    const p = pos[k];
    if (!p) continue;
    const dist = p.x - parent.x;
    if (dist <= COL_PITCH) nearRight = Math.max(nearRight, p.x + COL_W);
    else farLeft = Math.min(farLeft, p.x);
  }
  if (!Number.isFinite(nearRight) || !Number.isFinite(farLeft))
    return undefined;
  return (nearRight + farLeft) / 2;
};

export const latticeWires = (
  tree: Tree,
  pos: LatticeLayout,
  open: ReadonlySet<string>,
  onPath: ReadonlySet<string>,
): LatticeWire[] => {
  const wires: LatticeWire[] = [];
  for (const id of Object.keys(pos)) {
    if (!open.has(id)) continue; // a closed node shows no child wires
    const kids = tree[id]?.kids ?? [];
    const p = pos[id];
    if (!p) continue;

    // Hub with split-column kids gets the trunk-with-either-side routing;
    // any other parent uses the standard elbow.
    const trunkX = id === 'hub' ? hubTrunkX(p, kids, pos) : undefined;

    for (const k of kids) {
      const c = pos[k];
      if (!c) continue;
      wires.push({
        id: `${id}~${k}`,
        from: id,
        to: k,
        d: trunkX !== undefined ? hubBranch(p, c, trunkX) : elbow(p, c),
        on: onPath.has(id) && onPath.has(k),
      });
    }
  }
  return wires;
};
