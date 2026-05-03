import { useCallback } from 'react';

import { FormattedDate, FormattedTime } from 'react-intl';

import { Link } from 'react-router-dom';

import VideocamIcon from '@/material-icons/400-24px/diversity_2.svg?react';
import { Icon } from 'mastodon/components/icon';

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
  account: EventAccount | null;
  rsvp_enabled: boolean;
  visibility?: string | null;
}

interface EventAccount {
  id: string;
  username: string;
  acct: string;
  display_name: string;
  url: string;
}

interface Props {
  event: Event;
  onRsvp: (eventId: string, status: string) => void;
}

const isLive = (event: Event): boolean => {
  if (event.event_type !== 'huddle') return false;
  const now = new Date();
  const start = new Date(event.start_time);
  const end = event.end_time ? new Date(event.end_time) : null;
  return start <= now && (!end || end > now);
};

export const EventCard: React.FC<Props> = ({ event, onRsvp }) => {
  const live = isLive(event);

  const handleRsvpGoing = useCallback(() => {
    onRsvp(event.id, event.rsvp === 'going' ? 'remove' : 'going');
  }, [onRsvp, event.id, event.rsvp]);

  const handleRsvpMaybe = useCallback(() => {
    onRsvp(event.id, event.rsvp === 'interested' ? 'remove' : 'interested');
  }, [onRsvp, event.id, event.rsvp]);

  const handleRsvpSkip = useCallback(() => {
    onRsvp(event.id, event.rsvp === 'not_going' ? 'remove' : 'not_going');
  }, [onRsvp, event.id, event.rsvp]);

  return (
    <div className={`event-card ${live ? 'event-card--live' : ''}`}>
      <Link to={`/kalendar/${event.id}`} className='event-card__date'>
        <span className='event-card__date-day'>
          <FormattedDate value={event.start_time} day='numeric' />
        </span>
        <span className='event-card__date-month'>
          <FormattedDate value={event.start_time} month='short' />
        </span>
      </Link>

      <div className='event-card__content'>
        <Link to={`/kalendar/${event.id}`} className='event-card__title'>
          {live && <span className='event-card__live-badge'>LIVE</span>}
          {event.event_type === 'huddle' && !live && (
            <Icon
              id='videocam'
              icon={VideocamIcon}
              className='event-card__type-icon'
            />
          )}
          {event.title}
        </Link>
        <div className='event-card__meta'>
          <FormattedDate value={event.start_time} weekday='short' />{' '}
          <FormattedTime value={event.start_time} />
          {event.end_time && (
            <>
              {' – '}
              <FormattedTime value={event.end_time} />
            </>
          )}
          {event.location_name && <> &middot; {event.location_name}</>}
          {event.going_count > 0 && (
            <>
              {' '}
              &middot; <strong>{event.going_count}</strong> going
            </>
          )}
          {event.interested_count > 0 && (
            <>
              {' '}
              &middot; <strong>{event.interested_count}</strong> maybe
            </>
          )}
          {event.account && (
            <>
              {' '}
              &middot; by{' '}
              <span className='event-card__host'>
                @{event.account.username}
              </span>
            </>
          )}
        </div>
      </div>

      {event.rsvp_enabled && (
        <div className='event-card__rsvp'>
          <button
            className={`event-card__rsvp-seg ${event.rsvp === 'going' ? 'active' : ''}`}
            onClick={handleRsvpGoing}
          >
            Going
          </button>
          <button
            className={`event-card__rsvp-seg ${event.rsvp === 'interested' ? 'active' : ''}`}
            onClick={handleRsvpMaybe}
          >
            Maybe
          </button>
          <button
            className={`event-card__rsvp-seg ${event.rsvp === 'not_going' ? 'active' : ''}`}
            onClick={handleRsvpSkip}
          >
            Skip
          </button>
        </div>
      )}

      {live && event.huddle_url && (
        <a
          href={event.huddle_url}
          target='_blank'
          rel='noopener noreferrer'
          className='event-card__join-huddle'
        >
          <Icon id='videocam' icon={VideocamIcon} /> Join
        </a>
      )}
    </div>
  );
};
