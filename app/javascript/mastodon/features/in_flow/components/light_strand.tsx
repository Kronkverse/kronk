import { useMemo } from 'react';

import { getDaylightInfo } from 'mastodon/features/events/components/celestial_calendar';

import { LOCATION_TZ, LOCATION_LAT, LOCATION_LON } from '../constants';

import {
  SunIcon,
  SunsetIcon,
  SnowflakeIcon,
  BlossomIcon,
  LeafIcon,
  OrbitIcon,
  FlameIcon,
} from './celestial_icons';

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
  const parts = fmt.formatToParts(new Date());
  const get = (type: string): number =>
    parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10);
  return {
    year: get('year'),
    month: get('month') - 1,
    day: get('day'),
    date: new Date(),
  };
}

function formatTimeInLocation(date: Date): string {
  return date.toLocaleTimeString('en-AU', {
    timeZone: LOCATION_TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDateInLocation(date: Date): string {
  return date.toLocaleDateString('en-AU', {
    timeZone: LOCATION_TZ,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatDaylight(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h)}h ${String(m).padStart(2, '0')}m`;
}

function daysUntil(target: Date, now: Date): number {
  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
}

const TurningIcon = ({ label, size = 22 }: { label: string; size?: number }) => {
  const l = label.toLowerCase();
  if (l.includes('winter') || l.includes('imbolc'))
    return <SnowflakeIcon size={size} />;
  if (l.includes('summer') || l.includes('lammas'))
    return <SunIcon size={size} />;
  if (l.includes('spring') || l.includes('beltane')) {
    if (l.includes('beltane')) return <FlameIcon size={size} />;
    return <BlossomIcon size={size} />;
  }
  if (l.includes('autumn') || l.includes('samhain'))
    return <LeafIcon size={size} />;
  return <OrbitIcon size={size} />;
}

export const LightStrand: React.FC = () => {
  const { year, month, day, date: now } = useMemo(nowInLocation, []);

  const info = useMemo(
    () => getDaylightInfo(year, month, day, LOCATION_LAT, LOCATION_LON),
    [year, month, day],
  );

  const days = daysUntil(info.nextTurningPoint.date, now);

  const direction =
    info.deltaMinutes > 0.5
      ? 'lengthening'
      : info.deltaMinutes < -0.5
        ? 'shortening'
        : 'balanced';

  const directionLabel =
    direction === 'lengthening'
      ? 'Lengthening ↑'
      : direction === 'shortening'
        ? 'Shortening ↓'
        : 'Balanced';

  return (
    <div className='in-flow-light'>
      <div className='in-flow-light__headline'>
        <SunIcon size={32} className='in-flow-light__headline-icon' />
        <div>
          <span className='in-flow-light__headline-number'>
            {formatDaylight(info.daylightMinutes)}
          </span>
          <span className='in-flow-light__headline-label'>of daylight</span>
        </div>
        <span
          className={`in-flow-light__direction-badge in-flow-light__direction-badge--${direction}`}
        >
          {directionLabel}
        </span>
      </div>

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

      <div className='in-flow-light__turning'>
        <span className='in-flow-light__turning-icon'>
          <TurningIcon label={info.nextTurningPoint.label} size={22} />
        </span>
        <span className='in-flow-light__turning-body'>
          <span className='in-flow-light__turning-label'>
            {info.nextTurningPoint.label}
          </span>
          <span className='in-flow-light__turning-date'>
            {formatDateInLocation(info.nextTurningPoint.date)}
          </span>
          <span className='in-flow-light__turning-countdown'>
            {days === 0
              ? 'today'
              : days === 1
                ? 'tomorrow'
                : `in ${String(days)} days`}
          </span>
        </span>
      </div>
    </div>
  );
};
