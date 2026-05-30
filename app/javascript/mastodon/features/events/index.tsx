import { useCallback, useEffect, useState } from 'react';

import { useIntl, defineMessages, FormattedMessage } from 'react-intl';

import { Helmet } from 'react-helmet';

import api from 'mastodon/api';
import { Column } from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { planetIcon, planetName, spaceColor } from 'mastodon/planets';

import { CreateEventForm } from './components/create_event_form';
import { EventCalendar } from './components/event_calendar';
import { EventCard } from './components/event_card';
import { InviteFollowersPanel } from './components/invite_followers_panel';

const messages = defineMessages({
  title: { id: 'events.title', defaultMessage: '₭alendar' },
  heroIntro: {
    id: 'events.hero_intro',
    defaultMessage:
      'Find and share gatherings in the Kronk community. From live rooms to in-person meetups.',
  },
});

const filterMessages = {
  upcoming: (
    <FormattedMessage id='events.filter.upcoming' defaultMessage='Upcoming' />
  ),
  past: <FormattedMessage id='events.filter.past' defaultMessage='Past' />,
  mine: (
    <FormattedMessage
      id='events.filter.mine'
      defaultMessage='My ₭alendar Events'
    />
  ),
  invited: (
    <FormattedMessage id='events.filter.invited' defaultMessage='Invited' />
  ),
};

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

type FilterType = 'upcoming' | 'past' | 'mine' | 'invited';

const Events: React.FC<{ multiColumn?: boolean }> = ({ multiColumn }) => {
  const intl = useIntl();
  const [events, setEvents] = useState<Event[]>([]);
  const [filter, setFilter] = useState<FilterType>('upcoming');
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [createdEventId, setCreatedEventId] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api().get('/api/v1/events', {
        params: { filter },
      });
      setEvents(response.data as Event[]);
    } catch (err) {
      console.error('Failed to fetch events:', err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

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

  const handleSetFilter = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      setFilter(e.currentTarget.dataset.filter as FilterType);
    },
    [],
  );

  const handleListView = useCallback(() => {
    setViewMode('list');
  }, []);

  const handleCalendarView = useCallback(() => {
    setViewMode('calendar');
  }, []);

  const handleMonthChange = useCallback((m: Date) => {
    setSelectedMonth(m);
  }, []);

  const handleRsvpVoid = useCallback(
    (id: string, status: string) => {
      void handleRsvp(id, status);
    },
    [handleRsvp],
  );

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
        className='events-page'
        style={
          { '--space-color': spaceColor('Kalendar') } as React.CSSProperties
        }
      >
        <section className='events-page__hero'>
          <h1 className='events-page__hero-title'>
            {intl.formatMessage(messages.title)}
          </h1>
          <p className='events-page__hero-intro'>
            {intl.formatMessage(messages.heroIntro)}
          </p>
        </section>

        <div className='events-page__header'>
          <div className='events-page__filters'>
            {(['upcoming', 'past', 'mine', 'invited'] as FilterType[]).map(
              (f) => (
                <button
                  key={f}
                  data-filter={f}
                  className={`events-page__filter ${filter === f ? 'active' : ''}`}
                  onClick={handleSetFilter}
                >
                  {filterMessages[f]}
                </button>
              ),
            )}
          </div>

          <div className='events-page__actions'>
            <div className='events-page__view-toggle-group'>
              <button
                className={`events-page__view-toggle ${viewMode === 'list' ? 'active' : ''}`}
                onClick={handleListView}
              >
                List
              </button>
              <button
                className={`events-page__view-toggle ${viewMode === 'calendar' ? 'active' : ''}`}
                onClick={handleCalendarView}
              >
                Month
              </button>
            </div>
            <button
              className='events-page__create-btn'
              onClick={handleNewEvent}
            >
              <FormattedMessage id='events.create' defaultMessage='+ Host' />
            </button>
          </div>
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

        {viewMode === 'calendar' ? (
          <EventCalendar
            events={events}
            selectedMonth={selectedMonth}
            onMonthChange={handleMonthChange}
          />
        ) : (
          <>
            <div className='events-page__list'>
              {loading && events.length === 0 && (
                <div className='events-page__empty'>
                  <FormattedMessage
                    id='events.loading'
                    defaultMessage='Loading ₭alendar...'
                  />
                </div>
              )}
              {!loading && events.length === 0 && (
                <div className='events-page__empty'>
                  <FormattedMessage
                    id='events.empty'
                    defaultMessage='No events in ₭alendar'
                  />
                </div>
              )}
              {events.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onRsvp={handleRsvpVoid}
                />
              ))}
            </div>
            <div className='events-page__calendar-section'>
              <EventCalendar
                events={events}
                selectedMonth={selectedMonth}
                onMonthChange={handleMonthChange}
              />
            </div>
          </>
        )}
      </div>
    </Column>
  );
};

// eslint-disable-next-line import/no-default-export
export default Events;
