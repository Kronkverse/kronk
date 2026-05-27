import { useEffect, useMemo, useState } from 'react';

import {
  getCelestialEventsForMonth,
  getMoonPhaseName,
  getMoonIllumination,
  getZodiacForDate,
  getSeasonEventsForYear,
} from './celestial_calendar';
import type {
  CelestialDayEvents,
  CrossQuarterName,
  MoonPhaseName,
} from './celestial_calendar';

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
    'The sky holds its breath. Plant seeds in darkness — what you begin now takes root unseen.',
  waxing_crescent:
    'A silver sliver cuts the night. Take your first steps toward what you have been imagining.',
  first_quarter:
    'Half-lit, half-shadow. Push through resistance — the effort made now carries real weight.',
  waxing_gibbous:
    'Almost full. Refine and prepare; the light is gathering toward its peak.',
  full_moon:
    'The veil between worlds grows thin. Emotions run high — let what no longer serves you go.',
  waning_gibbous:
    'The light releases slowly. Share what you have learned with those around you.',
  last_quarter:
    'Clearing begins. Release, forgive, and make space for what is coming next.',
  waning_crescent:
    'Rest in the dark before the cycle turns. What you surrender now returns transformed.',
};

const SEASON_DESCRIPTIONS: Record<string, string> = {
  'Spring Equinox':
    'The land wakes and stretches. Life presses through the soil with quiet, irresistible force.',
  'Summer Solstice':
    'Light reigns at its longest hour. Step outside — the warmth is asking you to be present.',
  'Autumn Equinox':
    'The trees let their colours burn before letting go. There is beauty in this graceful release.',
  'Winter Solstice':
    'The world turns inward. In the stillness, something essential gathers strength.',
};

const ZODIAC_DESCRIPTIONS: Record<string, string> = {
  Aries:
    'Fire leads the way. Bold instincts are your guide — act before the moment passes.',
  Taurus:
    'A golden orb bathes the land. Savour the richness of simple pleasures.',
  Gemini:
    'Two minds at once, curious and quick. Let conversation carry you somewhere unexpected.',
  Cancer:
    'The tide pulls homeward. Tend to those you love and let yourself be tended in return.',
  Leo: 'The sun pours itself into everything. Shine without apology — your warmth is needed.',
  Virgo:
    'Detail and devotion sharpen the work. The smallest care changes everything.',
  Libra:
    'The scales tip and balance and tip again. Beauty and fairness ask for your attention.',
  Scorpio:
    'Still waters run deep. What lies beneath is worth more than the surface suggests.',
  Sagittarius:
    'The arrow flies toward the horizon. Follow curiosity wherever it dares to point.',
  Capricorn:
    'The mountain does not hurry. Patient effort builds what endures through any season.',
  Aquarius:
    'Strange ideas arrive from strange angles. Welcome what you cannot yet explain.',
  Pisces:
    'Dream and reality soften into each other. What you feel knows more than you think.',
};

const CROSS_QUARTER_DESCRIPTIONS: Record<CrossQuarterName, string> = {
  lammas:
    'The land offers what it has grown. Gather the abundance — this richness will carry you through.',
  samhain:
    'The veil between worlds grows thin. Honour what has passed and welcome what comes through the dark.',
  imbolc:
    'Beneath the frost, life stirs. The light is turning — tend the small flame within.',
  beltane:
    'Fire and blossom, the world awakens fully. Step into what calls you most alive.',
};

interface MonthEvent {
  date: Date;
  emoji: string;
  label: string;
  description: string;
  type: 'moon' | 'season' | 'zodiac' | 'cross_quarter';
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
    if (dayEvents.zodiac) {
      const signName = dayEvents.zodiac.sign;
      addEvent(
        date,
        dayEvents.zodiac.emoji,
        dayEvents.zodiac.label,
        ZODIAC_DESCRIPTIONS[signName] ?? '',
        'zodiac',
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

interface InFlowSectionProps {
  selectedMonth: Date;
}

export const InFlowSection: React.FC<InFlowSectionProps> = ({
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
  const zodiac = useMemo(() => getZodiacForDate(now), [now]);
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
        <span className='in-flow__header-label'>In Flow</span>
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

        <div className='in-flow__zodiac'>
          <span className='in-flow__zodiac-emoji'>{zodiac.emoji}</span>
          <span className='in-flow__zodiac-name'>{zodiac.sign}</span>
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
