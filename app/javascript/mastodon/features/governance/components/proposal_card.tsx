import { useCallback } from 'react';

import { FormattedMessage, FormattedRelativeTime } from 'react-intl';

import type { Proposal } from '../types';

const truncate = (text: string, maxLen: number) =>
  text.length > maxLen ? `${text.slice(0, maxLen)}…` : text;

const buildStripBackground = (summary: Proposal['vote_summary']) => {
  const total = summary.agree + summary.abstain + summary.block;
  if (total === 0) return undefined;
  const agreeEnd = (summary.agree / total) * 100;
  const abstainEnd = agreeEnd + (summary.abstain / total) * 100;
  return `linear-gradient(to bottom, var(--vote-agree) 0 ${agreeEnd}%, var(--vote-abstain) ${agreeEnd}% ${abstainEnd}%, var(--vote-block) ${abstainEnd}% 100%)`;
};

export const ProposalCard: React.FC<{
  proposal: Proposal;
  onSelect: (id: string) => void;
}> = ({ proposal, onSelect }) => {
  const ageSeconds = Math.round(
    (new Date(proposal.created_at).getTime() - Date.now()) / 1000,
  );
  const stripBackground = buildStripBackground(proposal.vote_summary);

  const handleClick = useCallback(() => {
    onSelect(proposal.id);
  }, [onSelect, proposal.id]);

  return (
    <button
      className={`governance-card governance-card--${proposal.status}`}
      onClick={handleClick}
    >
      <span
        className='governance-card__strip'
        style={stripBackground ? { background: stripBackground } : undefined}
        aria-hidden='true'
      />
      <h3 className='governance-card__title'>{proposal.title}</h3>

      <p className='governance-card__body'>{truncate(proposal.body, 180)}</p>

      <div className='governance-card__support'>
        <span className='governance-card__support-count'>
          {proposal.vote_summary.agree}
        </span>
        <span className='governance-card__support-label'>
          <FormattedMessage
            id='governance.card.supporting'
            defaultMessage='supporting'
          />
        </span>
        {proposal.vote_summary.block > 0 && (
          <span className='governance-card__veto-count'>
            <FormattedMessage
              id='governance.card.blocking'
              defaultMessage='· {n} blocking'
              values={{ n: proposal.vote_summary.block }}
            />
          </span>
        )}
      </div>

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
          <FormattedRelativeTime
            value={ageSeconds}
            numeric='auto'
            updateIntervalInSeconds={60}
          />
        </span>
      </div>
    </button>
  );
};
