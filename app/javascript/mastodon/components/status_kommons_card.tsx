import { useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import ToysFanIcon from '@/material-icons/400-24px/toys_fan.svg?react';
import { Icon } from 'mastodon/components/icon';
import { spaceColor } from 'mastodon/planets';

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
  in_progress: 'In Progress',
  delivered: 'Delivered',
  vetoed: 'Vetoed',
};

const TYPE_LABELS: Record<string, string> = {
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
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
    <div
      className='status-kommons-card'
      style={{ '--space-color': spaceColor('Kommons') } as React.CSSProperties}
    >
      <div className='status-kommons-card__badge'>
        <span className='status-kommons-card__badge-icon'>
          <Icon id='toys_fan' icon={ToysFanIcon} />
        </span>
        {intl.formatMessage(messages.badge)}
        <span className='status-kommons-card__type-tag'>
          {TYPE_LABELS[proposal.proposal_type] ?? proposal.proposal_type}
        </span>
      </div>

      <div className='status-kommons-card__body'>
        <div className='status-kommons-card__title'>{proposal.title}</div>
        {proposal.summary && (
          <div className='status-kommons-card__summary'>{proposal.summary}</div>
        )}
      </div>

      <div className='status-kommons-card__footer'>
        <span
          className={`status-kommons-card__status status-kommons-card__status--${proposal.status}`}
        >
          {STATUS_LABELS[proposal.status] ?? proposal.status}
        </span>
        <span className='status-kommons-card__votes'>
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
        </span>
        <Link
          to='/governance'
          className='status-kommons-card__link'
          onClick={handleLinkClick}
        >
          {intl.formatMessage(messages.viewSeed)}
        </Link>
      </div>
    </div>
  );
};
