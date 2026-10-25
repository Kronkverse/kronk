import { defineMessages, useIntl } from 'react-intl';

import PaletteIcon from '@/material-icons/400-24px/palette.svg?react';
import type { ArtKind } from 'mastodon/api_types/art';
import { CardTitle, CardMeta } from 'mastodon/components/standard_card';
import { StatusKornerCard } from 'mastodon/components/status_korner_card';
import { artKindLabel } from 'mastodon/features/art/kinds';

const messages = defineMessages({
  badge: {
    id: 'status_art_card.badge',
    defaultMessage: 'ART',
  },
  photos: {
    id: 'status_art_card.photos',
    defaultMessage: '{count, plural, one {# photo} other {# photos}}',
  },
});

interface ArtSummary {
  id: string;
  title: string;
  kind: ArtKind;
  visibility: 'public' | 'mates' | 'orbit' | 'self_only';
  photo_count: number;
  cover_url: string | null;
  owner_acct: string;
}

export const StatusArtCard: React.FC<{ piece: ArtSummary }> = ({ piece }) => {
  const intl = useIntl();

  return (
    <StatusKornerCard
      korner='Art'
      variant='art'
      className='status-art-card'
      to={`/hub/art/pieces/${piece.id}`}
      badge={{
        icon: PaletteIcon,
        iconId: 'palette',
        label: intl.formatMessage(messages.badge),
      }}
    >
      {piece.cover_url && (
        <div
          className='status-art-card__cover'
          style={{ backgroundImage: `url(${piece.cover_url})` }}
          aria-hidden
        />
      )}

      <div className='status-korner-card__body status-art-card__body'>
        <CardTitle className='status-art-card__title'>{piece.title}</CardTitle>
        <CardMeta className='status-art-card__meta'>
          {artKindLabel(intl, piece.kind)}
          {' · '}
          {intl.formatMessage(messages.photos, { count: piece.photo_count })}
        </CardMeta>
      </div>
    </StatusKornerCard>
  );
};
