import { useCallback, useState } from 'react';

import {
  defineMessages,
  useIntl,
  FormattedDate,
  FormattedTime,
} from 'react-intl';

import { useHistory } from 'react-router-dom';

import CalendarMonthIcon from '@/material-icons/400-24px/calendar_month.svg?react';
import CheckIcon from '@/material-icons/400-24px/check.svg?react';
import VideocamIcon from '@/material-icons/400-24px/diversity_2.svg?react';
import StarIcon from '@/material-icons/400-24px/star.svg?react';
import api from 'mastodon/api';
import { Icon } from 'mastodon/components/icon';

import { StatusKornerCard } from './status_korner_card';

const messages = defineMessages({
  event: { id: 'status_event_card.event', defaultMessage: 'EVENT' },
  huddle: { id: 'status_event_card.huddle', defaultMessage: 'HUDDLE' },
  live: { id: 'status_event_card.live', defaultMessage: 'LIVE' },
  going: { id: 'status_event_card.going', defaultMessage: 'Going' },
  interested: {
    id: 'status_event_card.interested',
    defaultMessage: 'Interested',
  },
  goingCount: {
    id: 'status_event_card.going_count',
    defaultMessage: '{count} going',
  },
  interestedCount: {
    id: 'status_event_card.interested_count',
    defaultMessage: '{count} interested',
  },
  joinHuddle: {
    id: 'status_event_card.join_huddle',
    defaultMessage: 'Join Huddle',
  },
});

interface EventData {
  id: string;
  slug?: string;
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
  const intl = useIntl();
  const history = useHistory();
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

  const stopPropagation = useCallback((e: React.MouseEvent) => {
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

  const handleCardClick = useCallback(() => {
    history.push(`/kalendar/${event.slug ?? event.id}`);
  }, [history, event.id, event.slug]);

  const handleCardKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        history.push(`/kalendar/${event.slug ?? event.id}`);
      }
    },
    [history, event.id, event.slug],
  );

  const badgeLabel = isLive
    ? intl.formatMessage(messages.live)
    : event.event_type === 'huddle'
      ? intl.formatMessage(messages.huddle)
      : intl.formatMessage(messages.event);

  const badgeIcon =
    isLive || event.event_type === 'huddle' ? VideocamIcon : CalendarMonthIcon;
  const badgeIconId =
    isLive || event.event_type === 'huddle' ? 'videocam' : 'calendar_month';

  return (
    <StatusKornerCard
      korner='Kalendar'
      variant={isLive ? 'live' : event.event_type}
      className='status-event-card'
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      role='button'
      tabIndex={0}
      badge={{
        icon: badgeIcon,
        iconId: badgeIconId,
        label: badgeLabel,
      }}
    >
      {event.image_url && (
        <div
          className='status-event-card__image'
          style={{ backgroundImage: `url(${event.image_url})` }}
        />
      )}

      <div className='status-korner-card__body status-event-card__body'>
        <div className='status-event-card__date-badge'>
          <span className='status-event-card__date-badge__month'>
            <FormattedDate value={event.start_time} month='short' />
          </span>
          <span className='status-event-card__date-badge__day'>
            <FormattedDate value={event.start_time} day='numeric' />
          </span>
        </div>

        <div className='status-event-card__content'>
          <div className='status-korner-card__title status-event-card__title'>
            {event.title}
          </div>
          <div className='status-korner-card__meta status-event-card__meta'>
            <FormattedDate value={event.start_time} weekday='short' />{' '}
            <FormattedTime value={event.start_time} />
            {event.end_time && (
              <>
                {' – '}
                <FormattedTime value={event.end_time} />
              </>
            )}
            {event.location_name && (
              <>
                {' · '}
                {event.location_url ? (
                  <a
                    href={event.location_url}
                    target='_blank'
                    rel='noopener noreferrer'
                    onClick={stopPropagation}
                  >
                    {event.location_name}
                  </a>
                ) : (
                  event.location_name
                )}
              </>
            )}
          </div>
          {event.description && (
            <div className='status-korner-card__summary status-event-card__description'>
              {event.description.length > 140
                ? event.description.slice(0, 140) + '…'
                : event.description}
            </div>
          )}
        </div>
      </div>

      <div className='status-korner-card__footer status-event-card__footer'>
        <div className='status-korner-card__meta status-event-card__counts'>
          {event.going_count > 0 && (
            <span>
              {intl.formatMessage(messages.goingCount, {
                count: event.going_count,
              })}
            </span>
          )}
          {event.interested_count > 0 && (
            <span>
              {intl.formatMessage(messages.interestedCount, {
                count: event.interested_count,
              })}
            </span>
          )}
        </div>

        {isLive && event.huddle_url ? (
          <a
            href={event.huddle_url}
            target='_blank'
            rel='noopener noreferrer'
            className='status-korner-card__action status-event-card__join-huddle'
            onClick={stopPropagation}
          >
            <Icon id='videocam' icon={VideocamIcon} />{' '}
            {intl.formatMessage(messages.joinHuddle)}
          </a>
        ) : (
          event.rsvp_enabled && (
            <div className='status-event-card__rsvp-buttons' role='group'>
              <button
                type='button'
                className={`status-event-card__rsvp-btn ${event.rsvp === 'going' ? 'active active--going' : ''}`}
                onClick={handleRsvpGoing}
              >
                <Icon id='check' icon={CheckIcon} />{' '}
                {intl.formatMessage(messages.going)}
              </button>
              <button
                type='button'
                className={`status-event-card__rsvp-btn ${event.rsvp === 'interested' ? 'active active--interested' : ''}`}
                onClick={handleRsvpInterested}
              >
                <Icon id='star' icon={StarIcon} />{' '}
                {intl.formatMessage(messages.interested)}
              </button>
            </div>
          )
        )}
      </div>
    </StatusKornerCard>
  );
};
