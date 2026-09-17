import { useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import api from 'mastodon/api';
import { EmptyState } from 'mastodon/components/empty_state';
import { LoadingState } from 'mastodon/components/loading_state';
import { SpaceCard, SpaceGrid } from 'mastodon/components/space_grid';

// Kalendar — the Events face (was "List" until 2026-09-08). Fetches
// upcoming events (`GET /api/v1/events?filter=upcoming`) and lays them out
// in the standard space grid, the same one Wachuneed lists with — two up on
// a phone, four on a desktop, each a square image over a short body.
//
// It used to render a stack of `<EventCard>`s, which is a reading surface:
// Live pip, meta line, map thumbnail, one event per row. A grid answers a
// different question — "what is coming up" rather than "tell me about this
// one" — and that is what this face is for. The detail, and RSVP, live on the
// event page a card links to.
//
// Kept intentionally lean: no create form, no calendar widget, no filter
// chips. Those live behind the compose bubble and the Spiral face.

const messages = defineMessages({
  loading: {
    id: 'kalendar.list.loading',
    defaultMessage: 'Loading Kalendar…',
  },
  empty: {
    id: 'kalendar.list.empty',
    defaultMessage: 'Nothing coming up yet.',
  },
  live: { id: 'kalendar.events.live', defaultMessage: 'Live now' },
});

// Day + time, short enough to sit under a title without wrapping the tile.
const whenLabel = (iso: string): string => {
  const dt = new Date(iso);
  return dt.toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
};

// A glyph per event type, so a tile with no image still says what kind of
// thing it is rather than showing an empty square.
const PLACEHOLDER: Record<string, string> = {
  huddle: '🎧',
  gathering: '🔥',
  workshop: '🛠',
};

// The Event shape shipped by `/api/v1/events` — a subset of the full
// EventCard payload, matching what the list needs. See
// `features/events/index.tsx` for the exhaustive shape.
interface Event {
  id: string;
  title: string;
  image_url: string | null;
  start_time: string;
  end_time: string | null;
  location_name: string | null;
  event_type: string;
  huddle_url: string | null;
  going_count: number;
  interested_count: number;
  rsvp: string | null;
  rsvp_enabled: boolean;
  account: {
    id: string;
    username: string;
    acct: string;
    display_name: string;
    url: string;
  } | null;
}

export const KalendarEventsView: React.FC = () => {
  const intl = useIntl();
  const [events, setEvents] = useState<Event[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void api()
      .get<Event[]>('/api/v1/events', { params: { filter: 'upcoming' } })
      .then((res) => {
        if (!cancelled) setEvents(res.data);
        return undefined;
      })
      .catch(() => {
        if (!cancelled) setEvents([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (events === null) {
    return (
      <div className='stage-column'>
        <LoadingState label={intl.formatMessage(messages.loading)} />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className='stage-column'>
        <EmptyState title={intl.formatMessage(messages.empty)} />
      </div>
    );
  }

  const now = Date.now();

  return (
    <div className='stage-column'>
      <div className='stage-column__inner'>
        <SpaceGrid>
          {events.map((event) => {
            const start = new Date(event.start_time).getTime();
            const end = event.end_time
              ? new Date(event.end_time).getTime()
              : null;
            const live = start <= now && (end === null || end >= now);

            return (
              <SpaceCard
                key={event.id}
                to={`/hub/kalendar/${event.id}`}
                image={event.image_url}
                placeholder={PLACEHOLDER[event.event_type] ?? '📅'}
                title={event.title}
                meta={whenLabel(event.start_time)}
                tag={live ? intl.formatMessage(messages.live) : null}
                tagKind={live ? 'live' : undefined}
              />
            );
          })}
        </SpaceGrid>
      </div>
    </div>
  );
};
