import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl, defineMessages, FormattedMessage } from 'react-intl';

import { Helmet } from 'react-helmet';

import api from 'mastodon/api';
import Column from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { DarkStrand } from 'mastodon/features/in_flow/components/dark_strand';
import { EarthStrand } from 'mastodon/features/in_flow/components/earth_strand';
import { FestivalStrand } from 'mastodon/features/in_flow/components/festival_strand';
import { LightStrand } from 'mastodon/features/in_flow/components/light_strand';
import { planetIcon, planetName, spaceColor } from 'mastodon/planets';

import { CreateEventForm } from './components/create_event_form';
import { EventCard } from './components/event_card';
import { InviteFollowersPanel } from './components/invite_followers_panel';
import { TemporalArc } from './components/temporal_arc';

const messages = defineMessages({
  title: { id: 'events.title', defaultMessage: '₭alendar' },
});

interface Event {
  id: string;
  title: string;
  description: string;
  start_time: string;
  end_time: string | null;
  location_name: string | null;
  location_url: string | null;
  event_type: string;
  huddle_url: string | null;
  rsvp_enabled: boolean;
  max_attendees: number | null;
  recurrence_rule: string | null;
  going_count: number;
  interested_count: number;
  rsvp: string | null;
  invited: boolean;
  cancelled: boolean;
  account: EventAccount;
  status_id: string | null;
  image_url: string | null;
  is_owner: boolean;
}

interface EventAccount {
  id: string;
  username: string;
  acct: string;
  display_name: string;
  url: string;
}

type StrandTab = 'light' | 'dark' | 'soil' | 'season';
const STRAND_TABS: StrandTab[] = ['light', 'dark', 'soil', 'season'];

const STRAND_LABELS: Record<StrandTab, string> = {
  light: 'Light',
  dark: 'Dark',
  soil: 'Soil',
  season: 'Season',
};

const Events: React.FC<{ multiColumn?: boolean }> = ({ multiColumn }) => {
  const intl = useIntl();
  const [events, setEvents] = useState<Event[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [createdEventId, setCreatedEventId] = useState<string | null>(null);
  const [focusedDate, setFocusedDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [activeStrand, setActiveStrand] = useState<StrandTab>('light');

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api().get('/api/v1/events', {
        params: { filter: 'upcoming' },
      });
      setEvents(response.data as Event[]);
    } catch (err) {
      console.error('Failed to fetch events:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchEvents();
  }, [fetchEvents]);

  const handleRsvp = useCallback(async (eventId: string, status: string) => {
    try {
      const response = await api().post(`/api/v1/events/${eventId}/rsvp`, {
        status,
      });
      setEvents((prev) =>
        prev.map((e) => (e.id === eventId ? (response.data as Event) : e)),
      );
    } catch (err) {
      console.error('Failed to RSVP:', err);
    }
  }, []);

  const handleEventCreated = useCallback(
    (event: Event) => {
      if (editingEvent) {
        setEvents((prev) => prev.map((e) => (e.id === event.id ? event : e)));
        setShowForm(false);
        setEditingEvent(null);
      } else {
        setEvents((prev) => [event, ...prev]);
        setShowForm(false);
        setCreatedEventId(event.id);
      }
    },
    [editingEvent],
  );

  const handleInviteDone = useCallback(() => {
    setCreatedEventId(null);
  }, []);

  const handleCancelForm = useCallback(() => {
    setShowForm(false);
    setEditingEvent(null);
  }, []);

  const handleNewEvent = useCallback(() => {
    setEditingEvent(null);
    setShowForm(true);
  }, []);

  const handleRsvpVoid = useCallback(
    (id: string, status: string) => {
      void handleRsvp(id, status);
    },
    [handleRsvp],
  );

  const handleStrandSelect = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      setActiveStrand(e.currentTarget.dataset.strand as StrandTab);
    },
    [],
  );

  const eventsForDate = useMemo(() => {
    return events.filter((ev) => {
      const d = new Date(ev.start_time);
      return (
        d.getFullYear() === focusedDate.getFullYear() &&
        d.getMonth() === focusedDate.getMonth() &&
        d.getDate() === focusedDate.getDate()
      );
    });
  }, [events, focusedDate]);

  const focusedDateLabel = focusedDate.toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const isToday = focusedDate.toDateString() === new Date().toDateString();

  return (
    <Column>
      <ColumnHeader
        title={planetName('Kalendar')}
        icon='neptune'
        iconComponent={planetIcon('Kalendar')}
        multiColumn={multiColumn}
      />

      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
      </Helmet>

      <div
        className='events-page events-page--wheel'
        style={
          { '--space-color': spaceColor('Kalendar') } as React.CSSProperties
        }
      >
        <div className='events-page__wheel-header'>
          <h1 className='events-page__wheel-title'>
            {intl.formatMessage(messages.title)}
          </h1>
          <button className='events-page__create-btn' onClick={handleNewEvent}>
            <FormattedMessage id='events.create' defaultMessage='+ Host' />
          </button>
        </div>

        {showForm && (
          <CreateEventForm
            onEventCreated={handleEventCreated}
            onCancel={handleCancelForm}
            editEvent={editingEvent}
          />
        )}

        {createdEventId && (
          <InviteFollowersPanel
            eventId={createdEventId}
            onDone={handleInviteDone}
          />
        )}

        <TemporalArc events={events} onFocusDate={setFocusedDate} />

        <div className='events-page__day-header'>
          <span className='events-page__day-label'>
            {isToday ? (
              <FormattedMessage id='events.today' defaultMessage='Today' />
            ) : (
              focusedDateLabel
            )}
          </span>
        </div>

        <div className='events-page__day-events'>
          {loading && events.length === 0 ? (
            <div className='events-page__empty'>
              <FormattedMessage
                id='events.loading'
                defaultMessage='Loading ₭alendar...'
              />
            </div>
          ) : eventsForDate.length === 0 ? (
            <div className='events-page__no-events'>
              <FormattedMessage
                id='events.no_events_day'
                defaultMessage='No gatherings on this day'
              />
            </div>
          ) : (
            eventsForDate.map((event) => (
              <EventCard key={event.id} event={event} onRsvp={handleRsvpVoid} />
            ))
          )}
        </div>

        <div className='events-page__in-flow'>
          <div className='events-page__strand-tabs'>
            {STRAND_TABS.map((tab) => (
              <button
                key={tab}
                data-strand={tab}
                className={`events-page__strand-tab${activeStrand === tab ? ' events-page__strand-tab--active' : ''}`}
                onClick={handleStrandSelect}
              >
                {STRAND_LABELS[tab]}
              </button>
            ))}
          </div>

          <div className='events-page__strand-content'>
            {activeStrand === 'light' && (
              <div className='events-page__strand-panel' key='light'>
                <LightStrand />
              </div>
            )}
            {activeStrand === 'dark' && (
              <div className='events-page__strand-panel' key='dark'>
                <DarkStrand />
              </div>
            )}
            {activeStrand === 'soil' && (
              <div className='events-page__strand-panel' key='soil'>
                <EarthStrand />
              </div>
            )}
            {activeStrand === 'season' && (
              <div className='events-page__strand-panel' key='season'>
                <FestivalStrand />
              </div>
            )}
          </div>
        </div>
      </div>
    </Column>
  );
};

export default Events;
