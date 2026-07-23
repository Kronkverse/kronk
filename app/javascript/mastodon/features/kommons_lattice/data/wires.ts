// Lattice connectors — orthogonal elbows (spec §2).
//
// Stroked, uniform-width right angles with a fixed corner radius. One wire per
// open parent → visible child. A wire is `on` when both ends sit on the active
// path.

import type { Tree } from '../../kommons_tree/data/layout';

import type { LatticeLayout, LatticePos } from './layout';
import { COL_GAP, COL_W, ROW_H } from './layout';

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
    for (const k of kids) {
      const p = pos[id];
      const c = pos[k];
      if (!p || !c) continue;
      wires.push({
        id: `${id}~${k}`,
        from: id,
        to: k,
        d: elbow(p, c),
        on: onPath.has(id) && onPath.has(k),
      });
    }
  }
  return wires;
};
