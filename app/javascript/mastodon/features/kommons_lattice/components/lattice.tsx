import { useCallback, useMemo, useState } from 'react';

import { Icon } from 'mastodon/components/icon';

import { ROOT_ID, buildTree } from '../../kommons_skeleton/data/layout';
import type { KommonsNode } from '../../kommons_skeleton/data/nodes';
import { latticeIcon } from '../data/icons';
import { COL_W, PLANE_PAD, ROW_H, layoutLattice } from '../data/layout';
import { activePath, toggleBranch } from '../data/state';
import { latticeWires } from '../data/wires';

// The Lattice plane. Structure is fixed; branches open one-per-level and fold
// on click. Everything is recomputed from `open` on each change — cheap, never
// cached. Motion (sprout/reflow choreography, spec §3–4) rides on top of this
// static model and is added incrementally; the row transform transition here is
// the reflow glide.
export const Lattice: React.FC<{ nodes: KommonsNode[] }> = ({ nodes }) => {
  const tree = useMemo(() => buildTree(nodes), [nodes]);
  const [open, setOpen] = useState<ReadonlySet<string>>(
    () => new Set([ROOT_ID]),
  );

  const { pos, width, height } = useMemo(
    () => layoutLattice(tree, open, ROOT_ID),
    [tree, open],
  );
  const path = useMemo(() => activePath(open, tree, ROOT_ID), [open, tree]);
  const wires = useMemo(
    () => latticeWires(tree, pos, open, path),
    [tree, pos, open, path],
  );

  // One delegated handler rather than a bound closure per row — a click reads
  // the row's id off the DOM and toggles that branch.
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const row = (e.target as HTMLElement).closest('.lattice-row');
      const id = row?.getAttribute('data-id');
      if (!id) return;
      const node = tree[id];
      if (!node || node.kids.length === 0) return; // leaves: panel is a later step
      setOpen((o) => toggleBranch(o, tree, id, ROOT_ID));
    },
    [tree],
  );

  const planeW = width + PLANE_PAD.x * 2;
  const planeH = height + PLANE_PAD.y * 2 + 40;

  return (
    <div className='lattice-scroll'>
      {/* Rows are <button>s that handle their own keyboard activation and
          bubble the resulting click here, so this delegation root needs no
          separate key handler of its own. */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
      <div
        className='lattice-plane'
        style={{ width: planeW, height: planeH }}
        onClick={handleClick}
      >
        <svg
          className='lattice-wires'
          width={planeW}
          height={planeH}
          aria-hidden='true'
        >
          <g transform={`translate(${PLANE_PAD.x}, ${PLANE_PAD.y})`}>
            {wires.map((w) => (
              <path
                key={w.id}
                className={`lattice-wire ${w.on ? 'lattice-wire--on' : ''}`}
                d={w.d}
              />
            ))}
          </g>
        </svg>

        {Object.entries(pos).map(([id, p]) => {
          const node = tree[id];
          if (!node) return null;
          const isCore = id === ROOT_ID;
          const isOpen = open.has(id);
          const hasKids = node.kids.length > 0;
          const cls = [
            'lattice-row',
            `lattice-row--d${p.depth}`,
            isCore ? 'lattice-row--core' : '',
            isOpen ? 'is-open' : '',
            path.has(id) ? 'is-on' : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <button
              key={id}
              type='button'
              className={cls}
              data-id={id}
              style={{
                transform: `translate(${p.x + PLANE_PAD.x}px, ${p.y + PLANE_PAD.y}px)`,
                width: COL_W,
                height: ROW_H,
              }}
            >
              <span className='lattice-row__icon'>
                {isCore ? (
                  <span className='lattice-core-glyph'>Ӂ</span>
                ) : (
                  <Icon id='' icon={latticeIcon(node, ROOT_ID)} />
                )}
              </span>
              <span className='lattice-row__label'>{node.label}</span>
              {node.count > 0 && (
                <span className='lattice-row__count'>{node.count}</span>
              )}
              {hasKids && !isCore && (
                <span
                  className={`lattice-row__chevron ${isOpen ? 'is-open' : ''}`}
                  aria-hidden='true'
                >
                  ›
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
