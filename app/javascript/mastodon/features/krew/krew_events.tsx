import { useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import { apiRequestGet } from 'mastodon/api';

// What a Krew has coming up, on its page (Kommons "Krew-Specific
// Events"). The list is the Krew's own: events whose audience includes
// this Krew. Making one is the Kalendar tile among the Krew's spaces.

interface KrewEvent {
  id: string;
  slug: string | null;
  title: string;
  start_time: string;
  location_name: string | null;
}

const messages = defineMessages({
  title: { id: 'krew.events.title', defaultMessage: 'Events' },
  empty: {
    id: 'krew.events.empty',
    defaultMessage:
      'Nothing coming up for this Krew yet. Kalendar, above, makes an event for it.',
  },
});

export const KrewEvents: React.FC<{ krewId: string }> = ({ krewId }) => {
  const intl = useIntl();
  const [events, setEvents] = useState<KrewEvent[] | null>(null);

  useEffect(() => {
    let stale = false;
    setEvents(null);
    apiRequestGet<KrewEvent[]>('v1/events', { krew_id: krewId })
      .then((list) => {
        if (!stale) setEvents(list);
      })
      .catch(() => {
        if (!stale) setEvents([]);
      });
    return () => {
      stale = true;
    };
  }, [krewId]);

  return (
    <section className='krew-detail__section krew-detail__events'>
      <h3 className='krew-detail__section-heading'>
        {intl.formatMessage(messages.title)}
      </h3>

      {events?.length === 0 && (
        <p className='krew-detail__section-hint'>
          {intl.formatMessage(messages.empty)}
        </p>
      )}

      {events && events.length > 0 && (
        <ul className='krew-detail__event-list'>
          {events.map((event) => (
            <li key={event.id}>
              <Link
                to={`/hub/kalendar/${event.slug ?? event.id}`}
                className='krew-detail__event'
              >
                <span className='krew-detail__event-when'>
                  {intl.formatDate(event.start_time, {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
                <span className='krew-detail__event-title'>{event.title}</span>
                {event.location_name && (
                  <span className='krew-detail__event-where'>
                    {event.location_name}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
