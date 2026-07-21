import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useHistory } from 'react-router-dom';

import { Glyph, iconFor } from '../data/icons';
import type { Camera, Layout, Tree } from '../data/layout';
import {
  LIMBS,
  ROOT_ID,
  buildBones,
  buildTree,
  buildWires,
  cameraFor,
  distances,
  layoutTree,
  pathTo,
  worldBounds,
} from '../data/layout';
import type { KommonsNode } from '../data/nodes';

// The Skeleton — one world, one camera.
//
// The tree is laid out once into world coordinates and every node and bone is
// rendered once. Navigating does not rebuild anything: the camera retargets and
// nodes re-class for emphasis. Nothing is ever culled, so the whole platform
// stays in your peripheral vision and you can see where you are within it.

type Emphasis = 'focus' | 'near' | 'path' | 'mid' | 'far';

const SCALE: Record<Emphasis, number> = {
  focus: 1,
  near: 1,
  path: 0.9,
  mid: 0.78,
  far: 0.62,
};

export const BodyMap: React.FC<{
  nodes: KommonsNode[];
  path: string[];
  onFocus: (id: string) => void;
  onOpenLeaf: (nodeId: string) => void;
}> = ({ nodes, path, onFocus, onOpenLeaf }) => {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const camRef = useRef<HTMLDivElement | null>(null);

  // Built once from the registry. Re-derived only if the registry itself
  // changes, never on navigation.
  const { tree, lay, bones, wires, world } = useMemo(() => {
    const t: Tree = buildTree(nodes);
    const l: Layout = layoutTree(t);
    return {
      tree: t,
      lay: l,
      bones: buildBones(t, l),
      wires: buildWires(t, l, nodes),
      world: worldBounds(l),
    };
  }, [nodes]);

  const focus = path[path.length - 1] ?? ROOT_ID;
  const [cam, setCam] = useState<Camera>({ x: 0, y: 0, s: 1 });
  const [animating, setAnimating] = useState(true);

  // Free drag, additive on top of the computed camera and reset whenever the
  // focus changes.
  const panRef = useRef({ x: 0, y: 0 });
  const dragRef = useRef({ down: false, moved: false, sx: 0, sy: 0, ox: 0, oy: 0 });
  const [grabbing, setGrabbing] = useState(false);

  const applyTransform = useCallback((c: Camera, animate: boolean) => {
    const el = camRef.current;
    if (!el) return;
    const pan = panRef.current;
    el.style.transition = animate ? 'transform 720ms var(--ease-out)' : 'none';
    el.style.transform = `translate(${(c.x + pan.x).toFixed(1)}px, ${(c.y + pan.y).toFixed(1)}px) scale(${c.s.toFixed(3)})`;
  }, []);

  const retarget = useCallback(
    (animate: boolean) => {
      const stage = stageRef.current;
      if (!stage) return;
      const next = cameraFor(tree, lay, focus, stage.clientWidth, stage.clientHeight);
      panRef.current = { x: 0, y: 0 };
      setCam(next);
      setAnimating(animate);
      applyTransform(next, animate);
    },
    [tree, lay, focus, applyTransform],
  );

  useEffect(() => {
    retarget(true);
  }, [retarget]);

  // Resize refits against the new viewport. The world is viewport-independent,
  // so nothing is rebuilt — only the camera.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        retarget(false);
      }, 140);
    };
    window.addEventListener('resize', onResize, { passive: true });
    return () => {
      window.removeEventListener('resize', onResize);
      clearTimeout(timer);
    };
  }, [retarget]);

  // ── drag ────────────────────────────────────────────────────────────────
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Clear the drag flag on every press, including presses that land on a
    // node. `handleNode` reads this flag to tell a tap from the end of a pan,
    // so leaving it set from a previous pan made the next tap — and every tap
    // after it — do nothing at all. Panning once disabled navigation until
    // you happened to click empty canvas.
    dragRef.current.moved = false;

    if ((e.target as HTMLElement).closest('.skel-node')) return;

    dragRef.current = {
      down: true,
      moved: false,
      sx: e.clientX,
      sy: e.clientY,
      ox: panRef.current.x,
      oy: panRef.current.y,
    };
    setGrabbing(true);
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d.down) return;
      const dx = e.clientX - d.sx;
      const dy = e.clientY - d.sy;
      // Dead zone, so a click on empty space is not read as a drag.
      if (!d.moved && Math.hypot(dx, dy) < 5) return;
      d.moved = true;
      panRef.current = { x: d.ox + dx, y: d.oy + dy };
      applyTransform(cam, false);
    };
    const onUp = () => {
      if (!dragRef.current.down) return;
      dragRef.current.down = false;
      setGrabbing(false);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [cam, applyTransform]);

  // ── limb switching ──────────────────────────────────────────────────────
  //
  // A limb is one of the three branches off the core. Arrowing sweeps the
  // camera around the body between them, which only reads correctly because
  // they sit at different angles rather than in a row.
  const hop = useCallback(
    (dir: number) => {
      if (path.length > 2) return;
      const i = LIMBS.indexOf(path[1] as (typeof LIMBS)[number]);
      const next =
        i < 0
          ? dir > 0
            ? 0
            : LIMBS.length - 1
          : Math.max(0, Math.min(LIMBS.length - 1, i + dir));
      const limb = LIMBS[next];
      if (limb) onFocus(limb);
    },
    [path, onFocus],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') hop(1);
      else if (e.key === 'ArrowLeft') hop(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [hop]);

  // ── emphasis ────────────────────────────────────────────────────────────
  const { emphasis, edgeClass, wireClass } = useMemo(() => {
    const dist = distances(tree, focus);
    const onPath = new Set(path);
    const kids = new Set(tree[focus]?.kids ?? []);

    const em: Record<string, Emphasis> = {};
    for (const id of Object.keys(lay)) {
      if (id === focus) em[id] = 'focus';
      else if (kids.has(id)) em[id] = 'near';
      else if (onPath.has(id)) em[id] = 'path';
      else if ((dist[id] ?? 99) <= 2) em[id] = 'mid';
      else em[id] = 'far';
    }

    const ec: Record<string, string> = {};
    for (const bone of bones) {
      // The chain you walked, drawn in space — the breadcrumb is a redundant
      // text rendering of this.
      if (onPath.has(bone.id) && onPath.has(bone.parent)) ec[bone.id] = 'hot';
      else if (bone.id === focus || kids.has(bone.id)) ec[bone.id] = 'live';
      else if ((dist[bone.id] ?? 99) <= 2) ec[bone.id] = 'near';
      else ec[bone.id] = 'ghost';
    }

    // A wire is drawn only when it touches where you are — the focus itself
    // or one of its children. Every wire on screen at once is noise; the two
    // or three attached to this node are the point.
    const wc: Record<string, string> = {};
    for (const w of wires) {
      const touchesFocus = w.from === focus || w.to === focus;
      const touchesKid = kids.has(w.from) || kids.has(w.to);
      wc[w.id] = touchesFocus ? 'live' : touchesKid ? 'near' : 'off';
    }

    return { emphasis: em, edgeClass: ec, wireClass: wc };
  }, [tree, lay, bones, wires, focus, path]);

  const history = useHistory();

  const handleNode = useCallback(
    (id: string) => () => {
      if (dragRef.current.moved) return;
      const node = tree[id];
      if (!node) return;
      // A korner (or a space-pillar like Nudges) is a space, not a branch to
      // drill: open its Space page rather than focusing its internal pages
      // (matches the Lattice).
      const spaceTarget = node.korner ?? node.space;
      if (spaceTarget) {
        history.push(`/hub/kommons/space/${spaceTarget}`);
        return;
      }
      // A Finger opens its page (Kronk's org pages are Rails-served).
      if (node.url) {
        if (node.url.startsWith('/kronk')) window.location.assign(node.url);
        else history.push(node.url);
        return;
      }
      if (node.kids.length > 0) {
        // Clicking the node you are already on climbs back out.
        onFocus(focus === id && node.parent ? node.parent : id);
      } else {
        onOpenLeaf(id);
      }
    },
    [tree, focus, onFocus, onOpenLeaf, history],
  );

  const worldW = world.x2 - world.x1;
  const worldH = world.y2 - world.y1;

  return (
    <div
      className={`skel-stage ${grabbing ? 'skel-stage--grabbing' : ''}`}
      ref={stageRef}
      onPointerDown={handlePointerDown}
    >
      <div className='skel-cam' ref={camRef}>
        <svg
          className='skel-bones'
          viewBox={`${world.x1} ${world.y1} ${worldW} ${worldH}`}
          width={worldW}
          height={worldH}
          style={{ left: world.x1, top: world.y1 }}
          aria-hidden='true'
        >
          {bones.map((b) => (
            <g key={b.id} className={`skel-edge skel-edge--${edgeClass[b.id] ?? 'ghost'}`}>
              <path className='skel-bone' d={b.d} />
              <circle className='skel-joint' cx={b.jointX} cy={b.jointY} r={b.jointR} />
            </g>
          ))}
          <circle className='skel-halo' cx={0} cy={0} r={46} />

          {/* Above the bones, below the discs: a wire crosses the anatomy,
              so it has to read as passing over the trunk rather than
              disappearing behind it. */}
          {wires.map((w) => (
            <g key={w.id} className={`skel-wire skel-wire--${wireClass[w.id] ?? 'off'}`}>
              <path className='skel-wire-line' d={w.d} />
              {wireClass[w.id] === 'live' && (
                <text className='skel-wire-label' x={w.labelX} y={w.labelY}>
                  {w.kind.replaceAll('_', ' ')}
                </text>
              )}
            </g>
          ))}
        </svg>

        <div className='skel-world'>
          {Object.entries(lay).map(([id, p]) => {
            const node = tree[id];
            if (!node) return null;
            const em = emphasis[id] ?? 'far';
            const isRoot = id === ROOT_ID;

            return (
              <button
                key={id}
                type='button'
                className={`skel-node skel-node--d${p.depth} skel-node--${em}`}
                style={{
                  width: p.w,
                  height: p.h,
                  transformOrigin: `50% ${p.disc / 2}px`,
                  transform: `translate(${(p.cx - p.w / 2).toFixed(1)}px, ${(p.cy - p.disc / 2).toFixed(1)}px) scale(${SCALE[em]})`,
                  transition: animating ? undefined : 'none',
                }}
                onClick={handleNode(id)}
                tabIndex={em === 'far' ? -1 : 0}
                aria-current={id === focus ? 'true' : undefined}
              >
                <span
                  className={`skel-disc ${isRoot ? 'skel-disc--core' : ''}`}
                  style={{ width: p.disc, height: p.disc }}
                >
                  <span className='skel-glow' />
                  {isRoot ? (
                    <span className='skel-glyph'>Ӂ</span>
                  ) : (
                    <Glyph name={iconFor(tree, id)} />
                  )}
                  {node.count > 0 && (
                    <span className={`skel-count ${node.count >= 6 ? 'skel-count--hot' : ''}`}>
                      {node.count}
                    </span>
                  )}
                </span>
                <span className='skel-label'>{node.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Kept mounted so it lifts away rather than vanishing — the hint is
          scaffolding you outgrow, not a control that disappears. */}
      <p className={`skel-hint ${path.length > 2 ? 'skel-hint--gone' : ''}`}>
        drag to move through the body · ← → to switch limb
      </p>
    </div>
  );
};

export { pathTo };
