import { useCallback, useEffect, useState } from 'react';
import { useIntl, defineMessages, FormattedMessage } from 'react-intl';
import { Helmet } from 'react-helmet';
import Column from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { Icon } from 'mastodon/components/icon';
import AddIcon from '@/material-icons/400-24px/add.svg?react';
import ListIcon from '@/material-icons/400-24px/list.svg?react';
import CalendarMonthIcon from '@/material-icons/400-24px/calendar_month.svg?react';
import api from 'mastodon/api';
import { EventCard } from './components/event_card';
import { EventCalendar } from './components/event_calendar';
import { CreateEventForm } from './components/create_event_form';
import { InviteFollowersPanel } from './components/invite_followers_panel';

const messages = defineMessages({
  title: { id: 'events.title', defaultMessage: 'Events' },
});

const filterMessages = {
  upcoming: <FormattedMessage id='events.filter.upcoming' defaultMessage='Upcoming' />,
  past: <FormattedMessage id='events.filter.past' defaultMessage='Past' />,
  mine: <FormattedMessage id='events.filter.mine' defaultMessage='My Events' />,
  invited: <FormattedMessage id='events.filter.invited' defaultMessage='Invited' />,
};

type Event = {
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
  account: any;
  status_id: string | null;
  image_url: string | null;
  is_owner: boolean;
};

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
      const response = await api().get('/api/v1/events', { params: { filter } });
      setEvents(response.data as Event[]);
    } catch (err) {
      console.error('Failed to fetch events:', err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleRsvp = useCallback(async (eventId: string, status: string) => {
    try {
      const response = await api().post(`/api/v1/events/${eventId}/rsvp`, { status });
      setEvents(prev => prev.map(e => e.id === eventId ? response.data as Event : e));
    } catch (err) {
      console.error('Failed to RSVP:', err);
    }
  }, []);

  const handleEventCreated = useCallback((event: Event) => {
    if (editingEvent) {
      setEvents(prev => prev.map(e => e.id === event.id ? event : e));
      setShowForm(false);
      setEditingEvent(null);
    } else {
      setEvents(prev => [event, ...prev]);
      setShowForm(false);
      setCreatedEventId(event.id);
    }
  }, [editingEvent]);

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

  return (
    <Column>
      <ColumnHeader
        title={intl.formatMessage(messages.title)}
        icon='calendar_month'
        iconComponent={CalendarMonthIcon}
        multiColumn={multiColumn}
      />

      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
      </Helmet>

      <div className='events-page'>
        <div className='events-page__header'>
          <div className='events-page__filters'>
            {(['upcoming', 'past', 'mine', 'invited'] as FilterType[]).map(f => (
              <button
                key={f}
                className={`events-page__filter ${filter === f ? 'active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {filterMessages[f]}
              </button>
            ))}
          </div>

          <div className='events-page__actions'>
            <button
              className={`events-page__view-toggle ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title='List view'
            >
              <Icon id='list' icon={ListIcon} />
            </button>
            <button
              className={`events-page__view-toggle ${viewMode === 'calendar' ? 'active' : ''}`}
              onClick={() => setViewMode('calendar')}
              title='Calendar view'
            >
              <Icon id='calendar_month' icon={CalendarMonthIcon} />
            </button>
            <button className='events-page__create-btn' onClick={handleNewEvent}>
              <Icon id='add' icon={AddIcon} />
              <FormattedMessage id='events.create' defaultMessage='New Event' />
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
          <EventCalendar events={events} selectedMonth={selectedMonth} onMonthChange={setSelectedMonth} onRsvp={handleRsvp} />
        ) : (
          <div className='events-page__list'>
            {loading && events.length === 0 && (
              <div className='events-page__empty'>
                <FormattedMessage id='events.loading' defaultMessage='Loading events...' />
              </div>
            )}
            {!loading && events.length === 0 && (
              <div className='events-page__empty'>
                <FormattedMessage id='events.empty' defaultMessage='No events to show' />
              </div>
            )}
            {events.map(event => (
              <EventCard key={event.id} event={event} onRsvp={handleRsvp} />
            ))}
          </div>
        )}
      </div>
    </Column>
  );
};

export default Events;
