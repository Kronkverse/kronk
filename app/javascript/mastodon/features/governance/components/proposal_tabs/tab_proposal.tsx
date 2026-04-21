import { useState, useCallback } from 'react';

import { FormattedMessage } from 'react-intl';

import api from 'mastodon/api';
import { me } from 'mastodon/initial_state';

import type { Proposal } from '../../index';

const POSITIONS = ['agree', 'abstain', 'block'] as const;
type Position = (typeof POSITIONS)[number];

const positionLabel = (p: Position): string =>
  p === 'agree' ? 'Agree' : p === 'abstain' ? 'Abstain' : 'Raise a block';

const positionShort = (p: string): string =>
  p === 'agree' ? 'Agree' : p === 'abstain' ? 'Abstain' : 'Block';

const VoteSummaryBar: React.FC<{ summary: Proposal['vote_summary'] }> = ({ summary }) => {
  const total = summary.agree + summary.abstain + summary.block;
  if (total === 0) {
    return <div className='governance-vote-bar governance-vote-bar--empty' />;
  }
  return (
    <div className='governance-vote-bar'>
      {summary.agree > 0 && (
        <div
          className='governance-vote-bar__seg governance-vote-bar__seg--agree'
          style={{ width: `${(summary.agree / total) * 100}%` }}
        />
      )}
      {summary.abstain > 0 && (
        <div
          className='governance-vote-bar__seg governance-vote-bar__seg--abstain'
          style={{ width: `${(summary.abstain / total) * 100}%` }}
        />
      )}
      {summary.block > 0 && (
        <div
          className='governance-vote-bar__seg governance-vote-bar__seg--block'
          style={{ width: `${(summary.block / total) * 100}%` }}
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
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [marking, setMarking] = useState(false);

  const isCreator = me !== undefined && proposal.created_by_account.id === me;
  const canVote = proposal.status !== 'delivered';
  const canMarkDelivered = isCreator && proposal.status !== 'delivered';

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

  const handleMarkDelivered = useCallback(async () => {
    if (!window.confirm('Mark this proposal as delivered? This closes voting and cannot be undone.')) {
      return;
    }
    setMarking(true);
    try {
      const res = await api().post(`/api/v1/proposals/${proposal.id}/mark_delivered`, {
        outcome_notes: deliveryNotes || null,
      });
      onVoteUpdate(res.data as Proposal);
    } catch (err) {
      console.error('Mark delivered failed:', err);
    } finally {
      setMarking(false);
    }
  }, [proposal.id, deliveryNotes, onVoteUpdate]);

  const total = proposal.participation_count;

  return (
    <div className='governance-tab-proposal'>
      <p className='governance-tab-proposal__body'>{proposal.body}</p>

      {proposal.status === 'vetoed' && (
        <div className='governance-tab-proposal__banner governance-tab-proposal__banner--vetoed'>
          <strong>
            <FormattedMessage id='governance.banner.vetoed' defaultMessage='Vetoed — discussion required' />
          </strong>
          <p>
            <FormattedMessage
              id='governance.banner.vetoed_body'
              defaultMessage='One or more blocks have been raised. The proposal stays open for discussion; if every block is withdrawn, it returns to Open.'
            />
          </p>
        </div>
      )}

      {proposal.status === 'delivered' && (
        <div className='governance-tab-proposal__banner governance-tab-proposal__banner--delivered'>
          <strong>
            <FormattedMessage id='governance.banner.delivered' defaultMessage='Delivered' />
          </strong>
          {proposal.outcome_notes && <p>{proposal.outcome_notes}</p>}
        </div>
      )}

      <hr className='governance-detail__divider' />

      <div className='governance-detail__section-label'>
        <FormattedMessage id='governance.community_position' defaultMessage='Community position' />
      </div>
      <VoteSummaryBar summary={proposal.vote_summary} />
      <div className='governance-vote-stats'>
        <div className='governance-vote-stat'>
          <span className='governance-vote-dot governance-vote-dot--agree' />
          {proposal.vote_summary.agree} agree
        </div>
        <div className='governance-vote-stat'>
          <span className='governance-vote-dot governance-vote-dot--abstain' />
          {proposal.vote_summary.abstain} abstain
        </div>
        <div className='governance-vote-stat'>
          <span className='governance-vote-dot governance-vote-dot--block' />
          {proposal.vote_summary.block} {proposal.vote_summary.block === 1 ? 'block' : 'blocks'}
        </div>
        <span className='governance-vote-total'>
          <FormattedMessage
            id='governance.vote_total'
            defaultMessage='{count} {count, plural, one {participant} other {participants}}'
            values={{ count: total }}
          />
        </span>
      </div>

      {canVote && (
        <>
          <hr className='governance-detail__divider' />

          <div className='governance-detail__section-label'>
            <FormattedMessage id='governance.your_position' defaultMessage='Your position' />
          </div>
          {position ? (
            <p className='governance-vote-current'>
              <FormattedMessage
                id='governance.vote.current'
                defaultMessage='Currently: {pos} — change below'
                values={{ pos: <strong>{positionShort(position)}</strong> }}
              />
            </p>
          ) : (
            <p className='governance-vote-current'>
              <FormattedMessage id='governance.vote.cast' defaultMessage='Cast your vote' />
            </p>
          )}

          <div className='governance-vote-btns'>
            {POSITIONS.map((pos) => (
              <button
                key={pos}
                className={`governance-vbtn governance-vbtn--${pos} ${position === pos ? 'active' : ''}`}
                onClick={() => void handleVote(pos)}
                disabled={submitting}
              >
                {positionLabel(pos)}
              </button>
            ))}
          </div>

          <textarea
            className='governance-statement-area'
            value={statement}
            onChange={(e) => setStatement(e.target.value)}
            rows={3}
            placeholder='Optional statement — required if raising a block'
          />
          <p className='governance-statement-hint'>
            <FormattedMessage
              id='governance.vote.block_hint'
              defaultMessage='Blocks require a written statement explaining your principled objection.'
            />
          </p>
        </>
      )}

      {proposal.voters && proposal.voters.length > 0 && (
        <>
          <hr className='governance-detail__divider' />
          <div className='governance-detail__section-label'>
            <FormattedMessage id='governance.all_votes' defaultMessage='All votes' />
          </div>
          <div className='governance-voter-list'>
            {proposal.voters.map((v) => (
              <div key={v.account.id} className='governance-voter-row'>
                <div className='governance-voter-avatar'>
                  {v.account.avatar ? (
                    <img src={v.account.avatar} alt='' aria-hidden='true' />
                  ) : (
                    v.account.username.charAt(0).toUpperCase()
                  )}
                </div>
                <span className='governance-voter-name'>{v.account.username}</span>
                {v.statement && (
                  <span className='governance-voter-statement'>&ldquo;{v.statement}&rdquo;</span>
                )}
                <span className={`governance-voter-pos governance-voter-pos--${v.position}`}>
                  {positionShort(v.position)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {canMarkDelivered && (
        <>
          <hr className='governance-detail__divider' />
          <div className='governance-detail__section-label'>
            <FormattedMessage id='governance.delivery.heading' defaultMessage='Mark as delivered' />
          </div>
          <p className='governance-statement-hint'>
            <FormattedMessage
              id='governance.delivery.hint'
              defaultMessage='Close voting once the work is complete. Optionally describe what was shipped.'
            />
          </p>
          <textarea
            className='governance-statement-area'
            value={deliveryNotes}
            onChange={(e) => setDeliveryNotes(e.target.value)}
            rows={2}
            placeholder='Delivery notes (optional)'
          />
          <button
            type='button'
            className='governance-vbtn governance-vbtn--deliver'
            onClick={() => void handleMarkDelivered()}
            disabled={marking}
          >
            {marking ? (
              <FormattedMessage id='governance.delivery.marking' defaultMessage='Marking…' />
            ) : (
              <FormattedMessage id='governance.delivery.mark' defaultMessage='Mark delivered' />
            )}
          </button>
        </>
      )}
    </div>
  );
};
