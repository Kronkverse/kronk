import { useState, useCallback } from 'react';

import { FormattedMessage } from 'react-intl';

import api from 'mastodon/api';

import type { Proposal } from '../../index';

const POSITIONS = ['agree', 'abstain', 'block'] as const;
type Position = (typeof POSITIONS)[number];

const positionLabel = (p: Position): string =>
  p === 'agree' ? 'Back it' : p === 'abstain' ? 'Meh' : 'Challenge';

const positionShort = (p: string): string =>
  p === 'agree' ? 'Backed' : p === 'abstain' ? 'Meh' : 'Challenged';

const CHALLENGE_MIN = 20;

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
  const [submitting, setSubmitting] = useState(false);
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [challengeText, setChallengeText] = useState(proposal.current_vote?.statement ?? '');

  const canVote = proposal.status !== 'delivered';

  const submitVote = useCallback(
    async (pos: Position, statement: string | null) => {
      setSubmitting(true);
      try {
        if (position === pos && pos !== 'block') {
          // Toggle off (non-block). Blocks are withdrawn via clicking Challenge again -> cancel.
          const res = await api().delete(`/api/v1/proposals/${proposal.id}/vote`);
          setPosition(null);
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
    [proposal.id, position, onVoteUpdate],
  );

  const handleVoteClick = (pos: Position) => {
    if (pos === 'block') {
      setChallengeOpen(true);
    } else {
      void submitVote(pos, null);
    }
  };

  const submitChallenge = () => {
    if (challengeText.trim().length < CHALLENGE_MIN) return;
    setChallengeOpen(false);
    void submitVote('block', challengeText.trim());
  };

  const withdrawChallenge = async () => {
    setSubmitting(true);
    try {
      const res = await api().delete(`/api/v1/proposals/${proposal.id}/vote`);
      setPosition(null);
      setChallengeText('');
      onVoteUpdate(res.data as Proposal);
    } catch (err) {
      console.error('Withdraw failed:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const total = proposal.participation_count;

  return (
    <div className='governance-tab-proposal'>
      <p className='governance-tab-proposal__body'>{proposal.body}</p>

      {proposal.status === 'vetoed' && (
        <div className='governance-tab-proposal__banner governance-tab-proposal__banner--vetoed'>
          <strong>
            <FormattedMessage id='governance.banner.vetoed' defaultMessage='Challenged — discussion required' />
          </strong>
          <p>
            <FormattedMessage
              id='governance.banner.vetoed_body'
              defaultMessage='One or more members have raised a challenge. The proposal stays open for discussion; if every challenge is withdrawn, it returns to Open.'
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
          {proposal.vote_summary.agree} backing
        </div>
        <div className='governance-vote-stat'>
          <span className='governance-vote-dot governance-vote-dot--abstain' />
          {proposal.vote_summary.abstain} meh
        </div>
        <div className='governance-vote-stat'>
          <span className='governance-vote-dot governance-vote-dot--block' />
          {proposal.vote_summary.block} {proposal.vote_summary.block === 1 ? 'challenge' : 'challenges'}
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
                defaultMessage='Currently: {pos}'
                values={{ pos: <strong>{positionShort(position)}</strong> }}
              />
              {position === 'block' && (
                <>
                  {' — '}
                  <button
                    type='button'
                    className='governance-vote-current__withdraw'
                    onClick={() => void withdrawChallenge()}
                    disabled={submitting}
                  >
                    <FormattedMessage id='governance.vote.withdraw_challenge' defaultMessage='withdraw challenge' />
                  </button>
                </>
              )}
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
                onClick={() => handleVoteClick(pos)}
                disabled={submitting}
              >
                {positionLabel(pos)}
              </button>
            ))}
          </div>
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

      <hr className='governance-detail__divider' />
      <div className='governance-detail__section-label'>
        <FormattedMessage id='governance.discussion' defaultMessage='Discussion' />
      </div>
      <p className='governance-detail__placeholder'>
        <FormattedMessage
          id='governance.discussion.coming_soon'
          defaultMessage='Comments thread coming in the next iteration — pending a decision on whether discussion lives as a native Mastodon thread or a standalone comments table.'
        />
      </p>

      {challengeOpen && (
        <div className='governance-challenge-modal'>
          <div
            className='governance-challenge-modal__backdrop'
            onClick={() => setChallengeOpen(false)}
          />
          <div className='governance-challenge-modal__body'>
            <h3 className='governance-challenge-modal__heading'>
              <FormattedMessage
                id='governance.challenge.heading'
                defaultMessage='Raise a challenge'
              />
            </h3>
            <p className='governance-challenge-modal__hint'>
              <FormattedMessage
                id='governance.challenge.hint'
                defaultMessage='A challenge is a principled objection, not just disagreement. Explain what needs to change or be discussed. Minimum {min} characters.'
                values={{ min: CHALLENGE_MIN }}
              />
            </p>
            <textarea
              className='governance-challenge-modal__textarea'
              value={challengeText}
              onChange={(e) => setChallengeText(e.target.value)}
              rows={5}
              placeholder='Your concern…'
              autoFocus
            />
            <div className='governance-challenge-modal__counter'>
              {challengeText.trim().length} / {CHALLENGE_MIN}+
            </div>
            <div className='governance-challenge-modal__actions'>
              <button
                type='button'
                className='governance-challenge-modal__cancel'
                onClick={() => setChallengeOpen(false)}
                disabled={submitting}
              >
                <FormattedMessage id='governance.challenge.cancel' defaultMessage='Cancel' />
              </button>
              <button
                type='button'
                className='governance-challenge-modal__submit'
                onClick={submitChallenge}
                disabled={submitting || challengeText.trim().length < CHALLENGE_MIN}
              >
                <FormattedMessage
                  id='governance.challenge.submit'
                  defaultMessage='Submit challenge'
                />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
