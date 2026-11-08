import { useCallback, useEffect, useMemo, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';
import type { IntlShape } from 'react-intl';

import { apiRequestGet } from 'mastodon/api';
import { SpaceShelf } from 'mastodon/components/space_shelf';
import type { ShelfCard } from 'mastodon/components/space_shelf';

// A Krew's events, its Kalendar section once Kalendar is on (Kommons
// "Krew-Specific Events"): events whose audience includes this Krew, as a
// row of cards, what's coming up first and then what's been. New makes an
// event for the Krew; Add existing Konnects one made elsewhere, which
// shares it into the Krew (Kronk::EventLinks). Taking one off is the
// page's Diskonnect (decisions.md, 2026-10-27).

interface KrewEvent {
  id: string;
  slug: string | null;
  title: string;
  start_time: string;
  image_url: string | null;
}

const messages = defineMessages({
  title: { id: 'krew.events.title', defaultMessage: 'Events' },
  past: { id: 'krew.events.past_card', defaultMessage: 'Was {when}' },
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
  id?: string;
  canAdd?: boolean;
}> = ({ krewId, id, canAdd = false }) => {
  const intl = useIntl();
  const [lists, setLists] = useState<{
    upcoming: KrewEvent[];
    past: KrewEvent[];
  } | null>(null);
  const [loads, setLoads] = useState(0);

  useEffect(() => {
    setLists(null);
    Promise.all([
      apiRequestGet<KrewEvent[]>('v1/events', { krew_id: krewId }),
      apiRequestGet<KrewEvent[]>('v1/events', {
        krew_id: krewId,
        filter: 'past',
      }),
    ])
      .then(([upcoming, past]) => {
        setLists({ upcoming, past });
      })
      .catch(() => {
        setLists({ upcoming: [], past: [] });
      });
  }, [krewId, loads]);

  const reload = useCallback(() => {
    setLoads((n) => n + 1);
  }, []);

  const cards = useMemo<ShelfCard[] | null>(() => {
    if (!lists) return null;
    const card = (event: KrewEvent, past: boolean): ShelfCard => ({
      key: event.id,
      id: event.id,
      to: `/hub/kalendar/${event.slug ?? event.id}`,
      image: event.image_url,
      title: event.title,
      meta: past
        ? intl.formatMessage(messages.past, {
            when: when(intl, event.start_time),
          })
        : when(intl, event.start_time),
    });
    return [
      ...lists.upcoming.map((event) => card(event, false)),
      ...lists.past.map((event) => card(event, true)),
    ];
  }, [lists, intl]);

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
