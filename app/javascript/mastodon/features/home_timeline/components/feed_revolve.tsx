import { useEffect, useRef, useCallback } from 'react';

import { animated, useSpring } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';

import { usePrevious } from '@/mastodon/hooks/usePrevious';
import { reduceMotion } from '@/mastodon/initial_state';

interface Props {
  reach: string;
  order: string[];
  onScopeChange: (key: string) => void;
  children: React.ReactNode;
}

// FeedRevolve — the home feed's "revolving" scope transition.
//
// When the feed scope changes (via the mini ScopeCarousel above, or a
// horizontal swipe on touch), the whole feed column pivots on a vertical
// hinge and settles back — it *feels* like the feed revolved to a new face,
// without being a literal 3D barrel. The selector no longer spins; the feed
// does.
//
// Two responsibilities:
//   1. Play a one-shot enter-spring whenever `reach` changes (direction taken
//      from the scope's position in `order`).
//   2. Own a strictly axis-locked horizontal swipe that steps scope, guarded
//      so it never fights vertical scroll or a horizontally scrollable child
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
  const prevReach = usePrevious(reach);

  const [styles, api] = useSpring(() => ({
    rotateY: 0,
    x: '0%',
    scale: 1,
    opacity: 1,
  }));

  // (1) Revolve-in whenever the scope actually changes. The new face is set to
  // a pivoted/offset/faded state instantly, then springs back to rest — an
  // enter transition that reads as the column turning into view.
  useEffect(() => {
    if (prevReach === undefined || prevReach === reach) return;
    if (reduceMotion) {
      api.set({ rotateY: 0, x: '0%', scale: 1, opacity: 1 });
      return;
    }
    const from = order.indexOf(prevReach);
    const to = order.indexOf(reach);
    // dir -1 = stepped backward through the order (pivot in from the left);
    // +1 (or unknown) = forward, pivot in from the right.
    const dir = to >= 0 && from >= 0 && to < from ? -1 : 1;
    api.set({
      rotateY: dir * -18,
      x: `${dir * 8}%`,
      scale: 0.965,
      opacity: 0,
    });
    void api.start({
      rotateY: 0,
      x: '0%',
      scale: 1,
      opacity: 1,
      config: { tension: 210, friction: 24 },
    });
  }, [reach, prevReach, order, api]);

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
      style={{ perspective: `${PERSPECTIVE}px` }}
    >
      {/* touch-action: pan-y hands the vertical axis to the browser so the
          swipe binding only ever competes for horizontal gestures. */}
      <animated.div
        {...bind()}
        className='feed-revolve__stage'
        style={{ ...styles, touchAction: 'pan-y' }}
      >
        {children}
      </animated.div>
    </div>
  );
};
