import { FormattedMessage, FormattedRelativeTime } from 'react-intl';

import type { Proposal } from '../index';

const truncate = (text: string, maxLen: number) =>
  text.length > maxLen ? `${text.slice(0, maxLen)}…` : text;

const VoteSummaryBar: React.FC<{ summary: Proposal['vote_summary'] }> = ({ summary }) => {
  const total = summary.agree + summary.abstain + summary.block;
  if (total === 0) return <div className='governance-vote-bar governance-vote-bar--empty' />;

  return (
    <div className='governance-vote-bar'>
      {summary.agree > 0 && (
        <div
          className='governance-vote-bar__segment governance-vote-bar__segment--agree'
          style={{ width: `${(summary.agree / total) * 100}%` }}
          title={`${summary.agree} agree`}
        />
      )}
      {summary.abstain > 0 && (
        <div
          className='governance-vote-bar__segment governance-vote-bar__segment--abstain'
          style={{ width: `${(summary.abstain / total) * 100}%` }}
          title={`${summary.abstain} abstain`}
        />
      )}
      {summary.block > 0 && (
        <div
          className='governance-vote-bar__segment governance-vote-bar__segment--block'
          style={{ width: `${(summary.block / total) * 100}%` }}
          title={`${summary.block} block`}
        />
      )}
    </div>
  );
};

const StatusPill: React.FC<{ status: string; outcome: string | null }> = ({ status, outcome }) => {
  if (status === 'open') {
    return (
      <span className='governance-status-pill governance-status-pill--open'>
        <FormattedMessage id='governance.status.open' defaultMessage='Open' />
      </span>
    );
  }
  if (status === 'closed') {
    if (outcome === 'approved') {
      return (
        <span className='governance-status-pill governance-status-pill--approved'>
          <FormattedMessage id='governance.status.approved' defaultMessage='Approved' />
        </span>
      );
    }
    if (outcome === 'blocked') {
      return (
        <span className='governance-status-pill governance-status-pill--blocked'>
          <FormattedMessage id='governance.status.blocked' defaultMessage='Blocked' />
        </span>
      );
    }
    return (
      <span className='governance-status-pill governance-status-pill--closed'>
        <FormattedMessage id='governance.status.closed' defaultMessage='Closed' />
      </span>
    );
  }
  return null;
};

export const ProposalCard: React.FC<{ proposal: Proposal; onClick: () => void }> = ({
  proposal,
  onClick,
}) => {
  const closesAt = proposal.closes_at ? new Date(proposal.closes_at) : null;
  const secondsUntilClose = closesAt
    ? Math.round((closesAt.getTime() - Date.now()) / 1000)
    : null;

  const hasOpenTasks = proposal.task_summary.open > 0;
  const needsHelp = proposal.status === 'open' && hasOpenTasks;

  return (
    <button className={`governance-card governance-card--${proposal.status}`} onClick={onClick}>
      <div className='governance-card__header'>
        <StatusPill status={proposal.status} outcome={proposal.outcome} />
        {needsHelp && (
          <span className='governance-card__needs-help'>
            <FormattedMessage id='governance.needs_help' defaultMessage='Needs help' />
          </span>
        )}
      </div>

      <h3 className='governance-card__title'>{proposal.title}</h3>

      <p className='governance-card__body'>{truncate(proposal.body, 160)}</p>

      <div className='governance-card__meta'>
        {proposal.status === 'open' && secondsUntilClose !== null && (
          <span className='governance-card__deadline'>
            <FormattedMessage id='governance.closes_in' defaultMessage='Closes ' />
            <FormattedRelativeTime value={secondsUntilClose} updateIntervalInSeconds={60} />
          </span>
        )}
        {proposal.status === 'closed' && proposal.outcome && (
          <span className='governance-card__outcome-label'>
            {proposal.outcome_notes ?? proposal.outcome}
          </span>
        )}
      </div>

      <VoteSummaryBar summary={proposal.vote_summary} />

      <div className='governance-card__footer'>
        <span className='governance-card__participants'>
          <FormattedMessage
            id='governance.participants'
            defaultMessage='{count} {count, plural, one {participant} other {participants}}'
            values={{ count: proposal.participation_count }}
          />
        </span>
        {proposal.task_summary.open > 0 && (
          <span className='governance-card__tasks'>
            <FormattedMessage
              id='governance.open_tasks'
              defaultMessage='{count} open {count, plural, one {task} other {tasks}}'
              values={{ count: proposal.task_summary.open }}
            />
          </span>
        )}
      </div>
    </button>
  );
};
