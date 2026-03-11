import { useMemo, useState } from 'react';
import { FormattedDate } from 'react-intl';
import { EventCard } from './event_card';

type Event = {
  id: string;
  title: string;
  description: string;
  start_time: string;
  end_time: string | null;
  location_name: string | null;
  event_type: string;
  huddle_url: string | null;
  going_count: number;
  interested_count: number;
  rsvp: string | null;
  invited: boolean;
  account: any;
  rsvp_enabled: boolean;
  image_url: string | null;
  visibility?: string | null;
};

type SpanPosition = 'single' | 'start' | 'middle' | 'end';

type DayEvent = {
  event: Event;
  position: SpanPosition;
};

type Props = {
  events: Event[];
  selectedMonth: Date;
  onMonthChange: (date: Date) => void;
  onRsvp: (eventId: string, status: string) => void;
};

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function toDateOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function getDaysInMonth(date: Date): Date[] {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  let startDate = new Date(firstDay);
  const dayOfWeek = startDate.getDay();
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  startDate.setDate(startDate.getDate() - diff);

  const days: Date[] = [];
  const current = new Date(startDate);
  while (current <= lastDay || days.length % 7 !== 0) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return days;
}

function isSameDay(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
}

const HuddleIcon = () => (
  <svg className='event-calendar__huddle-icon' viewBox='0 -960 960 960' width='10' height='10' fill='currentColor'>
    <path d='M350-63q-46 0-82.5-24T211-153q-16 21-40.5 32.5T120-109q-51 0-85.5-35T0-229q0-43 28-77.5T99-346q-14-20-21.5-42.5T70-436q0-40 20.5-75t57.5-57q5 18 13.5 38.5T181-494q-14 11-22 26.5t-8 32.5q0 56 46 69t87 21l19 32q-11 32-19 54.5t-8 40.5q0 30 21.5 52.5T350-143q38 0 63-34t41-80q16-46 24.5-93t13.5-72l78 21q-9 45-22 103t-36.5 110.5Q488-135 449.5-99T350-63ZM120-189q17 0 28.5-11.5T160-229q0-17-11.5-28.5T120-269q-17 0-28.5 11.5T80-229q0 17 11.5 28.5T120-189Zm284-158q-46-41-83.5-76.5t-64.5-69q-27-33.5-41.5-67T200-629q0-65 44.5-109.5T354-783q4 0 7 .5t7 .5q-4-10-6-20t-2-21q0-50 35-85t85-35q50 0 85 35t35 85q0 11-2 20.5t-6 19.5h14q60 0 102 38.5t50 95.5q-18-3-40.5-3t-41.5 2q-7-23-25.5-38T606-703q-35 0-54.5 20.5T498-623h-37q-35-41-54.5-60.5T354-703q-32 0-53 21t-21 53q0 23 13 47.5t36.5 52q23.5 27.5 57 58.5t74.5 67l-57 57Zm76-436q17 0 28.5-11.5T520-823q0-17-11.5-28.5T480-863q-17 0-28.5 11.5T440-823q0 17 11.5 28.5T480-783ZM609-63q-22 0-43.5-6T524-88q11-14 22-33t20-35q11 7 22 10t22 3q32 0 53.5-22.5T685-219q0-19-8-41t-19-54l19-32q42-8 87.5-21t45.5-69q0-40-29.5-58T716-512q-42 0-98 16t-131 41l-21-78q78-25 139-42t112-17q69 0 121 41t52 115q0 25-7.5 47.5T861-346q43 5 71 39.5t28 77.5q0 50-34.5 85T840-109q-26 0-50.5-11.5T749-153q-20 42-56.5 66T609-63Zm232-126q17 0 28-11.5t11-28.5q0-17-11.5-29T840-270q-17 0-28.5 11.5T800-230q0 17 12 29t29 12Z' />
  </svg>
);

function getColorClass(event: Event): string {
  if (event.event_type === 'huddle') return 'event-calendar__event-dot--huddle';
  if (event.rsvp === 'going') return 'event-calendar__event-dot--going';
  if (event.rsvp === 'interested') return 'event-calendar__event-dot--interested';
  if (event.rsvp === 'not_going') return 'event-calendar__event-dot--not-going';
  if (event.invited) return 'event-calendar__event-dot--invited';
  return '';
}

export const EventCalendar: React.FC<Props> = ({ events, selectedMonth, onMonthChange, onRsvp }) => {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const days = useMemo(() => getDaysInMonth(selectedMonth), [selectedMonth]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, DayEvent[]>();

    events.forEach(event => {
      const start = toDateOnly(new Date(event.start_time));
      const end = event.end_time ? toDateOnly(new Date(event.end_time)) : start;
      const isMultiDay = end.getTime() > start.getTime();

      if (!isMultiDay) {
        const dateKey = start.toDateString();
        const existing = map.get(dateKey) || [];
        existing.push({ event, position: 'single' });
        map.set(dateKey, existing);
      } else {
        const current = new Date(start);
        while (current <= end) {
          const dateKey = current.toDateString();
          const existing = map.get(dateKey) || [];

          let position: SpanPosition;
          if (isSameDay(current, start)) {
            position = 'start';
          } else if (isSameDay(current, end)) {
            position = 'end';
          } else {
            position = 'middle';
          }

          existing.push({ event, position });
          map.set(dateKey, existing);
          current.setDate(current.getDate() + 1);
        }
      }
    });

    return map;
  }, [events]);

  const selectedEvent = selectedEventId ? events.find(e => e.id === selectedEventId) : null;

  const prevMonth = () => {
    const d = new Date(selectedMonth);
    d.setMonth(d.getMonth() - 1);
    onMonthChange(d);
    setSelectedEventId(null);
  };

  const nextMonth = () => {
    const d = new Date(selectedMonth);
    d.setMonth(d.getMonth() + 1);
    onMonthChange(d);
    setSelectedEventId(null);
  };

  const today = new Date();

  return (
    <div className='event-calendar'>
      <div className='event-calendar__nav'>
        <button onClick={prevMonth} className='event-calendar__nav-btn'>{'\u2190'}</button>
        <span className='event-calendar__month-label'>
          <FormattedDate value={selectedMonth} month='long' year='numeric' />
        </span>
        <button onClick={nextMonth} className='event-calendar__nav-btn'>{'\u2192'}</button>
      </div>

      <div className='event-calendar__grid'>
        {DAYS.map(day => (
          <div key={day} className='event-calendar__day-header'>{day}</div>
        ))}

        {days.map((day, i) => {
          const dateKey = day.toDateString();
          const dayEvents = eventsByDate.get(dateKey) || [];
          const isCurrentMonth = day.getMonth() === selectedMonth.getMonth();
          const isToday = isSameDay(day, today);

          return (
            <div
              key={i}
              className={`event-calendar__cell ${!isCurrentMonth ? 'event-calendar__cell--other-month' : ''} ${isToday ? 'event-calendar__cell--today' : ''}`}
            >
              <span className='event-calendar__cell-date'>{day.getDate()}</span>
              {dayEvents.map(({ event, position }) => {
                const colorClass = getColorClass(event);
                const isSelected = selectedEventId === event.id;
                const posClass = position !== 'single' ? `event-calendar__event-dot--${position}` : '';

                return (
                  <button
                    key={event.id}
                    className={`event-calendar__event-dot ${colorClass} ${posClass} ${isSelected ? 'event-calendar__event-dot--selected' : ''}`}
                    title={event.title}
                    onClick={() => setSelectedEventId(isSelected ? null : event.id)}
                  >
                    {event.event_type === 'huddle' && (position === 'start' || position === 'single') && <HuddleIcon />}
                    {event.title.length > 10 ? event.title.slice(0, 10) + '\u2026' : event.title}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {selectedEvent && (
        <div className='event-calendar__selected'>
          <EventCard event={selectedEvent} onRsvp={onRsvp} />
        </div>
      )}
    </div>
  );
};
