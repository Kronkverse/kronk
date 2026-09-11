import { defineMessages, useIntl } from 'react-intl';

import KarpornIcon from '@/material-icons/400-24px/karporn.svg?react';
import { StatusKornerCard } from 'mastodon/components/status_korner_card';

const messages = defineMessages({
  badge: {
    id: 'status_karporn_card.badge',
    defaultMessage: 'KAR',
  },
  photos: {
    id: 'status_karporn_card.photos',
    defaultMessage: '{count, plural, one {# photo} other {# photos}}',
  },
});

interface KarSummary {
  id: string;
  title: string;
  year: number;
  make: string;
  model: string;
  visibility: 'public' | 'mates' | 'orbit' | 'self_only';
  photo_count: number;
  cover_url: string | null;
  owner_acct: string;
  location_label: string | null;
}

export const StatusKarpornCard: React.FC<{ kar: KarSummary }> = ({ kar }) => {
  const intl = useIntl();

  return (
    <StatusKornerCard
      korner='Karporn'
      variant='kar'
      className='status-karporn-card'
      to={`/hub/karporn/${kar.id}`}
      badge={{
        icon: KarpornIcon,
        iconId: 'karporn',
        label: intl.formatMessage(messages.badge),
      }}
    >
      {kar.cover_url && (
        <div
          className='status-karporn-card__cover'
          style={{ backgroundImage: `url(${kar.cover_url})` }}
          aria-hidden
        />
      )}

      <div className='status-korner-card__body status-karporn-card__body'>
        <div className='status-karporn-card__title'>{kar.title}</div>
        <div className='status-karporn-card__meta'>
          {kar.year} {kar.make} {kar.model}
          {' · '}
          {intl.formatMessage(messages.photos, { count: kar.photo_count })}
        </div>
        {kar.location_label && (
          <div className='status-karporn-card__location'>
            {kar.location_label}
          </div>
        )}
      </div>
    </StatusKornerCard>
  );
};
