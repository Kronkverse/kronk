import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import api from 'mastodon/api';

import { EventCard } from '../events/components/event_card';

// Kalendar — list view. The "list" face of the two-face rotator (see
// `./index.tsx`). Fetches upcoming events (`GET /api/v1/events?filter=
// upcoming`) and renders each through the existing `<EventCard>`, so
// the visual + interaction shape (RSVP buttons, Live pip, meta line)
// matches the classic events feature that shipped before the Spiral
// rebuild (retired here 2026-08-13 as a face rather than a whole
// page). Kept intentionally lean — no create form, no calendar
// widget, no filter chips: those live behind the compose bubble
// (`compose.route`) and the Spiral face respectively.

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

  const handleRsvp = useCallback(async (eventId: string, status: string) => {
    try {
      const res = await api().post<Event>(`/api/v1/events/${eventId}/rsvp`, {
        status,
      });
      setEvents((prev) =>
        prev ? prev.map((e) => (e.id === eventId ? res.data : e)) : prev,
      );
    } catch {
      // Silent — RSVP failure surfaces via the EventCard's own state
      // pipeline; nothing to do here.
    }
  }, []);

  const handleRsvpVoid = useCallback(
    (id: string, status: string) => {
      void handleRsvp(id, status);
    },
    [handleRsvp],
  );

  if (events === null) {
    return (
      <div className='stage-column'>
        <div className='kalendar-list__state'>
          <FormattedMessage {...messages.loading} />
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className='stage-column'>
        <div className='kalendar-list__state'>
          {intl.formatMessage(messages.empty)}
        </div>
      </div>
    );
  }

  return (
    <div className='stage-column'>
      <div className='stage-column__inner'>
        {events.map((event) => (
          <EventCard key={event.id} event={event} onRsvp={handleRsvpVoid} />
        ))}
      </div>
    </div>
  );
};
