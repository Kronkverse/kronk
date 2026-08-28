import { lazy, Suspense, useCallback } from 'react';

import { defineMessages, useIntl, FormattedDate } from 'react-intl';

import { useHistory } from 'react-router-dom';

import VideocamIcon from '@/material-icons/400-24px/diversity_2.svg?react';
import SpiralIcon from '@/material-icons/400-24px/spiral.svg?react';
import { Icon } from 'mastodon/components/icon';
import { parseOsmUrl } from 'mastodon/features/events/parse_osm_url';

import { StatusKornerCard } from './status_korner_card';

// MapPinPreview drags in MapLibre — lazy-load so feed cards without a
// pinned location don't pay for it.
const MapPinPreviewLazy = lazy(() =>
  import('mastodon/components/map_pin_preview').then((m) => ({
    default: m.MapPinPreview,
  })),
);

const messages = defineMessages({
  event: { id: 'status_event_card.event', defaultMessage: 'EVENT' },
  huddle: { id: 'status_event_card.huddle', defaultMessage: 'HUDDLE' },
  live: { id: 'status_event_card.live', defaultMessage: 'LIVE' },
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

interface GoingPreview {
  id: string;
  acct: string;
  avatar: string;
}

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
  going_preview?: GoingPreview[] | null;
  image_url: string | null;
  rsvp?: string | null;
  is_owner?: boolean;
}

interface Props {
  event: EventData;
}

export const StatusEventCard: React.FC<Props> = ({ event }) => {
  const intl = useIntl();
  const history = useHistory();

  const isLive =
    event.event_type === 'huddle' &&
    new Date(event.start_time) <= new Date() &&
    (!event.end_time || new Date(event.end_time) > new Date());

  const pin = parseOsmUrl(event.location_url);
  // Feed cards read at a glance — nudge the zoom out one step from
  // what the composer pinned so more street context comes through.
  // The default (14) also gets a wider view (13).
  const previewZoom = pin ? Math.max((pin.zoom ?? 14) - 1, 1) : undefined;
  const goingPreview = event.going_preview ?? [];

  const stopPropagation = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

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
    isLive || event.event_type === 'huddle' ? VideocamIcon : SpiralIcon;
  const badgeIconId =
    isLive || event.event_type === 'huddle' ? 'videocam' : 'spiral';

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
          {event.description && (
            <div className='status-korner-card__summary status-event-card__description'>
              {event.description.length > 140
                ? event.description.slice(0, 140) + '…'
                : event.description}
            </div>
          )}
          {goingPreview.length > 0 && (
            <div className='status-event-card__going-preview'>
              <div className='status-event-card__going-preview__avatars'>
                {goingPreview.slice(0, 5).map((a) => (
                  <img
                    key={a.id}
                    className='status-event-card__going-preview__avatar'
                    src={a.avatar}
                    alt={a.acct}
                  />
                ))}
              </div>
              {event.going_count > 0 && (
                <span className='status-event-card__going-preview__label'>
                  {intl.formatMessage(messages.goingCount, {
                    count: event.going_count,
                  })}
                </span>
              )}
            </div>
          )}
        </div>

        {pin && (
          <div className='status-event-card__map-preview' aria-hidden='true'>
            <Suspense
              fallback={
                <div className='status-event-card__map-preview-fallback' />
              }
            >
              <MapPinPreviewLazy
                key={`${pin.lat},${pin.lng},${previewZoom ?? ''}`}
                lat={pin.lat}
                lng={pin.lng}
                zoom={previewZoom}
              />
            </Suspense>
          </div>
        )}
      </div>

      <div className='status-korner-card__footer status-event-card__footer'>
        <div className='status-korner-card__meta status-event-card__counts'>
          {event.interested_count > 0 && (
            <span>
              {intl.formatMessage(messages.interestedCount, {
                count: event.interested_count,
              })}
            </span>
          )}
        </div>

        {isLive && event.huddle_url && (
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
        )}
      </div>
    </StatusKornerCard>
  );
};
