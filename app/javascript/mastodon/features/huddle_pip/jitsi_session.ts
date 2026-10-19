// The Huddle call, outside any page, so moving around Kronk never ends it
// (docs/spaces/huddle.md, The call follows you). Tomas's approach (#2118):
// the Jitsi iframe lives in a container on document.body that no React
// component owns. Built on (2026-10-19): the container always sits over a
// "slot", the call area on the Huddle page or the video area of the floating
// mini window, and is moved, never rebuilt, when the slot changes. So the
// call keeps its video and mic as you go.
//
// live/index.tsx and huddle_pip/index.tsx both import from here; this file
// imports from neither, which keeps the module graph free of cycles.

export interface JitsiApi {
  dispose: () => void;
  addListener: (event: string, callback: (data?: unknown) => void) => void;
  executeCommand: (command: string, ...args: string[]) => void;
  getNumberOfParticipants: () => number;
  isAudioMuted?: () => Promise<boolean>;
  isVideoMuted?: () => Promise<boolean>;
}

interface Session {
  api: JitsiApi;
  container: HTMLDivElement;
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

export const setJitsiSession = (next: Session): void => {
  session = next;
  place();
};

export const disposeJitsiSession = (): void => {
  if (!session) return;
  session.api.dispose();
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
