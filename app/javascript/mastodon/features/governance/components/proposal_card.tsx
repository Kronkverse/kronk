import { FormattedMessage, FormattedRelativeTime } from 'react-intl';

import ArrowUpwardIcon from '@/material-icons/400-24px/arrow_upward.svg?react';

import { Icon } from 'mastodon/components/icon';

import type { Proposal } from '../index';

const truncate = (text: string, maxLen: number) =>
  text.length > maxLen ? `${text.slice(0, maxLen)}…` : text;

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const StatusPill: React.FC<{ status: Proposal['status'] }> = ({ status }) => (
  <span className={`governance-status-pill governance-status-pill--${status}`}>
    {status === 'open' && <FormattedMessage id='governance.status.open' defaultMessage='Open' />}
    {status === 'in_progress' && <FormattedMessage id='governance.status.in_progress' defaultMessage='In progress' />}
    {status === 'vetoed' && <FormattedMessage id='governance.status.vetoed' defaultMessage='Vetoed' />}
    {status === 'delivered' && <FormattedMessage id='governance.status.delivered' defaultMessage='Delivered' />}
  </span>
);

export const ProposalCard: React.FC<{ proposal: Proposal; onClick: () => void }> = ({
  proposal,
  onClick,
}) => {
  const ageSeconds = Math.round((new Date(proposal.created_at).getTime() - Date.now()) / 1000);
  const tasksDone = proposal.task_summary.done;
  const tasksTotal =
    proposal.task_summary.open + proposal.task_summary.in_progress + proposal.task_summary.done;

  return (
    <button className={`governance-card governance-card--${proposal.status}`} onClick={onClick}>
      <div className='governance-card__header'>
        <div className='governance-card__header-chips'>
          <StatusPill status={proposal.status} />
          <span className='governance-card__size-chip'>{cap(proposal.proposal_type)}</span>
          {proposal.categories.map((cat) => (
            <span key={cat} className='governance-card__category-chip'>{cap(cat)}</span>
          ))}
        </div>
        <div className='governance-card__support-inline'>
          <Icon id='arrow_upward' icon={ArrowUpwardIcon} />
          <span className='governance-card__support-inline-count'>{proposal.support_count}</span>
        </div>
      </div>

      <h3 className='governance-card__title'>{proposal.title}</h3>

      <p className='governance-card__body'>{truncate(proposal.body, 180)}</p>

      <div className='governance-card__footer'>
        <div className='governance-card__author'>
          {proposal.created_by_account.avatar && (
            <img
              className='governance-card__avatar'
              src={proposal.created_by_account.avatar}
              alt=''
              aria-hidden='true'
            />
          )}
          <span className='governance-card__author-name'>
            @{proposal.created_by_account.username}
          </span>
          <span className='governance-card__author-dot'>·</span>
          <span className='governance-card__author-time'>
            <FormattedRelativeTime value={ageSeconds} numeric='auto' updateIntervalInSeconds={60} />
          </span>
        </div>
        <div className='governance-card__footer-meta'>
          {proposal.veto_count > 0 && (
            <span className='governance-card__veto-count'>
              <FormattedMessage
                id='governance.veto_count'
                defaultMessage='{count} {count, plural, one {veto} other {vetoes}}'
                values={{ count: proposal.veto_count }}
              />
            </span>
          )}
          {tasksTotal > 0 && (
            <span className='governance-card__tasks'>
              <FormattedMessage
                id='governance.tasks_progress'
                defaultMessage='{done}/{total} tasks'
                values={{ done: tasksDone, total: tasksTotal }}
              />
            </span>
          )}
        </div>
      </div>
    </button>
  );
};
