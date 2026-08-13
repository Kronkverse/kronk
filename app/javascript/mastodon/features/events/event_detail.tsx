import { useEffect, useState, useCallback, useRef } from 'react';

import { FormattedDate, FormattedTime, FormattedMessage } from 'react-intl';

import { Helmet } from 'react-helmet';
import { useParams, Link, useHistory } from 'react-router-dom';

import CalendarMonthIcon from '@/material-icons/400-24px/calendar_month.svg?react';
import CheckIcon from '@/material-icons/400-24px/check.svg?react';
import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import VideocamIcon from '@/material-icons/400-24px/diversity_2.svg?react';
import EditIcon from '@/material-icons/400-24px/edit.svg?react';
import PersonAddIcon from '@/material-icons/400-24px/person_add.svg?react';
import RepeatIcon from '@/material-icons/400-24px/repeat.svg?react';
import StarIcon from '@/material-icons/400-24px/star.svg?react';
import api from 'mastodon/api';
import { Icon } from 'mastodon/components/icon';
import { KornerActionBar } from 'mastodon/components/korner_action_bar';
import { KornerPill } from 'mastodon/components/korner_pill';
import { Stage } from 'mastodon/components/stage';
import { useConfirmDialog } from 'mastodon/hooks/useConfirmDialog';

import { CreateEventForm } from './components/create_event_form';

interface Attendee {
  id: string;
  username: string;
  display_name: string;
  avatar: string;
  url: string;
}

interface SearchAccount {
  id: string;
  username: string;
  display_name: string;
  avatar: string;
  acct: string;
}

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
  spawn_album: boolean;
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
  visibility?: string | null;
}

interface EventAccount {
  id: string;
  username: string;
  acct: string;
  display_name: string;
  url: string;
}

type RsvpStatus = 'going' | 'interested' | 'not_going';

const RSVP_CONFIG: Record<
  RsvpStatus,
  { label: string; icon: typeof CheckIcon; className: string }
> = {
  going: { label: 'Going', icon: CheckIcon, className: 'active--going' },
  interested: {
    label: 'Interested',
    icon: StarIcon,
    className: 'active--interested',
  },
  not_going: {
    label: "Can't go",
    icon: CloseIcon,
    className: 'active--not-going',
  },
};

const EventDetail: React.FC<{ multiColumn?: boolean }> = () => {
  const { id } = useParams<{ id: string }>();
  const history = useHistory();
  const [event, setEvent] = useState<Event | null>(null);
  const [goingAttendees, setGoingAttendees] = useState<Attendee[]>([]);
  const [interestedAttendees, setInterestedAttendees] = useState<Attendee[]>(
    [],
  );
  const [notGoingAttendees, setNotGoingAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteQuery, setInviteQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchAccount[]>([]);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Build a map of account_id -> rsvp status
  const rsvpMap = new Map<string, RsvpStatus>();
  goingAttendees.forEach((a) => rsvpMap.set(a.id, 'going'));
  interestedAttendees.forEach((a) => rsvpMap.set(a.id, 'interested'));
  notGoingAttendees.forEach((a) => rsvpMap.set(a.id, 'not_going'));

  const fetchAll = useCallback(async () => {
    try {
      const [eventRes, goingRes, interestedRes, notGoingRes] =
        await Promise.all([
          api().get(`/api/v1/events/${id}`),
          api().get(`/api/v1/events/${id}/attendees`, {
            params: { status: 'going' },
          }),
          api().get(`/api/v1/events/${id}/attendees`, {
            params: { status: 'interested' },
          }),
          api().get(`/api/v1/events/${id}/attendees`, {
            params: { status: 'not_going' },
          }),
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

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const handleRsvp = useCallback(
    async (status: string) => {
      if (!event) return;
      try {
        const response = await api().post(`/api/v1/events/${event.id}/rsvp`, {
          status,
        });
        setEvent(response.data as Event);
        const [goingRes, interestedRes, notGoingRes] = await Promise.all([
          api().get(`/api/v1/events/${event.id}/attendees`, {
            params: { status: 'going' },
          }),
          api().get(`/api/v1/events/${event.id}/attendees`, {
            params: { status: 'interested' },
          }),
          api().get(`/api/v1/events/${event.id}/attendees`, {
            params: { status: 'not_going' },
          }),
        ]);
        setGoingAttendees(goingRes.data as Attendee[]);
        setInterestedAttendees(interestedRes.data as Attendee[]);
        setNotGoingAttendees(notGoingRes.data as Attendee[]);
      } catch (err) {
        console.error('Failed to RSVP:', err);
      }
    },
    [event],
  );

  const [confirmDialog, confirm] = useConfirmDialog();

  const handleDelete = useCallback(async () => {
    if (!event) return;
    const ok = await confirm({
      title: 'Delete this event?',
      message: "It will disappear from everyone's Kalendar and from the feed.",
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await api().delete(`/api/v1/events/${event.id}`);
      history.push('/kalendar');
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  }, [event, confirm, history]);

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

    searchTimeout.current = setTimeout(() => {
      void (async () => {
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
      })();
    }, 300);
  }, []);

  const handleInvite = useCallback(
    async (accountId: string) => {
      if (!event) return;
      try {
        await api().post(`/api/v1/events/${event.id}/invite`, {
          account_ids: [accountId],
        });
        setInvitedIds((prev) => new Set(prev).add(accountId));
      } catch (err) {
        console.error('Failed to invite:', err);
      }
    },
    [event],
  );

  const handleCancelEdit = useCallback(() => {
    setEditing(false);
  }, []);
  const handleStartEdit = useCallback(() => {
    setEditing(true);
  }, []);
  const handleToggleInvite = useCallback(() => {
    setShowInvite((prev) => !prev);
  }, []);
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleInviteSearch(e.target.value);
    },
    [handleInviteSearch],
  );
  const handleInviteClickDetail = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      void handleInvite(e.currentTarget.dataset.accountId ?? '');
    },
    [handleInvite],
  );
  const handleRsvpGoing = useCallback(() => {
    void handleRsvp(event?.rsvp === 'going' ? 'remove' : 'going');
  }, [handleRsvp, event?.rsvp]);
  const handleRsvpInterested = useCallback(() => {
    void handleRsvp(event?.rsvp === 'interested' ? 'remove' : 'interested');
  }, [handleRsvp, event?.rsvp]);
  const handleRsvpNotGoing = useCallback(() => {
    void handleRsvp(event?.rsvp === 'not_going' ? 'remove' : 'not_going');
  }, [handleRsvp, event?.rsvp]);
  const handleDeleteVoid = useCallback(() => {
    void handleDelete();
  }, [handleDelete]);

  if (loading || !event) {
    return (
      <Stage label='Event'>
        <div className='events-page__empty'>Loading...</div>
      </Stage>
    );
  }

  if (editing) {
    return (
      <Stage label='Edit Event'>
        <div className='events-page'>
          <CreateEventForm
            onEventCreated={handleEventUpdated}
            onCancel={handleCancelEdit}
            editEvent={event}
          />
        </div>
      </Stage>
    );
  }

  const isLive =
    event.event_type === 'huddle' &&
    new Date(event.start_time) <= new Date() &&
    (!event.end_time || new Date(event.end_time) > new Date());

  const isPublic =
    event.visibility === 'public' || event.visibility === 'unlisted';

  const renderInviteAction = (account: SearchAccount) => {
    const rsvpStatus = rsvpMap.get(account.id);

    if (rsvpStatus) {
      const config = RSVP_CONFIG[rsvpStatus];
      return (
        <span
          className={`event-detail__invite-status-badge ${config.className}`}
        >
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
        data-account-id={account.id}
        onClick={handleInviteClickDetail}
      >
        <Icon id='person_add' icon={PersonAddIcon} /> Invite
      </button>
    );
  };

  return (
    <Stage label={event.title}>
      <Helmet>
        <title>{event.title}</title>
      </Helmet>

      {confirmDialog}

      <div className='event-detail'>
        {event.image_url && (
          <div
            className='event-detail__cover'
            style={{ backgroundImage: `url(${event.image_url})` }}
          />
        )}

        {/* No local ← Back to ₭alendar — the Frame's SpaceBadge in
            the SpaceNav slot already returns to /hub/kalendar. */}

        <div className='event-detail__header'>
          {isLive && <div className='event-detail__live-banner'>LIVE NOW</div>}
          <h1 className='event-detail__title'>
            {event.event_type === 'huddle' && (
              <Icon id='videocam' icon={VideocamIcon} />
            )}
            {event.event_type === 'event' && (
              <Icon id='calendar_month' icon={CalendarMonthIcon} />
            )}{' '}
            {event.title}
          </h1>
          <div className='event-detail__host'>
            Hosted by{' '}
            <Link to={`/@${event.account.username}`}>
              @{event.account.username}
            </Link>
          </div>
        </div>

        <div className='event-detail__info'>
          <div className='event-detail__info-row'>
            <Icon id='calendar_month' icon={CalendarMonthIcon} />
            <FormattedDate
              value={event.start_time}
              weekday='long'
              year='numeric'
              month='long'
              day='numeric'
            />
          </div>
          <div className='event-detail__info-row'>
            <Icon id='calendar_month' icon={CalendarMonthIcon} />
            <FormattedTime value={event.start_time} />
            {event.end_time && (
              <>
                {' – '}
                <FormattedTime value={event.end_time} />
              </>
            )}
          </div>
          {event.location_name && (
            <div className='event-detail__info-row'>
              {event.location_url ? (
                <a
                  href={event.location_url}
                  target='_blank'
                  rel='noopener noreferrer'
                >
                  {event.location_name}
                </a>
              ) : (
                event.location_name
              )}
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
              onClick={handleRsvpGoing}
            >
              <Icon id='check' icon={CheckIcon} /> Going
            </button>
            <button
              className={`event-detail__rsvp-btn ${event.rsvp === 'interested' ? 'active active--interested' : ''}`}
              onClick={handleRsvpInterested}
            >
              <Icon id='star' icon={StarIcon} /> Interested
            </button>
            <button
              className={`event-detail__rsvp-btn ${event.rsvp === 'not_going' ? 'active active--not-going' : ''}`}
              onClick={handleRsvpNotGoing}
            >
              <Icon id='close' icon={CloseIcon} /> {"Can't go"}
            </button>
          </div>
        )}

        {isLive && event.huddle_url && (
          <a
            href={event.huddle_url}
            target='_blank'
            rel='noopener noreferrer'
            className='event-detail__join-huddle'
          >
            <Icon id='videocam' icon={VideocamIcon} /> Join Huddle
          </a>
        )}

        <KornerActionBar className='event-detail__actions'>
          {isPublic && (
            <KornerPill
              label={
                <FormattedMessage id='events.invite' defaultMessage='Invite' />
              }
              icon={PersonAddIcon}
              iconId='person_add'
              active={showInvite}
              onClick={handleToggleInvite}
            />
          )}
          {event.is_owner && (
            <>
              <KornerPill
                label={
                  <FormattedMessage id='events.edit' defaultMessage='Edit' />
                }
                icon={EditIcon}
                iconId='edit'
                onClick={handleStartEdit}
              />
              <KornerPill
                label={
                  <FormattedMessage
                    id='events.delete'
                    defaultMessage='Delete'
                  />
                }
                variant='destructive'
                onClick={handleDeleteVoid}
              />
            </>
          )}
        </KornerActionBar>

        {showInvite && (
          <div className='event-detail__invite'>
            <div className='event-detail__invite-search'>
              <input
                type='text'
                value={inviteQuery}
                onChange={handleSearchChange}
                placeholder='Search for people to invite...'
              />
            </div>

            {searching && (
              <div className='event-detail__invite-empty'>Searching...</div>
            )}

            {searchResults.length > 0 && (
              <div className='event-detail__invite-results'>
                {searchResults.map((account) => (
                  <div key={account.id} className='event-detail__invite-result'>
                    <img
                      src={account.avatar}
                      alt=''
                      className='event-detail__invite-avatar'
                    />
                    <div className='event-detail__invite-info'>
                      <span className='event-detail__invite-name'>
                        {account.display_name || account.username}
                      </span>
                      <span className='event-detail__invite-acct'>
                        @{account.acct}
                      </span>
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
                {goingAttendees.map((a) => (
                  <Link
                    key={a.id}
                    to={`/@${a.username}`}
                    className='event-detail__attendee'
                  >
                    <img
                      src={a.avatar}
                      alt=''
                      className='event-detail__attendee-avatar'
                    />
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
                {interestedAttendees.map((a) => (
                  <Link
                    key={a.id}
                    to={`/@${a.username}`}
                    className='event-detail__attendee'
                  >
                    <img
                      src={a.avatar}
                      alt=''
                      className='event-detail__attendee-avatar'
                    />
                    <span>{a.display_name || a.username}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Stage>
  );
};

export { EventDetail };
