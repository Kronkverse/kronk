import { useMemo } from 'react';

import {
  getSeasonEventsForYear,
  getCrossQuarterEventsForYear,
} from 'mastodon/features/events/components/celestial_calendar';

import { LOCATION_TZ } from '../constants';

import {
  SunIcon,
  SnowflakeIcon,
  LeafIcon,
  BlossomIcon,
  FlameIcon,
  OrbitIcon,
} from './celestial_icons';

const FestivalIcon = ({
  label,
  size = 22,
}: {
  label: string;
  size?: number;
}) => {
  if (label.includes('Winter')) return <SnowflakeIcon size={size} />;
  if (label.includes('Summer') || label.includes('Lammas'))
    return <SunIcon size={size} />;
  if (label.includes('Spring') || label.includes('Imbolc'))
    return <BlossomIcon size={size} />;
  if (label.includes('Autumn') || label.includes('Samhain'))
    return <LeafIcon size={size} />;
  if (label.includes('Beltane')) return <FlameIcon size={size} />;
  return <OrbitIcon size={size} />;
};

const FESTIVAL_DESCRIPTIONS: Record<string, string> = {
  'Autumn Equinox':
    'Day and night arrive at equal length. From here the days shorten - the sun withdraws its daily portion toward the winter solstice.',
  'Winter Solstice':
    'The longest night. The sun reaches its lowest arc and pauses - solstice means sun stands still. The turn back toward light begins now.',
  'Spring Equinox':
    "Day and night equal again, the balance tipping toward the light. The sun's angle is climbing; the land's generative surge begins.",
  'Summer Solstice':
    "The longest day. The sun reaches its highest annual arc. Maximum daylight - the year's peak before the gradual withdrawal.",
  Lammas:
    'Midpoint between summer solstice and autumn equinox. The heat remains but the days have begun their slow retreat from the peak.',
  Samhain:
    'The sun is past the equinox, the days measurably shorter than the nights. Light retreats at its quickest pace around the cross-quarters.',
  Imbolc:
    'Midpoint between winter solstice and spring equinox. The days lengthen again - slowly, but the direction has reversed.',
  Beltane:
    "The light has returned to generous lengths. The sun's angle climbs steeply. Growth energy accelerates across the land.",
};

function nowInSydney(): { year: number; month: number; day: number } {
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

function formatFestivalDate(date: Date, isSeason: boolean): string {
  if (isSeason) {
    return date.toLocaleString('en-AU', {
      timeZone: LOCATION_TZ,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }
  return date.toLocaleString('en-AU', {
    timeZone: LOCATION_TZ,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

interface FestivalEvent {
  date: Date;
  label: string;
  emoji: string;
  isSeason: boolean;
  isPast: boolean;
  isNext: boolean;
}

export const FestivalStrand: React.FC = () => {
  const { year, month, day } = useMemo(nowInSydney, []);
  const todayStart = useMemo(
    () => new Date(year, month, day),
    [year, month, day],
  );

  const events = useMemo((): FestivalEvent[] => {
    const seasons = getSeasonEventsForYear(year);
    const crossQuarters = getCrossQuarterEventsForYear(year);

    const all: FestivalEvent[] = [
      ...seasons.map((e) => ({
        date: e.date,
        label: e.label,
        emoji: e.emoji,
        isSeason: true,
        isPast: e.date < todayStart,
        isNext: false,
      })),
      ...crossQuarters.map((e) => ({
        date: e.date,
        label: e.label,
        emoji: e.emoji,
        isSeason: false,
        isPast: e.date < todayStart,
        isNext: false,
      })),
    ].sort((a, b) => a.date.getTime() - b.date.getTime());

    // Mark first upcoming event
    const nextIdx = all.findIndex((e) => !e.isPast);
    if (nextIdx >= 0 && all[nextIdx]) {
      all[nextIdx] = { ...all[nextIdx], isNext: true };
    }

    return all;
  }, [year, todayStart]);

  return (
    <div className='in-flow-festival'>
      <ul className='in-flow-festival__list'>
        {events.map((event, i) => (
          <li
            key={i}
            className={[
              'in-flow-festival__item',
              event.isPast ? 'in-flow-festival__item--past' : '',
              event.isNext ? 'in-flow-festival__item--next' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <span className='in-flow-festival__emoji'>
              <FestivalIcon label={event.label} size={22} />
            </span>
            <span className='in-flow-festival__body'>
              <span className='in-flow-festival__label'>{event.label}</span>
              <span className='in-flow-festival__date'>
                {formatFestivalDate(event.date, event.isSeason)}
              </span>
              <span className='in-flow-festival__desc'>
                {FESTIVAL_DESCRIPTIONS[event.label] ?? ''}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};
