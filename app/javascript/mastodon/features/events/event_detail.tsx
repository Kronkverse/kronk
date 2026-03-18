import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link, useHistory } from 'react-router-dom';
import { FormattedDate, FormattedTime, FormattedMessage, defineMessages, useIntl } from 'react-intl';
import { Helmet } from 'react-helmet';
import Column from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { Icon } from 'mastodon/components/icon';
import CalendarMonthIcon from '@/material-icons/400-24px/calendar_month.svg?react';
import VideocamIcon from '@/material-icons/400-24px/diversity_2.svg?react';
import CheckIcon from '@/material-icons/400-24px/check.svg?react';
import StarIcon from '@/material-icons/400-24px/star.svg?react';
import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import EditIcon from '@/material-icons/400-24px/edit.svg?react';
import RepeatIcon from '@/material-icons/400-24px/repeat.svg?react';
import ArrowBackIcon from '@/material-icons/400-24px/arrow_back.svg?react';
import PersonAddIcon from '@/material-icons/400-24px/person_add.svg?react';
import ShareIcon from '@/material-icons/400-24px/share.svg?react';
import ContentCopyIcon from '@/material-icons/400-24px/content_copy.svg?react';
import api from 'mastodon/api';
import { apiReblog } from '@/mastodon/api/interactions';
import { CreateEventForm } from './components/create_event_form';

type Attendee = {
  id: string;
  username: string;
  display_name: string;
  avatar: string;
  url: string;
};

type SearchAccount = {
  id: string;
  username: string;
  display_name: string;
  avatar: string;
  acct: string;
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
  visibility?: string | null;
};

type RsvpStatus = 'going' | 'interested' | 'not_going';

const RSVP_CONFIG: Record<RsvpStatus, { label: string; icon: typeof CheckIcon; className: string }> = {
  going: { label: 'Going', icon: CheckIcon, className: 'active--going' },
  interested: { label: 'Interested', icon: StarIcon, className: 'active--interested' },
  not_going: { label: "Can't go", icon: CloseIcon, className: 'active--not-going' },
};

const EventDetail: React.FC<{ multiColumn?: boolean }> = ({ multiColumn }) => {
  const { id } = useParams<{ id: string }>();
  const intl = useIntl();
  const history = useHistory();
  const [event, setEvent] = useState<Event | null>(null);
  const [goingAttendees, setGoingAttendees] = useState<Attendee[]>([]);
  const [interestedAttendees, setInterestedAttendees] = useState<Attendee[]>([]);
  const [notGoingAttendees, setNotGoingAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteQuery, setInviteQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchAccount[]>([]);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [linkCopied, setLinkCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const shareUrl = `${window.location.origin}/events/${id}`;

  const handleShare = useCallback(() => {
    void navigator.share({ url: shareUrl, title: event?.title ?? '' }).catch((e: unknown) => {
      if (e instanceof Error && e.name !== 'AbortError') console.error(e);
    });
  }, [shareUrl, event?.title]);

  const handleCopyLink = useCallback(() => {
    void navigator.clipboard.writeText(shareUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }, [shareUrl]);

  const handleShareToTimeline = useCallback(async () => {
    if (!event?.status_id) return;
    try {
      await apiReblog(event.status_id, 'public');
      setShared(true);
    } catch (e) {
      console.error('Failed to share event:', e);
    }
  }, [event?.status_id]);

  // Build a map of account_id -> rsvp status
  const rsvpMap = new Map<string, RsvpStatus>();
  goingAttendees.forEach(a => rsvpMap.set(a.id, 'going'));
  interestedAttendees.forEach(a => rsvpMap.set(a.id, 'interested'));
  notGoingAttendees.forEach(a => rsvpMap.set(a.id, 'not_going'));

  const fetchAll = useCallback(async () => {
    try {
      const [eventRes, goingRes, interestedRes, notGoingRes] = await Promise.all([
        api().get(`/api/v1/events/${id}`),
        api().get(`/api/v1/events/${id}/attendees`, { params: { status: 'going' } }),
        api().get(`/api/v1/events/${id}/attendees`, { params: { status: 'interested' } }),
        api().get(`/api/v1/events/${id}/attendees`, { params: { status: 'not_going' } }),
      ]);
      setEvent(eventRes.data as Event);
      setGoingAttendees(goingRes.data as Attendee[]);
      setInterestedAttendees(interestedRes.data as Attendee[]);
      setNotGoingAttendees(notGoingRes.data as Attendee[]);
    } catch (err) {
      console.error('Failed to fetch event:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleRsvp = useCallback(async (status: string) => {
    if (!event) return;
    try {
      const response = await api().post(`/api/v1/events/${event.id}/rsvp`, { status });
      setEvent(response.data as Event);
      const [goingRes, interestedRes, notGoingRes] = await Promise.all([
        api().get(`/api/v1/events/${event.id}/attendees`, { params: { status: 'going' } }),
        api().get(`/api/v1/events/${event.id}/attendees`, { params: { status: 'interested' } }),
        api().get(`/api/v1/events/${event.id}/attendees`, { params: { status: 'not_going' } }),
      ]);
      setGoingAttendees(goingRes.data as Attendee[]);
      setInterestedAttendees(interestedRes.data as Attendee[]);
      setNotGoingAttendees(notGoingRes.data as Attendee[]);
    } catch (err) {
      console.error('Failed to RSVP:', err);
    }
  }, [event]);

  const handleDelete = useCallback(async () => {
    if (!event || !confirm('Delete this event?')) return;
    try {
      await api().delete(`/api/v1/events/${event.id}`);
      history.push('/events');
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  }, [event, history]);

  const handleEventUpdated = useCallback((updated: Event) => {
    setEvent(updated);
    setEditing(false);
  }, []);

  const handleInviteSearch = useCallback((query: string) => {
    setInviteQuery(query);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await api().get('/api/v1/accounts/search', {
          params: { q: query, limit: 6, resolve: false },
        });
        setSearchResults(response.data as SearchAccount[]);
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setSearching(false);
      }
    }, 300);
  }, []);

  const handleInvite = useCallback(async (accountId: string) => {
    if (!event) return;
    try {
      await api().post(`/api/v1/events/${event.id}/invite`, { account_ids: [accountId] });
      setInvitedIds(prev => new Set(prev).add(accountId));
    } catch (err) {
      console.error('Failed to invite:', err);
    }
  }, [event]);

  if (loading || !event) {
    return (
      <Column>
        <ColumnHeader title='Event' icon='calendar_month' iconComponent={CalendarMonthIcon} multiColumn={multiColumn} />
        <div className='events-page__empty'>Loading...</div>
      </Column>
    );
  }

  if (editing) {
    return (
      <Column>
        <ColumnHeader title='Edit Event' icon='edit' iconComponent={EditIcon} multiColumn={multiColumn} />
        <div className='events-page'>
          <CreateEventForm
            onEventCreated={handleEventUpdated}
            onCancel={() => setEditing(false)}
            editEvent={event}
          />
        </div>
      </Column>
    );
  }

  const isLive = event.event_type === 'huddle' &&
    new Date(event.start_time) <= new Date() &&
    (!event.end_time || new Date(event.end_time) > new Date());

  const isPublic = event.visibility === 'public' || event.visibility === 'unlisted';

  const renderInviteAction = (account: SearchAccount) => {
    const rsvpStatus = rsvpMap.get(account.id);

    if (rsvpStatus) {
      const config = RSVP_CONFIG[rsvpStatus];
      return (
        <span className={`event-detail__invite-status-badge ${config.className}`}>
          <Icon id='check' icon={config.icon} /> {config.label}
        </span>
      );
    }

    if (invitedIds.has(account.id)) {
      return (
        <span className='event-detail__invite-btn event-detail__invite-btn--sent'>
          <Icon id='check' icon={CheckIcon} /> Invited
        </span>
      );
    }

    return (
      <button
        className='event-detail__invite-btn'
        onClick={() => handleInvite(account.id)}
      >
        <Icon id='person_add' icon={PersonAddIcon} /> Invite
      </button>
    );
  };

  return (
    <Column>
      <ColumnHeader title={event.title} icon='calendar_month' iconComponent={CalendarMonthIcon} multiColumn={multiColumn} />

      <Helmet><title>{event.title}</title></Helmet>

      <div className='event-detail'>
        {event.image_url && (
          <div className='event-detail__cover' style={{ backgroundImage: `url(${event.image_url})` }} />
        )}

        <Link to='/events' className='event-detail__back'>
          <Icon id='arrow_back' icon={ArrowBackIcon} />
          <FormattedMessage id='events.back' defaultMessage='Back to Events' />
        </Link>

        <div className='event-detail__header'>
          {isLive && <div className='event-detail__live-banner'>LIVE NOW</div>}
          <h1 className='event-detail__title'>
            {event.event_type === 'huddle' && <Icon id='videocam' icon={VideocamIcon} />}
            {event.event_type === 'event' && <Icon id='calendar_month' icon={CalendarMonthIcon} />}
            {' '}{event.title}
          </h1>
          <div className='event-detail__host'>
            Hosted by <Link to={`/@${event.account.username}`}>@{event.account.username}</Link>
          </div>
        </div>

        <div className='event-detail__info'>
          <div className='event-detail__info-row'>
            <Icon id='calendar_month' icon={CalendarMonthIcon} />
            <FormattedDate value={event.start_time} weekday='long' year='numeric' month='long' day='numeric' />
          </div>
          <div className='event-detail__info-row'>
            <Icon id='calendar_month' icon={CalendarMonthIcon} />
            <FormattedTime value={event.start_time} />
            {event.end_time && (<>{' – '}<FormattedTime value={event.end_time} /></>)}
          </div>
          {event.location_name && (
            <div className='event-detail__info-row'>
              {event.location_url ? (
                <a href={event.location_url} target='_blank' rel='noopener noreferrer'>{event.location_name}</a>
              ) : event.location_name}
            </div>
          )}
          {event.recurrence_rule && (
            <div className='event-detail__info-row'>
              <Icon id='repeat' icon={RepeatIcon} /> Recurring event
            </div>
          )}
        </div>

        {event.description && (
          <div className='event-detail__description'>{event.description}</div>
        )}

        {event.rsvp_enabled && (
          <div className='event-detail__rsvp'>
            <button
              className={`event-detail__rsvp-btn ${event.rsvp === 'going' ? 'active active--going' : ''}`}
              onClick={() => handleRsvp(event.rsvp === 'going' ? 'remove' : 'going')}
            >
              <Icon id='check' icon={CheckIcon} /> Going
            </button>
            <button
              className={`event-detail__rsvp-btn ${event.rsvp === 'interested' ? 'active active--interested' : ''}`}
              onClick={() => handleRsvp(event.rsvp === 'interested' ? 'remove' : 'interested')}
            >
              <Icon id='star' icon={StarIcon} /> Interested
            </button>
            <button
              className={`event-detail__rsvp-btn ${event.rsvp === 'not_going' ? 'active active--not-going' : ''}`}
              onClick={() => handleRsvp(event.rsvp === 'not_going' ? 'remove' : 'not_going')}
            >
              <Icon id='close' icon={CloseIcon} /> Can't go
            </button>
          </div>
        )}

        {isLive && event.huddle_url && (
          <a href={event.huddle_url} target='_blank' rel='noopener noreferrer' className='event-detail__join-huddle'>
            <Icon id='videocam' icon={VideocamIcon} /> Join Huddle
          </a>
        )}

        <div className='event-detail__actions'>
          {event.status_id && event.visibility !== 'direct' && (
            <button
              className={`event-detail__action-btn ${shared ? 'event-detail__action-btn--active' : ''}`}
              onClick={handleShareToTimeline}
              disabled={shared}
            >
              <Icon id='repeat' icon={RepeatIcon} /> {shared ? 'Shared!' : 'Share'}
            </button>
          )}
          {isPublic && (
            <button
              className={`event-detail__action-btn ${showInvite ? 'event-detail__action-btn--active' : ''}`}
              onClick={() => setShowInvite(!showInvite)}
            >
              <Icon id='person_add' icon={PersonAddIcon} />
              <FormattedMessage id='events.invite' defaultMessage='Invite' />
            </button>
          )}
          {event.is_owner && (
            <>
              <button className='event-detail__action-btn' onClick={() => setEditing(true)}>
                <Icon id='edit' icon={EditIcon} />
                <FormattedMessage id='events.edit' defaultMessage='Edit' />
              </button>
              <button className='event-detail__action-btn event-detail__action-btn--danger' onClick={handleDelete}>
                <FormattedMessage id='events.delete' defaultMessage='Delete' />
              </button>
            </>
          )}
        </div>

        {showInvite && (
          <div className='event-detail__invite'>
            <div className='event-detail__invite-search'>
              <input
                type='text'
                value={inviteQuery}
                onChange={e => handleInviteSearch(e.target.value)}
                placeholder='Search for people to invite...'
                autoFocus
              />
            </div>

            {searching && (
              <div className='event-detail__invite-empty'>Searching...</div>
            )}

            {searchResults.length > 0 && (
              <div className='event-detail__invite-results'>
                {searchResults.map(account => (
                  <div key={account.id} className='event-detail__invite-result'>
                    <img src={account.avatar} alt='' className='event-detail__invite-avatar' />
                    <div className='event-detail__invite-info'>
                      <span className='event-detail__invite-name'>{account.display_name || account.username}</span>
                      <span className='event-detail__invite-acct'>@{account.acct}</span>
                    </div>
                    {renderInviteAction(account)}
                  </div>
                ))}
              </div>
            )}

            {!searching && inviteQuery.trim() && searchResults.length === 0 && (
              <div className='event-detail__invite-empty'>No results found</div>
            )}
          </div>
        )}

        <div className='event-detail__attendees'>
          {goingAttendees.length > 0 && (
            <div className='event-detail__attendee-section'>
              <h3>Going ({goingAttendees.length})</h3>
              <div className='event-detail__attendee-list'>
                {goingAttendees.map(a => (
                  <Link key={a.id} to={`/@${a.username}`} className='event-detail__attendee'>
                    <img src={a.avatar} alt='' className='event-detail__attendee-avatar' />
                    <span>{a.display_name || a.username}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
          {interestedAttendees.length > 0 && (
            <div className='event-detail__attendee-section'>
              <h3>Interested ({interestedAttendees.length})</h3>
              <div className='event-detail__attendee-list'>
                {interestedAttendees.map(a => (
                  <Link key={a.id} to={`/@${a.username}`} className='event-detail__attendee'>
                    <img src={a.avatar} alt='' className='event-detail__attendee-avatar' />
                    <span>{a.display_name || a.username}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Column>
  );
};

export default EventDetail;
