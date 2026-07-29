import { useEffect, useMemo, useRef } from 'react';

import {
  getMoonIllumination,
  getMoonPhaseName,
  getMoonRiseSet,
  getDaylightInfo,
} from 'mastodon/features/events/components/celestial_calendar';

import { buildDailyIntegrationText } from './components/daily_integration';
import { LOCATION_LAT, LOCATION_LON, LOCATION_TZ } from './constants';

// The InFlow veil — the feed parts to open onto the night sky.
//
// As you scroll to it, the neighbouring posts pin to the top and bottom edges
// and separate, framing an opening that reveals a brighter field of the same
// purple-star motif used platform-wide, with tonight's moon and reading
// floating in it — then they close back over. The same scene drives the
// standalone /hub/inflow page (where there are no neighbours to part, so it's
// just the reveal). All data is live for tonight's sky.

function melbourneDateParts(now: Date): {
  year: number;
  month: number;
  day: number;
} {
  const fmt = new Intl.DateTimeFormat('en-AU', {
    timeZone: LOCATION_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(now);
  const read = (type: string): number =>
    parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10);
  return { year: read('year'), month: read('month'), day: read('day') };
}

// getMoonPhaseName returns a snake_case key (e.g. "full_moon").
function fmtPhase(name: string): string {
  return name
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function fmtTime(d: Date | null): string {
  if (!d) return '—';
  return d.toLocaleTimeString('en-AU', {
    timeZone: LOCATION_TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  });
}

// The nearest scrolling ancestor — the Stage on /hub/inflow, the document in
// the (single-column) home feed. Falls back to the window.
function findScroller(el: HTMLElement): {
  target: HTMLElement | Window;
  isDoc: boolean;
} {
  let node = el.parentElement;
  while (node) {
    const oy = getComputedStyle(node).overflowY;
    if (
      (oy === 'auto' || oy === 'scroll') &&
      node.scrollHeight > node.clientHeight
    ) {
      return { target: node, isDoc: false };
    }
    node = node.parentElement;
  }
  return { target: window, isDoc: true };
}

// A phase-accurate moon: the terminator shadow slides across the disc by the
// live illumination (waning → shadow on the right). Silver face is physical,
// the shadow is the Kosmos void.
const VeilMoon: React.FC<{ illumination: number; waning: boolean }> = ({
  illumination,
  waning,
}) => {
  const R = 70;
  const cx = 100;
  const cy = 100;
  const offset = 2 * R * illumination;
  const shadowCx = waning ? cx + offset : cx - offset;

  return (
    <svg className='inflow-veil__moon' viewBox='0 0 200 200' aria-hidden='true'>
      <defs>
        <radialGradient id='veil-moon-face' cx='40%' cy='34%' r='78%'>
          <stop offset='0%' stopColor='#f6f4fc' />
          <stop offset='55%' stopColor='#dad7ec' />
          <stop offset='100%' stopColor='#b3afce' />
        </radialGradient>
        <filter id='veil-moon-soft' x='-30%' y='-30%' width='160%' height='160%'>
          <feGaussianBlur stdDeviation='6' />
        </filter>
      </defs>
      <circle cx={cx} cy={cy} r={R} fill='url(#veil-moon-face)' />
      <circle cx='78' cy='76' r='9' fill='#c4c1da' opacity='0.5' />
      <circle cx='118' cy='124' r='7' fill='#c4c1da' opacity='0.45' />
      <circle cx='92' cy='120' r='5' fill='#c4c1da' opacity='0.4' />
      <circle cx='66' cy='108' r='4' fill='#c4c1da' opacity='0.35' />
      {illumination < 0.985 && (
        <circle
          cx={shadowCx}
          cy={cy}
          r={R}
          fill='var(--kosmos-void, #040309)'
          filter='url(#veil-moon-soft)'
        />
      )}
    </svg>
  );
};

export const VeilScene: React.FC = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  const gapRef = useRef<HTMLDivElement>(null);
  const skyRef = useRef<HTMLDivElement>(null);
  const moonRef = useRef<HTMLDivElement>(null);
  const haloRef = useRef<HTMLDivElement>(null);
  const readRef = useRef<HTMLDivElement>(null);

  const sky = useMemo(() => {
    const now = new Date();
    const { year, month, day } = melbourneDateParts(now);
    const illum = getMoonIllumination(now);
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const waning = getMoonIllumination(tomorrow) < illum;
    return {
      illum,
      waning,
      phase: getMoonPhaseName(now),
      moon: getMoonRiseSet(year, month, day, LOCATION_LAT, LOCATION_LON),
      daylight: getDaylightInfo(year, month, day, LOCATION_LAT, LOCATION_LON),
      reflection: buildDailyIntegrationText(),
    };
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    const gap = gapRef.current;
    if (!root || !gap) return;

    const { target, isDoc } = findScroller(root);

    const topEdge = () =>
      isDoc ? 0 : (target as HTMLElement).getBoundingClientRect().top;
    const visibleHeight = () =>
      isDoc
        ? window.innerHeight
        : Math.max(
            320,
            window.innerHeight -
              (target as HTMLElement).getBoundingClientRect().top,
          );

    const setUnit = () => {
      root.style.setProperty('--veil-vh', `${visibleHeight()}px`);
    };
    setUnit();

    const clamp = (v: number, a: number, b: number) =>
      Math.max(a, Math.min(b, v));
    const smooth = (t: number) => {
      const c = clamp(t, 0, 1);
      return c * c * (3 - 2 * c);
    };

    // The neighbouring feed posts (this veil's item wrapper's siblings). We pin
    // them to the viewport edges during the reveal so the feed visibly parts;
    // track them so we can release their transforms cleanly.
    let pinnedPrev: HTMLElement | null = null;
    let pinnedNext: HTMLElement | null = null;
    let prevTy = 0;
    let nextTy = 0;
    const releasePins = () => {
      if (pinnedPrev) pinnedPrev.style.transform = '';
      if (pinnedNext) pinnedNext.style.transform = '';
      pinnedPrev = null;
      pinnedNext = null;
      prevTy = 0;
      nextTy = 0;
    };

    if (window.matchMedia('(prefers-reduced-motion:reduce)').matches) {
      window.addEventListener('resize', setUnit);
      return () => {
        window.removeEventListener('resize', setUnit);
        releasePins();
      };
    }

    const frame = () => {
      const top = topEdge();
      const view = visibleHeight();
      const gapRect = gap.getBoundingClientRect();
      const gapTop = gapRect.top - top;

      // Progress across the pinned range (0 as the opening engages, 1 as it
      // releases). `open` ramps up over the first third, holds, then eases back
      // down — a symmetric reveal.
      const denom = Math.max(1, gapRect.height - view);
      const p = clamp(-gapTop / denom, 0, 1);
      const open = Math.min(smooth(p / 0.32), smooth((1 - p) / 0.32));

      if (skyRef.current) skyRef.current.style.opacity = open.toFixed(3);
      if (moonRef.current)
        moonRef.current.style.transform = `translateY(${((0.5 - p) * 40).toFixed(2)}px) scale(${(0.9 + open * 0.1).toFixed(3)})`;
      if (haloRef.current)
        haloRef.current.style.opacity = (0.06 + open * 0.82).toFixed(3);
      if (readRef.current) {
        readRef.current.style.opacity = open.toFixed(3);
        readRef.current.style.transform = `translateY(${((1 - open) * 18).toFixed(2)}px)`;
      }

      // Part the feed: pin the post above near the top edge and the post below
      // near the bottom edge while open, so they frame the sky and separate.
      const item = root.parentElement;
      const prevItem = (item?.previousElementSibling ?? null) as HTMLElement | null;
      const nextItem = (item?.nextElementSibling ?? null) as HTMLElement | null;

      if (prevItem !== pinnedPrev) {
        if (pinnedPrev) pinnedPrev.style.transform = '';
        pinnedPrev = prevItem;
        prevTy = 0;
      }
      if (prevItem) {
        const naturalBottom = prevItem.getBoundingClientRect().bottom - prevTy;
        prevTy = (view * 0.14 - naturalBottom) * open;
        prevItem.style.transform = `translateY(${prevTy.toFixed(1)}px)`;
      }

      if (nextItem !== pinnedNext) {
        if (pinnedNext) pinnedNext.style.transform = '';
        pinnedNext = nextItem;
        nextTy = 0;
      }
      if (nextItem) {
        const naturalTop = nextItem.getBoundingClientRect().top - nextTy;
        nextTy = (view * 0.86 - naturalTop) * open;
        nextItem.style.transform = `translateY(${nextTy.toFixed(1)}px)`;
      }
    };

    // Sample every frame while the opening is on (or near) screen, so async
    // reflows above it — the friend-recommendation banner popping in, images
    // loading — never leave the reveal or the pinned posts stale. Gated by an
    // IntersectionObserver so it's idle everywhere else.
    let rafId = 0;
    let running = false;
    const loop = () => {
      frame();
      if (running) rafId = requestAnimationFrame(loop);
    };
    const start = () => {
      if (!running) {
        running = true;
        rafId = requestAnimationFrame(loop);
      }
    };
    const stop = () => {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      releasePins(); // hand the neighbouring posts back to the feed on leave
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          start();
        } else {
          stop();
        }
      },
      { rootMargin: '250px 0px' },
    );
    io.observe(root);

    const onResize = () => {
      setUnit();
      frame();
    };
    window.addEventListener('resize', onResize);
    frame();

    return () => {
      io.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      releasePins();
    };
  }, []);

  const lit = Math.round(sky.illum * 100);

  return (
    <div className='inflow-veil' ref={rootRef}>
      <div className='inflow-veil__gap' ref={gapRef}>
        <div className='inflow-veil__stage'>
          <div className='inflow-veil__sky' ref={skyRef} aria-hidden='true' />

          <div className='inflow-veil__moonwrap' ref={moonRef}>
            <div className='inflow-veil__halo' ref={haloRef} />
            <VeilMoon illumination={sky.illum} waning={sky.waning} />
          </div>

          <div className='inflow-veil__read' ref={readRef}>
            <h2 className='inflow-veil__read-title'>Beyond the veil</h2>
            <div className='inflow-veil__phase'>
              {fmtPhase(sky.phase)} · {lit}% lit
            </div>
            <p className='inflow-veil__reflection'>{sky.reflection}</p>
            <div className='inflow-veil__almanac'>
              <span>
                Moonrise <b>{fmtTime(sky.moon.rise)}</b>
              </span>
              <span>
                Moonset <b>{fmtTime(sky.moon.set)}</b>
              </span>
              <span>
                Sunrise <b>{fmtTime(sky.daylight.rise)}</b>
              </span>
              <span>
                Sunset <b>{fmtTime(sky.daylight.set)}</b>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
