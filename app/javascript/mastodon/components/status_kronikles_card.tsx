import { defineMessages, useIntl } from 'react-intl';

import MenuBookIcon from '@/material-icons/400-24px/menu_book.svg?react';
import { StatusKornerCard } from 'mastodon/components/status_korner_card';

const messages = defineMessages({
  badge: {
    id: 'status_kronikles_card.badge',
    defaultMessage: 'KRONIKLE',
  },
});

// Display copy for each kind. Matches Chronicle#kind in the Ruby
// model; capitalised for the card meta row.
const KIND_LABELS: Record<KronikleSummary['kind'], string> = {
  essay: 'Essay',
  short_story: 'Short story',
  poetry: 'Poetry',
  letter: 'Letter',
  journal: 'Journal',
  other: 'Piece',
};

interface KronikleSummary {
  id: string;
  title: string;
  kind: 'essay' | 'short_story' | 'poetry' | 'letter' | 'journal' | 'other';
  visibility: 'public' | 'mates' | 'orbit' | 'self_only';
  excerpt: string;
  owner_acct: string;
}

export const StatusKroniklesCard: React.FC<{ chronicle: KronikleSummary }> = ({
  chronicle,
}) => {
  const intl = useIntl();

  return (
    <StatusKornerCard
      korner='Kronikles'
      variant='kronikle'
      className='status-kronikles-card'
      to={`/hub/kronikles/${chronicle.id}`}
      badge={{
        icon: MenuBookIcon,
        iconId: 'menu_book',
        label: intl.formatMessage(messages.badge),
      }}
    >
      <div className='status-korner-card__body status-kronikles-card__body'>
        <div className='status-kronikles-card__title'>{chronicle.title}</div>
        <div className='status-kronikles-card__kind'>
          {KIND_LABELS[chronicle.kind]}
        </div>
        <p className='status-kronikles-card__excerpt'>{chronicle.excerpt}</p>
      </div>
    </StatusKornerCard>
  );
};
