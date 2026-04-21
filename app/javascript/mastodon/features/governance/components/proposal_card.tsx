import { FormattedRelativeTime } from 'react-intl';

import type { Proposal } from '../index';

const truncate = (text: string, maxLen: number) =>
  text.length > maxLen ? `${text.slice(0, maxLen)}…` : text;

export const ProposalCard: React.FC<{ proposal: Proposal; onClick: () => void }> = ({
  proposal,
  onClick,
}) => {
  const ageSeconds = Math.round((new Date(proposal.created_at).getTime() - Date.now()) / 1000);

  return (
    <button className={`governance-card governance-card--${proposal.status}`} onClick={onClick}>
      <h3 className='governance-card__title'>{proposal.title}</h3>

      <p className='governance-card__body'>{truncate(proposal.body, 180)}</p>

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
    </button>
  );
};
