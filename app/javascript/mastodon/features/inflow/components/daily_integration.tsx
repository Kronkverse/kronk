import { useMemo } from 'react';

import {
  getDaylightInfo,
  getMoonPhaseName,
  getMoonIllumination,
  getSeasonEventsForYear,
  getCrossQuarterEventsForYear,
  getOrbitalEventsForYear,
  getSuperMoonInfo,
  getMeteorShowerPeak,
} from 'mastodon/features/events/components/celestial_calendar';

import { LOCATION_TZ, LOCATION_LAT, LOCATION_LON } from '../constants';

import {
  SunIcon,
  MoonPhaseIcon,
  LeafIcon,
  SnowflakeIcon,
  BlossomIcon,
} from './celestial_icons';
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

function formatTimeShort(date: Date): string {
  return date
    .toLocaleTimeString('en-AU', {
      timeZone: LOCATION_TZ,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    .toLowerCase()
    .replace(' ', '');
}

function daysUntil(target: Date, now: Date): number {
  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
}

const MOON_PHASE_SHORT: Record<string, string> = {
  new_moon: 'New Moon',
  waxing_crescent: 'Waxing Crescent',
  first_quarter: 'First Quarter',
  waxing_gibbous: 'Waxing Gibbous',
  full_moon: 'Full Moon',
  waning_gibbous: 'Waning Gibbous',
  last_quarter: 'Last Quarter',
  waning_crescent: 'Waning Crescent',
};

const MOON_PHASE_PROSE: Record<string, string> = {
  new_moon: 'new moon',
  waxing_crescent: 'waxing crescent',
  first_quarter: 'first quarter moon',
  waxing_gibbous: 'waxing gibbous moon',
  full_moon: 'full moon',
  waning_gibbous: 'waning gibbous moon',
  last_quarter: 'last quarter moon',
  waning_crescent: 'waning crescent',
};

function pickSeasonIcon(label: string) {
  const l = label.toLowerCase();
  if (l.includes('winter') || l.includes('imbolc'))
    return <SnowflakeIcon size={14} className='in-flow__daily-tile-icon' />;
  if (l.includes('spring') || l.includes('beltane'))
    return <BlossomIcon size={14} className='in-flow__daily-tile-icon' />;
  if (l.includes('summer') || l.includes('lammas'))
    return <SunIcon size={14} className='in-flow__daily-tile-icon' />;
  return <LeafIcon size={14} className='in-flow__daily-tile-icon' />;
}

function buildIntegration(
  deltaMinutes: number,
  phase: string,
  turningLabel: string | null,
  turningDays: number | null,
  month: number,
  superMoon: { isSuper: boolean },
  meteorPeak: { name: string; zenithalHourlyRate: number } | null,
): string {
  const phaseStr = MOON_PHASE_PROSE[phase] ?? phase.replace(/_/g, ' ');
  const isWinter = month >= 5 && month <= 7;
  const isSummer = month === 11 || month <= 1;
  const isAutumn = month >= 2 && month <= 4;
  const nearTurning = turningDays !== null && turningDays <= 7;
  const veryNearTurning = turningDays !== null && turningDays <= 2;

  // Highest priority: meteor shower peak tonight
  if (meteorPeak) {
    if (phase === 'new_moon' || phase === 'waning_crescent') {
      return `The ${meteorPeak.name} peak tonight into a dark sky - a hundred brief crossings before dawn.`;
    }
    return `The ${meteorPeak.name} peak tonight under a ${phaseStr}, the sky alive with brief crossings.`;
  }

  // Supermoon + full or new
  if (superMoon.isSuper && phase === 'full_moon') {
    if (nearTurning && turningLabel) {
      return `A supermoon rises into the ${isWinter ? 'longest' : 'full'} nights as ${turningLabel} draws near - the sky at its most generous.`;
    }
    if (isWinter)
      return `A supermoon fills the long winter sky - closer and brighter, the night made luminous.`;
    if (isSummer)
      return `A supermoon rides the warm summer dark, expansive and close.`;
    return `A supermoon holds the sky - closer than usual, the night lit from edge to edge.`;
  }

  // Turning point proximity (within 2 days = at the threshold)
  if (veryNearTurning && turningLabel) {
    if (phase === 'full_moon') {
      return `As ${turningLabel} arrives, the full moon keeps the whole sky open - two great thresholds meeting.`;
    }
    if (phase === 'new_moon') {
      return `The dark of the new moon holds the moment as ${turningLabel} arrives - the Kosmos drawn inward.`;
    }
    if (isWinter)
      return `We stand at the ${turningLabel} threshold - the long dark reaches its still-point under a ${phaseStr}.`;
    if (isSummer)
      return `${turningLabel} is here - the land at full surge under a ${phaseStr}.`;
    return `${turningLabel} arrives under a ${phaseStr}, the year turning its page.`;
  }

  // Turning approaching (within 7 days)
  if (nearTurning && turningLabel) {
    if (phase === 'full_moon') {
      return `As the solstice draws near, the full moon rises into the ${isWinter ? 'longest' : 'briefest'} nights - the sky at its most generous.`;
    }
    if (phase === 'new_moon') {
      if (isWinter)
        return `The dark of the new moon holds the winter sky open as ${turningLabel} approaches - the stars press close tonight.`;
      return `Under a new moon, the Kosmos draws quiet as ${turningLabel} draws near.`;
    }
    if (deltaMinutes < -0.5)
      return `Under a waning ${phaseStr}, we move toward ${turningLabel}, the world contracting to its quiet centre.`;
    return `A ${phaseStr} climbs toward ${turningLabel} - the year gathering itself.`;
  }

  // Moon phase + season direction without special events
  if (phase === 'full_moon') {
    if (isWinter)
      return `The full moon rises into the long winter dark - silver on every surface, the night turned generous.`;
    if (isSummer)
      return `Full moon in summer - the sky barely dims, light folding over light.`;
    if (isAutumn)
      return `A full moon floods the autumn night, the world distilled to silver and shadow.`;
    return `The full moon holds the sky open, the stars recede to its edges.`;
  }

  if (phase === 'new_moon') {
    if (isWinter)
      return `The dark of the new moon holds the winter sky open - the stars press close tonight.`;
    if (isSummer)
      return `A new moon leaves the summer sky to starlight - the quietest night of the cycle.`;
    return `A new moon, and the deep field opens - the Kosmos behind the Kosmos.`;
  }

  if (
    phase === 'waxing_gibbous' ||
    phase === 'waxing_crescent' ||
    phase === 'first_quarter'
  ) {
    if (isAutumn || (deltaMinutes < -0.5 && isWinter)) {
      return `A waxing ${phaseStr.replace('waxing ', '')} climbs through autumn, the light inside and outside both building.`;
    }
    if (deltaMinutes > 0.5) {
      return `A ${phaseStr} rises as the days lengthen - two crescents, sky and season, opening together.`;
    }
  }

  if (
    phase === 'waning_gibbous' ||
    phase === 'waning_crescent' ||
    phase === 'last_quarter'
  ) {
    if (isWinter && deltaMinutes < -0.5) {
      return `Under a waning crescent, we move toward the solstice dark, the world contracting to its quiet centre.`;
    }
    if (deltaMinutes < -0.5) {
      return `A ${phaseStr} moves through the shortening days - the Kosmos drawing inward on both clocks.`;
    }
  }

  // Fallbacks by season
  if (isWinter)
    return `The land rests under a ${phaseStr} - winter quiet, the sky turning slowly overhead.`;
  if (isSummer)
    return `A ${phaseStr} in the summer sky, riding the long arc of light.`;
  if (isAutumn)
    return `Autumn and a ${phaseStr} - the world mellowing toward its quiet season.`;

  // Spring fallback
  if (deltaMinutes > 0.5)
    return `Spring light surging under a ${phaseStr} - the year at full stretch.`;
  return `A ${phaseStr} moves through the spring sky, the world opening.`;
}

interface DailyData {
  lightValue: string;
  darkValue: string;
  soilValue: string;
  seasonValue: string | null;
  seasonLabel: string | null;
  phase: string;
  sentence: string;
}

function buildDailyData(
  year: number,
  month: number,
  day: number,
  now: Date,
): DailyData {
  const daylight = getDaylightInfo(
    year,
    month,
    day,
    LOCATION_LAT,
    LOCATION_LON,
  );
  const phase = getMoonPhaseName(now);
  const illumination = getMoonIllumination(now);
  const earthData = getEarthMonth(month);

  // Light card value
  let lightValue: string;
  if (daylight.rise && daylight.set) {
    lightValue = `${formatTimeShort(daylight.rise)} → ${formatTimeShort(daylight.set)}`;
  } else {
    lightValue = formatDaylight(daylight.daylightMinutes);
  }

  // Dark card value
  const phaseLabel = MOON_PHASE_SHORT[phase] ?? phase.replace(/_/g, ' ');
  const illumPct = Math.round(illumination * 100);
  const darkValue = `${phaseLabel} · ${String(illumPct)}%`;

  // Soil card value — first clause of observable, max 60 chars
  const observable = earthData.observable;
  const firstClause = observable.split(/[.,;]/)[0] ?? observable;
  const soilValue =
    firstClause.length > 60 ? firstClause.slice(0, 57) + '...' : firstClause;

  // Next turning point
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
  let seasonValue: string | null = null;
  let seasonLabel: string | null = null;
  let turningDays: number | null = null;
  let turningLabelForSentence: string | null = null;

  if (next) {
    const days = daysUntil(next.date, now);
    turningDays = days;
    turningLabelForSentence = next.label;
    if (days <= 7) {
      seasonLabel = next.label;
      if (days === 0) seasonValue = `${next.label} today`;
      else if (days === 1) seasonValue = `${next.label} tomorrow`;
      else seasonValue = `${next.label} in ${String(days)} days`;
    }
  }

  const superMoon = getSuperMoonInfo(now);
  const meteorPeak = getMeteorShowerPeak(month, day);

  const sentence = buildIntegration(
    daylight.deltaMinutes,
    phase,
    turningLabelForSentence,
    turningDays,
    month,
    superMoon,
    meteorPeak ?? null,
  );

  return {
    lightValue,
    darkValue,
    soilValue,
    seasonValue,
    seasonLabel,
    phase,
    sentence,
  };
}

export const DailyIntegration: React.FC = () => {
  const { year, month, day, now } = useMemo(nowInLocation, []);
  const data = useMemo(
    () => buildDailyData(year, month, day, now),
    [year, month, day, now],
  );

  const {
    lightValue,
    darkValue,
    soilValue,
    seasonValue,
    seasonLabel,
    phase,
    sentence,
  } = data;

  return (
    <div className='in-flow__daily'>
      <p className='in-flow__daily-sentence'>{sentence}</p>
      <div className='in-flow__daily-grid'>
        {/* Light card */}
        <div className='in-flow__daily-tile in-flow__daily-tile--light'>
          <div className='in-flow__daily-tile-header'>
            <SunIcon size={14} className='in-flow__daily-tile-icon' />
            <span className='in-flow__daily-tile-label'>Light</span>
          </div>
          <span className='in-flow__daily-tile-value'>{lightValue}</span>
        </div>

        {/* Dark card */}
        <div className='in-flow__daily-tile in-flow__daily-tile--dark'>
          <div className='in-flow__daily-tile-header'>
            <MoonPhaseIcon
              phase={phase as Parameters<typeof MoonPhaseIcon>[0]['phase']}
              size={14}
            />
            <span className='in-flow__daily-tile-label'>Dark</span>
          </div>
          <span className='in-flow__daily-tile-value'>{darkValue}</span>
        </div>

        {/* Soil card */}
        <div className='in-flow__daily-tile in-flow__daily-tile--soil'>
          <div className='in-flow__daily-tile-header'>
            <LeafIcon size={14} className='in-flow__daily-tile-icon' />
            <span className='in-flow__daily-tile-label'>Soil</span>
          </div>
          <span className='in-flow__daily-tile-value'>{soilValue}</span>
        </div>

        {/* Season card - only when ≤7 days away */}
        {seasonValue && seasonLabel && (
          <div className='in-flow__daily-tile in-flow__daily-tile--season'>
            <div className='in-flow__daily-tile-header'>
              {pickSeasonIcon(seasonLabel)}
              <span className='in-flow__daily-tile-label'>Season</span>
            </div>
            <span className='in-flow__daily-tile-value'>{seasonValue}</span>
          </div>
        )}
      </div>
    </div>
  );
};

// Export for use in home page card — returns just the synthesizing sentence
export function buildDailyIntegrationText(): string {
  const { year, month, day, now } = nowInLocation();
  const data = buildDailyData(year, month, day, now);
  return data.sentence;
}

// ── Tile data for DailyKosmicCard ─────────────────────────────────────────────

export interface DailyTileData {
  lightRise: string; // formatted rise time e.g. "7:18 am"
  lightSet: string; // formatted set time e.g. "5:09 pm"
  darkPhase: string; // e.g. "Waning Crescent"
  darkIllumination: number; // 0–100 integer
  soilText: string; // first sentence of ecological observable, max 70 chars
  season: { label: string; days: number } | null; // only when ≤7 days
}

const MOON_PHASE_LABELS: Record<string, string> = {
  new_moon: 'New Moon',
  waxing_crescent: 'Waxing Crescent',
  first_quarter: 'First Quarter',
  waxing_gibbous: 'Waxing Gibbous',
  full_moon: 'Full Moon',
  waning_gibbous: 'Waning Gibbous',
  last_quarter: 'Last Quarter',
  waning_crescent: 'Waning Crescent',
};

export function buildDailyTileData(): DailyTileData {
  const { year, month, day, now } = nowInLocation();
  const daylight = getDaylightInfo(
    year,
    month,
    day,
    LOCATION_LAT,
    LOCATION_LON,
  );
  const phase = getMoonPhaseName(now);
  const illumination = getMoonIllumination(now);
  const earthData = getEarthMonth(month);

  const formatTile = (date: Date): string =>
    date
      .toLocaleTimeString('en-AU', {
        timeZone: LOCATION_TZ,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
      .toLowerCase()
      .replace(' ', '');

  const lightRise = daylight.rise ? formatTile(daylight.rise) : '—';
  const lightSet = daylight.set ? formatTile(daylight.set) : '—';

  const darkPhase = MOON_PHASE_LABELS[phase] ?? phase.replace(/_/g, ' ');
  const darkIllumination = Math.round(illumination * 100);

  // First sentence of observable, capped at 70 chars
  const observable = earthData.observable;
  const firstSentence = observable.split(/(?<=[.!?])\s/)[0] ?? observable;
  const soilText =
    firstSentence.length > 70
      ? firstSentence.slice(0, 69) + '…'
      : firstSentence;

  // Next turning point ≤7 days away (seasons + cross-quarters)
  const allEvents = [
    ...getSeasonEventsForYear(year),
    ...getCrossQuarterEventsForYear(year),
    ...getSeasonEventsForYear(year + 1),
    ...getCrossQuarterEventsForYear(year + 1),
  ]
    .filter((e) => e.date >= now)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const next = allEvents[0];
  let season: { label: string; days: number } | null = null;
  if (next) {
    const days = daysUntil(next.date, now);
    if (days <= 7) {
      season = { label: next.label, days };
    }
  }

  return { lightRise, lightSet, darkPhase, darkIllumination, soilText, season };
}
