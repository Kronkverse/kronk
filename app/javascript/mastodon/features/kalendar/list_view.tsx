import { useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import api from 'mastodon/api';
import { EmptyState } from 'mastodon/components/empty_state';
import { LoadingState } from 'mastodon/components/loading_state';

import { EventCard } from '../events/components/event_card';

// Kalendar — list view. The "list" face of the two-face rotator (see
// `./index.tsx`). Fetches upcoming events (`GET /api/v1/events?filter=
// upcoming`) and renders each through the existing `<EventCard>`, so
// the visual + interaction shape (Live pip, meta line, map thumbnail)
// matches the classic events feature that shipped before the Spiral
// rebuild (retired here 2026-08-13 as a face rather than a whole
// page). Kept intentionally lean — no create form, no calendar
// widget, no filter chips: those live behind the compose bubble
// (`compose.route`) and the Spiral face respectively. RSVP lives on
// the event detail page — the list card is a glance surface.

const messages = defineMessages({
  loading: {
    id: 'kalendar.list.loading',
    defaultMessage: 'Loading Kalendar…',
  },
  empty: {
    id: 'kalendar.list.empty',
    defaultMessage: 'Nothing coming up yet.',
  },
});

// The Event shape shipped by `/api/v1/events` — a subset of the full
// EventCard payload, matching what the list needs. See
// `features/events/index.tsx` for the exhaustive shape.
interface Event {
  id: string;
  title: string;
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

export const KalendarListView: React.FC = () => {
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

  return (
    <div className='stage-column'>
      <div className='stage-column__inner'>
        {events.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>
    </div>
  );
};
