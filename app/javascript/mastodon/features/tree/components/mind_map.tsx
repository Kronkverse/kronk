import { useMemo } from 'react';

import type { TreeNode } from '../types';
import { childrenOf, branchColorFor, ideaDescendantCount } from '../helpers';

// Layout constants — tuned to feel like the prototype at typical column width.
const NODE_W = 148;
const NODE_H = 40;
const H_GAP = 48;  // horizontal gap between depth columns
const V_GAP = 14;  // vertical gap between sibling rows
const PADDING = 24;

interface Positioned {
  node: TreeNode;
  depth: number;
  x: number;
  y: number;
}

interface LayoutResult {
  positioned: Positioned[];
  width: number;
  height: number;
  byId: Record<string, Positioned>;
}

// "Tidy" tree layout — depth on x, subtree centering on y. Leaf slots are
// assigned in DFS order at V_GAP spacing. Parent y = midpoint of its
// children. Skips the synthetic root so top branches sit at depth 0.
function layoutTree(nodes: TreeNode[]): LayoutResult {
  const rootChildren = childrenOf(nodes, null);
  if (rootChildren.length === 0) {
    return { positioned: [], width: 0, height: 0, byId: {} };
  }

  const root = rootChildren[0];
  if (!root) {
    return { positioned: [], width: 0, height: 0, byId: {} };
  }

  const positioned: Positioned[] = [];
  const byId: Record<string, Positioned> = {};
  let leafCursor = 0;

  const walk = (nodeId: string, depth: number): number => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return leafCursor * (NODE_H + V_GAP) + NODE_H / 2;

    const kids = childrenOf(nodes, nodeId);
    let y: number;

    if (kids.length === 0) {
      y = leafCursor * (NODE_H + V_GAP) + NODE_H / 2;
      leafCursor += 1;
    } else {
      const kidYs = kids.map((k) => walk(k.id, depth + 1));
      const first = kidYs[0];
      const last = kidYs[kidYs.length - 1];
      y = ((first ?? 0) + (last ?? 0)) / 2;
    }

    const p: Positioned = {
      node,
      depth,
      x: depth * (NODE_W + H_GAP) + NODE_W / 2,
      y,
    };
    positioned.push(p);
    byId[node.id] = p;
    return y;
  };

  // Start from each top branch (children of the synthetic root), keeping
  // depth aligned so all top branches sit on the same column.
  const topBranches = childrenOf(nodes, root.id);
  topBranches.forEach((tb) => {
    walk(tb.id, 0);
  });

  const width =
    topBranches.length === 0 ? 0 : (positioned.reduce((m, p) => Math.max(m, p.x), 0) + NODE_W / 2);
  const height = leafCursor * (NODE_H + V_GAP);

  return { positioned, width, height, byId };
}

interface Props {
  nodes: TreeNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export const MindMap: React.FC<Props> = ({ nodes, selectedId, onSelect }) => {
  const layout = useMemo(() => layoutTree(nodes), [nodes]);

  if (layout.positioned.length === 0) {
    return null;
  }

  const svgW = layout.width + PADDING * 2;
  const svgH = layout.height + PADDING * 2;

  // Connectors — one per non-top node linking to its parent.
  const connectors = layout.positioned.flatMap((p) => {
    const parent = p.node.parent_id ? layout.byId[p.node.parent_id] : null;
    if (!parent) return [];

    const x1 = parent.x + NODE_W / 2 + PADDING;
    const y1 = parent.y + PADDING;
    const x2 = p.x - NODE_W / 2 + PADDING;
    const y2 = p.y + PADDING;
    const mx = (x1 + x2) / 2;
    const d = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;

    return [
      <path
        key={`c-${p.node.id}`}
        d={d}
        className='tree-mindmap__link'
        fill='none'
      />,
    ];
  });

  return (
    <div className='tree-mindmap'>
      <svg
        className='tree-mindmap__svg'
        viewBox={`0 0 ${svgW} ${svgH}`}
        width={svgW}
        height={svgH}
        role='tree'
        aria-label='Tree mind map'
      >
        {connectors}

        {layout.positioned.map((p) => {
          const isSelected = p.node.id === selectedId;
          const color = branchColorFor(nodes, p.node);
          const isLeafLayer =
            p.node.kind === 'layer' &&
            childrenOf(nodes, p.node.id).every((c) => c.kind === 'idea');
          const ideas = ideaDescendantCount(nodes, p.node.id);

          return (
            <g
              key={p.node.id}
              className={`tree-mindmap__node tree-mindmap__node--${p.node.kind}${isSelected ? ' tree-mindmap__node--selected' : ''}`}
              transform={`translate(${p.x - NODE_W / 2 + PADDING}, ${p.y - NODE_H / 2 + PADDING})`}
              onClick={() => {
                onSelect(p.node.id);
              }}
            >
              <rect
                x={0}
                y={0}
                width={NODE_W}
                height={NODE_H}
                rx={4}
                className='tree-mindmap__box'
                style={{ stroke: color }}
              />
              <text
                x={NODE_W / 2}
                y={NODE_H / 2 + 4}
                className='tree-mindmap__label'
                textAnchor='middle'
              >
                {p.node.name.length > 18
                  ? `${p.node.name.slice(0, 17)}…`
                  : p.node.name}
              </text>
              {p.node.kind === 'layer' && isLeafLayer && ideas > 0 && (
                <text
                  x={NODE_W - 6}
                  y={12}
                  className='tree-mindmap__badge'
                  textAnchor='end'
                >
                  {ideas}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};
