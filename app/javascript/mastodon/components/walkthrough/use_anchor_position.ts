import { useCallback, useEffect, useState } from 'react';

// Measures a walkthrough anchor and, on desktop, picks a placement
// (top / bottom / left / right) with the most room. Returns a rect for
// the spotlight hole + a bubble position + arrow side.
//
// Mobile (< 768px) is handled by CSS — the bubble docks to the bottom
// as a fixed sheet, so we don't compute a position for it. The
// spotlight hole still tracks the anchor above the sheet.

export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface Placement {
  rect: Rect | null;
  bubble: { top: number; left: number } | null;
  arrow: { side: 'top' | 'bottom' | 'left' | 'right'; offset: number } | null;
}

const MOBILE_MAX = 767;
const GAP = 16;

function measure(anchor: string | null): Rect | null {
  if (!anchor) return null;
  if (typeof document === 'undefined') return null;
  const el = document.querySelector(`[data-walkthrough-anchor="${anchor}"]`);
  if (!(el instanceof HTMLElement)) return null;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function placeDesktop(rect: Rect, bw: number, bh: number): Placement {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const rooms = {
    bottom: vh - (rect.top + rect.height),
    top: rect.top,
    right: vw - (rect.left + rect.width),
    left: rect.left,
  };
  const side = (Object.entries(rooms).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    'bottom') as 'top' | 'bottom' | 'left' | 'right';
  let top = 0;
  let left = 0;
  switch (side) {
    case 'bottom':
      top = rect.top + rect.height + GAP;
      left = Math.max(
        12,
        Math.min(rect.left + rect.width / 2 - bw / 2, vw - bw - 12),
      );
      return {
        rect,
        bubble: { top, left },
        arrow: { side: 'top', offset: rect.left + rect.width / 2 - left },
      };
    case 'top':
      top = rect.top - bh - GAP;
      left = Math.max(
        12,
        Math.min(rect.left + rect.width / 2 - bw / 2, vw - bw - 12),
      );
      return {
        rect,
        bubble: { top, left },
        arrow: { side: 'bottom', offset: rect.left + rect.width / 2 - left },
      };
    case 'right':
      left = rect.left + rect.width + GAP;
      top = Math.max(
        12,
        Math.min(rect.top + rect.height / 2 - bh / 2, vh - bh - 12),
      );
      return {
        rect,
        bubble: { top, left },
        arrow: { side: 'left', offset: rect.top + rect.height / 2 - top },
      };
    case 'left':
      left = rect.left - bw - GAP;
      top = Math.max(
        12,
        Math.min(rect.top + rect.height / 2 - bh / 2, vh - bh - 12),
      );
      return {
        rect,
        bubble: { top, left },
        arrow: { side: 'right', offset: rect.top + rect.height / 2 - top },
      };
  }
}

function placeCentre(bw: number, bh: number): Placement {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return {
    rect: null,
    bubble: { top: (vh - bh) / 2, left: (vw - bw) / 2 },
    arrow: null,
  };
}

interface Args {
  anchor: string | null;
  bubbleEl: HTMLElement | null;
  // Bumped when the runner wants a fresh measurement (step change,
  // navigation, resize). Callers can plumb the current step id here.
  seed: unknown;
}

export function useAnchorPosition({ anchor, bubbleEl, seed }: Args): Placement {
  const [placement, setPlacement] = useState<Placement>({
    rect: null,
    bubble: null,
    arrow: null,
  });

  const recompute = useCallback(() => {
    if (!bubbleEl) return;
    const bw = bubbleEl.offsetWidth;
    const bh = bubbleEl.offsetHeight;
    const isMobile =
      typeof window !== 'undefined' && window.innerWidth <= MOBILE_MAX;
    const rect = measure(anchor);
    if (isMobile) {
      // Bubble docks bottom via CSS; still surface the rect so the
      // spotlight ring can wrap the anchor above.
      setPlacement({ rect, bubble: null, arrow: null });
      return;
    }
    if (!rect) {
      setPlacement(placeCentre(bw, bh));
      return;
    }
    setPlacement(placeDesktop(rect, bw, bh));
  }, [anchor, bubbleEl]);

  useEffect(() => {
    // Two-frame defer: one for the just-navigated route to render the
    // anchor into the DOM, one for the bubble to lay out so its offset
    // dimensions are correct before we place it.
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(recompute);
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [recompute, seed]);

  useEffect(() => {
    const onResize = () => {
      recompute();
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, [recompute]);

  return placement;
}
