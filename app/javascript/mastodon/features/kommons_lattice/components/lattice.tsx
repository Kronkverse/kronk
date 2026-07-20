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

// Zoom is a scale on the plane, not a camera (§5): layout never changes,
// scrolling stays ordinary scrolling. The user only chooses how much fits.
const Z_MIN = 0.38;
const Z_MAX = 1.6;
const Z_TINY = 0.62; // below this the lattice reads as shape, not text
const clampZoom = (z: number): number => Math.max(Z_MIN, Math.min(Z_MAX, z));

export const Lattice: React.FC<{ nodes: KommonsNode[] }> = ({ nodes }) => {
  const tree = useMemo(() => buildTree(nodes), [nodes]);
  const [open, setOpen] = useState<ReadonlySet<string>>(
    () => new Set([ROOT_ID]),
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [zooming, setZooming] = useState(false); // brief transition for stepped zoom
  const zoomTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const dragRef = useRef({
    down: false,
    moved: false,
    sx: 0,
    sy: 0,
    sl: 0,
    st: 0,
  });
  const [grabbing, setGrabbing] = useState(false);

  const { pos, width, height } = useMemo(
    () => layoutLattice(tree, open, ROOT_ID),
    [tree, open],
  );

  // A fold can prune the selected leaf; don't leave a panel on a hidden row.
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

  // Sprout diff (§3): only genuinely new rows and wires animate; the rest
  // reflows. Compare against the previous frame's ids (updated after paint).
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

  const planeW = width + PLANE_PAD.x * 2;
  const planeH = height + PLANE_PAD.y * 2 + 40;

  // ── zoom ────────────────────────────────────────────────────────────────
  // Stepped zoom (buttons/keys) gets a short transition; wheel zoom gets none,
  // so it tracks the gesture 1:1.
  const flashZoomTransition = useCallback(() => {
    setZooming(true);
    if (zoomTimer.current) clearTimeout(zoomTimer.current);
    zoomTimer.current = setTimeout(() => {
      setZooming(false);
    }, 260);
  }, []);

  const stepZoom = useCallback(
    (factor: number) => {
      flashZoomTransition();
      setZoom((z) => clampZoom(z * factor));
    },
    [flashZoomTransition],
  );
  const zoomIn = useCallback(() => {
    stepZoom(1.2);
  }, [stepZoom]);
  const zoomOut = useCallback(() => {
    stepZoom(1 / 1.2);
  }, [stepZoom]);
  const resetZoom = useCallback(() => {
    flashZoomTransition();
    setZoom(1);
  }, [flashZoomTransition]);
  const fit = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const z = clampZoom(
      Math.min((el.clientWidth - 24) / planeW, (el.clientHeight - 24) / planeH),
    );
    flashZoomTransition();
    setZoom(z);
    el.scrollTo({ left: 0, top: 0, behavior: 'smooth' });
  }, [planeW, planeH, flashZoomTransition]);

  // Anchored wheel zoom on ctrl/⌘ + wheel — keep the point under the cursor
  // fixed. A bare wheel scrolls. Non-passive so preventDefault holds.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const ax = e.clientX - rect.left;
      const ay = e.clientY - rect.top;
      setZoom((zOld) => {
        const zNew = clampZoom(zOld * (e.deltaY < 0 ? 1.1 : 0.9));
        if (zNew === zOld) return zOld;
        const wx = (el.scrollLeft + ax) / zOld;
        const wy = (el.scrollTop + ay) / zOld;
        requestAnimationFrame(() => {
          el.scrollLeft = wx * zNew - ax;
          el.scrollTop = wy * zNew - ay;
        });
        return zNew;
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
    };
  }, []);

  // ── drag to pan ─────────────────────────────────────────────────────────
  // Left button on empty canvas only; a press on a row, the panel, or the zoom
  // controls must not start a pan.
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('.lattice-row, .lattice-panel, .lattice-zoom')) return;
    const el = scrollRef.current;
    if (!el) return;
    dragRef.current = {
      down: true,
      moved: false,
      sx: e.clientX,
      sy: e.clientY,
      sl: el.scrollLeft,
      st: el.scrollTop,
    };
  }, []);
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d.down) return;
      const dx = e.clientX - d.sx;
      const dy = e.clientY - d.sy;
      if (!d.moved && Math.hypot(dx, dy) < 4) return; // 4px dead zone
      if (!d.moved) setGrabbing(true);
      d.moved = true;
      const el = scrollRef.current;
      if (el) {
        el.scrollLeft = d.sl - dx;
        el.scrollTop = d.st - dy;
      }
    };
    const onUp = () => {
      if (dragRef.current.down) {
        dragRef.current.down = false;
        setGrabbing(false);
      }
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    window.addEventListener('pointercancel', onUp, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, []);

  // ── click (delegated) ───────────────────────────────────────────────────
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      // A pan that happens to end over a row would otherwise expand a branch
      // the user never chose — swallow that trailing click.
      if (dragRef.current.moved) {
        dragRef.current.moved = false;
        return;
      }
      const row = (e.target as HTMLElement).closest('.lattice-row');
      const id = row?.getAttribute('data-id');
      if (!id) return;
      const node = tree[id];
      if (!node) return;
      if (node.kids.length > 0) {
        setSelected(null);
        setOpen((o) => toggleBranch(o, tree, id, ROOT_ID));
      } else {
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

  return (
    <div
      className={`lattice-scroll ${grabbing ? 'is-grabbing' : ''}`}
      ref={scrollRef}
      onPointerDown={onPointerDown}
    >
      {/* The plane's box carries the scaled size so the scrollbars stay honest;
          the content inside stays in unscaled coordinates and is scaled by a
          transform (§5). */}
      <div
        className='lattice-plane'
        style={{ width: planeW * zoom, height: planeH * zoom }}
      >
        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events -- rows are <button>s that bubble their activation here; this is only a delegation root */}
        <div
          className={`lattice-content ${zoom < Z_TINY ? 'is-tiny' : ''} ${
            zooming ? 'is-zooming' : ''
          }`}
          style={{
            width: planeW,
            height: planeH,
            transform: `scale(${zoom})`,
          }}
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
              id === selected ? 'is-sel' : '',
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
      </div>

      <div className='lattice-zoom'>
        <button type='button' onClick={zoomOut} aria-label='Zoom out'>
          −
        </button>
        <button type='button' onClick={resetZoom}>
          {Math.round(zoom * 100)}%
        </button>
        <button type='button' onClick={zoomIn} aria-label='Zoom in'>
          +
        </button>
        <button type='button' onClick={fit}>
          fit
        </button>
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
