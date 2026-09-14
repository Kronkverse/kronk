import { getKosmosBrightness } from './brightness';
import {
  buildGeometry,
  readPalette,
  renderFrame,
  HALF_CYCLE_MS,
} from './renderer';
import type { OrbData } from './use_mates_orb';

// The Kosmos on Rails-served pages — sign-in, the landing page,
// everything under /kronk/*.
//
// Those pages used to get a CSS lookalike: the right void colour and horizon
// glow, and then a tiled SVG starfield of about twenty invented stars per
// tile. It read as the Kosmos and contained nothing. That is the same sin as
// the orb fixture deleted in August: decoration dressed as substance, on the
// first page anyone ever sees.
//
// So they get the real renderer instead. Same geometry, same palette, same
// ten-minute sweep as the canvas inside the app — drawn here without React,
// which costs nothing because the renderer never needed it.
//
// What they do not get is the community, and cannot: `/api/v1/kommunity/orb`
// requires a signed-in user, and publishing the follow graph to a signed-out
// page is a decision about people's connections, not about a background. So
// the sphere draws with no accounts in it, which is exactly what the app
// itself shows when the orb cannot be reached — 150 dim sockets that read as
// room to grow. Honest, and identical in character to the real thing rather
// than an imitation of it.

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const EMPTY_ORB: OrbData = {
  generated_at: new Date().toISOString(),
  socket_count: 150,
  provenance: 'static-empty',
  accounts: [],
  follows: [],
};

export const mountStaticKosmos = (
  host: HTMLElement,
): (() => void) | undefined => {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.className = 'kronk-kosmos-static__canvas';
  host.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;

  const palette = readPalette();
  const geometry = buildGeometry(EMPTY_ORB, palette);
  const dpr = Math.min(2, window.devicePixelRatio || 1);

  let W = 0;
  let H = 0;

  const resize = () => {
    W = Math.floor(window.innerWidth * dpr);
    H = Math.floor(window.innerHeight * dpr);
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
  };
  resize();

  const reducedMedia = window.matchMedia(REDUCED_MOTION_QUERY);
  let reduced = reducedMedia.matches;
  const onReducedChange = (event: MediaQueryListEvent) => {
    reduced = event.matches;
  };
  reducedMedia.addEventListener('change', onReducedChange);
  window.addEventListener('resize', resize);

  let phase = 0;
  let last = performance.now();
  let raf = 0;
  let stopped = false;

  const loop = (now: number) => {
    if (stopped) return;
    const dt = Math.min(60, now - last);
    last = now;
    if (!reduced) phase += dt / HALF_CYCLE_MS;
    renderFrame(ctx, geometry, palette, W, H, dpr, {
      now,
      phase,
      brightness: getKosmosBrightness(),
      showThreads: true,
      reduced,
    });
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    reducedMedia.removeEventListener('change', onReducedChange);
    canvas.remove();
  };
};

// Called from the Rails entrypoints. No-op when the layer is absent — not
// every Rails layout renders it (the void layout deliberately skips the
// shared chrome).
export const mountStaticKosmosIfPresent = (): void => {
  const host = document.querySelector<HTMLElement>('.kronk-kosmos-static');
  if (!host) return;

  mountStaticKosmos(host);
};
