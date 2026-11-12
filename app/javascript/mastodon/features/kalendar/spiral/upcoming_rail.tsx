import { defineMessages, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

// The next few events, listed down the left of the Spiral under the today
// badge (Kommons "Upcoming events"): date, name and a line of description,
// each linking to the event's page. Fed by the Spiral's own events fetch, so
// the list and the tile glyphs can't disagree. On a phone the description
// drops out so the column stays narrow beside the spiral.

export interface UpcomingEvent {
  id: string;
  slug?: string | null;
  title: string;
  description?: string | null;
  start_time: string;
}

const messages = defineMessages({
  label: {
    id: 'kalendar.spiral.upcoming',
    defaultMessage: 'Coming up',
  },
});

const LIMIT = 6;

export const UpcomingRail: React.FC<{ events: UpcomingEvent[] }> = ({
  events,
}) => {
  const intl = useIntl();
  if (events.length === 0) return null;

  return (
    <nav
      className='kspiral__upcoming'
      aria-label={intl.formatMessage(messages.label)}
    >
      <ol className='kspiral__upcoming-list'>
        {events.slice(0, LIMIT).map((event) => {
          const start = new Date(event.start_time);
          return (
            <li key={event.id}>
              <Link
                to={`/hub/kalendar/${event.slug ?? event.id}`}
                className='kspiral__upcoming-item'
              >
                <time
                  className='kspiral__upcoming-date'
                  dateTime={event.start_time}
                >
                  {intl.formatDate(start, {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })}
                </time>
                <span className='kspiral__upcoming-title'>{event.title}</span>
                {event.description && (
                  <span className='kspiral__upcoming-desc'>
                    {event.description}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
