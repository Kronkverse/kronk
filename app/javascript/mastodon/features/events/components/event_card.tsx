import { lazy, Suspense } from 'react';

import { FormattedDate, FormattedTime } from 'react-intl';

import { Link } from 'react-router-dom';

import VideocamIcon from '@/material-icons/400-24px/diversity_2.svg?react';
import { Icon } from 'mastodon/components/icon';
import { KornerMeta } from 'mastodon/components/korner_meta';

import { parseOsmUrl } from '../parse_osm_url';

// MapPinPreview pulls in MapLibre, so load it only when a card actually
// has a parseable pin — keeps the kalendar list bundle lean.
const MapPinPreviewLazy = lazy(() =>
  import('mastodon/components/map_pin_preview').then((m) => ({
    default: m.MapPinPreview,
  })),
);

interface Event {
  id: string;
  slug?: string;
  title: string;
  start_time: string;
  end_time: string | null;
  location_name: string | null;
  location_url?: string | null;
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
}

const isLive = (event: Event): boolean => {
  if (event.event_type !== 'huddle') return false;
  const now = new Date();
  const start = new Date(event.start_time);
  const end = event.end_time ? new Date(event.end_time) : null;
  return start <= now && (!end || end > now);
};

export const EventCard: React.FC<Props> = ({ event }) => {
  const live = isLive(event);
  const pin = parseOsmUrl(event.location_url ?? null);

  return (
    <div className={`event-card ${live ? 'event-card--live' : ''}`}>
      <Link
        to={`/kalendar/${event.slug ?? event.id}`}
        className='event-card__date'
      >
        <span className='event-card__date-day'>
          <FormattedDate value={event.start_time} day='numeric' />
        </span>
        <span className='event-card__date-month'>
          <FormattedDate value={event.start_time} month='short' />
        </span>
      </Link>

      <div className='event-card__content'>
        <Link
          to={`/kalendar/${event.slug ?? event.id}`}
          className='event-card__title'
        >
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
        <KornerMeta
          className='event-card__meta'
          items={[
            <>
              <FormattedDate value={event.start_time} weekday='short' />{' '}
              <FormattedTime value={event.start_time} />
              {event.end_time && (
                <>
                  {' – '}
                  <FormattedTime value={event.end_time} />
                </>
              )}
            </>,
            event.location_name,
            event.going_count > 0 && (
              <>
                <strong>{event.going_count}</strong> going
              </>
            ),
            event.interested_count > 0 && (
              <>
                <strong>{event.interested_count}</strong> maybe
              </>
            ),
            event.account && (
              <>
                by{' '}
                <span className='event-card__host'>
                  @{event.account.username}
                </span>
              </>
            ),
          ]}
        />
      </div>

      {pin && (
        <Link
          to={`/kalendar/${event.slug ?? event.id}`}
          className='event-card__map-preview'
          aria-label={event.location_name ?? 'Map preview'}
        >
          <Suspense
            fallback={<div className='event-card__map-preview-fallback' />}
          >
            <MapPinPreviewLazy
              key={`${pin.lat},${pin.lng}`}
              lat={pin.lat}
              lng={pin.lng}
              zoom={pin.zoom}
            />
          </Suspense>
        </Link>
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
