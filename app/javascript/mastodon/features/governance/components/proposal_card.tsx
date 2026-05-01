import { useCallback, useState } from 'react';

import { FormattedMessage, FormattedRelativeTime } from 'react-intl';

import api from 'mastodon/api';
import { me } from 'mastodon/initial_state';

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
  onVoteUpdate: (updated: Proposal) => void;
}> = ({ proposal, onSelect, onVoteUpdate }) => {
  const [bumping, setBumping] = useState(false);

  const ageSeconds = Math.round(
    (new Date(proposal.created_at).getTime() - Date.now()) / 1000,
  );
  const stripBackground = buildStripBackground(proposal.vote_summary);
  const isBumped = proposal.current_vote?.position === 'agree';

  const handleClick = useCallback(() => {
    onSelect(proposal.id);
  }, [onSelect, proposal.id]);

  const handleBump = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!me || bumping) return;
    setBumping(true);
    try {
      let res;
      if (isBumped) {
        res = await api().delete<Proposal>(`/api/v1/proposals/${proposal.id}/unvote`);
      } else {
        res = await api().post<Proposal>(`/api/v1/proposals/${proposal.id}/vote`, {
          vote: { position: 'agree' },
        });
      }
      onVoteUpdate(res.data);
    } catch {
      // silently ignore
    } finally {
      setBumping(false);
    }
  }, [proposal.id, isBumped, bumping, onVoteUpdate]);

  const handleBumpClick = useCallback((e: React.MouseEvent) => {
    void handleBump(e);
  }, [handleBump]);

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
            id='governance.card.bumps'
            defaultMessage='{n, plural, one {bump} other {bumps}}'
            values={{ n: proposal.vote_summary.agree }}
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

      {me && (
        <button
          type='button'
          className={'governance-card__bump-btn' + (isBumped ? ' active' : '')}
          onClick={handleBumpClick}
          disabled={bumping}
          aria-pressed={isBumped}
        >
          {isBumped
            ? <FormattedMessage id='governance.card.bumped' defaultMessage='Bumped' />
            : <FormattedMessage id='governance.card.bump' defaultMessage='Bump' />}
        </button>
      )}

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
