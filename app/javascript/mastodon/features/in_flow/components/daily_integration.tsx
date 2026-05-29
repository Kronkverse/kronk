import { useMemo } from 'react';

import {
  getDaylightInfo,
  getMoonPhaseName,
  getMoonIllumination,
  getSeasonEventsForYear,
  getCrossQuarterEventsForYear,
  getOrbitalEventsForYear,
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

function buildSynthesizingSentence(
  deltaMinutes: number,
  phase: string,
  turningLabel: string | null,
  turningDays: number | null,
  month: number,
): string {
  const phaseStr = MOON_PHASE_PROSE[phase] ?? phase.replace(/_/g, ' ');
  const isWinter = month >= 5 && month <= 7; // Southern hemisphere: Jun–Aug
  const isSummer = month === 11 || month <= 1; // Dec–Feb
  const isFullOrNew = phase === 'full_moon' || phase === 'new_moon';
  const nearTurning = turningDays !== null && turningDays <= 14;

  const turningStr =
    nearTurning && turningLabel
      ? turningDays === 0
        ? `as ${turningLabel} arrives today`
        : turningDays === 1
          ? `as ${turningLabel} comes tomorrow`
          : `as ${turningLabel} approaches`
      : null;

  if (phase === 'full_moon') {
    if (turningStr) {
      return `The full moon lights the whole sky ${turningStr}.`;
    }
    if (isWinter) {
      return `A full moon fills the long winter night with silver light.`;
    }
    return `Full moon — the sky carries a silver tide, the stars recede.`;
  }

  if (phase === 'new_moon') {
    if (isWinter) {
      return `No moon tonight — the winter sky is deep and the Milky Way comes forward.`;
    }
    return `A new moon leaves the sky dark — the stars are out in force.`;
  }

  if (isWinter) {
    if (deltaMinutes < -0.5) {
      if (turningStr) {
        return `The days draw in under a ${phaseStr}, ${turningStr}.`;
      }
      return `The days are short and drawing in, a ${phaseStr} moving through the long night.`;
    }
    if (turningStr) {
      return `Winter deepens under a ${phaseStr}, ${turningStr}.`;
    }
    return `The land settles into its winter quiet under a ${phaseStr}.`;
  }

  if (isSummer) {
    if (deltaMinutes > 0.5) {
      if (turningStr) {
        return `Long, generous days and a ${phaseStr} overhead ${turningStr}.`;
      }
      return `The days are long and still lengthening, a ${phaseStr} in the summer sky.`;
    }
    if (turningStr) {
      return `The land is at full surge under a ${phaseStr}, ${turningStr}.`;
    }
    return `Long summer days stretch out, a ${phaseStr} riding the warm sky.`;
  }

  // Shoulder seasons
  if (isFullOrNew && turningStr) {
    return `A ${phaseStr} marks the sky ${turningStr}.`;
  }
  if (turningStr) {
    return `The days ${deltaMinutes >= 0 ? 'lengthen' : 'contract'} under a ${phaseStr}, ${turningStr}.`;
  }
  if (deltaMinutes > 0.5) {
    return `The days are lengthening, a ${phaseStr} rising each night.`;
  }
  if (deltaMinutes < -0.5) {
    return `The days are contracting, a ${phaseStr} moving through the darkening sky.`;
  }
  return `The days hold steady, a ${phaseStr} moving through the sky.`;
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

  const sentence = buildSynthesizingSentence(
    daylight.deltaMinutes,
    phase,
    turningLabelForSentence,
    turningDays,
    month,
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

        {/* Season card — only when ≤7 days away */}
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
