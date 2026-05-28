import { useMemo } from 'react';

import {
  getMoonPhaseName,
  getMoonIllumination,
  getMoonRiseSet,
  getSunConstellation,
  getWanderers,
} from 'mastodon/features/events/components/celestial_calendar';

const LAT = -33.8688;
const LON = 151.2093;
const SYDNEY_TZ = 'Australia/Sydney';

const MOON_LABELS: Record<string, string> = {
  new_moon: 'New Moon',
  waxing_crescent: 'Waxing Crescent',
  first_quarter: 'First Quarter',
  waxing_gibbous: 'Waxing Gibbous',
  full_moon: 'Full Moon',
  waning_gibbous: 'Waning Gibbous',
  last_quarter: 'Last Quarter',
  waning_crescent: 'Waning Crescent',
};

const MOON_EMOJIS: Record<string, string> = {
  new_moon: '🌑',
  waxing_crescent: '🌒',
  first_quarter: '🌓',
  waxing_gibbous: '🌔',
  full_moon: '🌕',
  waning_gibbous: '🌖',
  last_quarter: '🌗',
  waning_crescent: '🌘',
};

const MOON_DESCRIPTIONS: Record<string, string> = {
  new_moon:
    'The moon withdraws its reflected light — the sky is at its darkest in the monthly cycle.',
  waxing_crescent:
    'The first sliver of reflected sunlight reappears in the western sky after sunset.',
  first_quarter:
    "Half the moon's face is lit, half in shadow — the month's first peak of tidal complexity.",
  waxing_gibbous:
    'More than half the lunar face is lit, brightening night by night as the full phase approaches.',
  full_moon:
    'The moon stands opposite the sun — fully illuminated, at its strongest gravitational reach.',
  waning_gibbous:
    'The peak has passed. The lit face gradually withdrawing; light and tidal force begin their retreat.',
  last_quarter: 'The lit face is halving — the cycle exhales toward its dark.',
  waning_crescent:
    'A thin crescent lingers in the pre-dawn sky. The month is completing its arc toward the dark.',
};

function nowInSydney(): { year: number; month: number; day: number } {
  const fmt = new Intl.DateTimeFormat('en-AU', {
    timeZone: SYDNEY_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(new Date());
  const get = (type: string): number =>
    parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10);
  return { year: get('year'), month: get('month') - 1, day: get('day') };
}

function formatTimeInSydney(date: Date): string {
  return date.toLocaleTimeString('en-AU', {
    timeZone: SYDNEY_TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export const DarkStrand: React.FC = () => {
  const { year, month, day } = useMemo(nowInSydney, []);
  const now = useMemo(() => new Date(), []);

  const phase = useMemo(() => getMoonPhaseName(now), [now]);
  const illumination = useMemo(
    () => Math.round(getMoonIllumination(now) * 100),
    [now],
  );
  const moonRiseSet = useMemo(
    () => getMoonRiseSet(year, month, day, LAT, LON),
    [year, month, day],
  );
  const constellation = useMemo(() => getSunConstellation(now), [now]);
  const wanderers = useMemo(
    () => getWanderers(year, month, day, LAT, LON),
    [year, month, day],
  );

  const phaseEmoji = MOON_EMOJIS[phase] ?? '🌑';
  const phaseLabel = MOON_LABELS[phase] ?? phase;
  const phaseDesc = MOON_DESCRIPTIONS[phase] ?? '';

  return (
    <div className='in-flow-dark'>
      {/* Moon */}
      <div className='in-flow-dark__moon'>
        <div className='in-flow-dark__moon-header'>
          <span className='in-flow-dark__moon-emoji'>{phaseEmoji}</span>
          <div className='in-flow-dark__moon-meta'>
            <span className='in-flow-dark__moon-phase'>{phaseLabel}</span>
            <span className='in-flow-dark__moon-illumination'>
              {illumination}% illuminated
            </span>
          </div>
        </div>
        <p className='in-flow-dark__moon-desc'>{phaseDesc}</p>

        {(moonRiseSet.rise ?? moonRiseSet.set) && (
          <div className='in-flow-dark__moon-times'>
            {moonRiseSet.rise && (
              <div className='in-flow-dark__time-pair'>
                <span className='in-flow-dark__time-icon'>🌙↑</span>
                <span className='in-flow-dark__time-value'>
                  {formatTimeInSydney(moonRiseSet.rise)}
                </span>
              </div>
            )}
            {moonRiseSet.set && (
              <div className='in-flow-dark__time-pair'>
                <span className='in-flow-dark__time-icon'>🌙↓</span>
                <span className='in-flow-dark__time-value'>
                  {formatTimeInSydney(moonRiseSet.set)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* The Dial */}
      <div className='in-flow-dark__dial'>
        <div className='in-flow-dark__section-label'>The Dial</div>
        <div className='in-flow-dark__dial-body'>
          <span className='in-flow-dark__dial-emoji'>
            {constellation.emoji}
          </span>
          <div className='in-flow-dark__dial-text'>
            <span className='in-flow-dark__dial-name'>
              The sun is in {constellation.name}
            </span>
            <span className='in-flow-dark__dial-desc'>
              {constellation.description}
            </span>
          </div>
        </div>
      </div>

      {/* Wanderers */}
      <div className='in-flow-dark__wanderers'>
        <div className='in-flow-dark__section-label'>Wanderers</div>
        {wanderers.length === 0 ? (
          <p className='in-flow-dark__wanderers-empty'>
            No naked-eye planets are well-placed in the sky tonight.
          </p>
        ) : (
          <ul className='in-flow-dark__wanderers-list'>
            {wanderers.map((w) => (
              <li key={w.name} className='in-flow-dark__wanderer'>
                <span className='in-flow-dark__wanderer-emoji'>{w.emoji}</span>
                <span className='in-flow-dark__wanderer-name'>{w.name}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
