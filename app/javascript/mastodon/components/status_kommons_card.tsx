import { useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import ToysFanIcon from '@/material-icons/400-24px/toys_fan.svg?react';

import { StatusKornerCard } from './status_korner_card';

const messages = defineMessages({
  badge: {
    id: 'status_kommons_card.badge',
    defaultMessage: 'SEED',
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

interface ProposalSummary {
  id: string;
  title: string;
  summary?: string | null;
  status: string;
  proposal_type: string;
  support_count: number;
  veto_count: number;
  participation_count: number;
  categories: string[];
}

export const StatusKommonsCard: React.FC<{ proposal: ProposalSummary }> = ({
  proposal,
}) => {
  const intl = useIntl();

  const handleLinkClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <StatusKornerCard
      korner='Kommons'
      variant='proposal'
      className='status-kommons-card'
      badge={{
        icon: ToysFanIcon,
        iconId: 'toys_fan',
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
          {proposal.veto_count > 0 && (
            <span className='status-kommons-card__vote status-kommons-card__vote--challenge'>
              {intl.formatMessage(messages.challenges, {
                count: proposal.veto_count,
              })}
            </span>
          )}
        </div>
        <Link
          to='/hub/kommons'
          className='status-korner-card__action'
          onClick={handleLinkClick}
        >
          {intl.formatMessage(messages.viewSeed)}
        </Link>
      </div>
    </StatusKornerCard>
  );
};
