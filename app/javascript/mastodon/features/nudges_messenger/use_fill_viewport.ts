import { useLayoutEffect } from 'react';
import type { RefObject } from 'react';

// Size an element from its own top edge down to the bottom of what the
// viewer can actually see: the top of the phone's pillar nav when that is
// on screen, otherwise the bottom of the visible viewport (which is above
// the on-screen keyboard while that is up).
//
// The messenger used to get its height from CSS, by pinning the page and
// every ancestor to `100vh`. On a phone `100vh` is the tallest the page can
// ever be, with the browser's address bar tucked away; whenever the bar was
// showing, the bottom of the page, and the composer with it, sat below the
// screen (Tal 2026-10-12, Kommons proposal "Text box below screen"). The
// dynamic units were tried and lagged. Measuring is the one thing that is
// right in every state, so the height is measured.
export const useFillViewport = (ref: RefObject<HTMLElement>): void => {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const viewport = window.visualViewport;
    let frame = 0;

    const fit = () => {
      frame = 0;
      const top = el.getBoundingClientRect().top;
      const visibleBottom = viewport
        ? viewport.offsetTop + viewport.height
        : window.innerHeight;

      let bottom = visibleBottom;
      const band = document.querySelector('.kronk-frame__bottom-band');
      if (band) {
        const rect = band.getBoundingClientRect();
        if (rect.height > 0 && rect.top > top && rect.top < visibleBottom)
          bottom = rect.top;
      }

      el.style.height = `${Math.max(0, Math.round(bottom - top))}px`;
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(fit);
    };

    fit();

    viewport?.addEventListener('resize', schedule);
    viewport?.addEventListener('scroll', schedule);
    window.addEventListener('resize', schedule);

    // The element's top moves when the title row above it comes or goes
    // (it is hidden on a phone while a chat is open). Nothing resizes when
    // that happens, so watch the Stage for the change itself.
    const stage = el.closest('.kronk-stage') ?? document.body;
    const observer = new MutationObserver(schedule);
    observer.observe(stage, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => {
      if (frame) cancelAnimationFrame(frame);
      viewport?.removeEventListener('resize', schedule);
      viewport?.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      observer.disconnect();
    };
  }, [ref]);
};
