import { defineMessages, useIntl } from 'react-intl';

import CampaignIcon from '@/material-icons/400-24px/campaign.svg?react';
import type { ApiProposalSummaryJSON } from 'mastodon/api_types/statuses';

import { StatusKornerCard } from './status_korner_card';

const messages = defineMessages({
  badge: {
    id: 'status_kommons_card.badge',
    defaultMessage: 'PROPOSAL',
  },
  supports: {
    id: 'status_kommons_card.supports',
    defaultMessage: '{count, plural, one {# support} other {# supports}}',
  },
  challenges: {
    id: 'status_kommons_card.challenges',
    defaultMessage: '{count, plural, one {# challenge} other {# challenges}}',
  },
  viewSeed: {
    id: 'status_kommons_card.view_seed',
    defaultMessage: 'View in ₭ommons →',
  },
});

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  completed: 'Completed',
  delivered: 'Delivered',
  annulled: 'Annulled',
};

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

      <div className='status-korner-card__footer status-kommons-card__footer'>
        <div className='status-korner-card__meta'>
          <span
            className={`status-kommons-card__status status-kommons-card__status--${proposal.status}`}
          >
            {STATUS_LABELS[proposal.status] ?? proposal.status}
          </span>
          <span className='status-kommons-card__vote status-kommons-card__vote--support'>
            {intl.formatMessage(messages.supports, {
              count: proposal.support_count,
            })}
          </span>
          {proposal.challenge_count > 0 && (
            <span className='status-kommons-card__vote status-kommons-card__vote--challenge'>
              {intl.formatMessage(messages.challenges, {
                count: proposal.challenge_count,
              })}
            </span>
          )}
        </div>
        <span className='status-korner-card__action'>
          {intl.formatMessage(messages.viewSeed)}
        </span>
      </div>
    </StatusKornerCard>
  );
};
