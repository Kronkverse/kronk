import { useEffect, useMemo, useRef, useState } from 'react';

import { createPortal } from 'react-dom';

import {
  getMoonIllumination,
  getMoonPhaseName,
  getMoonRiseSet,
  getDaylightInfo,
} from 'mastodon/features/events/components/celestial_calendar';

import { buildDailyIntegrationText } from './components/daily_integration';
import { LOCATION_LAT, LOCATION_LON, LOCATION_TZ } from './constants';

// The InFlow veil — the feed parts to reveal a night sky that was always there.
//
// The night sky (moon + stars + reading) is a *fixed* backdrop: it does not
// scroll. There is an opening (aperture) in the feed, and the fixed sky is
// clipped to whatever slice of that opening is on screen — so as the post above
// scrolls up its lower edge uncovers the stationary moon (it emerges from
// underneath), you gaze at it while you read, and the post below then slides up
// and covers it over again. The sky is rendered through a portal to <body> so
// it escapes the feed's `contain`/overflow and can truly pin to the viewport.
// All data is live for tonight's sky.

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
  const apertureRef = useRef<HTMLDivElement>(null);
  const nightskyRef = useRef<HTMLDivElement>(null);

  // A body-level host for the fixed night sky, so it escapes the feed's
  // overflow/contain and pins to the viewport.
  const [host] = useState<HTMLElement | null>(() =>
    typeof document === 'undefined' ? null : document.createElement('div'),
  );

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
    if (!host) return;
    host.className = 'inflow-veil__host';
    document.body.appendChild(host);
    return () => {
      host.remove();
    };
  }, [host]);

  useEffect(() => {
    const aperture = apertureRef.current;
    const nightsky = nightskyRef.current;
    if (!aperture || !nightsky) return;

    const setUnit = () => {
      aperture.style.setProperty('--veil-vh', `${window.innerHeight}px`);
    };
    setUnit();

    // Clip the fixed night sky to the on-screen slice of the aperture. The sky
    // itself never moves; the clip edges are the edges of the posts above and
    // below, so scrolling uncovers and re-covers the stationary moon.
    const frame = () => {
      const r = aperture.getBoundingClientRect();
      const v = window.innerHeight;
      const top = Math.min(v, Math.max(0, r.top));
      const bot = Math.min(v, Math.max(0, r.bottom));
      nightsky.style.clipPath = `inset(${top.toFixed(1)}px 0 ${(v - bot).toFixed(1)}px 0)`;
    };

    let rafId = 0;
    let running = false;
    const loop = () => {
      frame();
      if (running) rafId = requestAnimationFrame(loop);
    };
    const start = () => {
      if (!running) {
        running = true;
        nightsky.classList.add('is-open');
        rafId = requestAnimationFrame(loop);
      }
    };
    const stop = () => {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      nightsky.classList.remove('is-open');
    };

    // Reveal the sky only while the opening is on (or near) screen.
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) start();
        else stop();
      },
      { rootMargin: '200px 0px' },
    );
    io.observe(aperture);

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
    };
  }, [host]);

  const lit = Math.round(sky.illum * 100);

  const nightsky = (
    <div className='inflow-veil__nightsky' ref={nightskyRef} aria-hidden='true'>
      <div className='inflow-veil__sky' />
      <div className='inflow-veil__scene'>
        <div className='inflow-veil__moonwrap'>
          <div className='inflow-veil__halo' />
          <VeilMoon illumination={sky.illum} waning={sky.waning} />
        </div>
        <div className='inflow-veil__read'>
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
  );

  return (
    <div className='inflow-veil'>
      <div className='inflow-veil__aperture' ref={apertureRef} />
      {host ? createPortal(nightsky, host) : null}
    </div>
  );
};
