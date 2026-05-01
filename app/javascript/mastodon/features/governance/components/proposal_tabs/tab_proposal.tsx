import { useState, useCallback, useMemo } from 'react';

import { FormattedMessage, FormattedRelativeTime } from 'react-intl';

import api from 'mastodon/api';
import { me } from 'mastodon/initial_state';

import type { Proposal } from '../../types';

type ResponseType = 'support' | 'question' | 'challenge';

const TITLE_MAX = 80;
const CHALLENGE_MIN = 20;

const TYPE_LABEL: Record<ResponseType, string> = {
  support: 'Support',
  question: 'Question',
  challenge: 'Challenge',
};

const positionToType = (pos: string): ResponseType =>
  pos === 'agree' ? 'support' : pos === 'block' ? 'challenge' : 'question';

const typeToPosition = (t: ResponseType): 'agree' | 'abstain' | 'block' =>
  t === 'support' ? 'agree' : t === 'challenge' ? 'block' : 'abstain';

interface UnifiedResponse {
  id: string;
  type: ResponseType;
  title: string | null;
  description: string | null;
  created_at: string;
  account: Proposal['voters'][number]['account'];
  conditions?: Proposal['challenges'][number]['conditions'];
}

// ── Challenge condition reply row ─────────────────────────────────────────

const ChallengeResponseRow: React.FC<{
  response: Proposal['challenges'][number]['conditions'][number]['responses'][number];
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

// ── One challenge condition ───────────────────────────────────────────────

const ConditionBlock: React.FC<{
  condition: Proposal['challenges'][number]['conditions'][number];
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

// ── Response card ─────────────────────────────────────────────────────────

const ResponseCard: React.FC<{
  response: UnifiedResponse;
  isMine: boolean;
  onChanged: (updated: Proposal) => void;
  onEdit: () => void;
  onDelete: () => void;
  busy: boolean;
}> = ({ response, isMine, onChanged, onEdit, onDelete, busy }) => {
  const ageSeconds = Math.round(
    (new Date(response.created_at).getTime() - Date.now()) / 1000,
  );

  return (
    <div
      className={`governance-response-card governance-response-card--${response.type}${isMine ? ' governance-response-card--mine' : ''}`}
    >
      <div className='governance-response-card__header'>
        <span
          className={`governance-response-card__type governance-response-card__type--${response.type}`}
        >
          {TYPE_LABEL[response.type]}
        </span>
        <div className='governance-response-card__who'>
          <span className='governance-response-card__author'>
            @{response.account.username}
          </span>
          <span className='governance-response-card__sep'>·</span>
          <FormattedRelativeTime
            value={ageSeconds}
            numeric='auto'
            updateIntervalInSeconds={60}
          />
        </div>
      </div>

      {response.title && (
        <h4 className='governance-response-card__title'>{response.title}</h4>
      )}

      {response.description && (
        <p className='governance-response-card__body'>{response.description}</p>
      )}

      {response.type === 'challenge' &&
        response.conditions &&
        response.conditions.length > 0 && (
          <div className='governance-response-card__conditions'>
            <div className='governance-response-card__conditions-label'>
              <FormattedMessage
                id='governance.challenge.conditions_heading'
                defaultMessage='Conditions for withdrawal'
              />
            </div>
            {response.conditions.map((c) => (
              <ConditionBlock
                key={c.id}
                condition={c}
                canToggle={isMine}
                onChanged={onChanged}
              />
            ))}
          </div>
        )}

      {isMine && (
        <div className='governance-response-card__actions'>
          <button
            type='button'
            className='governance-response-card__edit-btn'
            onClick={onEdit}
            disabled={busy}
          >
            <FormattedMessage
              id='governance.response.edit'
              defaultMessage='Edit'
            />
          </button>
          <button
            type='button'
            className='governance-response-card__delete-btn'
            onClick={onDelete}
            disabled={busy}
          >
            <FormattedMessage
              id='governance.response.withdraw'
              defaultMessage='Withdraw'
            />
          </button>
        </div>
      )}
    </div>
  );
};

// ── Main tab ──────────────────────────────────────────────────────────────

export const TabProposal: React.FC<{
  proposal: Proposal;
  onVoteUpdate: (updated: Proposal) => void;
}> = ({ proposal, onVoteUpdate }) => {
  const canVote = proposal.status !== 'delivered';

  // My existing response (if any)
  const myResponse = useMemo<UnifiedResponse | null>(() => {
    if (!proposal.current_vote) return null;
    const type = positionToType(proposal.current_vote.position);
    const myVoter = proposal.voters.find((v) => v.account.id === me);
    const myChallenge =
      type === 'challenge'
        ? proposal.challenges.find((c) => c.account.id === me)
        : undefined;
    if (!myVoter) return null;
    return {
      id: myVoter.id,
      type,
      title: myVoter.title,
      description: myVoter.statement,
      created_at: myVoter.created_at,
      account: myVoter.account,
      conditions: myChallenge?.conditions,
    };
  }, [proposal.current_vote, proposal.voters, proposal.challenges]);

  // Composer state
  const [editing, setEditing] = useState(false);
  const [composerType, setComposerType] = useState<ResponseType>('support');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [conditions, setConditions] = useState<string[]>(['']);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const composerOpen = !myResponse || editing;

  const resetComposer = useCallback(() => {
    setComposerType('support');
    setTitle('');
    setDescription('');
    setConditions(['']);
    setError(null);
  }, []);

  const openEdit = useCallback(() => {
    if (!myResponse) return;
    setComposerType(myResponse.type);
    setTitle(myResponse.title ?? '');
    setDescription(myResponse.description ?? '');
    setConditions(
      myResponse.conditions && myResponse.conditions.length > 0
        ? myResponse.conditions.map((c) => c.text)
        : [''],
    );
    setError(null);
    setEditing(true);
  }, [myResponse]);

  const closeEdit = useCallback(() => {
    setEditing(false);
    resetComposer();
  }, [resetComposer]);

  const handleTypeSelect = useCallback((type: ResponseType) => {
    setComposerType(type);
    setError(null);
  }, []);

  const handleSupportType = useCallback(() => {
    handleTypeSelect('support');
  }, [handleTypeSelect]);

  const handleQuestionType = useCallback(() => {
    handleTypeSelect('question');
  }, [handleTypeSelect]);

  const handleChallengeType = useCallback(() => {
    handleTypeSelect('challenge');
  }, [handleTypeSelect]);

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setTitle(e.target.value);
    },
    [],
  );

  const handleDescriptionChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setDescription(e.target.value);
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

  const submit = useCallback(async () => {
    const titleTrim = title.trim();
    if (!titleTrim) {
      setError('Title is required.');
      return;
    }
    if (titleTrim.length > TITLE_MAX) {
      setError(`Title must be ${TITLE_MAX} characters or fewer.`);
      return;
    }
    if (composerType === 'challenge') {
      if (description.trim().length < CHALLENGE_MIN) {
        setError(`Challenge description must be ${CHALLENGE_MIN}+ characters.`);
        return;
      }
      const filled = conditions.map((c) => c.trim()).filter(Boolean);
      if (filled.length === 0) {
        setError('Add at least one condition.');
        return;
      }
    }

    setSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        position: typeToPosition(composerType),
        title: titleTrim,
        statement: description.trim() || null,
      };
      if (composerType === 'challenge') {
        payload.conditions = conditions.map((c) => c.trim()).filter(Boolean);
      }
      const res = await api().post(`/api/v1/proposals/${proposal.id}/vote`, {
        vote: payload,
      });
      onVoteUpdate(res.data as Proposal);
      setEditing(false);
      resetComposer();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to post response';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }, [
    composerType,
    title,
    description,
    conditions,
    proposal.id,
    onVoteUpdate,
    resetComposer,
  ]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      void submit();
    },
    [submit],
  );

  const withdrawResponse = useCallback(async () => {
    setSubmitting(true);
    try {
      const res = await api().delete(`/api/v1/proposals/${proposal.id}/vote`);
      onVoteUpdate(res.data as Proposal);
      setEditing(false);
      resetComposer();
    } catch (err) {
      console.error('Withdraw failed:', err);
    } finally {
      setSubmitting(false);
    }
  }, [proposal.id, onVoteUpdate, resetComposer]);

  const handleDelete = useCallback(() => {
    void withdrawResponse();
  }, [withdrawResponse]);

  // Build unified responses list (all voters, joined with challenge data for block votes)
  const responses = useMemo<UnifiedResponse[]>(() => {
    return proposal.voters.map((v) => {
      const type = positionToType(v.position);
      const challenge =
        type === 'challenge'
          ? proposal.challenges.find((c) => c.id === v.id)
          : undefined;
      return {
        id: v.id,
        type,
        title: v.title,
        description: v.statement,
        created_at: v.created_at,
        account: v.account,
        conditions: challenge?.conditions,
      };
    });
  }, [proposal.voters, proposal.challenges]);

  // Other responses (excluding mine, which is rendered above)
  const otherResponses = useMemo(
    () => responses.filter((r) => r.account.id !== me),
    [responses],
  );

  const { agree, abstain, block } = proposal.vote_summary;

  return (
    <div className='governance-tab-proposal'>
      <p className='governance-tab-proposal__body'>{proposal.body}</p>

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

      <div className='governance-tab-proposal__respond'>
        <p className='governance-tab-proposal__support-line'>
          <strong>{agree}</strong> support
          {' · '}
          <strong>{abstain}</strong> {abstain === 1 ? 'question' : 'questions'}
          {' · '}
          <strong>{block}</strong> {block === 1 ? 'challenge' : 'challenges'}
        </p>

        {myResponse && !editing && (
          <ResponseCard
            response={myResponse}
            isMine
            onChanged={onVoteUpdate}
            onEdit={openEdit}
            onDelete={handleDelete}
            busy={submitting}
          />
        )}

        {canVote && composerOpen && (
          <form className='governance-composer' onSubmit={handleSubmit}>
            <div className='governance-composer__type-selector'>
              <button
                type='button'
                className={`governance-composer__type governance-composer__type--support ${composerType === 'support' ? 'active' : ''}`}
                onClick={handleSupportType}
                disabled={submitting}
              >
                Support
              </button>
              <button
                type='button'
                className={`governance-composer__type governance-composer__type--question ${composerType === 'question' ? 'active' : ''}`}
                onClick={handleQuestionType}
                disabled={submitting}
              >
                Question
              </button>
              <button
                type='button'
                className={`governance-composer__type governance-composer__type--challenge ${composerType === 'challenge' ? 'active' : ''}`}
                onClick={handleChallengeType}
                disabled={submitting}
              >
                Challenge
              </button>
            </div>

            <label className='governance-composer__field'>
              <span className='governance-composer__label'>
                <FormattedMessage
                  id='governance.composer.title'
                  defaultMessage='Title'
                />
              </span>
              <input
                className='governance-composer__input'
                type='text'
                value={title}
                onChange={handleTitleChange}
                maxLength={TITLE_MAX}
                placeholder='One-line summary'
                required
              />
              <span className='governance-composer__counter'>
                {title.length} / {TITLE_MAX}
              </span>
            </label>

            <label className='governance-composer__field'>
              <span className='governance-composer__label'>
                <FormattedMessage
                  id='governance.composer.description'
                  defaultMessage='Description'
                />
                {composerType !== 'challenge' && (
                  <span className='governance-composer__optional'>
                    (optional)
                  </span>
                )}
              </span>
              <textarea
                className='governance-composer__textarea'
                value={description}
                onChange={handleDescriptionChange}
                rows={4}
                placeholder={
                  composerType === 'challenge'
                    ? `Explain your concern (${CHALLENGE_MIN}+ chars)…`
                    : composerType === 'question'
                      ? 'What do you need clarified?'
                      : 'Say more (optional)…'
                }
              />
            </label>

            {composerType === 'challenge' && (
              <div className='governance-composer__conditions'>
                <span className='governance-composer__label'>
                  <FormattedMessage
                    id='governance.composer.conditions_label'
                    defaultMessage='Conditions for withdrawal'
                  />
                </span>
                {conditions.map((c, i) => (
                  <div key={i} className='governance-composer__condition-row'>
                    <input
                      className='governance-composer__condition-input'
                      type='text'
                      placeholder={`Condition ${i + 1}`}
                      value={c}
                      data-idx={i}
                      onChange={handleConditionChange}
                    />
                    {conditions.length > 1 && (
                      <button
                        type='button'
                        className='governance-composer__condition-remove'
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
                  className='governance-composer__condition-add'
                  onClick={handleConditionAdd}
                >
                  +{' '}
                  <FormattedMessage
                    id='governance.composer.add_condition'
                    defaultMessage='Add condition'
                  />
                </button>
              </div>
            )}

            {error && <p className='governance-composer__error'>{error}</p>}

            <div className='governance-composer__actions'>
              {editing && (
                <button
                  type='button'
                  className='governance-composer__cancel'
                  onClick={closeEdit}
                  disabled={submitting}
                >
                  <FormattedMessage
                    id='governance.composer.cancel'
                    defaultMessage='Cancel'
                  />
                </button>
              )}
              <button
                type='submit'
                className='governance-composer__submit'
                disabled={submitting}
              >
                {editing ? (
                  <FormattedMessage
                    id='governance.composer.save'
                    defaultMessage='Save'
                  />
                ) : (
                  <FormattedMessage
                    id='governance.composer.post'
                    defaultMessage='Post'
                  />
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      {otherResponses.length > 0 && (
        <div className='governance-tab-proposal__subsection'>
          <h3 className='governance-tab-proposal__subsection-title'>
            <FormattedMessage
              id='governance.responses_heading'
              defaultMessage='Discussion'
            />
          </h3>
          <div className='governance-response-list'>
            {otherResponses.map((r) => (
              <ResponseCard
                key={r.id}
                response={r}
                isMine={false}
                onChanged={onVoteUpdate}
                onEdit={openEdit}
                onDelete={handleDelete}
                busy={submitting}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
