import type {
  ComponentType,
  PointerEvent as ReactPointerEvent,
  SVGProps,
} from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import KeyboardArrowDownIcon from '@/material-icons/400-24px/keyboard_arrow_down.svg?react';

// KronkDial — a concentric-wheel picker. Two rings (outer = category /
// medium, inner = lens / view mode) rotate independently under a fixed
// inward-pointing needle mark pinned at 3 o'clock. The centre hub shows
// the currently-shown outer slice + a chevron affordance for a drop-
// down alternative. Built for the Art korner (Tal 2026-08-14 screencast)
// but intentionally decoupled from any specific domain so it can be
// reused by per-discipline korners later.
//
// Rotation:
//   * Pointer-down inside the wheel captures the pointer, then
//     each move rotates the whole SVG by (currentAngle − startAngle)
//     around its centre. Pointer-up starts a rAF-driven snap tween
//     to the nearest slice (SNAP_MS ease-out cubic) — the ring's
//     onChange fires only when the tween lands, so the parent's
//     index update aligns with the tween's endpoint (no jump).
//   * `touch-action: none` on the wheel means touch-drag ROTATES
//     rather than scrolls the page; anywhere else on the surface
//     keeps native scroll behaviour (Tal 2026-08-14).
//   * Keyboard: ← / → step the outer wheel one slice; ↑ / ↓ step
//     the inner wheel one bubble. Hidden `<select>` mirrors provide
//     screen-reader-navigable equivalents.
//
// Composition:
//   * Everything is SVG so the ring geometry uses the same math the
//     Ж menu's moon fan and the /me hub wheel already ship —
//     `rotate(θ) translate(0,-r)` per slice — but in a single
//     coordinate system rather than one transform per DOM element.
//   * The needle mark sits in a non-rotating overlay layer, so the
//     rings spin under it (physical-dial mental model). Slice
//     boundary dividers (one per slice, at the slice EDGE) rotate
//     with the wheel and give each label a visible "slot".

// ── Public types ─────────────────────────────────────────────────

export interface DialSlice {
  key: string;
  label: string;
  count?: number;
}

export interface DialBubble {
  key: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

interface Props {
  // Outer wheel: N slices, one per medium (Journals / Essays / Pieces /
  // Readings / …). N drives both angular spacing and hit-testing.
  outer: DialSlice[];
  outerIndex: number;
  onOuterChange: (index: number) => void;

  // Inner wheel: the "lens" bubbles (grid / waveform / book / mic / …).
  // Optional — a dial can ship with just the outer ring.
  inner?: DialBubble[];
  innerIndex?: number;
  onInnerChange?: (index: number) => void;

  // Centre hub: renders the current outer slice's icon inside the
  // hub circle. Falls back to the inner-ring icon at innerIndex if a
  // dedicated centre icon isn't supplied.
  centerIcon?: ComponentType<SVGProps<SVGSVGElement>>;

  // Accessibility labels for the two ring `<select>` mirrors —
  // required so a screen-reader user can name what the dial picks.
  outerAriaLabel: string;
  innerAriaLabel?: string;
}

// ── Geometry constants ───────────────────────────────────────────
//
// One coordinate system: 200×200 view-box centred on (0,0), so the
// same math describes the wheel at any rendered pixel size. The
// consumer sets the rendered size via CSS (`.kronk-dial` width /
// height) — SVG scales the coord system to fit.

const VIEW_BOX = 200;
const CENTRE = 0; // view-box is centred via viewBox="-100 -100 200 200"
const R_OUTER_LABEL = 88; // label baseline on the outer arc
const R_OUTER_TICK_START = 72;
const R_OUTER_TICK_END = 80;
const R_INNER_BUBBLE = 48; // centre of each inner-ring bubble
const R_HUB = 26; // centre hub radius
const BUBBLE_R = 12; // per-bubble radius

// Snap-back animation duration (drag release → nearest slice).
const SNAP_MS = 260;

// ── Helpers ──────────────────────────────────────────────────────

// Fold any real number into [0, 360). The atan2 output is in
// (-180, 180]; the dial's rotation state uses (-∞, ∞) so momentum-
// less drag still snaps cleanly on release.
const normDeg = (deg: number): number => {
  const m = deg % 360;
  return m < 0 ? m + 360 : m;
};

// ── Component ────────────────────────────────────────────────────

export const KronkDial: React.FC<Props> = ({
  outer,
  outerIndex,
  onOuterChange,
  inner,
  innerIndex = 0,
  onInnerChange,
  centerIcon: CenterIcon,
  outerAriaLabel,
  innerAriaLabel,
}) => {
  const outerCount = outer.length;
  const innerCount = inner?.length ?? 0;
  const outerStep = outerCount > 0 ? 360 / outerCount : 0;
  const innerStep = innerCount > 0 ? 360 / innerCount : 0;

  // Rotation offsets in degrees. Positive rotates clockwise (the
  // needle is fixed, so rotating the wheel CW brings the next slice
  // under it). The base rotation for each ring places its `index`
  // slice under the needle at 3 o'clock.
  const baseOuterRotation = -outerIndex * outerStep;
  const baseInnerRotation = -innerIndex * innerStep;

  // Live drag offset — added onto the base rotation while dragging.
  const [dragOffset, setDragOffset] = useState(0);
  // Which ring is being dragged. `null` = idle.
  const [dragTarget, setDragTarget] = useState<'outer' | 'inner' | null>(null);
  const dragOrigin = useRef<{ angle: number; targetIndex: number } | null>(
    null,
  );
  const svgRef = useRef<SVGSVGElement | null>(null);

  // rAF-driven snap-back animation state. On drag release we tween
  // the ring's live rotation to the target slice's rotation over
  // SNAP_MS with an ease-out cubic; `onOuterChange` / `onInnerChange`
  // fires only when the tween completes, so the parent's `outerIndex`
  // update (and its `baseRotation` recomputation) aligns exactly with
  // the tween's endpoint — no visual jump.
  const [snapAnim, setSnapAnim] = useState<{
    ring: 'outer' | 'inner';
    from: number;
    to: number;
    toIndex: number;
  } | null>(null);
  const [snapRotation, setSnapRotation] = useState(0);

  const pointToAngle = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return 0;
    const rect = svg.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    // atan2 returns radians from positive x-axis, CCW positive. SVG's
    // y goes DOWN, so a naive atan2 gives CW-positive in screen space
    // — which matches how the wheel rotates (CW under the needle at
    // 3 o'clock), no sign flip needed.
    return (Math.atan2(clientY - cy, clientX - cx) * 180) / Math.PI;
  }, []);

  const handlePointerDown = useCallback(
    (ring: 'outer' | 'inner') => (event: ReactPointerEvent<SVGGElement>) => {
      if (ring === 'inner' && innerCount === 0) return;
      (
        event.currentTarget as Element & {
          setPointerCapture: (id: number) => void;
        }
      ).setPointerCapture(event.pointerId);
      dragOrigin.current = {
        angle: pointToAngle(event.clientX, event.clientY),
        targetIndex: ring === 'outer' ? outerIndex : innerIndex,
      };
      setDragTarget(ring);
      setDragOffset(0);
    },
    [innerCount, outerIndex, innerIndex, pointToAngle],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<SVGGElement>) => {
      if (!dragTarget || !dragOrigin.current) return;
      const current = pointToAngle(event.clientX, event.clientY);
      const delta = current - dragOrigin.current.angle;
      setDragOffset(delta);
    },
    [dragTarget, pointToAngle],
  );

  const settleDrag = useCallback(
    (event: ReactPointerEvent<SVGGElement>) => {
      if (!dragTarget || !dragOrigin.current) return;
      event.currentTarget.releasePointerCapture(event.pointerId);
      const ring = dragTarget;
      const step = ring === 'outer' ? outerStep : innerStep;
      const count = ring === 'outer' ? outerCount : innerCount;
      const currentIndex = ring === 'outer' ? outerIndex : innerIndex;
      const baseRotation =
        ring === 'outer' ? baseOuterRotation : baseInnerRotation;
      // Where the wheel VISUALLY sits at pointer-up: base + live drag.
      const currentRotation = baseRotation + dragOffset;

      let nextIndex = currentIndex;
      if (step > 0 && count > 0) {
        // A CW drag increases the offset; each `step` degrees of drag
        // rotates the wheel one slice. The offset is measured against
        // the wheel, not the world, so subtract (the wheel rotates
        // CCW under the needle to bring the next slice CW into view).
        const stepsMoved = Math.round(dragOffset / step);
        const next = normDeg(
          (dragOrigin.current.targetIndex - stepsMoved) * step,
        );
        nextIndex = Math.round(next / step) % count;
      }
      const targetRotation = -nextIndex * step;

      // Tween from where the wheel visually is → the target slot's
      // rotation. If they're already within a fraction of a degree
      // (e.g. a click without meaningful drag on the exact slice),
      // skip the animation to avoid burning a frame on nothing.
      if (Math.abs(currentRotation - targetRotation) > 0.1) {
        setSnapRotation(currentRotation);
        setSnapAnim({
          ring,
          from: currentRotation,
          to: targetRotation,
          toIndex: nextIndex,
        });
      } else if (nextIndex !== currentIndex) {
        // No visible travel needed, but the index still changed —
        // fire the change now.
        if (ring === 'outer') onOuterChange(nextIndex);
        else if (onInnerChange) onInnerChange(nextIndex);
      }

      dragOrigin.current = null;
      setDragTarget(null);
      setDragOffset(0);
    },
    [
      dragTarget,
      outerStep,
      innerStep,
      outerCount,
      innerCount,
      dragOffset,
      outerIndex,
      innerIndex,
      baseOuterRotation,
      baseInnerRotation,
      onOuterChange,
      onInnerChange,
    ],
  );

  // Run the snap tween. Ease-out cubic over SNAP_MS. When it lands,
  // fire the ring's onChange so the parent's index update carries the
  // wheel to exactly where the tween left it — no jump.
  useEffect(() => {
    if (!snapAnim) return;
    const startTime = performance.now();
    let rafId = 0;
    const tick = () => {
      const t = Math.min((performance.now() - startTime) / SNAP_MS, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setSnapRotation(snapAnim.from + (snapAnim.to - snapAnim.from) * eased);
      if (t < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        if (snapAnim.ring === 'outer') onOuterChange(snapAnim.toIndex);
        else if (onInnerChange) onInnerChange(snapAnim.toIndex);
        setSnapAnim(null);
      }
    };
    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [snapAnim, onOuterChange, onInnerChange]);

  // Keyboard nav — ←/→ walk the outer ring, ↑/↓ walk the inner.
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        const dir = event.key === 'ArrowRight' ? 1 : -1;
        const next = (outerIndex + dir + outerCount) % outerCount;
        onOuterChange(next);
        event.preventDefault();
      } else if (
        (event.key === 'ArrowDown' || event.key === 'ArrowUp') &&
        innerCount > 0 &&
        onInnerChange
      ) {
        const dir = event.key === 'ArrowDown' ? 1 : -1;
        const next = (innerIndex + dir + innerCount) % innerCount;
        onInnerChange(next);
        event.preventDefault();
      }
    },
    [
      outerIndex,
      outerCount,
      innerIndex,
      innerCount,
      onOuterChange,
      onInnerChange,
    ],
  );

  // Static geometry — slice / bubble angles only. Positions are
  // computed inline via SVG `rotate(θ) translate(R 0)` composition,
  // so the useMemo only needs the angular assignment.
  const outerSlices = useMemo(
    () => outer.map((slice, i) => ({ slice, index: i, angle: i * outerStep })),
    [outer, outerStep],
  );

  const innerBubbles = useMemo(
    () =>
      (inner ?? []).map((bubble, i) => ({
        bubble,
        index: i,
        angle: i * innerStep,
      })),
    [inner, innerStep],
  );

  // Effective rotation per ring, in precedence order:
  //   1. active snap-back tween (rAF-driven ease-out)
  //   2. live drag (pointer tracks 1:1)
  //   3. base rotation (derived from the ring's index)
  const outerRotation =
    snapAnim?.ring === 'outer'
      ? snapRotation
      : baseOuterRotation + (dragTarget === 'outer' ? dragOffset : 0);
  const innerRotation =
    snapAnim?.ring === 'inner'
      ? snapRotation
      : baseInnerRotation + (dragTarget === 'inner' ? dragOffset : 0);

  const centerBubble = inner?.[innerIndex];
  const Center = CenterIcon ?? centerBubble?.Icon;

  // Needle — a small outward-pointing triangle at 3 o'clock, sitting
  // in the empty band between the centre hub and the outer tick ring
  // (R_HUB=26 → R_OUTER_TICK_START=72). Points from R=60 out to
  // R=68, so its tip aims at the outer perimeter without ever
  // touching the label text at R=88 (Tal 2026-08-14: needle
  // overlapped the JOURNALS label when placed at the outer edge).
  // Replaces the pie-wedge selector Tal read as "ugly and
  // obtrusive"; the compass metaphor is enough — the active slice
  // always rotates under this mark, and the outer-slice `--active`
  // styling brightens the tick + label right beneath it as a
  // secondary cue.
  const needlePath = useMemo(() => {
    const base = 60; // back of the triangle (nearer the hub)
    const tip = 68; // point (nearer the outer ring; still inside label R)
    const wing = 3; // half-width of the base
    return [`M ${tip} 0`, `L ${base} ${-wing}`, `L ${base} ${wing}`, 'Z'].join(
      ' ',
    );
  }, []);

  // Ensure pointer-move / pointer-up outside the SVG still settle
  // the drag — the SVG captures the pointer on down, but if capture
  // ever escapes (e.g. dev-tools stealing focus) we lose the state
  // otherwise.
  useEffect(() => {
    if (!dragTarget) return;
    const cancel = () => {
      dragOrigin.current = null;
      setDragTarget(null);
      setDragOffset(0);
    };
    window.addEventListener('pointercancel', cancel);
    return () => {
      window.removeEventListener('pointercancel', cancel);
    };
  }, [dragTarget]);

  const handleOuterSelectChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const next = outer.findIndex((s) => s.key === event.target.value);
      if (next !== -1) onOuterChange(next);
    },
    [outer, onOuterChange],
  );

  const handleInnerSelectChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      if (!inner || !onInnerChange) return;
      const next = inner.findIndex((b) => b.key === event.target.value);
      if (next !== -1) onInnerChange(next);
    },
    [inner, onInnerChange],
  );

  return (
    // role="group" + tabIndex=0 is the intentional keyboard-nav
    // affordance for the whole dial (←/→ walk the outer ring, ↑/↓
    // walk the inner). The interactive parts inside are the SVG
    // rings; the wrapper carries the focus target so keyboard users
    // can reach the dial without landing on a ring first.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      className='kronk-dial'
      role='group'
      aria-label={outerAriaLabel}
      onKeyDown={handleKeyDown}
      tabIndex={0} // eslint-disable-line jsx-a11y/no-noninteractive-tabindex
    >
      <svg
        ref={svgRef}
        className='kronk-dial__svg'
        viewBox={`${-VIEW_BOX / 2} ${-VIEW_BOX / 2} ${VIEW_BOX} ${VIEW_BOX}`}
      >
        {/* Outer ring — labels + tick marks. The rotating group uses
            SVG's own `transform` ATTRIBUTE (no `deg` suffix, no CSS
            transform-box gymnastics — CSS transforms on <g> with
            transform-box: view-box are unreliable across browsers,
            which sent labels flying in #1483's first pass). Each
            slice lives in a nested <g> that first rotates to its
            slot then translates OUT along the +x axis, so the label
            sits at (R, 0) in its local frame. A final counter-rotate
            on the text box keeps glyphs upright regardless of wheel
            spin. */}
        <g
          className='kronk-dial__outer'
          transform={`rotate(${outerRotation.toFixed(3)})`}
          onPointerDown={handlePointerDown('outer')}
          onPointerMove={handlePointerMove}
          onPointerUp={settleDrag}
          onPointerCancel={settleDrag}
        >
          {/* Dashed ring — the outer perimeter marker. Non-interactive. */}
          <circle
            className='kronk-dial__outer-ring'
            r={R_OUTER_TICK_END}
            cx={CENTRE}
            cy={CENTRE}
            fill='none'
          />
          {/* Boundary dividers — thin radial lines at each slice
              EDGE (halfway between slice centres), giving each
              label its own visual "slot" so it no longer reads as
              floating loose in the ring. Rotates with the wheel. */}
          {outerSlices.map(({ slice, angle }) => (
            <line
              key={`edge-${slice.key}`}
              x1={R_OUTER_TICK_START}
              y1={0}
              x2={R_OUTER_TICK_END}
              y2={0}
              className='kronk-dial__slice-divider'
              transform={`rotate(${(angle - outerStep / 2).toFixed(3)})`}
            />
          ))}
          {outerSlices.map(({ slice, angle, index }) => {
            const isActive = index === outerIndex;
            // Total upright counter-rotation applied at the label
            // position: cancel the parent wheel spin AND this slice's
            // local rotation so the glyph lands horizontal.
            const uprightRotation = -(outerRotation + angle);
            return (
              <g
                key={slice.key}
                className={
                  isActive
                    ? 'kronk-dial__outer-slice kronk-dial__outer-slice--active'
                    : 'kronk-dial__outer-slice'
                }
                transform={`rotate(${angle.toFixed(3)})`}
              >
                {/* Tick line: from R_OUTER_TICK_START to R_OUTER_TICK_END
                    along the +x axis of the rotated frame. */}
                <line
                  x1={R_OUTER_TICK_START}
                  y1={0}
                  x2={R_OUTER_TICK_END}
                  y2={0}
                  className='kronk-dial__tick'
                />
                {/* Label group: translate out to the label radius, then
                    counter-rotate the whole nested <g> so the two <text>
                    elements sit upright without needing per-glyph
                    rotation math. */}
                <g transform={`translate(${R_OUTER_LABEL} 0)`}>
                  <g transform={`rotate(${uprightRotation.toFixed(3)})`}>
                    <text
                      className='kronk-dial__outer-label'
                      textAnchor='middle'
                      dominantBaseline='middle'
                    >
                      {slice.label}
                    </text>
                    {typeof slice.count === 'number' && (
                      <text
                        y={7}
                        className='kronk-dial__outer-count'
                        textAnchor='middle'
                        dominantBaseline='middle'
                      >
                        {slice.count}
                      </text>
                    )}
                  </g>
                </g>
              </g>
            );
          })}
        </g>

        {/* Inner ring — icon bubbles at fixed angular positions. Same
            rotating-group trick as the outer ring. */}
        {inner && (
          <g
            className='kronk-dial__inner'
            transform={`rotate(${innerRotation.toFixed(3)})`}
            onPointerDown={handlePointerDown('inner')}
            onPointerMove={handlePointerMove}
            onPointerUp={settleDrag}
            onPointerCancel={settleDrag}
          >
            {innerBubbles.map(({ bubble, angle, index }) => {
              const isActive = index === innerIndex;
              const BubbleIcon = bubble.Icon;
              const uprightRotation = -(innerRotation + angle);
              return (
                <g
                  key={bubble.key}
                  className={
                    isActive
                      ? 'kronk-dial__bubble kronk-dial__bubble--active'
                      : 'kronk-dial__bubble'
                  }
                  transform={`rotate(${angle.toFixed(3)}) translate(${R_INNER_BUBBLE} 0)`}
                >
                  <circle r={BUBBLE_R} />
                  {/* Icons stay upright — counter-rotate against the
                      wheel spin + this bubble's own angle. */}
                  <g transform={`rotate(${uprightRotation.toFixed(3)})`}>
                    <BubbleIcon width={16} height={16} x={-8} y={-8} />
                  </g>
                </g>
              );
            })}
          </g>
        )}

        {/* Fixed overlay layer — needle mark + centre hub sit outside
            the rotating groups so they don't spin. */}
        <g className='kronk-dial__needle' aria-hidden>
          <path d={needlePath} className='kronk-dial__needle-mark' />
        </g>
        <g className='kronk-dial__hub' aria-hidden>
          <circle r={R_HUB} className='kronk-dial__hub-bg' />
          {Center && <Center width={22} height={22} x={-11} y={-11} />}
        </g>
      </svg>

      {/* Under-hub chevron — the "SHOWN ▼" dropdown affordance. Rendered
          as HTML rather than SVG so native menu semantics land right
          when we wire it up. */}
      <button
        type='button'
        className='kronk-dial__hub-hint'
        aria-haspopup='menu'
      >
        <span className='kronk-dial__hub-hint-label'>Shown</span>
        <KeyboardArrowDownIcon aria-hidden='true' />
      </button>

      {/* Screen-reader mirror — hidden native <select>s so AT users
          can nav the dial without touching the visual rings. */}
      <label className='kronk-dial__sr'>
        {outerAriaLabel}
        <select
          value={outer[outerIndex]?.key ?? ''}
          onChange={handleOuterSelectChange}
        >
          {outer.map((slice) => (
            <option key={slice.key} value={slice.key}>
              {slice.label}
            </option>
          ))}
        </select>
      </label>
      {inner && onInnerChange && innerAriaLabel && (
        <label className='kronk-dial__sr'>
          {innerAriaLabel}
          <select
            value={inner[innerIndex]?.key ?? ''}
            onChange={handleInnerSelectChange}
          >
            {inner.map((bubble) => (
              <option key={bubble.key} value={bubble.key}>
                {bubble.label}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
};
