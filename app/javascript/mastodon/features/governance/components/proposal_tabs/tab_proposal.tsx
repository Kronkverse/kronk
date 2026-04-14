import { useState, useCallback } from 'react';

import { FormattedMessage } from 'react-intl';

import api from 'mastodon/api';

import type { Proposal } from '../../index';

const POSITIONS = ['agree', 'abstain', 'block'] as const;
type Position = (typeof POSITIONS)[number];

const VoteSummaryBar: React.FC<{ summary: Proposal['vote_summary'] }> = ({ summary }) => {
  const total = summary.agree + summary.abstain + summary.block;
  if (total === 0) {
    return <div className='governance-vote-bar governance-vote-bar--empty' />;
  }
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

export const TabProposal: React.FC<{
  proposal: Proposal;
  onVoteUpdate: (updated: Proposal) => void;
}> = ({ proposal, onVoteUpdate }) => {
  const [position, setPosition] = useState<Position | null>(
    (proposal.current_vote?.position as Position | undefined) ?? null,
  );
  const [statement, setStatement] = useState(proposal.current_vote?.statement ?? '');
  const [submitting, setSubmitting] = useState(false);

  const handleVote = useCallback(
    async (pos: Position) => {
      setSubmitting(true);
      try {
        if (position === pos) {
          const res = await api().delete(`/api/v1/proposals/${proposal.id}/vote`);
          setPosition(null);
          setStatement('');
          onVoteUpdate(res.data as Proposal);
        } else {
          const res = await api().post(`/api/v1/proposals/${proposal.id}/vote`, {
            vote: { position: pos, statement: statement || null },
          });
          setPosition(pos);
          onVoteUpdate(res.data as Proposal);
        }
      } catch (err) {
        console.error('Vote failed:', err);
      } finally {
        setSubmitting(false);
      }
    },
    [proposal.id, position, statement, onVoteUpdate],
  );

  const isOpen = proposal.status === 'open';

  return (
    <div className='governance-tab-proposal'>
      <div className='governance-tab-proposal__body'>{proposal.body}</div>

      {proposal.status === 'closed' && (
        <div className={`governance-tab-proposal__outcome governance-tab-proposal__outcome--${proposal.outcome ?? 'closed'}`}>
          <strong>
            {proposal.outcome === 'approved' && (
              <FormattedMessage id='governance.outcome.approved' defaultMessage='Approved' />
            )}
            {proposal.outcome === 'blocked' && (
              <FormattedMessage id='governance.outcome.blocked' defaultMessage='Blocked' />
            )}
            {proposal.outcome === 'lapsed' && (
              <FormattedMessage id='governance.outcome.lapsed' defaultMessage='Lapsed' />
            )}
            {!proposal.outcome && (
              <FormattedMessage id='governance.outcome.closed' defaultMessage='Closed' />
            )}
          </strong>
          {proposal.outcome_notes && (
            <p className='governance-tab-proposal__outcome-notes'>{proposal.outcome_notes}</p>
          )}
        </div>
      )}

      <VoteSummaryBar summary={proposal.vote_summary} />

      <p className='governance-tab-proposal__count'>
        <FormattedMessage
          id='governance.participants'
          defaultMessage='{count} {count, plural, one {participant} other {participants}}'
          values={{ count: proposal.participation_count }}
        />
      </p>

      {isOpen && (
        <div className='governance-vote-ui'>
          {position && (
            <p className='governance-vote-ui__current'>
              <FormattedMessage
                id='governance.your_vote'
                defaultMessage='Your position: {position}'
                values={{ position: <strong>{position}</strong> }}
              />
              {' — '}
              <FormattedMessage id='governance.change_vote' defaultMessage='change below' />
            </p>
          )}

          <div className='governance-vote-ui__buttons'>
            {POSITIONS.map((pos) => (
              <button
                key={pos}
                className={`governance-vote-btn governance-vote-btn--${pos} ${position === pos ? 'active' : ''}`}
                onClick={() => void handleVote(pos)}
                disabled={submitting}
              >
                <FormattedMessage
                  id={`governance.vote.${pos}`}
                  defaultMessage={pos.charAt(0).toUpperCase() + pos.slice(1)}
                />
              </button>
            ))}
          </div>

          <textarea
            className='governance-vote-ui__statement'
            value={statement}
            onChange={(e) => setStatement(e.target.value)}
            placeholder='Optional: add a statement (required for blocks)'
            rows={3}
          />
        </div>
      )}
    </div>
  );
};
