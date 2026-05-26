import { useEffect, useMemo, useState } from 'react';

import {
  getCelestialEventsForMonth,
  getMoonPhaseName,
  getMoonIllumination,
  getZodiacForDate,
  getSeasonEventsForYear,
  type CelestialDayEvents,
  type MoonPhaseName,
} from './celestial_calendar';

const SYDNEY_TZ = 'Australia/Sydney';

function nowInSydney(): Date {
  const str = new Date().toLocaleString('en-AU', { timeZone: SYDNEY_TZ });
  return new Date(str);
}

function formatSydneyTime(date: Date): string {
  return date.toLocaleString('en-AU', {
    timeZone: SYDNEY_TZ,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatSydneyDate(date: Date): string {
  return date.toLocaleString('en-AU', {
    timeZone: SYDNEY_TZ,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

const MOON_LABELS: Record<MoonPhaseName, string> = {
  new_moon: 'New Moon',
  waxing_crescent: 'Waxing Crescent',
  first_quarter: 'First Quarter',
  waxing_gibbous: 'Waxing Gibbous',
  full_moon: 'Full Moon',
  waning_gibbous: 'Waning Gibbous',
  last_quarter: 'Last Quarter',
  waning_crescent: 'Waning Crescent',
};

const MOON_EMOJIS: Record<MoonPhaseName, string> = {
  new_moon: '🌑',
  waxing_crescent: '🌒',
  first_quarter: '🌓',
  waxing_gibbous: '🌔',
  full_moon: '🌕',
  waning_gibbous: '🌖',
  last_quarter: '🌗',
  waning_crescent: '🌘',
};

type UpcomingEvent = {
  date: Date;
  emoji: string;
  label: string;
  type: 'moon' | 'season' | 'zodiac';
};

function getUpcomingEvents(selectedMonth: Date, now: Date): UpcomingEvent[] {
  const year = selectedMonth.getFullYear();
  const month = selectedMonth.getMonth();
  const celestialMap = getCelestialEventsForMonth(year, month);
  const events: UpcomingEvent[] = [];

  celestialMap.forEach((dayEvents: CelestialDayEvents, dateStr: string) => {
    const date = new Date(dateStr);
    if (dayEvents.moon) {
      events.push({ date, emoji: dayEvents.moon.emoji, label: dayEvents.moon.label, type: 'moon' });
    }
    if (dayEvents.season) {
      events.push({ date, emoji: dayEvents.season.emoji, label: dayEvents.season.label, type: 'season' });
    }
    if (dayEvents.zodiac) {
      events.push({ date, emoji: dayEvents.zodiac.emoji, label: dayEvents.zodiac.label, type: 'zodiac' });
    }
  });

  // Also include season events that fall this month (more precise dates)
  const seasonEvents = getSeasonEventsForYear(year).filter(
    (e) => e.date.getMonth() === month,
  );
  seasonEvents.forEach((s) => {
    const key = s.date.toDateString();
    if (!events.find((e) => e.type === 'season' && e.date.toDateString() === key)) {
      events.push({ date: s.date, emoji: s.emoji, label: s.label, type: 'season' });
    }
  });

  return events
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .filter((e) => e.date >= new Date(now.getFullYear(), now.getMonth(), now.getDate()));
}

interface InFlowSectionProps {
  selectedMonth: Date;
}

export const InFlowSection: React.FC<InFlowSectionProps> = ({ selectedMonth }) => {
  const [now, setNow] = useState<Date>(nowInSydney);

  // Refresh current moment every hour
  useEffect(() => {
    const id = setInterval(() => setNow(nowInSydney()), 60 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const moonPhase = useMemo(() => getMoonPhaseName(now), [now]);
  const illumination = useMemo(
    () => Math.round(getMoonIllumination(now) * 100),
    [now],
  );
  const zodiac = useMemo(() => getZodiacForDate(now), [now]);
  const upcoming = useMemo(
    () => getUpcomingEvents(selectedMonth, now),
    [selectedMonth, now],
  );

  return (
    <section className='in-flow'>
      <div className='in-flow__header'>
        <span className='in-flow__header-label'>In Flow</span>
        <span className='in-flow__header-tz'>Sydney / Melbourne</span>
      </div>

      <div className='in-flow__now'>
        <div className='in-flow__moon'>
          <span className='in-flow__moon-emoji'>
            {MOON_EMOJIS[moonPhase]}
          </span>
          <div className='in-flow__moon-info'>
            <span className='in-flow__moon-name'>{MOON_LABELS[moonPhase]}</span>
            <span className='in-flow__moon-illumination'>
              {illumination}% illuminated
            </span>
          </div>
        </div>

        <div className='in-flow__zodiac'>
          <span className='in-flow__zodiac-emoji'>{zodiac.emoji}</span>
          <span className='in-flow__zodiac-name'>{zodiac.sign}</span>
        </div>
      </div>

      {upcoming.length > 0 && (
        <div className='in-flow__upcoming'>
          <span className='in-flow__upcoming-label'>Coming up</span>
          <ul className='in-flow__upcoming-list'>
            {upcoming.slice(0, 8).map((event, i) => (
              <li key={i} className={`in-flow__upcoming-item in-flow__upcoming-item--${event.type}`}>
                <span className='in-flow__upcoming-emoji'>{event.emoji}</span>
                <span className='in-flow__upcoming-text'>
                  <span className='in-flow__upcoming-event-label'>{event.label}</span>
                  <span className='in-flow__upcoming-date'>
                    {event.type === 'season'
                      ? formatSydneyTime(event.date)
                      : formatSydneyDate(event.date)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};
