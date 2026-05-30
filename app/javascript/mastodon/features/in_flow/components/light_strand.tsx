import { useMemo } from 'react';

import {
  getDaylightInfo,
  getSeasonEventsForYear,
} from 'mastodon/features/events/components/celestial_calendar';

import { LOCATION_TZ, LOCATION_LAT, LOCATION_LON } from '../constants';

import { SunsetIcon } from './celestial_icons';

function nowInLocation(): {
  year: number;
  month: number;
  day: number;
  date: Date;
} {
  const fmt = new Intl.DateTimeFormat('en-AU', {
    timeZone: LOCATION_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const date = new Date();
  const parts = fmt.formatToParts(date);
  const get = (type: string): number =>
    parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10);
  return { year: get('year'), month: get('month') - 1, day: get('day'), date };
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

interface DaylightArcProps {
  daylightMinutes: number;
  riseMinutesFromMidnight: number;
  setMinutesFromMidnight: number;
  riseLabel: string;
  setLabel: string;
  currentMinutes: number;
}

const DaylightArc: React.FC<DaylightArcProps> = ({
  daylightMinutes,
  riseMinutesFromMidnight,
  setMinutesFromMidnight,
  riseLabel,
  setLabel,
  currentMinutes,
}) => {
  const R = 34;
  const cx = 50;
  const cy = 42;

  // t=0 (midnight) → left endpoint; t=720 (noon) → top; t=1440 (midnight) → right
  const arcPoint = (t: number) => {
    const angle = Math.PI * (1 - t / 1440);
    return {
      x: cx + R * Math.cos(angle),
      y: cy - R * Math.sin(angle),
    };
  };

  const leftEnd = arcPoint(0);
  const rightEnd = arcPoint(1440);
  const riseP = arcPoint(riseMinutesFromMidnight);
  const setP = arcPoint(setMinutesFromMidnight);

  const largeArc =
    setMinutesFromMidnight - riseMinutesFromMidnight > 720 ? 1 : 0;

  const h = Math.floor(daylightMinutes / 60);
  const m = daylightMinutes % 60;
  const daylightLabel = `${String(h)}h ${String(m).padStart(2, '0')}m`;

  const sunIsUp =
    currentMinutes >= riseMinutesFromMidnight &&
    currentMinutes <= setMinutesFromMidnight;
  const sunP = sunIsUp ? arcPoint(currentMinutes) : null;

  return (
    <div className='in-flow-light__arc-wrap'>
      <div className='in-flow-light__arc-duration'>{daylightLabel}</div>
      <svg viewBox='0 0 100 56' className='in-flow-light__arc-svg'>
        {/* Background arc — full day */}
        <path
          d={`M ${leftEnd.x} ${leftEnd.y} A ${R} ${R} 0 0 1 ${rightEnd.x} ${rightEnd.y}`}
          className='in-flow-light__arc-track'
        />
        {/* Daylight arc */}
        <path
          d={`M ${riseP.x} ${riseP.y} A ${R} ${R} 0 ${largeArc} 1 ${setP.x} ${setP.y}`}
          className='in-flow-light__arc-fill'
        />
        {/* Sun dot at current time */}
        {sunP && (
          <circle
            cx={sunP.x}
            cy={sunP.y}
            r='4'
            className='in-flow-light__arc-sun'
          />
        )}
        {/* Rise label */}
        <text
          x={riseP.x}
          y={cy + 14}
          textAnchor='middle'
          className='in-flow-light__arc-time'
        >
          {riseLabel}
        </text>
        {/* Set label */}
        <text
          x={setP.x}
          y={cy + 14}
          textAnchor='middle'
          className='in-flow-light__arc-time'
        >
          {setLabel}
        </text>
      </svg>
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

interface SolsticeProgressProps {
  year: number;
  now: Date;
}

const SolsticeProgress: React.FC<SolsticeProgressProps> = ({ year, now }) => {
  const allEvents = useMemo(() => {
    const seasons = [
      ...getSeasonEventsForYear(year - 1),
      ...getSeasonEventsForYear(year),
      ...getSeasonEventsForYear(year + 1),
    ];
    // Only solstices (winter + summer)
    return seasons.filter(
      (e) => e.season === 'winter' || e.season === 'summer',
    );
  }, [year]);

  const prev = allEvents.filter((e) => e.date <= now).at(-1);
  const next = allEvents.find((e) => e.date > now);

  if (!prev || !next) return null;

  const total = next.date.getTime() - prev.date.getTime();
  const elapsed = now.getTime() - prev.date.getTime();
  const progress = Math.min(1, Math.max(0, elapsed / total));
  const progressPct = Math.round(progress * 100);

  const daysUntilNext = Math.ceil(
    (next.date.getTime() - now.getTime()) / 86400000,
  );

  return (
    <div className='in-flow-light__solstice'>
      <div className='in-flow-light__solstice-labels'>
        <span className='in-flow-light__solstice-from'>{prev.label}</span>
        <span className='in-flow-light__solstice-countdown'>
          {daysUntilNext === 1 ? '1 day' : `${String(daysUntilNext)} days`} to{' '}
          {next.label}
        </span>
        <span className='in-flow-light__solstice-to'>{next.label}</span>
      </div>
      <div className='in-flow-light__solstice-bar'>
        <div
          className='in-flow-light__solstice-fill'
          style={{ width: `${String(progressPct)}%` }}
        />
        <div
          className='in-flow-light__solstice-dot'
          style={{ left: `${String(progressPct)}%` }}
        />
      </div>
    </div>
  );
};

export const LightStrand: React.FC = () => {
  const { year, month, day, date } = useMemo(nowInLocation, []);

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
  const currentMinutes = useMemo(() => toLocalMinutes(date), [date]);

  const relationSentence = getLightRelation(direction, month);

  return (
    <div className='in-flow-light'>
      <DaylightArc
        daylightMinutes={info.daylightMinutes}
        riseMinutesFromMidnight={riseMinutes}
        setMinutesFromMidnight={setMinutes}
        riseLabel={riseLabel}
        setLabel={setLabel}
        currentMinutes={currentMinutes}
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

      <SolsticeProgress year={year} now={date} />
    </div>
  );
};
