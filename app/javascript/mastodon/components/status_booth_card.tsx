import { defineMessages, useIntl } from 'react-intl';

import HeadphonesIcon from '@/material-icons/400-24px/headphones.svg?react';

import { CardTitle, CardMeta } from './standard_card';
import { StatusKornerCard } from './status_korner_card';

const messages = defineMessages({
  badge: {
    id: 'status_booth_card.badge',
    defaultMessage: 'SET',
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
  if (h > 0)
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
};

export const StatusBoothCard: React.FC<{ set: BoothSet }> = ({ set }) => {
  const intl = useIntl();

  const durationLabel = set.duration_seconds
    ? formatDuration(set.duration_seconds)
    : null;

  const genresLabel =
    set.genres && set.genres.length > 0
      ? set.genres.slice(0, 3).join(' · ')
      : null;

  return (
    <StatusKornerCard
      korner='Booth'
      variant='set'
      className='status-booth-card'
      to={`/booth/sets/${set.id}`}
      badge={{
        icon: HeadphonesIcon,
        iconId: 'headphones',
        label: intl.formatMessage(messages.badge),
        tag: set.event_name,
      }}
    >
      <div className='status-korner-card__body'>
        <CardTitle className='status-korner-card__title'>{set.title}</CardTitle>
        {set.artist_name && (
          <CardMeta className='status-booth-card__artist'>
            {set.artist_name}
          </CardMeta>
        )}
      </div>

      <div className='status-korner-card__footer status-booth-card__footer'>
        <CardMeta className='status-korner-card__meta'>
          {genresLabel && (
            <span className='status-booth-card__genres'>{genresLabel}</span>
          )}
          {durationLabel && (
            <span className='status-booth-card__duration'>{durationLabel}</span>
          )}
        </CardMeta>
      </div>
    </StatusKornerCard>
  );
};
