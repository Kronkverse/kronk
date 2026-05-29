import { useMemo } from 'react';

import {
  getDaylightInfo,
  getMoonPhaseName,
  getSunConstellation,
  getSeasonEventsForYear,
  getCrossQuarterEventsForYear,
  getOrbitalEventsForYear,
  getSuperMoonInfo,
  getMeteorShowerPeak,
  getEclipsesNear,
} from 'mastodon/features/events/components/celestial_calendar';

import { LOCATION_TZ, LOCATION_LAT, LOCATION_LON } from '../constants';

function nowInLocation(): {
  year: number;
  month: number;
  day: number;
  now: Date;
} {
  const fmt = new Intl.DateTimeFormat('en-AU', {
    timeZone: LOCATION_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const now = new Date();
  const parts = fmt.formatToParts(now);
  const get = (type: string): number =>
    parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10);
  return { year: get('year'), month: get('month') - 1, day: get('day'), now };
}

function formatDaylight(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h)}h ${String(m).padStart(2, '0')}m`;
}

function daysUntil(target: Date, now: Date): number {
  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
}

const MOON_PHASE_SHORT: Record<string, string> = {
  new_moon: 'new moon',
  waxing_crescent: 'waxing crescent',
  first_quarter: 'first quarter moon',
  waxing_gibbous: 'waxing gibbous moon',
  full_moon: 'full moon',
  waning_gibbous: 'waning gibbous moon',
  last_quarter: 'last quarter moon',
  waning_crescent: 'waning crescent',
};

function buildIntegration(
  year: number,
  month: number,
  day: number,
  now: Date,
): string {
  const daylight = getDaylightInfo(
    year,
    month,
    day,
    LOCATION_LAT,
    LOCATION_LON,
  );
  const phase = getMoonPhaseName(now);
  const constellation = getSunConstellation(now);
  const superMoon = getSuperMoonInfo(now);
  const meteorPeak = getMeteorShowerPeak(month, day);
  const eclipses = getEclipsesNear(now, 1);
  const eclipse = eclipses[0];

  const daylightStr = formatDaylight(daylight.daylightMinutes);
  const deltaMin = daylight.deltaMinutes;
  const phaseStr = MOON_PHASE_SHORT[phase] ?? phase;

  // --- Daylight sentence ---
  let daylightSentence: string;
  if (Math.abs(deltaMin) < 0.5) {
    daylightSentence = `${daylightStr} of daylight — the days are holding still.`;
  } else if (deltaMin > 0) {
    const abs = Math.abs(deltaMin);
    const mins = Math.floor(abs);
    const secs = Math.round((abs - mins) * 60);
    const amt =
      mins > 0 && secs > 0
        ? `${String(mins)}m ${String(secs)}s`
        : mins > 0
          ? `${String(mins)}m`
          : `${String(secs)}s`;
    daylightSentence = `${daylightStr} of daylight, and we are gaining ${amt} each day.`;
  } else {
    const abs = Math.abs(deltaMin);
    const mins = Math.floor(abs);
    const secs = Math.round((abs - mins) * 60);
    const amt =
      mins > 0 && secs > 0
        ? `${String(mins)}m ${String(secs)}s`
        : mins > 0
          ? `${String(mins)}m`
          : `${String(secs)}s`;
    daylightSentence = `${daylightStr} of daylight, losing ${amt} each day as we move toward the dark.`;
  }

  // --- Moon sentence ---
  let moonSentence: string;
  if (superMoon.isSuper && phase === 'full_moon') {
    moonSentence = `The full moon is at its closest — a supermoon at ${String(Math.round(superMoon.distanceKm / 1000))}k km, visibly larger and brighter in the sky.`;
  } else if (superMoon.isSuper && phase === 'new_moon') {
    moonSentence = `A new moon at perigee — the sky is dark and the moon sits closest to Earth tonight.`;
  } else if (phase === 'full_moon') {
    moonSentence = `The moon is full tonight — the whole sky is lit.`;
  } else if (phase === 'new_moon') {
    moonSentence = `No moon tonight — the sky opens to its deepest dark.`;
  } else {
    moonSentence = `A ${phaseStr} moves through the night.`;
  }

  // --- Constellation ---
  const constellationSentence = `The sun is passing through ${constellation.name}.`;

  // --- Next turning point ---
  const allEvents = [
    ...getSeasonEventsForYear(year),
    ...getCrossQuarterEventsForYear(year),
    ...getOrbitalEventsForYear(year),
    ...getSeasonEventsForYear(year + 1),
    ...getCrossQuarterEventsForYear(year + 1),
  ]
    .filter((e) => e.date >= now)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const next = allEvents[0];
  let turningStr = '';
  if (next) {
    const days = daysUntil(next.date, now);
    if (days === 0) turningStr = `${next.label} arrives today.`;
    else if (days === 1) turningStr = `${next.label} is tomorrow.`;
    else turningStr = `${next.label} in ${String(days)} days.`;
  }

  // --- Special events ---
  const specials: string[] = [];
  if (eclipse) {
    specials.push(`${eclipse.label} — ${eclipse.visibility}.`);
  }
  if (meteorPeak) {
    specials.push(
      `The ${meteorPeak.name} meteor shower peaks tonight — up to ${String(meteorPeak.zenithalHourlyRate)} meteors per hour from the ${meteorPeak.radiant} radiant.`,
    );
  }

  const parts = [daylightSentence, moonSentence, constellationSentence];
  if (turningStr) parts.push(turningStr);
  parts.push(...specials);

  return parts.join(' ');
}

export const DailyIntegration: React.FC = () => {
  const { year, month, day, now } = useMemo(nowInLocation, []);
  const text = useMemo(
    () => buildIntegration(year, month, day, now),
    [year, month, day, now],
  );

  return (
    <div className='in-flow__daily'>
      <div className='in-flow__daily-label'>Today</div>
      <p className='in-flow__daily-text'>{text}</p>
    </div>
  );
};

// Export for use in home page card
export function buildDailyIntegrationText(): string {
  const { year, month, day, now } = nowInLocation();
  return buildIntegration(year, month, day, now);
}
