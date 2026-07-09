import { useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import HeadphonesIcon from '@/material-icons/400-24px/headphones.svg?react';

import { StatusKornerCard } from './status_korner_card';

const messages = defineMessages({
  badge: {
    id: 'status_booth_card.badge',
    defaultMessage: 'SET',
  },
  view: {
    id: 'status_booth_card.view',
    defaultMessage: 'Play in the Booth',
  },
});

interface BoothSet {
  id: string;
  title: string;
  artist_name?: string | null;
  genres?: string[] | null;
  duration_seconds?: number | null;
  cover_url?: string | null;
  event_name?: string | null;
}

const formatDuration = (seconds: number): string => {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
};

export const StatusBoothCard: React.FC<{ set: BoothSet }> = ({ set }) => {
  const intl = useIntl();

  const handleLinkClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const durationLabel = set.duration_seconds
    ? formatDuration(set.duration_seconds)
    : null;

  const genresLabel = set.genres && set.genres.length > 0
    ? set.genres.slice(0, 3).join(' · ')
    : null;

  return (
    <StatusKornerCard
      korner='Booth'
      variant='set'
      className='status-booth-card'
      badge={{
        icon: HeadphonesIcon,
        iconId: 'headphones',
        label: intl.formatMessage(messages.badge),
        tag: set.event_name,
      }}
    >
      <div className='status-korner-card__body'>
        <div className='status-korner-card__title'>{set.title}</div>
        {set.artist_name && (
          <div className='status-korner-card__summary status-booth-card__artist'>
            {set.artist_name}
          </div>
        )}
      </div>

      <div className='status-korner-card__footer status-booth-card__footer'>
        <div className='status-korner-card__meta'>
          {genresLabel && (
            <span className='status-booth-card__genres'>{genresLabel}</span>
          )}
          {durationLabel && (
            <span className='status-booth-card__duration'>{durationLabel}</span>
          )}
        </div>
        <Link
          to={`/booth/sets/${set.id}`}
          className='status-korner-card__action'
          onClick={handleLinkClick}
        >
          {intl.formatMessage(messages.view)}
        </Link>
      </div>
    </StatusKornerCard>
  );
};
