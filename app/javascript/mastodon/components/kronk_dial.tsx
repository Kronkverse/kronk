import type {
  ComponentType,
  PointerEvent as ReactPointerEvent,
  SVGProps,
} from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import KeyboardArrowDownIcon from '@/material-icons/400-24px/keyboard_arrow_down.svg?react';

// KronkDial — a concentric-wheel picker. Two rings (outer = category /
// medium, inner = lens / view mode) rotate independently under a fixed
// pie-wedge selector pinned at 3 o'clock; the active slice's label +
// count emerge from the wedge tip as an external callout. Fine dial-
// face pips ring the perimeter as a compass-face texture; boundary
// dividers wall off each slice. Built for the Art korner (Tal
// 2026-08-14 screencast + HTML mockup) but intentionally decoupled
// from any specific domain so it can be reused elsewhere.
//
// Rotation:
//   * Pointer-down inside the wheel captures the pointer, then each
//     move rotates the whole SVG by (currentAngle − startAngle)
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
// Composition (SVG throughout — native `transform` attributes on <g>
// elements; the CSS-transform-with-view-box approach was unreliable
// across engines, #1487):
//   * Each rotating ring is a <g transform="rotate(θ)">
//   * Each slice sits at `rotate(sliceAngle) translate(R 0)` in its
//     own nested <g>
//   * Non-active labels are drawn TANGENT to the ring (rotate 90°
//     from radial) with a 180° flip for bottom-half labels so glyph
//     tops always point roughly upward — the standard "readable-
//     around-a-dial" trick. The active slice is skipped here — it
//     appears at the wedge tip in the fixed overlay.

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

  // Centre hub action — when supplied, the hub becomes an
  // interactive button (role, tabIndex, keyboard). Used by the Art
  // hub to scroll the viewer down to the content below the dial
  // (Tal 2026-08-15). Label is required so the button announces
  // meaningfully to screen readers.
  onCenterClick?: () => void;
  centerActionLabel?: string;

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

// Volvelle geometry — three concentric discs plus a central pivot,
// each with a visible boundary so the whole thing reads as a stack
// of rotating rings (Tal 2026-08-14: "this is a volvelle, we want
// that to be obvious"). Radii define the shared physical boundaries
// between rings; the ring FILLS use these to draw annular bands
// (layered filled circles: outermost first, each smaller one paints
// over the last's interior).
//
// Outer band widened 2026-08-15 (from 62-88 to 58-92) so upright
// labels fit inside horizontally — the tangent-labels approach made
// bottom-half labels flip, which read as jitter during rotation.
const R_HUB = 30; // centre pivot: 0..R_HUB
const R_INNER_RING_OUTER = 58; // inner ring band: R_HUB..R_INNER_RING_OUTER
const R_OUTER_RING_OUTER = 92; // outer ring band: R_INNER_RING_OUTER..R_OUTER_RING_OUTER

// Content radii inside the rings — bubbles centred in the inner
// band, labels centred in the outer band, dividers spanning the
// outer band's full width, fine pips near its inner edge.
const R_INNER_BUBBLE = 44; // centre of each inner-ring bubble (inside inner band)
const BUBBLE_R = 12;
const BUBBLE_R_ACTIVE = 14;
const R_OUTER_LABEL = 76; // label centre (mid-band 58→92)
const R_OUTER_TICK_START = 59; // slice divider inner (just inside outer band)
const R_OUTER_TICK_END = 91; // slice divider outer (just inside outer band edge)

// Fine dial-face pips (uniform ring of small ticks — the "compass"
// texture behind the labelled slices).
const DIAL_FACE_TICKS = 72; // one every 5°
const R_FACE_TICK_INNER = 61;
const R_FACE_TICK_OUTER = 65;

// The wedge selector — a pie slice at 3 o'clock that spans BOTH ring
// bands (from just outside the hub out to the outer perimeter), so
// the volvelle reads as "the wheel points at this slice". The active
// slice's label paints ON TOP of the wedge (see the fixed-overlay
// render) — no external callout; Tal 2026-08-15 asked for the word
// to stay on the ring rather than disappearing into a select zone.
const R_WEDGE_INNER = 30;
const R_WEDGE_OUTER = 92;

// Hit-region annulus paths — invisible transparent-fill shapes
// with `pointer-events: all`, one per rotating ring, so drag
// registers anywhere on the ring band (not just on the painted
// label / bubble geometry). Composed via even-odd fill-rule: a
// path with an outer circle followed by an inner circle "carves"
// a ring shape whose interior counts as hit. Tal 2026-08-14: "drag
// only works on the words or icons, not the empty space".
const annulusPath = (rOuter: number, rInner: number): string =>
  [
    `M ${rOuter} 0`,
    `A ${rOuter} ${rOuter} 0 1 1 ${-rOuter} 0`,
    `A ${rOuter} ${rOuter} 0 1 1 ${rOuter} 0`,
    'Z',
    `M ${rInner} 0`,
    `A ${rInner} ${rInner} 0 1 1 ${-rInner} 0`,
    `A ${rInner} ${rInner} 0 1 1 ${rInner} 0`,
    'Z',
  ].join(' ');

// Snap-back animation duration (drag release → nearest slice).
const SNAP_MS = 260;

// A pointer movement smaller than this (in degrees, measured on the
// dial's angular axis) counts as a click, not a drag. Above the
// threshold, the pointer is treated as a real drag and the spoke
// click path is suppressed via `wasDragRef`.
const CLICK_THRESHOLD_DEG = 3;

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
  onCenterClick,
  centerActionLabel,
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
  // Flag flipped true when pointer movement exceeds CLICK_THRESHOLD_DEG;
  // spoke click handlers early-return when it's set so a drag that
  // ends over a spoke doesn't fire an additional spoke-select snap on
  // top of the drag's natural snap.
  const wasDragRef = useRef(false);
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
      wasDragRef.current = false;
    },
    [innerCount, outerIndex, innerIndex, pointToAngle],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<SVGGElement>) => {
      if (!dragTarget || !dragOrigin.current) return;
      const current = pointToAngle(event.clientX, event.clientY);
      const delta = current - dragOrigin.current.angle;
      if (Math.abs(delta) > CLICK_THRESHOLD_DEG) {
        wasDragRef.current = true;
      }
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

      // CLICK path — pointer released without meaningful movement.
      // The browser's own click event doesn't fire reliably on
      // individual spokes while the group has pointer capture (the
      // capture rewrites the click's target to the capturing group),
      // so resolve "which spoke was under the release point" here
      // from the release angle. Uses shortest-path snap via
      // `spinRingTo`. Anywhere off the ring's spokes (an empty gap
      // between labels, hitting only the hit-region annulus) is
      // still a click — but the nearest spoke wins, matching the
      // spoke's angular slot.
      if (!wasDragRef.current && step > 0 && count > 0) {
        const releaseWorldAngle = pointToAngle(event.clientX, event.clientY);
        // Undo the wheel's current rotation to get the slot the
        // pointer hit in slot-space (the position "if the wheel
        // hadn't spun"). Then index = round(slotAngle / step).
        const slotAngle = normDeg(releaseWorldAngle - currentRotation);
        const clickedIndex = Math.round(slotAngle / step) % count;
        dragOrigin.current = null;
        setDragTarget(null);
        setDragOffset(0);
        if (clickedIndex !== currentIndex && !snapAnim) {
          const targetBase = -clickedIndex * step;
          let delta = targetBase - currentRotation;
          delta = ((delta + 540) % 360) - 180;
          setSnapRotation(currentRotation);
          setSnapAnim({
            ring,
            from: currentRotation,
            to: currentRotation + delta,
            toIndex: clickedIndex,
          });
        }
        return;
      }

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
      pointToAngle,
      snapAnim,
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

  // Wedge selector — a pie slice at 3 o'clock spanning one slice's
  // angular width, extending from just outside the hub OUT past the
  // outer perimeter so it "punches through" the ring. Replaces the
  // previous tiny needle mark. The active slice's label + count
  // emerge from the wedge's tip via the fixed callout in the overlay
  // layer below — matches the picker mockup Tal designed
  // (2026-08-14 HTML mockup: wedge + external label callout).
  const wedgePath = useMemo(() => {
    const half = ((outerStep || 30) / 2) * (Math.PI / 180);
    const cosA = Math.cos(half);
    const sinA = Math.sin(half);
    const rOuter = R_WEDGE_OUTER;
    const rInner = R_WEDGE_INNER;
    return [
      `M ${(rInner * cosA).toFixed(2)} ${(-rInner * sinA).toFixed(2)}`,
      `L ${(rOuter * cosA).toFixed(2)} ${(-rOuter * sinA).toFixed(2)}`,
      `A ${rOuter} ${rOuter} 0 0 1 ${(rOuter * cosA).toFixed(2)} ${(rOuter * sinA).toFixed(2)}`,
      `L ${(rInner * cosA).toFixed(2)} ${(rInner * sinA).toFixed(2)}`,
      `A ${rInner} ${rInner} 0 0 0 ${(rInner * cosA).toFixed(2)} ${(-rInner * sinA).toFixed(2)}`,
      'Z',
    ].join(' ');
  }, [outerStep]);

  const activeOuterSlice = outer[outerIndex];

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

  // Spoke click — snap the wheel so the clicked spoke lands in the
  // selection space at 3 o'clock (Tal 2026-08-16). Suppressed if the
  // pointer sequence was actually a drag (wasDragRef), so a drag that
  // ends over a spoke doesn't fire an additional select on top of the
  // drag's natural snap.
  //
  // Shortest-path rotation: the tween goes to `to = base + delta`
  // where `delta` is the signed difference (targetBase − currentRot)
  // normalised into (-180°, +180°]. Otherwise a click on the opposite
  // side of the wheel would spin ~360° when a half-turn either way
  // would land on the same spoke.
  const spinRingTo = useCallback(
    (ring: 'outer' | 'inner', nextIndex: number) => {
      if (snapAnim) return; // already animating; ignore stray clicks
      const step = ring === 'outer' ? outerStep : innerStep;
      const currentIndex = ring === 'outer' ? outerIndex : innerIndex;
      if (nextIndex === currentIndex || step <= 0) return;

      const currentRotation =
        ring === 'outer' ? baseOuterRotation : baseInnerRotation;
      const targetBase = -nextIndex * step;
      let delta = targetBase - currentRotation;
      // Fold delta into (-180, 180] so the tween takes the short way.
      delta = ((delta + 540) % 360) - 180;
      const targetRotation = currentRotation + delta;

      setSnapRotation(currentRotation);
      setSnapAnim({
        ring,
        from: currentRotation,
        to: targetRotation,
        toIndex: nextIndex,
      });
    },
    [
      snapAnim,
      outerStep,
      innerStep,
      outerIndex,
      innerIndex,
      baseOuterRotation,
      baseInnerRotation,
    ],
  );

  const handleOuterSpokeClick = useCallback(
    (index: number) => {
      if (wasDragRef.current) return;
      spinRingTo('outer', index);
    },
    [spinRingTo],
  );

  const handleInnerSpokeClick = useCallback(
    (index: number) => {
      if (wasDragRef.current) return;
      spinRingTo('inner', index);
    },
    [spinRingTo],
  );

  // Keyboard fallback for the centre-hub button. SVG doesn't nest an
  // HTML <button>, so we hand-roll the ENTER / SPACE handling that a
  // native button would give us for free.
  const handleCenterKey = useCallback(
    (event: React.KeyboardEvent) => {
      if (!onCenterClick) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onCenterClick();
      }
    },
    [onCenterClick],
  );

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
        {/* Volvelle ring backgrounds — layered filled circles that
            paint the concentric ring-bands as physical discs (Tal
            2026-08-14: "clearly defined rings"). Order matters:
            outermost first so each inner disc paints over the
            previous's interior, leaving visible annuli. Fixed base
            layer, rotates with nothing. */}
        <circle
          r={R_OUTER_RING_OUTER}
          className='kronk-dial__ring-outer'
          aria-hidden='true'
        />
        <circle
          r={R_INNER_RING_OUTER}
          className='kronk-dial__ring-inner'
          aria-hidden='true'
        />

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
          {/* Hit region — invisible annulus spanning the whole outer
              band so drag registers anywhere on it (empty gaps,
              labels, dividers). Without this, SVG only hit-tests the
              painted geometry — narrow ticks and thin dividers —
              which felt "sticky" on any empty space between labels. */}
          <path
            d={annulusPath(R_OUTER_RING_OUTER, R_INNER_RING_OUTER)}
            className='kronk-dial__hit-region'
            fillRule='evenodd'
            aria-hidden='true'
          />

          {/* Fine dial-face pips — full compass ring of uniform ticks
              that reads as texture behind the labelled slices.
              Rotates with the wheel so the whole dial face spins as
              one physical object. */}
          {Array.from({ length: DIAL_FACE_TICKS }, (_, i) => {
            const tickAngle = (i * 360) / DIAL_FACE_TICKS;
            return (
              <line
                key={`face-${i}`}
                x1={R_FACE_TICK_INNER}
                y1={0}
                x2={R_FACE_TICK_OUTER}
                y2={0}
                className='kronk-dial__face-tick'
                transform={`rotate(${tickAngle.toFixed(3)})`}
              />
            );
          })}

          {/* Boundary dividers — thin radial lines at each slice
              EDGE (halfway between slice centres). Rotates with the
              wheel so each label sits inside its visible "slot". */}
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

          {/* Labels — UPRIGHT (horizontal in world space). Sit inside
              the widened outer band; each rotates to its slot then
              counter-rotates by the full wheel angle so text stays
              horizontal regardless of wheel spin (Tal 2026-08-15:
              "words fit within the ring, horizontally"). The active
              slice IS rendered on the ring here — the previous
              "hide under wedge" approach made words appear to
              vanish as they entered the select zone (Tal
              2026-08-15). It's the FIXED-overlay copy below that
              paints on top of the wedge, so the word reads on both
              layers seamlessly. */}
          {outerSlices.map(({ slice, angle, index }) => {
            const uprightRotation = -(outerRotation + angle);
            return (
              <g
                key={`label-${slice.key}`}
                className='kronk-dial__outer-slice'
                transform={`rotate(${angle.toFixed(3)})`}
              >
                <g
                  transform={`translate(${R_OUTER_LABEL} 0) rotate(${uprightRotation.toFixed(3)})`}
                  // eslint-disable-next-line react/jsx-no-bind -- per-spoke click needs the index closure; a few slices, arrow cost is negligible
                  onClick={() => {
                    handleOuterSpokeClick(index);
                  }}
                >
                  <text
                    className='kronk-dial__outer-label'
                    textAnchor='middle'
                    dominantBaseline='middle'
                  >
                    {slice.label}
                  </text>
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
            {/* Hit region — same trick as the outer ring; drag
                anywhere on the inner band (bubbles OR the gaps
                between them) triggers rotation. */}
            <path
              d={annulusPath(R_INNER_RING_OUTER, R_HUB)}
              className='kronk-dial__hit-region'
              fillRule='evenodd'
              aria-hidden='true'
            />
            {innerBubbles.map(({ bubble, angle, index }) => {
              const isActive = index === innerIndex;
              const BubbleIcon = bubble.Icon;
              const uprightRotation = -(innerRotation + angle);
              // Active bubble punches larger (visual weight matches
              // "this is the shown lens") — geometry stays radial so
              // it grows outward without shifting the ring layout.
              const r = isActive ? BUBBLE_R_ACTIVE : BUBBLE_R;
              const iconSize = isActive ? 20 : 16;
              const iconOffset = -iconSize / 2;
              return (
                <g
                  key={bubble.key}
                  className={
                    isActive
                      ? 'kronk-dial__bubble kronk-dial__bubble--active'
                      : 'kronk-dial__bubble'
                  }
                  transform={`rotate(${angle.toFixed(3)}) translate(${R_INNER_BUBBLE} 0)`}
                  // eslint-disable-next-line react/jsx-no-bind -- per-bubble click needs the index closure; a few bubbles, arrow cost is negligible
                  onClick={() => {
                    handleInnerSpokeClick(index);
                  }}
                >
                  <circle r={r} />
                  {/* Icons stay upright — counter-rotate against the
                      wheel spin + this bubble's own angle. */}
                  <g transform={`rotate(${uprightRotation.toFixed(3)})`}>
                    <BubbleIcon
                      width={iconSize}
                      height={iconSize}
                      x={iconOffset}
                      y={iconOffset}
                    />
                  </g>
                </g>
              );
            })}
          </g>
        )}

        {/* Fixed overlay layer — wedge + active-slice label + centre
            hub sit outside the rotating groups so they don't spin.
            The wedge punches through the ring at 3 o'clock; the
            active label paints ON TOP of the wedge (bright text-on-
            accent colour) so the word stays visible when the wheel
            spins it under the select zone (Tal 2026-08-15: "I don't
            like how the word on the outer rim disappears when it
            gets to the select zone"). Its twin on the rotating ring
            takes over the moment the wheel rotates away. */}
        <path d={wedgePath} className='kronk-dial__wedge' aria-hidden='true' />
        {activeOuterSlice && (
          <text
            x={R_OUTER_LABEL}
            y={0}
            className='kronk-dial__active-label'
            textAnchor='middle'
            dominantBaseline='middle'
            aria-hidden='true'
          >
            {activeOuterSlice.label}
          </text>
        )}
        {/* Centre hub — decorative by default; interactive when
            `onCenterClick` is set (Tal 2026-08-15: hub becomes a
            "scroll to the content below" button on the Art hub).
            Uses SVG role="button" + tabIndex + keyboard-fallback so
            it's fully AT-navigable without wrapping in an HTML
            <button> (which SVG doesn't nest cleanly). */}
        <g
          className={
            onCenterClick
              ? 'kronk-dial__hub kronk-dial__hub--interactive'
              : 'kronk-dial__hub'
          }
          role={onCenterClick ? 'button' : undefined}
          aria-label={onCenterClick ? centerActionLabel : undefined}
          aria-hidden={onCenterClick ? undefined : true}
          tabIndex={onCenterClick ? 0 : undefined}
          onClick={onCenterClick}
          onKeyDown={onCenterClick ? handleCenterKey : undefined}
        >
          <circle r={R_HUB} className='kronk-dial__hub-bg' />
          {Center && <Center width={26} height={26} x={-13} y={-13} />}
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
