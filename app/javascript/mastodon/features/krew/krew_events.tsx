import { useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';
import type { IntlShape } from 'react-intl';

import { Link } from 'react-router-dom';

import { apiRequestGet } from 'mastodon/api';

// A Krew's events, on its page (Kommons "Krew-Specific Events"): events
// whose audience includes this Krew, what's coming up and what's been.
// Shown when its Kalendar tile is open. Making one is the Ж menu's +.
// Linking one made elsewhere, and taking it off again, is the page's
// Konnect and Diskonnect (decisions.md, 2026-10-27), not this list.

interface KrewEvent {
  id: string;
  slug: string | null;
  title: string;
  start_time: string;
  location_name: string | null;
}

const messages = defineMessages({
  title: { id: 'krew.events.title', defaultMessage: 'Events' },
  past: { id: 'krew.events.past', defaultMessage: 'Earlier' },
  empty: {
    id: 'krew.events.empty',
    defaultMessage:
      'Nothing coming up for this Krew yet. The + in the Ж menu makes an event for it.',
  },
});

const when = (intl: IntlShape, iso: string) =>
  intl.formatDate(iso, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });

export const KrewEvents: React.FC<{
  krewId: string;
}> = ({ krewId }) => {
  const intl = useIntl();
  const [events, setEvents] = useState<KrewEvent[] | null>(null);
  const [past, setPast] = useState<KrewEvent[]>([]);

  useEffect(() => {
    setEvents(null);
    setPast([]);
    Promise.all([
      apiRequestGet<KrewEvent[]>('v1/events', { krew_id: krewId }),
      apiRequestGet<KrewEvent[]>('v1/events', {
        krew_id: krewId,
        filter: 'past',
      }),
    ])
      .then(([upcoming, earlier]) => {
        setEvents(upcoming);
        setPast(earlier);
      })
      .catch(() => {
        setEvents([]);
      });
  }, [krewId]);

  const renderList = (list: KrewEvent[]) => (
    <ul className='krew-detail__event-list'>
      {list.map((event) => (
        <li key={event.id}>
          <Link
            to={`/hub/kalendar/${event.slug ?? event.id}`}
            className='krew-detail__event'
          >
            <span className='krew-detail__event-when'>
              {when(intl, event.start_time)}
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
  );

  return (
    <section className='krew-detail__section krew-detail__events'>
      <h3 className='korner-section-heading'>
        {intl.formatMessage(messages.title)}
      </h3>

      {events?.length === 0 && (
        <p className='krew-detail__section-hint'>
          {intl.formatMessage(messages.empty)}
        </p>
      )}

      {events && events.length > 0 && renderList(events)}

      {past.length > 0 && (
        <>
          <h4 className='krew-detail__subheading'>
            {intl.formatMessage(messages.past)}
          </h4>
          {renderList(past)}
        </>
      )}
    </section>
  );
};
