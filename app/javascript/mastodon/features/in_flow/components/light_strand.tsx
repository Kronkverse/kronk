import { useMemo } from 'react';

import { getDaylightInfo } from 'mastodon/features/events/components/celestial_calendar';

import { LOCATION_TZ, LOCATION_LAT, LOCATION_LON } from '../constants';

import { SunsetIcon } from './celestial_icons';

function nowInLocation(): { year: number; month: number; day: number } {
  const fmt = new Intl.DateTimeFormat('en-AU', {
    timeZone: LOCATION_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(new Date());
  const get = (type: string): number =>
    parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10);
  return { year: get('year'), month: get('month') - 1, day: get('day') };
}

function formatTimeInLocation(date: Date): string {
  return date.toLocaleTimeString('en-AU', {
    timeZone: LOCATION_TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function toLocalMinutes(date: Date): number {
  const fmt = new Intl.DateTimeFormat('en-AU', {
    timeZone: LOCATION_TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const h = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
  const m = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
  return h * 60 + m;
}

interface DaylightBarProps {
  daylightMinutes: number;
  riseMinutesFromMidnight: number;
  setMinutesFromMidnight: number;
  riseLabel: string;
  setLabel: string;
}

const DaylightBar: React.FC<DaylightBarProps> = ({
  daylightMinutes,
  riseMinutesFromMidnight,
  setMinutesFromMidnight,
  riseLabel,
  setLabel,
}) => {
  const total = 24 * 60;
  const riseX = (riseMinutesFromMidnight / total) * 100;
  const setX = (setMinutesFromMidnight / total) * 100;
  const midX = (riseX + setX) / 2;
  const h = Math.floor(daylightMinutes / 60);
  const m = daylightMinutes % 60;
  const daylightLabel = `${String(h)}h ${String(m).padStart(2, '0')}m`;

  return (
    <div className='in-flow-light__bar-wrap'>
      <svg
        viewBox='0 0 100 20'
        className='in-flow-light__bar-svg'
        preserveAspectRatio='none'
      >
        {/* Track */}
        <rect
          x='0'
          y='8'
          width='100'
          height='4'
          rx='2'
          className='in-flow-light__bar-track'
        />
        {/* Daylight fill */}
        <rect
          x={riseX}
          y='7'
          width={setX - riseX}
          height='6'
          rx='3'
          className='in-flow-light__bar-fill'
        />
        {/* Sun dot */}
        <circle cx={midX} cy='10' r='4' className='in-flow-light__bar-sun' />
      </svg>
      <div className='in-flow-light__bar-labels'>
        <span className='in-flow-light__bar-rise'>{riseLabel}</span>
        <span className='in-flow-light__bar-duration'>
          {daylightLabel} of daylight
        </span>
        <span className='in-flow-light__bar-set'>{setLabel}</span>
      </div>
    </div>
  );
};

function getLightRelation(direction: string, month: number): string {
  // Southern Hemisphere seasons by month
  if (month >= 5 && month <= 7) {
    // Winter
    if (direction === 'shortening')
      return 'The light continues to withdraw — low angles, long shadows, a sky that holds its warmth close to the horizon.';
    if (direction === 'lengthening')
      return 'Winter light beginning its slow return — each day a little more sky before dark.';
    return 'The light rests at its winter still-point.';
  }
  if (month >= 8 && month <= 10) {
    // Spring
    if (direction === 'lengthening')
      return 'Spring light surging — the angle steepens, the warmth arrives earlier each morning.';
    return 'The light of spring, generous and climbing.';
  }
  if (month >= 11 || month <= 1) {
    // Summer
    if (direction === 'shortening')
      return 'Long summer light beginning its slow retreat — still generous, but the turn has come.';
    return 'Expansive summer light — the sun barely below the horizon at dusk.';
  }
  // Autumn
  if (direction === 'shortening')
    return 'Autumn light — softer and lower each week, the world turning amber at the edges.';
  return 'The mellowing light of autumn, drawing down toward winter.';
}

export const LightStrand: React.FC = () => {
  const { year, month, day } = useMemo(nowInLocation, []);

  const info = useMemo(
    () => getDaylightInfo(year, month, day, LOCATION_LAT, LOCATION_LON),
    [year, month, day],
  );

  const direction =
    info.deltaMinutes > 0.5
      ? 'lengthening'
      : info.deltaMinutes < -0.5
        ? 'shortening'
        : 'balanced';

  const riseLabel = info.rise ? formatTimeInLocation(info.rise) : '';
  const setLabel = info.set ? formatTimeInLocation(info.set) : '';
  const riseMinutes = info.rise ? toLocalMinutes(info.rise) : 6 * 60;
  const setMinutes = info.set ? toLocalMinutes(info.set) : 18 * 60;

  const relationSentence = getLightRelation(direction, month);

  return (
    <div className='in-flow-light'>
      <DaylightBar
        daylightMinutes={info.daylightMinutes}
        riseMinutesFromMidnight={riseMinutes}
        setMinutesFromMidnight={setMinutes}
        riseLabel={riseLabel}
        setLabel={setLabel}
      />

      {info.rise && info.set && (
        <div className='in-flow-light__sun-times'>
          <div className='in-flow-light__sun-time'>
            <SunsetIcon size={20} className='in-flow-light__sun-icon' />
            <span className='in-flow-light__sun-label'>Rises</span>
            <span className='in-flow-light__sun-value'>
              {formatTimeInLocation(info.rise)}
            </span>
          </div>
          <div className='in-flow-light__sun-divider' />
          <div className='in-flow-light__sun-time'>
            <SunsetIcon
              size={20}
              className='in-flow-light__sun-icon in-flow-light__sun-icon--set'
            />
            <span className='in-flow-light__sun-label'>Sets</span>
            <span className='in-flow-light__sun-value'>
              {formatTimeInLocation(info.set)}
            </span>
          </div>
        </div>
      )}

      <p className='in-flow-light__relation'>{relationSentence}</p>
    </div>
  );
};
