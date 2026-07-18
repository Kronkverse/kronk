import { useEffect, useMemo, useState } from 'react';

import {
  getCelestialEventsForMonth,
  getMoonPhaseName,
  getMoonIllumination,
  getSeasonEventsForYear,
} from './celestial_calendar';
import type {
  CelestialDayEvents,
  CrossQuarterName,
  MoonPhaseName,
} from './celestial_calendar';

type OrbitalType = 'perihelion' | 'aphelion';

const SYDNEY_TZ = 'Australia/Sydney';

function nowInSydney(): Date {
  const fmt = new Intl.DateTimeFormat('en-AU', {
    timeZone: SYDNEY_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const get = (type: string): number =>
    parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10);
  return new Date(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
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

const MOON_DESCRIPTIONS: Record<MoonPhaseName, string> = {
  new_moon:
    'The moon withdraws its reflected light — the sky is at its darkest in the monthly cycle. A genuine pause before the next arc of illumination begins.',
  waxing_crescent:
    "The first sliver of reflected sunlight reappears in the western sky after sunset. The moon's lit face is opening; the tidal pull begins its monthly build.",
  first_quarter:
    "Half the moon's face is lit, half in shadow. The moon and sun are at cross-angles, producing the month's first peak of tidal complexity.",
  waxing_gibbous:
    "More than half the lunar face is lit, brightening night by night as the full phase approaches. The tidal pull is building toward the month's highest range.",
  full_moon:
    'The moon stands opposite the sun — fully illuminated, at its strongest gravitational reach. Tides run at their widest range. The sea, the soil, and all water-holding life moves with this pull.',
  waning_gibbous:
    'The peak has passed. The moon rises later each night, its lit face gradually withdrawing. Light and tidal force begin their monthly retreat.',
  last_quarter:
    'The moon and sun are at cross-angles again — tidal complexity at its second peak of the month. The lit face is halving; the cycle exhales toward its dark.',
  waning_crescent:
    'A thin crescent lingers in the pre-dawn sky. The month is completing its arc toward the dark. Rest before the next new moon begins the turn.',
};

const SEASON_DESCRIPTIONS: Record<string, string> = {
  'Autumn Equinox':
    "Day and night arrive at equal length — the equinox balance point. From here the days shorten, one small increment at a time, as the sun's arc lowers toward the winter solstice. The light is withdrawing its daily portion.",
  'Winter Solstice':
    "The longest night. The sun reaches its lowest arc across the sky and pauses — solstice means 'sun stands still.' From tomorrow the days begin to lengthen. The darkness has reached its full depth; the turn back toward light begins now.",
  'Spring Equinox':
    "Day and night are equal again, the balance tipping toward the light. Each day from here is longer than the last. The sun's angle is climbing; the land's photosynthetic energy begins its generative surge.",
  'Summer Solstice':
    "The longest day. The sun reaches its highest annual arc and pauses before beginning its gradual withdrawal. Maximum daylight, maximum solar angle — the year's peak of light and growing energy.",
};

const ORBITAL_DESCRIPTIONS: Record<OrbitalType, string> = {
  perihelion:
    'Earth is at its closest approach to the sun this year — roughly 147 million kilometres. Solar energy reaching the planet is at its annual peak, about 7% more intense than at aphelion. In the Southern Hemisphere, perihelion falls in summer; in the north, in winter. A quiet asymmetry woven into every year.',
  aphelion:
    'Earth is at its greatest distance from the sun this year — roughly 152 million kilometres. Solar energy is at its annual minimum, though the difference from perihelion is only about 7%. The orbit has reached its widest arc. In the Southern Hemisphere this falls in winter — cold despite the open reach.',
};

const CROSS_QUARTER_DESCRIPTIONS: Record<CrossQuarterName, string> = {
  lammas:
    "Past the summer solstice peak, the days have begun to shorten — though slowly. The heat remains gathered in the land, the sun still high. The year's light begins its gradual withdrawal from its summer maximum.",
  samhain:
    "The days are now measurably shorter than the nights. The sun's arc has lowered; its angle across the sky has shallowed. The light retreats at its quickest pace around the cross-quarters.",
  imbolc:
    'The winter solstice is past. The days are lengthening again — slowly, but the direction has reversed. The sun rises a little earlier each morning. The first measurable return of light is underway.',
  beltane:
    "The light has been returning since the winter solstice and has now reached generous daily lengths. The sun's angle is climbing steeply. Growth energy is accelerating across the land.",
};

interface MonthEvent {
  date: Date;
  emoji: string;
  label: string;
  description: string;
  type: 'moon' | 'season' | 'cross_quarter' | 'orbital';
  isPast: boolean;
}

function getMonthEvents(selectedMonth: Date, now: Date): MonthEvent[] {
  const year = selectedMonth.getFullYear();
  const month = selectedMonth.getMonth();
  const celestialMap = getCelestialEventsForMonth(year, month);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const events: MonthEvent[] = [];

  const addEvent = (
    date: Date,
    emoji: string,
    label: string,
    description: string,
    type: MonthEvent['type'],
  ) => {
    events.push({
      date,
      emoji,
      label,
      description,
      type,
      isPast: date < todayStart,
    });
  };

  celestialMap.forEach((dayEvents: CelestialDayEvents, dateStr: string) => {
    const date = new Date(dateStr);
    if (dayEvents.moon) {
      addEvent(
        date,
        dayEvents.moon.emoji,
        dayEvents.moon.label,
        MOON_DESCRIPTIONS[dayEvents.moon.phase],
        'moon',
      );
    }
    if (dayEvents.season) {
      addEvent(
        date,
        dayEvents.season.emoji,
        dayEvents.season.label,
        SEASON_DESCRIPTIONS[dayEvents.season.label] ?? '',
        'season',
      );
    }
    if (dayEvents.crossQuarter) {
      addEvent(
        date,
        dayEvents.crossQuarter.emoji,
        dayEvents.crossQuarter.label,
        CROSS_QUARTER_DESCRIPTIONS[dayEvents.crossQuarter.name],
        'cross_quarter',
      );
    }
    if (dayEvents.orbital) {
      addEvent(
        date,
        dayEvents.orbital.emoji,
        dayEvents.orbital.label,
        ORBITAL_DESCRIPTIONS[dayEvents.orbital.type],
        'orbital',
      );
    }
  });

  // Season events with precise times (deduplicated)
  const seasonEvents = getSeasonEventsForYear(year).filter(
    (e) => e.date.getMonth() === month,
  );
  seasonEvents.forEach((s) => {
    const key = s.date.toDateString();
    if (
      !events.find((e) => e.type === 'season' && e.date.toDateString() === key)
    ) {
      addEvent(
        s.date,
        s.emoji,
        s.label,
        SEASON_DESCRIPTIONS[s.label] ?? '',
        'season',
      );
    }
  });

  return events.sort((a, b) => a.date.getTime() - b.date.getTime());
}

interface InflowSectionProps {
  selectedMonth: Date;
}

export const InflowSection: React.FC<InflowSectionProps> = ({
  selectedMonth,
}) => {
  const [now, setNow] = useState<Date>(nowInSydney);

  useEffect(() => {
    const id = setInterval(
      () => {
        setNow(nowInSydney());
      },
      60 * 60 * 1000,
    );
    return () => {
      clearInterval(id);
    };
  }, []);

  const moonPhase = useMemo(() => getMoonPhaseName(now), [now]);
  const illumination = useMemo(
    () => Math.round(getMoonIllumination(now) * 100),
    [now],
  );
  const monthEvents = useMemo(
    () => getMonthEvents(selectedMonth, now),
    [selectedMonth, now],
  );

  const monthLabel = selectedMonth.toLocaleString('en-AU', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <section className='in-flow'>
      <div className='in-flow__header'>
        <span className='in-flow__header-label'>Inflow</span>
        <span className='in-flow__header-tz'>Sydney · Melbourne</span>
        <p className='in-flow__header-tagline'>
          Returning to the rhythm of the Kosmos returns us to the Syntropic
          current of Life itself. Through this we come alive and belong again.
        </p>
      </div>

      <div className='in-flow__now'>
        <div className='in-flow__moon'>
          <span className='in-flow__moon-emoji'>{MOON_EMOJIS[moonPhase]}</span>
          <div className='in-flow__moon-info'>
            <span className='in-flow__moon-name'>{MOON_LABELS[moonPhase]}</span>
            <span className='in-flow__moon-illumination'>
              {illumination}% illuminated
            </span>
          </div>
        </div>
      </div>

      {monthEvents.length > 0 && (
        <div className='in-flow__upcoming'>
          <span className='in-flow__upcoming-label'>{monthLabel}</span>
          <ul className='in-flow__upcoming-list'>
            {monthEvents.map((event, i) => (
              <li
                key={i}
                className={`in-flow__upcoming-item in-flow__upcoming-item--${event.type}${event.isPast ? ' in-flow__upcoming-item--past' : ''}`}
              >
                <span className='in-flow__upcoming-emoji'>{event.emoji}</span>
                <span className='in-flow__upcoming-text'>
                  <span className='in-flow__upcoming-event-label'>
                    {event.label}
                  </span>
                  <span className='in-flow__upcoming-date'>
                    {event.type === 'season'
                      ? formatSydneyTime(event.date)
                      : formatSydneyDate(event.date)}
                  </span>
                  <span className='in-flow__upcoming-description'>
                    {event.description}
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
