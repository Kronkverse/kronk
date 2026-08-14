import type {
  ComponentType,
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  SVGProps,
} from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import KeyboardArrowDownIcon from '@/material-icons/400-24px/keyboard_arrow_down.svg?react';

// KronkDial — a concentric-wheel picker. Two rings (outer = category /
// medium, inner = lens / view mode) rotate independently under a fixed
// pie-wedge "needle" pinned at 3 o'clock. The centre hub shows the
// currently-shown outer slice + a chevron affordance for a drop-down
// alternative. Built for the Art korner (Tal 2026-08-14 screencast)
// but intentionally decoupled from any specific domain so it can be
// reused by per-discipline korners later.
//
// Rotation:
//   * Pointer-down inside the wheel captures the pointer, then
//     each move rotates the whole SVG by (currentAngle − startAngle)
//     around its centre. Pointer-up snaps to the nearest slice.
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
//   * The needle wedge sits in a non-rotating overlay layer, so the
//     rings spin under it (physical-dial mental model).

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
const R_WEDGE_INNER = 34; // inner boundary of the fixed needle wedge
const R_WEDGE_OUTER = 78; // outer boundary
const BUBBLE_R = 12; // per-bubble radius

// The needle pins to 3 o'clock (positive x-axis in SVG's y-down world
// = 0° in atan2 terms). We rotate the wheel so the selected slice
// lands under the needle: `rotation = -index * (360 / count)`.
const NEEDLE_BEARING = 0;

// Snap-back animation duration (drag release → nearest slice).
const SNAP_MS = 260;

// ── Helpers ──────────────────────────────────────────────────────

const polar = (radius: number, angleDeg: number): [number, number] => {
  const rad = (angleDeg * Math.PI) / 180;
  return [radius * Math.cos(rad), radius * Math.sin(rad)];
};

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
      if (step > 0 && count > 0) {
        // A CW drag increases the offset; each `step` degrees of drag
        // rotates the wheel one slice. The offset is measured against
        // the wheel, not the world, so subtract (the wheel rotates
        // CCW under the needle to bring the next slice CW into view).
        const stepsMoved = Math.round(dragOffset / step);
        const next = normDeg(
          (dragOrigin.current.targetIndex - stepsMoved) * step,
        );
        const nextIndex = Math.round(next / step) % count;
        if (ring === 'outer' && nextIndex !== outerIndex) {
          onOuterChange(nextIndex);
        } else if (
          ring === 'inner' &&
          nextIndex !== innerIndex &&
          onInnerChange
        ) {
          onInnerChange(nextIndex);
        }
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
      onOuterChange,
      onInnerChange,
    ],
  );

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

  // Static geometry — recomputed only when the ring shape changes.
  const outerSlices = useMemo(
    () =>
      outer.map((slice, i) => {
        const angle = i * outerStep;
        const [lx, ly] = polar(R_OUTER_LABEL, angle);
        const [tx1, ty1] = polar(R_OUTER_TICK_START, angle);
        const [tx2, ty2] = polar(R_OUTER_TICK_END, angle);
        return {
          slice,
          index: i,
          angle,
          label: { x: lx, y: ly },
          tick: { x1: tx1, y1: ty1, x2: tx2, y2: ty2 },
        };
      }),
    [outer, outerStep],
  );

  const innerBubbles = useMemo(
    () =>
      (inner ?? []).map((bubble, i) => {
        const angle = i * innerStep;
        const [x, y] = polar(R_INNER_BUBBLE, angle);
        return { bubble, index: i, angle, x, y };
      }),
    [inner, innerStep],
  );

  // Total rotations — base offset + live drag while active.
  const outerRotation =
    baseOuterRotation + (dragTarget === 'outer' ? dragOffset : 0);
  const innerRotation =
    baseInnerRotation + (dragTarget === 'inner' ? dragOffset : 0);

  const dialStyle: CSSProperties = {
    // While dragging, kill the snap transition so the wheel tracks
    // the pointer 1:1; when the drag ends, the transition re-enables
    // and the wheel eases to the snap position.
    '--snap-transition': dragTarget ? '0ms' : `${SNAP_MS}ms`,
  } as CSSProperties;

  const centerBubble = inner?.[innerIndex];
  const Center = CenterIcon ?? centerBubble?.Icon;

  // The needle wedge — a pie slice centred on 3 o'clock, drawn once
  // in the non-rotating overlay layer.
  const wedgePath = useMemo(() => {
    const halfSpan = (outerStep || 30) / 2;
    const [x1, y1] = polar(R_WEDGE_OUTER, NEEDLE_BEARING - halfSpan);
    const [x2, y2] = polar(R_WEDGE_OUTER, NEEDLE_BEARING + halfSpan);
    const [xi1, yi1] = polar(R_WEDGE_INNER, NEEDLE_BEARING - halfSpan);
    const [xi2, yi2] = polar(R_WEDGE_INNER, NEEDLE_BEARING + halfSpan);
    return [
      `M ${xi1} ${yi1}`,
      `L ${x1} ${y1}`,
      `A ${R_WEDGE_OUTER} ${R_WEDGE_OUTER} 0 0 1 ${x2} ${y2}`,
      `L ${xi2} ${yi2}`,
      `A ${R_WEDGE_INNER} ${R_WEDGE_INNER} 0 0 0 ${xi1} ${yi1}`,
      'Z',
    ].join(' ');
  }, [outerStep]);

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
      style={dialStyle}
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
        {/* Outer ring — labels + tick marks. Wrapped in a rotating
            group so a drag or index change spins the whole thing;
            each slice sits at its own angle inside that group. */}
        <g
          className='kronk-dial__outer'
          style={{ transform: `rotate(${outerRotation}deg)` }}
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
          {outerSlices.map(({ slice, angle, label, tick, index }) => {
            const isActive = index === outerIndex;
            // Text needs to sit upright at any wheel rotation — the
            // outer group's transform rotates the label, so counter-
            // rotate here by (-outerRotation - angle) so the glyph
            // ends up horizontal.
            const counterRotation = -outerRotation - angle;
            return (
              <g
                key={slice.key}
                className={
                  isActive
                    ? 'kronk-dial__outer-slice kronk-dial__outer-slice--active'
                    : 'kronk-dial__outer-slice'
                }
              >
                <line
                  x1={tick.x1}
                  y1={tick.y1}
                  x2={tick.x2}
                  y2={tick.y2}
                  className='kronk-dial__tick'
                />
                <text
                  x={label.x}
                  y={label.y}
                  className='kronk-dial__outer-label'
                  transform={`rotate(${angle} ${label.x} ${label.y}) rotate(${counterRotation} ${label.x} ${label.y})`}
                  textAnchor='middle'
                  dominantBaseline='middle'
                >
                  {slice.label}
                </text>
                {typeof slice.count === 'number' && (
                  <text
                    x={label.x}
                    y={label.y + 8}
                    className='kronk-dial__outer-count'
                    transform={`rotate(${angle} ${label.x} ${label.y}) rotate(${counterRotation} ${label.x} ${label.y})`}
                    textAnchor='middle'
                    dominantBaseline='middle'
                  >
                    {slice.count}
                  </text>
                )}
              </g>
            );
          })}
        </g>

        {/* Inner ring — icon bubbles at fixed angular positions. Same
            rotating-group trick as the outer ring. */}
        {inner && (
          <g
            className='kronk-dial__inner'
            style={{ transform: `rotate(${innerRotation}deg)` }}
            onPointerDown={handlePointerDown('inner')}
            onPointerMove={handlePointerMove}
            onPointerUp={settleDrag}
            onPointerCancel={settleDrag}
          >
            {innerBubbles.map(({ bubble, x, y, index }) => {
              const isActive = index === innerIndex;
              const BubbleIcon = bubble.Icon;
              return (
                <g
                  key={bubble.key}
                  className={
                    isActive
                      ? 'kronk-dial__bubble kronk-dial__bubble--active'
                      : 'kronk-dial__bubble'
                  }
                  transform={`translate(${x} ${y})`}
                >
                  <circle r={BUBBLE_R} />
                  <g
                    // Bubble icons should stay upright — counter-
                    // rotate against the ring's live rotation.
                    transform={`rotate(${-innerRotation})`}
                  >
                    <BubbleIcon width={16} height={16} x={-8} y={-8} />
                  </g>
                </g>
              );
            })}
          </g>
        )}

        {/* Fixed overlay layer — needle wedge + centre hub sit outside
            the rotating groups so they don't spin. */}
        <g className='kronk-dial__needle' aria-hidden>
          <path d={wedgePath} className='kronk-dial__wedge' />
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
