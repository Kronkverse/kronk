import { useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import ExploreIcon from '@/material-icons/400-24px/explore.svg?react';

import { StatusKornerCard } from './status_korner_card';

const messages = defineMessages({
  badge: { id: 'status_trek_card.badge', defaultMessage: 'MAP' },
  view: { id: 'status_trek_card.view', defaultMessage: 'View on Map' },
  distance: { id: 'status_trek_card.distance', defaultMessage: 'Distance' },
  time: { id: 'status_trek_card.time', defaultMessage: 'Time' },
  pace: { id: 'status_trek_card.pace', defaultMessage: 'Pace' },
  speed: { id: 'status_trek_card.speed', defaultMessage: 'Speed' },
  elevation: { id: 'status_trek_card.elevation', defaultMessage: 'Climb' },
  run: { id: 'status_trek_card.activity.run', defaultMessage: 'Run' },
  walk: { id: 'status_trek_card.activity.walk', defaultMessage: 'Walk' },
  hike: { id: 'status_trek_card.activity.hike', defaultMessage: 'Hike' },
  swim: { id: 'status_trek_card.activity.swim', defaultMessage: 'Swim' },
  ride: { id: 'status_trek_card.activity.ride', defaultMessage: 'Ride' },
  paddle: { id: 'status_trek_card.activity.paddle', defaultMessage: 'Paddle' },
});

type Activity = 'run' | 'walk' | 'hike' | 'swim' | 'ride' | 'paddle';

const ACTIVITY_GLYPH: Record<Activity, string> = {
  run: '🏃',
  walk: '🚶',
  hike: '🥾',
  swim: '🏊',
  ride: '🚴',
  paddle: '🛶',
};

// Pace activities report minutes-per-km; speed activities report km/h.
const PACE_ACTIVITIES = new Set<Activity>(['run', 'walk', 'hike', 'swim']);

interface Trek {
  id: string;
  activity_type: Activity;
  title: string;
  distance_m: number;
  moving_sec: number;
  pace_seconds: number | null;
  speed_kmh: number | null;
  elevation_gain: number | null;
  has_route: boolean;
  route: [number, number][] | null;
}

const trekPath = (id: string) => `/hub/map/treks/${id}`;

const km = (m: number) => (m / 1000).toFixed(1);

const duration = (sec: number) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
};

const paceLabel = (secPerKm: number) => {
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')} /km`;
};

// A single polyline glimpse of the (already privacy-trimmed) route. We project
// [lng, lat] into an aspect-corrected box — 1° of longitude is cos(lat) shorter
// than 1° of latitude — then fit-and-centre it into the viewBox. Deliberately
// lightweight: no MapLibre per feed card, just the shape of the outing.
const VB_W = 320;
const VB_H = 120;
const PAD = 10;

const routePoints = (route: [number, number][]): string | null => {
  if (route.length < 2) return null;

  const midLat = ((route[0][1] + route[route.length - 1][1]) / 2) * (Math.PI / 180);
  const kx = Math.cos(midLat) || 1;

  const xs = route.map(([lng]) => lng * kx);
  const ys = route.map(([, lat]) => lat);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX || 1e-6;
  const spanY = maxY - minY || 1e-6;

  const scale = Math.min((VB_W - 2 * PAD) / spanX, (VB_H - 2 * PAD) / spanY);
  const offX = PAD + (VB_W - 2 * PAD - spanX * scale) / 2;
  const offY = PAD + (VB_H - 2 * PAD - spanY * scale) / 2;

  return route
    .map(([lng, lat]) => {
      const x = offX + (lng * kx - minX) * scale;
      const y = offY + (maxY - lat) * scale; // flip: north is up
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
};

export const StatusTrekCard: React.FC<{ trek: Trek }> = ({ trek }) => {
  const intl = useIntl();

  const handleLinkClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const isPace = PACE_ACTIVITIES.has(trek.activity_type);
  const points = trek.has_route && trek.route ? routePoints(trek.route) : null;
  const activityName = intl.formatMessage(messages[trek.activity_type]);

  return (
    <StatusKornerCard
      korner='Map'
      variant='trek'
      className='status-trek-card'
      badge={{
        icon: ExploreIcon,
        iconId: 'explore',
        label: intl.formatMessage(messages.badge),
        tag: `${ACTIVITY_GLYPH[trek.activity_type]} ${activityName}`,
      }}
    >
      {points ? (
        <div className='status-trek-card__glimpse'>
          <svg
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            preserveAspectRatio='xMidYMid meet'
            role='img'
            aria-label={activityName}
          >
            <polyline
              points={points}
              fill='none'
              strokeLinejoin='round'
              strokeLinecap='round'
            />
          </svg>
        </div>
      ) : null}

      <div className='status-korner-card__body'>
        {trek.title && (
          <div className='status-korner-card__title'>{trek.title}</div>
        )}
        <dl className='status-trek-card__stats'>
          <div>
            <dt>{intl.formatMessage(messages.distance)}</dt>
            <dd>{km(trek.distance_m)} km</dd>
          </div>
          {trek.moving_sec > 0 && (
            <div>
              <dt>{intl.formatMessage(messages.time)}</dt>
              <dd>{duration(trek.moving_sec)}</dd>
            </div>
          )}
          {isPace && trek.pace_seconds ? (
            <div>
              <dt>{intl.formatMessage(messages.pace)}</dt>
              <dd>{paceLabel(trek.pace_seconds)}</dd>
            </div>
          ) : null}
          {!isPace && trek.speed_kmh ? (
            <div>
              <dt>{intl.formatMessage(messages.speed)}</dt>
              <dd>{trek.speed_kmh.toFixed(1)} km/h</dd>
            </div>
          ) : null}
          {trek.elevation_gain ? (
            <div>
              <dt>{intl.formatMessage(messages.elevation)}</dt>
              <dd>{trek.elevation_gain} m</dd>
            </div>
          ) : null}
        </dl>
      </div>

      <div className='status-korner-card__footer'>
        <div className='status-korner-card__meta' />
        <Link
          to={trekPath(trek.id)}
          className='status-korner-card__action'
          onClick={handleLinkClick}
        >
          {intl.formatMessage(messages.view)}
        </Link>
      </div>
    </StatusKornerCard>
  );
};
