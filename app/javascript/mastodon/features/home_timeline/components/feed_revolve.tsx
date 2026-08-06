import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

import { useDrag } from '@use-gesture/react';

import { usePrevious } from '@/mastodon/hooks/usePrevious';
import { reduceMotion } from '@/mastodon/initial_state';

interface Props {
  reach: string;
  order: string[];
  onScopeChange: (key: string) => void;
  children: React.ReactNode;
}

// FeedRevolve — the home feed's carousel transition.
//
// When the feed scope changes (via the mini ScopeCarousel above, or a
// horizontal swipe on touch), the feed rides in on the SAME barrel the scope
// selector turns on: it orbits a vertical axis `radius` behind the screen —
// `translateZ(-R) rotateY(θ) translateZ(R)` — so the incoming face arcs in from
// the side and swings flat to the front, shaded by a veil (darkens the turning
// edge) and a sheen (lifts the leading one). It reuses the selector's exact
// geometry (radius = w/2·cot(π/n), one step = 360/n) and its 1000ms turn, so the
// feed and the selector read as one solid body turning together.
//
// It only ever renders ONE face (the live feed): the outgoing content is gone
// the instant scope commits, and the new content swings in. It *feels* like a
// carousel without paying to mount two full feeds.
//
// Two responsibilities:
//   1. Play a one-shot barrel-in whenever `reach` changes (direction and step
//      taken from the scope's position in `order`).
//   2. Own a strictly axis-locked horizontal swipe that steps scope, guarded so
//      it never fights vertical scroll or a horizontally scrollable child
//      (media gallery, moments strip).
//
// Reduced motion collapses (1) to an instant swap; the swipe still works.

const PERSPECTIVE = 1200;

// Walk up from a swipe's target to `stop`, bailing if any ancestor is itself
// horizontally scrollable — those own the horizontal axis and must not have
// their scroll stolen to change scope.
const hasHorizontalScrollAncestor = (
  target: EventTarget | null,
  stop: Element | null,
): boolean => {
  let node = target instanceof Element ? target : null;
  while (node && node !== stop) {
    if (node.scrollWidth > node.clientWidth + 1) {
      const overflowX = getComputedStyle(node).overflowX;
      if (overflowX === 'auto' || overflowX === 'scroll') return true;
    }
    node = node.parentElement;
  }
  return false;
};

export const FeedRevolve: React.FC<Props> = ({
  reach,
  order,
  onScopeChange,
  children,
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);
  const sheenRef = useRef<HTMLDivElement>(null);
  const radiusRef = useRef(0);
  const prevReach = usePrevious(reach);

  const n = order.length;
  const step = n > 1 ? 360 / n : 0;

  // Size the barrel radius to the feed's own width, using the same cylinder
  // geometry the selector uses for `n` faces — so both turn on a barrel of the
  // same curvature. Re-measured on resize.
  const layout = useCallback(() => {
    const w = rootRef.current?.clientWidth ?? 0;
    radiusRef.current = n > 1 ? w / 2 / Math.tan(Math.PI / n) : w;
  }, [n]);

  useLayoutEffect(() => {
    layout();
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', layout);
      return () => {
        window.removeEventListener('resize', layout);
      };
    }
    const ro = new ResizeObserver(layout);
    ro.observe(root);
    return () => {
      ro.disconnect();
    };
  }, [layout]);

  // Jump the face to `startAngle` on the barrel (no transition), then let CSS
  // ease it home to the front — the turn. Veil/sheen opacities are keyed to the
  // angle exactly as the selector shades each face.
  const revolveFrom = useCallback((startAngle: number) => {
    const stage = stageRef.current;
    if (!stage) return;
    const veil = veilRef.current;
    const sheen = sheenRef.current;
    const R = radiusRef.current;
    const orbit = (a: number) =>
      `translateZ(${-R}px) rotateY(${a}deg) translateZ(${R}px)`;
    const t = Math.min(Math.abs(startAngle) / 90, 1);
    const sheenO = Math.abs(Math.sin((startAngle * Math.PI) / 180)) * 0.9;

    // Frame 0: snap to the side of the barrel, transitions off.
    stage.style.transition = 'none';
    stage.style.transform = orbit(startAngle);
    if (veil) {
      veil.style.transition = 'none';
      veil.style.opacity = (t * 0.7).toFixed(3);
    }
    if (sheen) {
      sheen.style.transition = 'none';
      sheen.style.opacity = sheenO.toFixed(3);
    }

    // Commit that frame, then hand back to the CSS transition and settle to
    // front — the barrel turns.
    void stage.offsetWidth;
    stage.style.transition = '';
    stage.style.transform = orbit(0);
    if (veil) {
      veil.style.transition = '';
      veil.style.opacity = '0';
    }
    if (sheen) {
      sheen.style.transition = '';
      sheen.style.opacity = '0';
    }
  }, []);

  // (1) Barrel-in whenever the scope actually changes. Forward through `order`
  // (or unknown) enters from the right (+step); backward enters from the left.
  useEffect(() => {
    if (prevReach === undefined || prevReach === reach) return;
    if (reduceMotion || step === 0) return;
    const from = order.indexOf(prevReach);
    const to = order.indexOf(reach);
    const dir = to >= 0 && from >= 0 && to < from ? -1 : 1;
    revolveFrom(dir * step);
  }, [reach, prevReach, order, step, revolveFrom]);

  // (2) Swipe to step scope — touch only, strictly horizontal.
  const stepScope = useCallback(
    (delta: number) => {
      const idx = order.indexOf(reach);
      if (idx < 0) return;
      const nextKey = order[idx + delta];
      if (nextKey === undefined) return;
      onScopeChange(nextKey);
    },
    [order, reach, onScopeChange],
  );

  const bind = useDrag(
    ({ event, swipe: [swipeX], tap }) => {
      if (tap || swipeX === 0) return;
      // Touch only — don't hijack desktop mouse drags or text selection.
      if ('pointerType' in event && event.pointerType !== 'touch') return;
      if (hasHorizontalScrollAncestor(event.target, rootRef.current)) return;
      // swipeX = -1 (flick left) → next scope; +1 (flick right) → previous.
      stepScope(swipeX === -1 ? 1 : -1);
    },
    { axis: 'x', filterTaps: true, pointer: { touch: true } },
  );

  return (
    <div
      className='feed-revolve'
      ref={rootRef}
      style={{
        perspective: `${PERSPECTIVE}px`,
        perspectiveOrigin: '50% 42%',
      }}
    >
      {/* touch-action: pan-y hands the vertical axis to the browser so the
          swipe binding only ever competes for horizontal gestures. */}
      <div
        {...bind()}
        ref={stageRef}
        className='feed-revolve__stage'
        style={{ touchAction: 'pan-y' }}
      >
        {children}
        <div className='feed-revolve__veil' ref={veilRef} aria-hidden='true' />
        <div
          className='feed-revolve__sheen'
          ref={sheenRef}
          aria-hidden='true'
        />
      </div>
    </div>
  );
};
