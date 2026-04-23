import { useState, useCallback } from 'react';

import { FormattedMessage, FormattedRelativeTime } from 'react-intl';

import api from 'mastodon/api';
import { me } from 'mastodon/initial_state';

import type { Proposal } from '../../index';

const POSITIONS = ['agree', 'abstain', 'block'] as const;
type Position = (typeof POSITIONS)[number];

const positionLabel = (p: Position): string =>
  p === 'agree' ? 'Back it' : p === 'abstain' ? 'Meh' : 'Challenge';

const positionShort = (p: string): string =>
  p === 'agree' ? 'Backed' : p === 'abstain' ? 'Meh' : 'Challenged';

const CHALLENGE_MIN = 20;

type Challenge = Proposal['challenges'][number];
type ChallengeCondition = Challenge['conditions'][number];

const VoteSummaryBar: React.FC<{ summary: Proposal['vote_summary'] }> = ({
  summary,
}) => {
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

// ── Challenge response row ─────────────────────────────────────────────────

const ChallengeResponseRow: React.FC<{
  response: ChallengeCondition['responses'][number];
}> = ({ response }) => {
  const ageSeconds = Math.round(
    (new Date(response.created_at).getTime() - Date.now()) / 1000,
  );
  return (
    <div className='governance-challenge-response'>
      <div className='governance-challenge-response__avatar'>
        {response.account.avatar ? (
          <img src={response.account.avatar} alt='' aria-hidden='true' />
        ) : (
          response.account.username.charAt(0).toUpperCase()
        )}
      </div>
      <div className='governance-challenge-response__body'>
        <div className='governance-challenge-response__meta'>
          <strong>@{response.account.username}</strong>
          <span>·</span>
          <FormattedRelativeTime
            value={ageSeconds}
            numeric='auto'
            updateIntervalInSeconds={60}
          />
        </div>
        <p className='governance-challenge-response__text'>{response.body}</p>
      </div>
    </div>
  );
};

// ── One condition within a challenge ───────────────────────────────────────

const ConditionBlock: React.FC<{
  condition: ChallengeCondition;
  canToggle: boolean;
  onChanged: (updated: Proposal) => void;
}> = ({ condition, canToggle, onChanged }) => {
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const toggleMet = useCallback(async () => {
    if (!canToggle) return;
    try {
      const res = await api().post(
        `/api/v1/challenge_conditions/${condition.id}/toggle`,
      );
      onChanged(res.data as Proposal);
    } catch (err) {
      console.error('Toggle failed:', err);
    }
  }, [canToggle, condition.id, onChanged]);

  const submitReply = useCallback(async () => {
    if (!replyText.trim()) return;
    setSubmitting(true);
    try {
      const res = await api().post(
        `/api/v1/challenge_conditions/${condition.id}/responses`,
        { response: { body: replyText.trim() } },
      );
      setReplyText('');
      onChanged(res.data as Proposal);
    } catch (err) {
      console.error('Reply failed:', err);
    } finally {
      setSubmitting(false);
    }
  }, [condition.id, replyText, onChanged]);

  const handleToggleChange = useCallback(() => {
    void toggleMet();
  }, [toggleMet]);

  const handleReplyChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setReplyText(e.target.value);
    },
    [],
  );

  const handleReplyClick = useCallback(() => {
    void submitReply();
  }, [submitReply]);

  return (
    <div
      className={`governance-condition ${condition.met ? 'governance-condition--met' : ''}`}
    >
      <label className='governance-condition__header'>
        <input
          type='checkbox'
          checked={condition.met}
          onChange={handleToggleChange}
          disabled={!canToggle}
          aria-label='Mark condition as addressed'
        />
        <span className='governance-condition__text'>{condition.text}</span>
      </label>

      {condition.responses.length > 0 && (
        <div className='governance-condition__responses'>
          {condition.responses.map((r) => (
            <ChallengeResponseRow key={r.id} response={r} />
          ))}
        </div>
      )}

      <div className='governance-condition__reply'>
        <textarea
          className='governance-condition__reply-area'
          placeholder='Respond to this condition…'
          value={replyText}
          onChange={handleReplyChange}
          rows={2}
        />
        <button
          type='button'
          className='governance-condition__reply-btn'
          disabled={submitting || !replyText.trim()}
          onClick={handleReplyClick}
        >
          <FormattedMessage
            id='governance.challenge.reply'
            defaultMessage='Reply'
          />
        </button>
      </div>
    </div>
  );
};

// ── One challenge (per challenger) ─────────────────────────────────────────

const ChallengeBlock: React.FC<{
  challenge: Challenge;
  viewerIsAuthor: boolean;
  onChanged: (updated: Proposal) => void;
  onWithdraw: () => void;
  withdrawing: boolean;
}> = ({ challenge, viewerIsAuthor, onChanged, onWithdraw, withdrawing }) => {
  const allMet =
    challenge.conditions.length > 0 && challenge.conditions.every((c) => c.met);

  return (
    <div className='governance-challenge'>
      <div className='governance-challenge__header'>
        <div className='governance-challenge__avatar'>
          {challenge.account.avatar ? (
            <img src={challenge.account.avatar} alt='' aria-hidden='true' />
          ) : (
            challenge.account.username.charAt(0).toUpperCase()
          )}
        </div>
        <div className='governance-challenge__who'>
          <strong>@{challenge.account.username}</strong>
          <span> challenged this proposal</span>
        </div>
      </div>

      {challenge.statement && (
        <p className='governance-challenge__statement'>
          &ldquo;{challenge.statement}&rdquo;
        </p>
      )}

      {challenge.conditions.length > 0 && (
        <div className='governance-challenge__conditions'>
          <div className='governance-challenge__section-label'>
            <FormattedMessage
              id='governance.challenge.conditions_heading'
              defaultMessage='Conditions for withdrawal'
            />
          </div>
          {challenge.conditions.map((c) => (
            <ConditionBlock
              key={c.id}
              condition={c}
              canToggle={viewerIsAuthor}
              onChanged={onChanged}
            />
          ))}
        </div>
      )}

      {viewerIsAuthor && (
        <div className='governance-challenge__withdraw'>
          {allMet && (
            <span className='governance-challenge__withdraw-hint'>
              <FormattedMessage
                id='governance.challenge.all_addressed'
                defaultMessage='All conditions marked addressed.'
              />
            </span>
          )}
          <button
            type='button'
            className={`governance-challenge__withdraw-btn ${allMet ? 'governance-challenge__withdraw-btn--ready' : ''}`}
            onClick={onWithdraw}
            disabled={withdrawing}
          >
            <FormattedMessage
              id='governance.challenge.withdraw'
              defaultMessage='Withdraw challenge'
            />
          </button>
        </div>
      )}
    </div>
  );
};

// ── Main tab ───────────────────────────────────────────────────────────────

export const TabProposal: React.FC<{
  proposal: Proposal;
  onVoteUpdate: (updated: Proposal) => void;
}> = ({ proposal, onVoteUpdate }) => {
  const [position, setPosition] = useState<Position | null>(
    (proposal.current_vote?.position as Position | undefined) ?? null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [challengeText, setChallengeText] = useState(
    proposal.current_vote?.statement ?? '',
  );
  const [conditions, setConditions] = useState<string[]>(['']);

  const canVote = proposal.status !== 'delivered';

  const submitVote = useCallback(
    async (
      pos: Position,
      statement: string | null,
      conditionList?: string[],
    ) => {
      setSubmitting(true);
      try {
        if (position === pos && pos !== 'block') {
          const res = await api().delete(
            `/api/v1/proposals/${proposal.id}/vote`,
          );
          setPosition(null);
          onVoteUpdate(res.data as Proposal);
        } else {
          const payload: Record<string, unknown> = {
            position: pos,
            statement: statement ?? null,
          };
          if (pos === 'block' && conditionList)
            payload.conditions = conditionList;
          const res = await api().post(
            `/api/v1/proposals/${proposal.id}/vote`,
            {
              vote: payload,
            },
          );
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

  const handleVoteClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const pos = e.currentTarget.dataset.pos as Position;
      if (pos === 'block') {
        setChallengeOpen(true);
      } else {
        void submitVote(pos, null);
      }
    },
    [submitVote],
  );

  const submitChallenge = useCallback(() => {
    if (challengeText.trim().length < CHALLENGE_MIN) return;
    const filled = conditions.map((c) => c.trim()).filter(Boolean);
    if (filled.length === 0) return;
    setChallengeOpen(false);
    void submitVote('block', challengeText.trim(), filled);
  }, [challengeText, conditions, submitVote]);

  const withdrawChallenge = useCallback(async () => {
    setSubmitting(true);
    try {
      const res = await api().delete(`/api/v1/proposals/${proposal.id}/vote`);
      setPosition(null);
      setChallengeText('');
      setConditions(['']);
      onVoteUpdate(res.data as Proposal);
    } catch (err) {
      console.error('Withdraw failed:', err);
    } finally {
      setSubmitting(false);
    }
  }, [proposal.id, onVoteUpdate]);

  const handleWithdrawClick = useCallback(() => {
    void withdrawChallenge();
  }, [withdrawChallenge]);

  const closeChallenge = useCallback(() => {
    setChallengeOpen(false);
  }, []);

  const handleChallengeTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setChallengeText(e.target.value);
    },
    [],
  );

  const handleConditionChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const idx = Number(e.currentTarget.dataset.idx);
      const value = e.target.value;
      setConditions((prev) => {
        const next = prev.slice();
        next[idx] = value;
        return next;
      });
    },
    [],
  );

  const handleConditionRemove = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const idx = Number(e.currentTarget.dataset.idx);
      setConditions((prev) => prev.filter((_, i) => i !== idx));
    },
    [],
  );

  const handleConditionAdd = useCallback(() => {
    setConditions((prev) => [...prev, '']);
  }, []);

  const total = proposal.participation_count;
  const myChallenge = proposal.challenges.find((ch) => ch.account.id === me);

  return (
    <div className='governance-tab-proposal'>
      <section className='governance-zone governance-zone--body'>
        <h4 className='governance-zone__heading'>
          <FormattedMessage
            id='governance.proposal_body'
            defaultMessage='Proposal'
          />
        </h4>
        <p className='governance-tab-proposal__body'>{proposal.body}</p>
      </section>

      {proposal.status === 'vetoed' && (
        <div className='governance-tab-proposal__banner governance-tab-proposal__banner--vetoed'>
          <strong>
            <FormattedMessage
              id='governance.banner.vetoed'
              defaultMessage='Challenged — discussion required'
            />
          </strong>
          <p>
            <FormattedMessage
              id='governance.banner.vetoed_body'
              defaultMessage='One or more members have raised a challenge. The proposal stays open for discussion; once every challenge is withdrawn, it returns to Open.'
            />
          </p>
        </div>
      )}

      {proposal.status === 'delivered' && (
        <div className='governance-tab-proposal__banner governance-tab-proposal__banner--delivered'>
          <strong>
            <FormattedMessage
              id='governance.banner.delivered'
              defaultMessage='Delivered'
            />
          </strong>
          {proposal.outcome_notes && <p>{proposal.outcome_notes}</p>}
        </div>
      )}

      <section className='governance-zone governance-zone--vote'>
        <h4 className='governance-zone__heading'>
          <FormattedMessage
            id='governance.community_position'
            defaultMessage='Community position'
          />
        </h4>
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
            {proposal.vote_summary.block}{' '}
            {proposal.vote_summary.block === 1 ? 'challenge' : 'challenges'}
          </div>
          <span className='governance-vote-total'>
            <FormattedMessage
              id='governance.vote_total'
              defaultMessage="{count, plural, one {# participant} other {# participants}}"
              values={{ count: total }}
            />
          </span>
        </div>
      </section>

      {canVote && (
        <section className='governance-zone governance-zone--position'>
          <h4 className='governance-zone__heading'>
            <FormattedMessage
              id='governance.your_position'
              defaultMessage='Your position'
            />
          </h4>
          {position ? (
            <p className='governance-vote-current'>
              <FormattedMessage
                id='governance.vote.current'
                defaultMessage='Currently: {pos}'
                values={{ pos: <strong>{positionShort(position)}</strong> }}
              />
            </p>
          ) : (
            <p className='governance-vote-current'>
              <FormattedMessage
                id='governance.vote.cast'
                defaultMessage='Cast your vote'
              />
            </p>
          )}

          <div className='governance-vote-btns'>
            {POSITIONS.map((pos) => (
              <button
                key={pos}
                className={`governance-vbtn governance-vbtn--${pos} ${position === pos ? 'active' : ''}`}
                data-pos={pos}
                onClick={handleVoteClick}
                disabled={submitting}
              >
                {positionLabel(pos)}
              </button>
            ))}
          </div>
        </section>
      )}

      {proposal.challenges.length > 0 && (
        <section className='governance-zone governance-zone--challenges'>
          <h4 className='governance-zone__heading governance-zone__heading--block'>
            <FormattedMessage
              id='governance.challenges_heading'
              defaultMessage='Active challenges'
            />
          </h4>
          <div className='governance-challenges-list'>
            {proposal.challenges.map((ch) => (
              <ChallengeBlock
                key={ch.id}
                challenge={ch}
                viewerIsAuthor={ch.account.id === me}
                onChanged={onVoteUpdate}
                onWithdraw={handleWithdrawClick}
                withdrawing={submitting}
              />
            ))}
          </div>
        </section>
      )}

      {proposal.voters.length > 0 && (
        <section className='governance-zone governance-zone--voters'>
          <h4 className='governance-zone__heading governance-zone__heading--neutral'>
            <FormattedMessage
              id='governance.all_votes'
              defaultMessage='All votes'
            />
          </h4>
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
                <span className='governance-voter-name'>
                  {v.account.username}
                </span>
                <span
                  className={`governance-voter-pos governance-voter-pos--${v.position}`}
                >
                  {positionShort(v.position)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {challengeOpen && (
        <div className='governance-challenge-modal'>
          <button
            type='button'
            className='governance-challenge-modal__backdrop'
            onClick={closeChallenge}
            aria-label='Close challenge dialog'
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
                defaultMessage='A challenge is a principled objection, not just disagreement. Summarise your concern ({min}+ chars), then list the conditions that need to be met before you would withdraw.'
                values={{ min: CHALLENGE_MIN }}
              />
            </p>

            <div className='governance-challenge-modal__label'>
              <FormattedMessage
                id='governance.challenge.summary'
                defaultMessage='Your concern'
              />
            </div>
            <textarea
              className='governance-challenge-modal__textarea'
              value={challengeText}
              onChange={handleChallengeTextChange}
              rows={3}
              placeholder='In one sentence, what is your concern?'
            />
            <div className='governance-challenge-modal__counter'>
              {challengeText.trim().length} / {CHALLENGE_MIN}+
            </div>

            <div className='governance-challenge-modal__label'>
              <FormattedMessage
                id='governance.challenge.conditions_label'
                defaultMessage='Conditions for withdrawal'
              />
            </div>
            {conditions.map((c, i) => (
              <div
                key={i}
                className='governance-challenge-modal__condition-row'
              >
                <input
                  className='governance-challenge-modal__condition-input'
                  type='text'
                  placeholder={`Condition ${i + 1}`}
                  value={c}
                  data-idx={i}
                  onChange={handleConditionChange}
                />
                {conditions.length > 1 && (
                  <button
                    type='button'
                    className='governance-challenge-modal__remove-cond'
                    data-idx={i}
                    onClick={handleConditionRemove}
                    aria-label='Remove condition'
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <button
              type='button'
              className='governance-challenge-modal__add-cond'
              onClick={handleConditionAdd}
            >
              +{' '}
              <FormattedMessage
                id='governance.challenge.add_condition'
                defaultMessage='Add condition'
              />
            </button>

            <div className='governance-challenge-modal__actions'>
              <button
                type='button'
                className='governance-challenge-modal__cancel'
                onClick={closeChallenge}
                disabled={submitting}
              >
                <FormattedMessage
                  id='governance.challenge.cancel'
                  defaultMessage='Cancel'
                />
              </button>
              <button
                type='button'
                className='governance-challenge-modal__submit'
                onClick={submitChallenge}
                disabled={
                  submitting ||
                  challengeText.trim().length < CHALLENGE_MIN ||
                  conditions.every((c) => !c.trim())
                }
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

      {!myChallenge && (
        <section className='governance-zone governance-zone--discussion'>
          <h4 className='governance-zone__heading'>
            <FormattedMessage
              id='governance.discussion'
              defaultMessage='Discussion'
            />
          </h4>
          <p className='governance-detail__placeholder'>
            <FormattedMessage
              id='governance.discussion.coming_soon'
              defaultMessage='General discussion thread coming in a future iteration. For now, structured conversation happens inside individual challenges above.'
            />
          </p>
        </section>
      )}
    </div>
  );
};
