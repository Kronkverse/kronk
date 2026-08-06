import { defineMessages, useIntl } from 'react-intl';

import CampaignIcon from '@/material-icons/400-24px/campaign.svg?react';
import type { ApiProposalSummaryJSON } from 'mastodon/api_types/statuses';

import { StatusKornerCard } from './status_korner_card';

// Kommons proposal card as it appears embedded in the home feed
// (a boosted / referenced proposal). The whole card is one tap
// target that opens `/hub/kommons/p/:id`, so it stays minimal:
// PROPOSAL badge + campaign glyph, title, optional summary. The
// former footer (Open pill / N supports / N challenges / "View in
// ₭ommons →" action) is retired — every piece of it duplicated the
// affordance the card itself already carries (Tal, 2026-08-06).

const messages = defineMessages({
  badge: {
    id: 'status_kommons_card.badge',
    defaultMessage: 'PROPOSAL',
  },
});

export const StatusKommonsCard: React.FC<{
  proposal: ApiProposalSummaryJSON;
}> = ({ proposal }) => {
  const intl = useIntl();

  return (
    <StatusKornerCard
      korner='Kommons'
      variant='proposal'
      className='status-kommons-card'
      to={`/hub/kommons/p/${proposal.id}`}
      badge={{
        icon: CampaignIcon,
        iconId: 'campaign',
        label: intl.formatMessage(messages.badge),
      }}
    >
      <div className='status-korner-card__body status-kommons-card__body'>
        <div className='status-kommons-card__title'>{proposal.title}</div>
        {proposal.summary && (
          <div className='status-kommons-card__summary'>{proposal.summary}</div>
        )}
      </div>
    </StatusKornerCard>
  );
};
