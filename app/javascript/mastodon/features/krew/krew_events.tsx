import { useCallback, useEffect, useMemo, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { apiRequestGet } from 'mastodon/api';
import { SpaceShelf } from 'mastodon/components/space_shelf';
import type { ShelfCard } from 'mastodon/components/space_shelf';

// A Krew's events, its Kalendar section once Kalendar is on (Kommons
// "Krew-Specific Events"): events whose audience includes this Krew that
// are still to come, as a row of cards, soonest first. Past ones aren't
// shown (Tal, 2026-11-09: "i dont think we need to show previous events");
// they stay in Kalendar. New makes an event for the Krew, and its composer
// offers Add existing, which shares one made elsewhere into the Krew
// (Kronk::EventLinks). Taking one off is the page's Diskonnect
// (decisions.md, 2026-10-27).

interface KrewEvent {
  id: string;
  slug: string | null;
  title: string;
  start_time: string;
  image_url: string | null;
}

const messages = defineMessages({
  title: { id: 'krew.events.title', defaultMessage: 'Events' },
});

export const KrewEvents: React.FC<{
  krewId: string;
  id?: string;
  canAdd?: boolean;
}> = ({ krewId, id, canAdd = false }) => {
  const intl = useIntl();
  const [events, setEvents] = useState<KrewEvent[] | null>(null);
  const [loads, setLoads] = useState(0);

  useEffect(() => {
    setEvents(null);
    apiRequestGet<KrewEvent[]>('v1/events', { krew_id: krewId })
      .then(setEvents)
      .catch(() => {
        setEvents([]);
      });
  }, [krewId, loads]);

  const reload = useCallback(() => {
    setLoads((n) => n + 1);
  }, []);

  const cards = useMemo<ShelfCard[] | null>(
    () =>
      events?.map((event) => ({
        key: event.id,
        id: event.id,
        to: `/hub/kalendar/${event.slug ?? event.id}`,
        image: event.image_url,
        title: event.title,
        meta: intl.formatDate(event.start_time, {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          hour: 'numeric',
          minute: '2-digit',
        }),
      })) ?? null,
    [events, intl],
  );

  return (
    <SpaceShelf
      homeSlug='krew'
      homeId={krewId}
      korner='kalendar'
      id={id}
      title={intl.formatMessage(messages.title)}
      canAdd={canAdd}
      cards={cards}
      onAdded={reload}
      className='krew-detail__events'
    />
  );
};
