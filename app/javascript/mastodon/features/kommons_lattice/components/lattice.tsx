import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Icon } from 'mastodon/components/icon';

import { Composer } from '../../kommons_skeleton/components/composer';
import { ROOT_ID, buildTree } from '../../kommons_skeleton/data/layout';
import type { KommonsNode } from '../../kommons_skeleton/data/nodes';
import { latticeIcon } from '../data/icons';
import {
  COL_PITCH,
  COL_W,
  PLANE_PAD,
  ROW_H,
  layoutLattice,
} from '../data/layout';
import { activePath, toggleBranch } from '../data/state';
import { latticeWires } from '../data/wires';

import { LeafPanel } from './leaf_panel';

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
  const [selected, setSelected] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);

  const { pos, width, height } = useMemo(
    () => layoutLattice(tree, open, ROOT_ID),
    [tree, open],
  );

  // A fold can prune the selected leaf; don't leave a panel attached to a row
  // that is no longer on screen (§8).
  useEffect(() => {
    if (selected && !pos[selected]) {
      setSelected(null);
      setComposerOpen(false);
    }
  }, [pos, selected]);
  const path = useMemo(() => activePath(open, tree, ROOT_ID), [open, tree]);
  const wires = useMemo(
    () => latticeWires(tree, pos, open, path),
    [tree, pos, open, path],
  );

  // Sprout choreography (§3): growth is drawn, not revealed. Only genuinely new
  // rows and wires animate in — everything already on screen reflows into its
  // new place. We diff against the previous frame's ids (updated after paint, so
  // during render this still holds the prior frame).
  const prev = useRef<{ nodes: Set<string>; wires: Set<string> }>({
    nodes: new Set(),
    wires: new Set(),
  });
  const enteredNodes = useMemo(() => {
    const order = new Map<string, number>();
    let i = 0;
    for (const id of Object.keys(pos)) {
      if (!prev.current.nodes.has(id)) order.set(id, i++);
    }
    return order;
  }, [pos]);
  const enteredWires = useMemo(() => {
    const set = new Set<string>();
    for (const w of wires) if (!prev.current.wires.has(w.id)) set.add(w.id);
    return set;
  }, [wires]);
  useEffect(() => {
    prev.current = {
      nodes: new Set(Object.keys(pos)),
      wires: new Set(wires.map((w) => w.id)),
    };
  });

  // One delegated handler rather than a bound closure per row — a click reads
  // the row's id off the DOM and toggles that branch.
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const row = (e.target as HTMLElement).closest('.lattice-row');
      const id = row?.getAttribute('data-id');
      if (!id) return;
      const node = tree[id];
      if (!node) return;
      if (node.kids.length > 0) {
        // A branch opens (folding its siblings) and clears any leaf panel.
        setSelected(null);
        setOpen((o) => toggleBranch(o, tree, id, ROOT_ID));
      } else {
        // A leaf toggles its detail panel.
        setSelected((s) => (s === id ? null : id));
      }
    },
    [tree],
  );

  const openComposer = useCallback(() => {
    setComposerOpen(true);
  }, []);
  const closeComposer = useCallback(() => {
    setComposerOpen(false);
  }, []);
  const closePanel = useCallback(() => {
    setSelected(null);
  }, []);
  const onComposerSuccess = useCallback(() => {
    setComposerOpen(false);
  }, []);

  const selectedNode = selected ? tree[selected] : undefined;
  const selectedApiNode = selected
    ? nodes.find((n) => n.id === selected)
    : undefined;
  const selectedPos = selected ? pos[selected] : undefined;

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
                className={`lattice-wire ${w.on ? 'lattice-wire--on' : ''} ${
                  enteredWires.has(w.id) ? 'lattice-wire--draw' : ''
                }`}
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
          const enterIndex = enteredNodes.get(id);
          const cls = [
            'lattice-row',
            `lattice-row--d${p.depth}`,
            isCore ? 'lattice-row--core' : '',
            isOpen ? 'is-open' : '',
            path.has(id) ? 'is-on' : '',
            enterIndex === undefined ? '' : 'lattice-row--enter',
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
                // Stagger new rows in; cap the delay so a 14-child fan doesn't
                // take a full second to populate (§3).
                animationDelay:
                  enterIndex === undefined
                    ? undefined
                    : `${Math.min(enterIndex * 26, 340)}ms`,
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

        {selectedNode && selectedPos && (
          <LeafPanel
            node={selectedNode}
            x={selectedPos.x + COL_PITCH + PLANE_PAD.x}
            y={Math.max(PLANE_PAD.y, selectedPos.y + PLANE_PAD.y - 90)}
            onPlant={openComposer}
            onClose={closePanel}
          />
        )}
      </div>

      {composerOpen && selectedApiNode && (
        <Composer
          node={selectedApiNode}
          onSuccess={onComposerSuccess}
          onDismiss={closeComposer}
        />
      )}
    </div>
  );
};
