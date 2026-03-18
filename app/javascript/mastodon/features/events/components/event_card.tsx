import { useState, useCallback, useRef } from 'react';
import { FormattedDate, FormattedTime, FormattedMessage } from 'react-intl';
import { Link } from 'react-router-dom';
import { Icon } from 'mastodon/components/icon';
import VideocamIcon from '@/material-icons/400-24px/diversity_2.svg?react';
import CheckIcon from '@/material-icons/400-24px/check.svg?react';
import StarIcon from '@/material-icons/400-24px/star.svg?react';
import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import ArrowRightIcon from '@/material-icons/400-24px/arrow_right_alt.svg?react';
import PersonAddIcon from '@/material-icons/400-24px/person_add.svg?react';
import api from 'mastodon/api';
import { CopyIconButton } from '@/mastodon/components/copy_icon_button';
import RepeatIcon from '@/material-icons/400-24px/repeat.svg?react';
import { apiReblog, apiUnreblog } from '@/mastodon/api/interactions';
import ShareIcon from '@/material-icons/400-24px/share.svg?react';

type Event = {
  id: string;
  title: string;
  description: string;
  start_time: string;
  end_time: string | null;
  location_name: string | null;
  event_type: string;
  huddle_url: string | null;
  going_count: number;
  interested_count: number;
  rsvp: string | null;
  account: any;
  image_url: string | null;
  rsvp_enabled: boolean;
  visibility?: string | null;
  status_id?: string | null;
};

type SearchAccount = {
  id: string;
  username: string;
  display_name: string;
  avatar: string;
  acct: string;
};

type RsvpStatus = 'going' | 'interested' | 'not_going';

type Attendee = { id: string };

type Props = {
  event: Event;
  onRsvp: (eventId: string, status: string) => void;
};

const RSVP_LABELS: Record<RsvpStatus, string> = {
  going: 'Going',
  interested: 'Interested',
  not_going: "Can't go",
};

const RSVP_ICONS: Record<RsvpStatus, typeof CheckIcon> = {
  going: CheckIcon,
  interested: StarIcon,
  not_going: CloseIcon,
};

const RSVP_CLASSES: Record<RsvpStatus, string> = {
  going: 'active--going',
  interested: 'active--interested',
  not_going: 'active--not-going',
};

const isLive = (event: Event): boolean => {
  if (event.event_type !== 'huddle') return false;
  const now = new Date();
  const start = new Date(event.start_time);
  const end = event.end_time ? new Date(event.end_time) : null;
  return start <= now && (!end || end > now);
};

export const EventCard: React.FC<Props> = ({ event, onRsvp }) => {
  const live = isLive(event);
  const isPublic = event.visibility === 'public' || event.visibility === 'unlisted';

  const [showInvite, setShowInvite] = useState(false);
  const [inviteQuery, setInviteQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchAccount[]>([]);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const [rsvpMap, setRsvpMap] = useState<Map<string, RsvpStatus>>(new Map());
  const [searching, setSearching] = useState(false);
  const [attendeesLoaded, setAttendeesLoaded] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shareUrl = `${window.location.origin}/events/${event.id}`;
  const [shared, setShared] = useState(false);

  const handleShareToTimeline = useCallback(async () => {
    if (!event.status_id) return;
    try {
      if (shared) {
        await apiUnreblog(event.status_id);
        setShared(false);
      } else {
        await apiReblog(event.status_id, 'public');
        setShared(true);
      }
    } catch (e) {
      console.error('Failed to toggle event share:', e);
    }
  }, [event.status_id, shared]);

  const handleShare = useCallback(() => {
    void navigator.share({ url: shareUrl }).catch((e: unknown) => {
      if (e instanceof Error && e.name !== 'AbortError') console.error(e);
    });
  }, [shareUrl]);

  const loadAttendees = useCallback(async () => {
    if (attendeesLoaded) return;
    try {
      const [goingRes, interestedRes, notGoingRes] = await Promise.all([
        api().get(`/api/v1/events/${event.id}/attendees`, { params: { status: 'going' } }),
        api().get(`/api/v1/events/${event.id}/attendees`, { params: { status: 'interested' } }),
        api().get(`/api/v1/events/${event.id}/attendees`, { params: { status: 'not_going' } }),
      ]);
      const map = new Map<string, RsvpStatus>();
      (goingRes.data as Attendee[]).forEach(a => map.set(a.id, 'going'));
      (interestedRes.data as Attendee[]).forEach(a => map.set(a.id, 'interested'));
      (notGoingRes.data as Attendee[]).forEach(a => map.set(a.id, 'not_going'));
      setRsvpMap(map);
      setAttendeesLoaded(true);
    } catch (err) {
      console.error('Failed to load attendees:', err);
    }
  }, [event.id, attendeesLoaded]);

  const handleToggleInvite = useCallback(() => {
    const next = !showInvite;
    setShowInvite(next);
    if (next) {
      loadAttendees();
    } else {
      setInviteQuery('');
      setSearchResults([]);
    }
  }, [showInvite, loadAttendees]);

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
          params: { q: query, limit: 5, resolve: false },
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
    try {
      await api().post(`/api/v1/events/${event.id}/invite`, { account_ids: [accountId] });
      setInvitedIds(prev => new Set(prev).add(accountId));
    } catch (err) {
      console.error('Failed to invite:', err);
    }
  }, [event.id]);

  const renderInviteAction = (account: SearchAccount) => {
    const status = rsvpMap.get(account.id);

    if (status) {
      return (
        <span className={`event-detail__invite-status-badge ${RSVP_CLASSES[status]}`}>
          <Icon id='check' icon={RSVP_ICONS[status]} /> {RSVP_LABELS[status]}
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
    <div className={`event-card ${live ? 'event-card--live' : ''}`}>
      {event.image_url && (
        <div className='event-card__image' style={{ backgroundImage: `url(${event.image_url})` }} />
      )}

      <div className='event-card__body'>
        <div className='event-card__date-badge'>
          <span className='event-card__date-badge__month'>
            <FormattedDate value={event.start_time} month='short' />
          </span>
          <span className='event-card__date-badge__day'>
            <FormattedDate value={event.start_time} day='numeric' />
          </span>
        </div>

        <div className='event-card__content'>
          <div className='event-card__header'>
            {live && <span className='event-card__live-badge'>LIVE</span>}
            {event.event_type === 'huddle' && !live && (
              <Icon id='videocam' icon={VideocamIcon} className='event-card__type-icon' />
            )}
            <Link to={`/events/${event.id}`} className='event-card__title'>
              {event.title}
            </Link>
          </div>

          <div className='event-card__meta'>
            <span className='event-card__time'>
              <FormattedDate value={event.start_time} weekday='short' />{' '}
              <FormattedTime value={event.start_time} />
              {event.end_time && (
                <>
                  {' – '}
                  <FormattedTime value={event.end_time} />
                </>
              )}
            </span>
            {event.location_name && (
              <span className='event-card__location'>
                {' · '}{event.location_name}
              </span>
            )}
          </div>

          <div className='event-card__counts'>
            {event.going_count > 0 && (
              <span>{event.going_count} going</span>
            )}
            {event.interested_count > 0 && (
              <span>{event.interested_count} interested</span>
            )}
            {event.account && (
              <span className='event-card__host'>
                Hosted by @{event.account.username}
              </span>
            )}
          </div>

          <div className='event-card__actions'>
            {event.rsvp_enabled && (
              <div className='event-card__rsvp-buttons'>
                <button
                  className={`event-card__rsvp-btn ${event.rsvp === 'going' ? 'active' : ''}`}
                  onClick={() => onRsvp(event.id, event.rsvp === 'going' ? 'remove' : 'going')}
                >
                  <Icon id='check' icon={CheckIcon} /> Going
                </button>
                <button
                  className={`event-card__rsvp-btn ${event.rsvp === 'interested' ? 'active' : ''}`}
                  onClick={() => onRsvp(event.id, event.rsvp === 'interested' ? 'remove' : 'interested')}
                >
                  <Icon id='star' icon={StarIcon} /> Interested
                </button>
              </div>
            )}

            {isPublic && (
              <button
                className={`event-card__invite-btn ${showInvite ? 'event-card__invite-btn--active' : ''}`}
                onClick={handleToggleInvite}
                title='Invite people'
              >
                <Icon id='person_add' icon={PersonAddIcon} /> Invite
              </button>
            )}

            {live && event.huddle_url && (
              <a
                href={event.huddle_url}
                target='_blank'
                rel='noopener noreferrer'
                className='event-card__join-huddle'
              >
                <Icon id='videocam' icon={VideocamIcon} /> Join Huddle
              </a>
            )}

            {event.status_id && event.visibility !== 'direct' && (
              <button
                className={`event-card__action-btn ${shared ? 'event-card__action-btn--active' : ''}`}
                onClick={handleShareToTimeline}
              >
                <Icon id='repeat' icon={RepeatIcon} /> {shared ? 'Unshare' : 'Share'}
              </button>
            )}

            <Link to={`/events/${event.id}`} className='event-card__view-link'>
              <FormattedMessage id='events.view' defaultMessage='View' />
              <Icon id='arrow_right' icon={ArrowRightIcon} />
            </Link>
          </div>
        </div>
      </div>

      {showInvite && (
        <div className='event-card__invite-panel'>
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
    </div>
  );
};
