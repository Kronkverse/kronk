// The Huddle call (the Main Huddle's or a Kuddle's), outside any page, so
// moving around Kronk never ends it (docs/spaces/huddle.md, The call follows
// you). Tomas's approach (#2118): the Jitsi iframe lives in a container on
// document.body that no React component owns. Built on (2026-10-19): the
// container always sits over a "slot", the call area on the call's page or
// the video area of the floating mini window, and is moved, never rebuilt,
// when the slot changes. So the call keeps its video and mic as you go.
//
// live/index.tsx (the Main Huddle), live/room.tsx (a Kuddle) and
// huddle_pip/index.tsx all import from here; this file imports from none of
// them, which keeps the module graph free of cycles. The
// call itself, and the state Kronk's controls show, is mastodon/jitsi.ts's
// Call, so the mini window picks up where the page left off.

import type { Call } from 'mastodon/jitsi';

// Which call it is: the Main Huddle (`huddle`) or one Kuddle
// (`kuddle:<id>`). The mini window names it and goes back to its page, and a
// page only picks up a call that is its own.
export interface CallPlace {
  key: string;
  path: string;
  // A Kuddle's name; the Main Huddle is just "Huddle".
  name?: string;
}

interface Session {
  call: Call;
  container: HTMLDivElement;
  place: CallPlace;
}

let session: Session | null = null;
let slot: HTMLElement | null = null;
let observer: ResizeObserver | null = null;
let frame = 0;

// Stacking: over the Huddle page's content when docked; over everything but
// dialogs when floating, just above the mini window's own frame.
const Z_DOCKED = '10';
export const Z_FLOATING = 1001;

export const getJitsiSession = (): Session | null => session;

// The call going on for this place, if that's the one going on.
export const getJitsiSessionFor = (key: string): Session | null =>
  session?.place.key === key ? session : null;

// A container for a new call, on document.body, hidden until a slot claims it.
export const createJitsiContainer = (): HTMLDivElement => {
  const container = document.createElement('div');
  container.className = 'huddle-call';
  Object.assign(container.style, {
    position: 'fixed',
    visibility: 'hidden',
    pointerEvents: 'none',
  });
  document.body.appendChild(container);
  return container;
};

// One call at a time: starting one (a Kuddle while the Main Huddle is in
// the mini window, say) ends the one before.
export const setJitsiSession = (next: Session): void => {
  if (session && session.call !== next.call) {
    session.call.dispose();
    session.container.remove();
  }
  session = next;
  place();
};

// End the call. Given one, only if it's still the call going on, so a call
// already replaced can't end the one that replaced it.
export const disposeJitsiSession = (call?: Call): void => {
  if (!session || (call && session.call !== call)) return;
  session.call.dispose();
  session.container.remove();
  session = null;
  detach();
};

const place = () => {
  frame = 0;
  if (!session) return;
  const { container } = session;
  if (!slot?.isConnected) {
    // Nowhere to show it: keep the call going, out of sight.
    container.style.visibility = 'hidden';
    container.style.pointerEvents = 'none';
    return;
  }
  const r = slot.getBoundingClientRect();
  const floating = slot.dataset.huddleSlot === 'floating';
  Object.assign(container.style, {
    top: `${r.top}px`,
    left: `${r.left}px`,
    width: `${r.width}px`,
    height: `${r.height}px`,
    visibility: 'visible',
    pointerEvents: 'auto',
    zIndex: floating ? String(Z_FLOATING) : Z_DOCKED,
    borderRadius: floating ? 'var(--radius-medium)' : '0',
    overflow: 'hidden',
  });
};

// Re-place on the next frame: scrolling, resizing, or the slot moving
// (the mini window being dragged).
export const placeJitsiSession = (): void => {
  if (frame) return;
  frame = window.requestAnimationFrame(place);
};

const detach = () => {
  observer?.disconnect();
  observer = null;
  window.removeEventListener('resize', placeJitsiSession);
  window.removeEventListener('scroll', placeJitsiSession, true);
};

// Show the call over `el`, or nowhere (null). A slot that has been replaced
// in the meantime is ignored when it lets go, so a page leaving after the
// mini window took over doesn't hide the call.
export const setJitsiSlot = (
  el: HTMLElement | null,
  owner?: HTMLElement,
): void => {
  if (el === null && owner && slot !== owner) return;
  detach();
  slot = el;
  if (el) {
    observer = new ResizeObserver(placeJitsiSession);
    observer.observe(el);
    window.addEventListener('resize', placeJitsiSession);
    window.addEventListener('scroll', placeJitsiSession, true);
  }
  place();
};
