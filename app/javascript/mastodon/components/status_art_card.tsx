import { defineMessages, useIntl } from 'react-intl';

import PaletteIcon from '@/material-icons/400-24px/palette.svg?react';
import { StatusKornerCard } from 'mastodon/components/status_korner_card';

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

// The kind values match ArtPiece#kind in the Ruby model. Display copy
// is capitalised for the card meta row; en-US canonical spellings used
// throughout ("photograph" not "photo" so it doesn't collide with the
// photo-count label above).
const KIND_LABELS: Record<ArtSummary['kind'], string> = {
  painting: 'Painting',
  sculpture: 'Sculpture',
  print: 'Print',
  drawing: 'Drawing',
  ceramic: 'Ceramic',
  photograph: 'Photograph',
  other: 'Work',
};

interface ArtSummary {
  id: string;
  title: string;
  kind:
    | 'painting'
    | 'sculpture'
    | 'print'
    | 'drawing'
    | 'ceramic'
    | 'photograph'
    | 'other';
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
        <div className='status-art-card__title'>{piece.title}</div>
        <div className='status-art-card__meta'>
          {KIND_LABELS[piece.kind]}
          {' · '}
          {intl.formatMessage(messages.photos, { count: piece.photo_count })}
        </div>
      </div>
    </StatusKornerCard>
  );
};
