import { useEffect } from 'react';

import { useHistory } from 'react-router-dom';

import { SCREENS } from './sections';

// A sideways swipe on a phone moves between the five screens, YOU, Share,
// Home, Explore and Join, side by side (Tal, 2026-11-01): a finger moving
// right brings the screen on the left. Only on those five screens, and
// only for a swipe that nothing under the finger wants for itself, so a
// row that scrolls sideways, a map, a slider or a text field keeps its own
// gesture. No animation, so there is no motion to reduce.

// How far and how flat a swipe has to be, and how quick.
const MIN_DISTANCE = 64;
const MAX_SLOPE = 0.6;
const MAX_MS = 700;

// Something under the finger that takes sideways gestures itself.
const claimsSwipe = (target: EventTarget | null): boolean => {
  let el = target instanceof Element ? target : null;
  while (el && el !== document.body) {
    if (
      el.matches(
        'input, textarea, select, [contenteditable], canvas, video, [role="slider"], [data-no-swipe], .maplibregl-map, .leaflet-container, .modal-root__modal',
      )
    )
      return true;
    const { overflowX } = getComputedStyle(el);
    if (
      (overflowX === 'auto' || overflowX === 'scroll') &&
      el.scrollWidth > el.clientWidth
    )
      return true;
    el = el.parentElement;
  }
  return false;
};

export const SectionSwipe: React.FC = () => {
  const history = useHistory();

  useEffect(() => {
    let start: { x: number; y: number; t: number } | null = null;

    const onStart = (e: TouchEvent) => {
      const touch = e.touches.item(0);
      start =
        e.touches.length === 1 &&
        touch &&
        SCREENS.includes(history.location.pathname) &&
        !claimsSwipe(e.target)
          ? { x: touch.clientX, y: touch.clientY, t: Date.now() }
          : null;
    };

    const onEnd = (e: TouchEvent) => {
      const touch = e.changedTouches.item(0);
      if (!start || !touch) return;
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      const quick = Date.now() - start.t <= MAX_MS;
      start = null;
      if (!quick || Math.abs(dx) < MIN_DISTANCE) return;
      if (Math.abs(dy) > Math.abs(dx) * MAX_SLOPE) return;

      const at = SCREENS.indexOf(history.location.pathname);
      const next = SCREENS.at(dx > 0 ? at - 1 : at + 1);
      if (at < 0 || !next || (dx > 0 && at === 0)) return;
      history.push(next);
    };

    const onCancel = () => {
      start = null;
    };

    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchend', onEnd, { passive: true });
    document.addEventListener('touchcancel', onCancel, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onCancel);
    };
  }, [history]);

  return null;
};
