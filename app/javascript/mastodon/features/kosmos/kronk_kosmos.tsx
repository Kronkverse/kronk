// KronkKosmos — the ambient background layer.
//
// A single full-viewport canvas mounted at KronkFrame level (see
// docs/kronk_frame.md), painting the Mates orb cross-section as it
// sweeps crown → floor → crown once per ~10 minutes. Every star is a
// real chord crossing at that depth; density is the graph, not
// decoration. Peak alpha is a ceiling, not a target — the layer must
// read as threshold-of-perception, never as visualisation.
//
// This is the only component in Kronk that fix-positions outside a
// KronkFrame slot by design. Standard L11 (Frame parasite) skips it
// via the .kronk-kosmos-layer allow-list; the Inflow veil (later)
// modulates its brightness via features/kosmos/brightness.

import { useEffect, useRef } from 'react';

import { useIsDocumentVisible } from 'mastodon/hooks/useIsDocumentVisible';

import { getKosmosBrightness } from './brightness';
import {
  buildGeometry,
  readPalette,
  renderFrame,
  HALF_CYCLE_MS,
} from './renderer';
import { useMatesOrb } from './use_mates_orb';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export const KronkKosmos = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const orb = useMatesOrb();
  const isVisible = useIsDocumentVisible();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const palette = readPalette();
    const geometry = buildGeometry(orb, palette);

    // Match device pixel ratio without a ctx.scale — the mockup +
    // renderer multiply pixel-space math by dpr directly, so the
    // canvas backing store just needs to be sized for the target dpr.
    let W = 0;
    let H = 0;
    let dpr = 1;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio, 2);
      W = window.innerWidth * dpr;
      H = window.innerHeight * dpr;
      canvas.width = W;
      canvas.height = H;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
    };
    resize();

    // Reduced-motion is a live subscription — flip mid-session if the
    // user toggles the OS pref, and the sweep freezes on the next
    // frame.
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
    };
    // isVisible in the dep list restarts the loop when the tab
    // regains focus — rAF is already suspended by the browser on
    // hidden tabs, but restarting resets the frame timing so no huge
    // dt lands on the first return frame.
  }, [orb, isVisible]);

  return (
    <canvas ref={canvasRef} className='kronk-kosmos-layer' aria-hidden='true' />
  );
};
