import { useEffect, useMemo, useRef } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';

import {
  getMoonIllumination,
  getMoonPhaseName,
  getMoonRiseSet,
  getDaylightInfo,
} from 'mastodon/features/events/components/celestial_calendar';
import { Stage } from 'mastodon/components/stage';

import { buildDailyIntegrationText } from './components/daily_integration';
import { LOCATION_LAT, LOCATION_LON, LOCATION_TZ } from './constants';

// InFlow — the veil. The behind-the-scenes reveal (Kommons proposal
// "Inflow View" #116969234825049453): the surface parts to a pinned starfield
// void — the moon, its halo, drifting stars — and a reading of tonight's sky
// (phase, a reflection, the almanac), then the surface closes over again.
//
// The proposal's HTML prototype is the choreography guideline; the palette,
// type and surfaces here are Kronk tokens (accent / kosmos-void / text / the
// display face), not the prototype's raw hexes. All data is live: the moon and
// almanac read tonight's sky at the InFlow location.

const messages = defineMessages({
  title: { id: 'inflow.title', defaultMessage: 'In Flow' },
});

// ── live sky data ───────────────────────────────────────────────────────────

interface StarSpec {
  left: number;
  top: number;
  size: number;
  opacity: number;
}

function makeStars(count: number, min: number, max: number): StarSpec[] {
  return Array.from({ length: count }, () => ({
    left: Math.random() * 100,
    top: Math.random() * 100,
    size: min + Math.random() * (max - min),
    opacity: 0.28 + Math.random() * 0.5,
  }));
}

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

export const InflowVeil: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();

  const rootRef = useRef<HTMLDivElement>(null);
  const beforeRef = useRef<HTMLDivElement>(null);
  const afterRef = useRef<HTMLDivElement>(null);
  const farRef = useRef<HTMLDivElement>(null);
  const midRef = useRef<HTMLDivElement>(null);
  const nearRef = useRef<HTMLDivElement>(null);
  const moonRef = useRef<HTMLDivElement>(null);
  const haloRef = useRef<HTMLDivElement>(null);
  const readRef = useRef<HTMLDivElement>(null);

  const sky = useMemo(() => {
    const now = new Date();
    const { year, month, day } = melbourneDateParts(now);
    const illum = getMoonIllumination(now);
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const waning = getMoonIllumination(tomorrow) < illum;
    const moon = getMoonRiseSet(year, month, day, LOCATION_LAT, LOCATION_LON);
    const daylight = getDaylightInfo(
      year,
      month,
      day,
      LOCATION_LAT,
      LOCATION_LON,
    );
    const dateLabel = now.toLocaleDateString('en-AU', {
      timeZone: LOCATION_TZ,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    return {
      illum,
      waning,
      phase: getMoonPhaseName(now),
      moon,
      daylight,
      reflection: buildDailyIntegrationText(),
      dateLabel,
    };
  }, []);

  const stars = useMemo(
    () => ({
      far: makeStars(52, 1, 2),
      mid: makeStars(24, 1, 1.6),
      near: makeStars(15, 2.2, 3.6),
    }),
    [],
  );

  useEffect(() => {
    const root = rootRef.current;
    const scroller = root?.closest<HTMLElement>('.kronk-stage');
    const before = beforeRef.current;
    const after = afterRef.current;
    if (!root || !scroller || !before || !after) return;

    // The Stage is shorter than the viewport (top nav), so the reveal scope is
    // measured from the Stage's own height, not 100vh.
    const setUnit = () => {
      root.style.setProperty('--veil-vh', `${scroller.clientHeight}px`);
    };
    setUnit();

    if (window.matchMedia('(prefers-reduced-motion:reduce)').matches) {
      window.addEventListener('resize', setUnit);
      return () => {
        window.removeEventListener('resize', setUnit);
      };
    }

    const clamp = (v: number, a: number, b: number) =>
      Math.max(a, Math.min(b, v));
    const smooth = (t: number) => {
      const c = clamp(t, 0, 1);
      return c * c * (3 - 2 * c);
    };

    let ticking = false;
    const frame = () => {
      ticking = false;
      const view = scroller.clientHeight;
      const top = scroller.getBoundingClientRect().top;
      // Positions of the two curtains relative to the scroller's top edge.
      const beforeBottom = before.getBoundingClientRect().bottom - top;
      const afterTop = after.getBoundingClientRect().top - top;

      const revealed = clamp(1 - beforeBottom / view, 0, 1);
      const covered = clamp(1 - afterTop / view, 0, 1);
      const open = smooth(revealed) * (1 - smooth(covered));
      const drift = smooth(revealed) - smooth(covered);

      if (farRef.current)
        farRef.current.style.transform = `translateY(${((1 - drift) * 10).toFixed(2)}px)`;
      if (midRef.current)
        midRef.current.style.transform = `translateY(${((1 - drift) * 26).toFixed(2)}px)`;
      if (nearRef.current)
        nearRef.current.style.transform = `translateY(${((1 - drift) * 52).toFixed(2)}px)`;
      if (moonRef.current)
        moonRef.current.style.transform = `translateY(${((1 - drift) * 34 - 4).toFixed(2)}px) scale(${(0.94 + open * 0.06).toFixed(3)})`;
      if (haloRef.current)
        haloRef.current.style.opacity = (0.18 + open * 0.86).toFixed(3);
      if (readRef.current) {
        readRef.current.style.opacity = open.toFixed(3);
        readRef.current.style.transform = `translateY(${((1 - open) * 20).toFixed(2)}px)`;
      }
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(frame);
      }
    };

    const onResize = () => {
      setUnit();
      onScroll();
    };

    scroller.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    frame();

    return () => {
      scroller.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const lit = Math.round(sky.illum * 100);

  return (
    <Stage label={intl.formatMessage(messages.title)}>
      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
        <meta name='robots' content='noindex' />
      </Helmet>

      <div className='inflow-veil' ref={rootRef}>
        {/* The surface — parts as you scroll to reveal the void. */}
        <div
          className='inflow-veil__deck inflow-veil__deck--before'
          ref={beforeRef}
        >
          <div className='inflow-veil__intro'>
            <div className='inflow-veil__eyebrow'>In Flow · {sky.dateLabel}</div>
            <p className='inflow-veil__lede'>{sky.reflection}</p>
            <div className='inflow-veil__hint'>keep scrolling ↓</div>
          </div>
        </div>

        {/* The void — pinned behind the surface. */}
        <div className='inflow-veil__scope'>
          <section className='inflow-veil__veil'>
            <div className='inflow-veil__void' />
            <div className='inflow-veil__layer' ref={farRef}>
              {stars.far.map((s, i) => (
                <span
                  key={`f${i}`}
                  className='inflow-veil__star inflow-veil__star--dot'
                  style={{
                    left: `${s.left}%`,
                    top: `${s.top}%`,
                    width: `${s.size}px`,
                    height: `${s.size}px`,
                    opacity: s.opacity,
                  }}
                />
              ))}
            </div>
            <div className='inflow-veil__layer' ref={midRef}>
              {stars.mid.map((s, i) => (
                <span
                  key={`m${i}`}
                  className='inflow-veil__star inflow-veil__star--spark'
                  style={{ left: `${s.left}%`, top: `${s.top}%`, opacity: s.opacity }}
                >
                  +
                </span>
              ))}
            </div>
            <div className='inflow-veil__layer' ref={nearRef}>
              {stars.near.map((s, i) => (
                <span
                  key={`n${i}`}
                  className='inflow-veil__star inflow-veil__star--dot'
                  style={{
                    left: `${s.left}%`,
                    top: `${s.top}%`,
                    width: `${s.size}px`,
                    height: `${s.size}px`,
                    opacity: s.opacity,
                  }}
                />
              ))}
            </div>

            <div className='inflow-veil__scene'>
              <div className='inflow-veil__moonwrap' ref={moonRef}>
                <div className='inflow-veil__halo' ref={haloRef} />
                <VeilMoon illumination={sky.illum} waning={sky.waning} />
              </div>

              <div className='inflow-veil__read' ref={readRef}>
                <div className='inflow-veil__read-eye'>
                  ☾ In Flow · {sky.dateLabel}
                </div>
                <h2 className='inflow-veil__read-title'>Beyond the veil</h2>
                <div className='inflow-veil__phase'>
                  {sky.phase} · {lit}% lit
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
                <div className='inflow-veil__close'>
                  Then the surface closes over again.
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* The surface — slides back over. */}
        <div
          className='inflow-veil__deck inflow-veil__deck--after'
          ref={afterRef}
        >
          <div className='inflow-veil__intro'>
            <p className='inflow-veil__lede'>
              The land turns, the sky turns, and you return.
            </p>
          </div>
        </div>
      </div>
    </Stage>
  );
};

// eslint-disable-next-line import/no-default-export
export default InflowVeil;
