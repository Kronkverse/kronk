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

import { getEarthMonth } from './earth_calendar';

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
  const earthData = getEarthMonth(month);
  const ecologicalNote = earthData.observable;

  const daylightStr = formatDaylight(daylight.daylightMinutes);
  const deltaMin = daylight.deltaMinutes;
  const phaseStr = MOON_PHASE_SHORT[phase] ?? phase;

  // --- Daylight sentence ---
  let daylightSentence: string;
  if (Math.abs(deltaMin) < 0.5) {
    daylightSentence = `The days rest at ${daylightStr} of light, neither growing nor retreating.`;
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
    daylightSentence = `The days hold ${daylightStr} of light now, and each one is a little longer than the last — ${amt} today.`;
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
    daylightSentence = `${daylightStr} of daylight, each day a little shorter — we are moving ${amt} deeper into the dark.`;
  }

  // --- Moon sentence ---
  let moonSentence: string;
  if (superMoon.isSuper && phase === 'full_moon') {
    moonSentence = `A supermoon tonight — the full face of the moon at just ${String(Math.round(superMoon.distanceKm / 1000))}k km, pulling the tides and lighting the whole sky.`;
  } else if (superMoon.isSuper && phase === 'new_moon') {
    moonSentence = `A supermoon tonight — the moon at perigee, pulling the tides in silence, the sky dark and deep.`;
  } else if (phase === 'full_moon') {
    moonSentence = `Full moon tonight. The sky carries a silver tide; the stars recede.`;
  } else if (phase === 'new_moon') {
    moonSentence = `No moon tonight — the sky is deep and the Milky Way comes forward.`;
  } else if (phase === 'waxing_crescent' || phase === 'waning_crescent') {
    moonSentence = `A ${phaseStr} rises in the ${phase.includes('waxing') ? 'evening' : 'pre-dawn'} sky.`;
  } else {
    moonSentence = `A ${phaseStr} moves through the night.`;
  }

  // --- Constellation ---
  const constellationSentence = `The sun is moving through ${constellation.name}.`;

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
    if (days === 0) turningStr = `${next.label} is today.`;
    else if (days === 1) turningStr = `${next.label} arrives tomorrow.`;
    else turningStr = `${next.label} comes in ${String(days)} days.`;
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

  // --- Ecological sentence ---
  const firstSentence = ecologicalNote.split(/\.\s/)[0] ?? ecologicalNote;
  const ecologicalSentence = firstSentence.endsWith('.')
    ? firstSentence
    : firstSentence + '.';

  const parts = [daylightSentence, moonSentence, constellationSentence];
  if (turningStr) parts.push(turningStr);
  parts.push(...specials);

  return parts.join(' ') + ' — ' + ecologicalSentence;
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
