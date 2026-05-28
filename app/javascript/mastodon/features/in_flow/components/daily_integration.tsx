import { useMemo } from 'react';

import {
  getDaylightInfo,
  getMoonPhaseName,
  getSunConstellation,
  getSeasonEventsForYear,
  getCrossQuarterEventsForYear,
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
  first_quarter: 'first quarter',
  waxing_gibbous: 'waxing gibbous',
  full_moon: 'full moon',
  waning_gibbous: 'waning gibbous',
  last_quarter: 'last quarter',
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

  const daylightStr = formatDaylight(daylight.daylightMinutes);
  const deltaMin = daylight.deltaMinutes;
  const phaseStr = MOON_PHASE_SHORT[phase] ?? phase;

  // Direction of daylight change
  let deltaStr: string;
  if (Math.abs(deltaMin) < 0.5) {
    deltaStr = 'holding steady';
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
    deltaStr = deltaMin > 0 ? `lengthening by ${amt}` : `shortening by ${amt}`;
  }

  // Next turning point across seasons + cross-quarters
  const allEvents = [
    ...getSeasonEventsForYear(year),
    ...getCrossQuarterEventsForYear(year),
    ...getSeasonEventsForYear(year + 1),
    ...getCrossQuarterEventsForYear(year + 1),
  ]
    .filter((e) => e.date >= now)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const next = allEvents[0];
  let turningStr = '';
  if (next) {
    const days = daysUntil(next.date, now);
    turningStr =
      days === 0
        ? `${next.label} is today`
        : days === 1
          ? `${next.label} is tomorrow`
          : `${next.label} in ${String(days)} days`;
  }

  return `${daylightStr} of daylight — ${deltaStr}. A ${phaseStr} rises tonight. The sun moves through ${constellation.name}. ${turningStr}.`;
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

// Export for use in home page card too
export function buildDailyIntegrationText(): string {
  const { year, month, day, now } = nowInLocation();
  return buildIntegration(year, month, day, now);
}
