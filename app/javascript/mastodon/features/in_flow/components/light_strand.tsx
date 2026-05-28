import { useMemo } from 'react';

import { getDaylightInfo } from 'mastodon/features/events/components/celestial_calendar';

// Sydney coordinates
const LAT = -33.8688;
const LON = 151.2093;

const SYDNEY_TZ = 'Australia/Sydney';

function nowInSydney(): {
  year: number;
  month: number;
  day: number;
  date: Date;
} {
  const fmt = new Intl.DateTimeFormat('en-AU', {
    timeZone: SYDNEY_TZ,
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

function formatTimeInSydney(date: Date): string {
  return date.toLocaleTimeString('en-AU', {
    timeZone: SYDNEY_TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDateInSydney(date: Date): string {
  return date.toLocaleDateString('en-AU', {
    timeZone: SYDNEY_TZ,
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

function formatDelta(delta: number): string {
  if (Math.abs(delta) < 0.5) return 'unchanged today';
  const abs = Math.abs(delta);
  const mins = Math.floor(abs);
  const secs = Math.round((abs - mins) * 60);
  const parts = [];
  if (mins > 0) parts.push(`${String(mins)}m`);
  if (secs > 0) parts.push(`${String(secs)}s`);
  const amount = parts.join(' ');
  return delta > 0 ? `+${amount} today` : `−${amount} today`;
}

function daysUntil(target: Date, now: Date): number {
  const msPerDay = 86400000;
  return Math.ceil((target.getTime() - now.getTime()) / msPerDay);
}

export const LightStrand: React.FC = () => {
  const { year, month, day, date: now } = useMemo(nowInSydney, []);

  const info = useMemo(
    () => getDaylightInfo(year, month, day, LAT, LON),
    [year, month, day],
  );

  const days = daysUntil(info.nextTurningPoint.date, now);

  const deltaDir =
    info.deltaMinutes > 0.5
      ? 'lengthening'
      : info.deltaMinutes < -0.5
        ? 'shortening'
        : 'at equilibrium';

  return (
    <div className='in-flow-light'>
      <div className='in-flow-light__headline'>
        <span className='in-flow-light__headline-number'>
          {formatDaylight(info.daylightMinutes)}
        </span>
        <span className='in-flow-light__headline-label'>of daylight today</span>
      </div>

      <div className='in-flow-light__delta'>
        <span
          className={`in-flow-light__delta-value in-flow-light__delta-value--${deltaDir.replace(' ', '-')}`}
        >
          {formatDelta(info.deltaMinutes)}
        </span>
        <span className='in-flow-light__delta-dir'>· days are {deltaDir}</span>
      </div>

      {info.rise && info.set && (
        <div className='in-flow-light__sun-times'>
          <div className='in-flow-light__sun-time'>
            <span className='in-flow-light__sun-emoji'>🌅</span>
            <span className='in-flow-light__sun-label'>Rises</span>
            <span className='in-flow-light__sun-value'>
              {formatTimeInSydney(info.rise)}
            </span>
          </div>
          <div className='in-flow-light__sun-divider' />
          <div className='in-flow-light__sun-time'>
            <span className='in-flow-light__sun-emoji'>🌇</span>
            <span className='in-flow-light__sun-label'>Sets</span>
            <span className='in-flow-light__sun-value'>
              {formatTimeInSydney(info.set)}
            </span>
          </div>
        </div>
      )}

      <div className='in-flow-light__turning'>
        <span className='in-flow-light__turning-emoji'>
          {info.nextTurningPoint.emoji}
        </span>
        <span className='in-flow-light__turning-body'>
          <span className='in-flow-light__turning-label'>
            {info.nextTurningPoint.label}
          </span>
          <span className='in-flow-light__turning-date'>
            {formatDateInSydney(info.nextTurningPoint.date)}
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
