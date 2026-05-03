import { useCallback, useState } from 'react';

import { FormattedDate, FormattedTime } from 'react-intl';

import { Link } from 'react-router-dom';

import CalendarMonthIcon from '@/material-icons/400-24px/calendar_month.svg?react';
import CheckIcon from '@/material-icons/400-24px/check.svg?react';
import VideocamIcon from '@/material-icons/400-24px/diversity_2.svg?react';
import StarIcon from '@/material-icons/400-24px/star.svg?react';
import api from 'mastodon/api';
import { Icon } from 'mastodon/components/icon';

interface EventData {
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
  going_count: number;
  interested_count: number;
  image_url: string | null;
  rsvp?: string | null;
  is_owner?: boolean;
}

interface Props {
  event: EventData;
}

export const StatusEventCard: React.FC<Props> = ({ event: initialEvent }) => {
  const [event, setEvent] = useState(initialEvent);

  const isLive =
    event.event_type === 'huddle' &&
    new Date(event.start_time) <= new Date() &&
    (!event.end_time || new Date(event.end_time) > new Date());

  const handleRsvp = useCallback(
    async (status: string) => {
      try {
        const response = await api().post(`/api/v1/events/${event.id}/rsvp`, {
          status,
        });
        setEvent(response.data as EventData);
      } catch (err) {
        console.error('Failed to RSVP:', err);
      }
    },
    [event.id],
  );

  const handleLocationClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handleRsvpGoing = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      void handleRsvp(event.rsvp === 'going' ? 'remove' : 'going');
    },
    [handleRsvp, event.rsvp],
  );

  const handleRsvpInterested = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      void handleRsvp(event.rsvp === 'interested' ? 'remove' : 'interested');
    },
    [handleRsvp, event.rsvp],
  );

  const handleHuddleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <Link
      to={`/kalendar/${event.id}`}
      className={`status-event-card ${isLive ? 'status-event-card--live' : ''}`}
    >
      {event.image_url && (
        <div
          className='status-event-card__image'
          style={{ backgroundImage: `url(${event.image_url})` }}
        />
      )}

      <div className='status-event-card__body'>
        <div className='status-event-card__date-badge'>
          <span className='status-event-card__date-badge__month'>
            <FormattedDate value={event.start_time} month='short' />
          </span>
          <span className='status-event-card__date-badge__day'>
            <FormattedDate value={event.start_time} day='numeric' />
          </span>
        </div>

        <div className='status-event-card__content'>
          <div className='status-event-card__header'>
            {isLive && (
              <span className='status-event-card__live-badge'>LIVE</span>
            )}
            {event.event_type === 'huddle' && !isLive && (
              <Icon
                id='videocam'
                icon={VideocamIcon}
                className='status-event-card__type-icon'
              />
            )}
            {event.event_type === 'event' && (
              <Icon
                id='calendar_month'
                icon={CalendarMonthIcon}
                className='status-event-card__type-icon'
              />
            )}
            <span className='status-event-card__title'>{event.title}</span>
          </div>

          <div className='status-event-card__meta'>
            <span className='status-event-card__time'>
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
              <span className='status-event-card__location'>
                {' · '}
                {event.location_url ? (
                  <a
                    href={event.location_url}
                    target='_blank'
                    rel='noopener noreferrer'
                    onClick={handleLocationClick}
                  >
                    {event.location_name}
                  </a>
                ) : (
                  event.location_name
                )}
              </span>
            )}
          </div>

          {event.description && (
            <p className='status-event-card__description'>
              {event.description.length > 140
                ? event.description.slice(0, 140) + '…'
                : event.description}
            </p>
          )}

          <div className='status-event-card__footer'>
            <div className='status-event-card__counts'>
              {event.going_count > 0 && <span>{event.going_count} going</span>}
              {event.interested_count > 0 && (
                <span>{event.interested_count} interested</span>
              )}
            </div>

            {event.rsvp_enabled && (
              <div className='status-event-card__rsvp-buttons' role='group'>
                <button
                  className={`status-event-card__rsvp-btn ${event.rsvp === 'going' ? 'active active--going' : ''}`}
                  onClick={handleRsvpGoing}
                >
                  <Icon id='check' icon={CheckIcon} /> Going
                </button>
                <button
                  className={`status-event-card__rsvp-btn ${event.rsvp === 'interested' ? 'active active--interested' : ''}`}
                  onClick={handleRsvpInterested}
                >
                  <Icon id='star' icon={StarIcon} /> Interested
                </button>
              </div>
            )}

            {isLive && event.huddle_url && (
              <a
                href={event.huddle_url}
                target='_blank'
                rel='noopener noreferrer'
                className='status-event-card__join-huddle'
                onClick={handleHuddleClick}
              >
                <Icon id='videocam' icon={VideocamIcon} /> Join Huddle
              </a>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
};
