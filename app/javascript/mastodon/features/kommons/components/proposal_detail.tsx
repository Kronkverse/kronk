import { useCallback, useState } from 'react';

import { FormattedMessage, FormattedDate } from 'react-intl';

import { Link } from 'react-router-dom';

import api from 'mastodon/api';
import { me } from 'mastodon/initial_state';

import type { Proposal } from '../types';

import { ProposalAttachments } from './proposal_attachments';
import { ProposalBacking } from './proposal_backing';
import { ProposalComments } from './proposal_comments';
import { ProposalSteps } from './proposal_steps';

const statusLabels: Record<Proposal['status'], string> = {
  open: 'Open',
  claimed: 'Claimed',
  closed: 'Closed',
  annulled: 'Annulled',
  actioned: 'Actioned',
};

// How much work the proposer reckons this is. It used to ride on the board
// card as a chip; it was noise while scanning and it matters here, where
// someone is deciding whether to back it (Tal 2026-09-12).
const sizeLabels: Record<Proposal['proposal_type'], string> = {
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
};

const TITLE_MAX = 240;

export const ProposalDetail: React.FC<{
  proposal: Proposal;
  onVoteUpdate: (updated: Proposal) => void;
}> = ({ proposal, onVoteUpdate }) => {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(proposal.title);
  const [editBody, setEditBody] = useState(proposal.body);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [closeNotes, setCloseNotes] = useState('');
  const [closePending, setClosePending] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [claimPending, setClaimPending] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  const isProposer = proposal.created_by_account.id === me;
  const isClaimant = proposal.claimed_by_account?.id === me;
  // Anyone signed in can claim an open proposal; only the claimant can hand
  // it back. (docs/spaces/kommons.md, Dev workflow.)
  const canClaim = !!me && proposal.status === 'open';
  const canUnclaim = isClaimant && proposal.status === 'claimed';
  // The claimant marks it actioned once their work has merged — but never on
  // their own proposal: whoever closes (and gets paid) can't also say the work
  // is done. A steward does it for them.
  const canAction = canUnclaim && !isProposer;
  const [confirmingAction, setConfirmingAction] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleActionAsk = useCallback(() => {
    setActionError(null);
    setConfirmingAction(true);
  }, []);

  const handleActionCancel = useCallback(() => {
    setConfirmingAction(false);
  }, []);

  const handleActionConfirm = useCallback(async () => {
    setActionPending(true);
    setActionError(null);
    try {
      const res = await api().post<Proposal>(
        `/api/v1/proposals/${proposal.id}/action`,
      );
      onVoteUpdate(res.data);
      setConfirmingAction(false);
    } catch {
      setActionError('Couldn’t mark it actioned. Refresh and try again.');
    } finally {
      setActionPending(false);
    }
  }, [proposal.id, onVoteUpdate]);

  const handleActionConfirmClick = useCallback(() => {
    void handleActionConfirm();
  }, [handleActionConfirm]);

  const handleClaimToggle = useCallback(async () => {
    setClaimPending(true);
    setClaimError(null);
    const action = proposal.status === 'claimed' ? 'unclaim' : 'claim';
    try {
      const res = await api().post<Proposal>(
        `/api/v1/proposals/${proposal.id}/${action}`,
      );
      onVoteUpdate(res.data);
    } catch {
      setClaimError(
        action === 'claim'
          ? 'Couldn’t claim it. Someone may have just claimed it; refresh to see.'
          : 'Couldn’t unclaim it. Refresh and try again.',
      );
    } finally {
      setClaimPending(false);
    }
  }, [proposal.id, proposal.status, onVoteUpdate]);

  const handleClaimClick = useCallback(() => {
    void handleClaimToggle();
  }, [handleClaimToggle]);

  const handleEditOpen = useCallback(() => {
    setEditTitle(proposal.title);
    setEditBody(proposal.body);
    setEditError(null);
    setEditing(true);
  }, [proposal.title, proposal.body]);

  const handleEditCancel = useCallback(() => {
    setEditing(false);
  }, []);

  const handleEditTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setEditTitle(e.target.value);
    },
    [],
  );

  const handleEditBodyChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setEditBody(e.target.value);
    },
    [],
  );

  const handleEditSave = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSaving(true);
      setEditError(null);
      try {
        const res = await api().patch<Proposal>(
          `/api/v1/proposals/${proposal.id}`,
          {
            proposal: { title: editTitle, body: editBody },
          },
        );
        onVoteUpdate(res.data);
        setEditing(false);
      } catch {
        setEditError('Failed to save changes.');
      } finally {
        setSaving(false);
      }
    },
    [proposal.id, editTitle, editBody, onVoteUpdate],
  );

  const handleEditSaveSubmit = useCallback(
    (e: React.FormEvent) => {
      void handleEditSave(e);
    },
    [handleEditSave],
  );

  const handleCloseOpen = useCallback(() => {
    setCloseNotes('');
    setCloseError(null);
    setClosing(true);
  }, []);

  const handleCloseCancel = useCallback(() => {
    setClosing(false);
  }, []);

  const handleCloseNotesChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setCloseNotes(e.target.value);
    },
    [],
  );

  const handleCloseSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setClosePending(true);
      setCloseError(null);
      try {
        const res = await api().post<Proposal>(
          `/api/v1/proposals/${proposal.id}/close`,
          {
            outcome_notes: closeNotes.trim() || null,
          },
        );
        onVoteUpdate(res.data);
        setClosing(false);
      } catch {
        setCloseError('Couldn’t close it. Refresh and try again.');
      } finally {
        setClosePending(false);
      }
    },
    [proposal.id, closeNotes, onVoteUpdate],
  );

  const handleCloseSubmitClick = useCallback(
    (e: React.FormEvent) => {
      void handleCloseSubmit(e);
    },
    [handleCloseSubmit],
  );

  return (
    <div className='kommons-detail'>
      <div className='kommons-detail__page'>
        {/* No local ← All proposals — the Frame's SpaceBadge in the
            SpaceNav slot returns to /hub/kommons (the korner root).
            Users who want the proposal list specifically can rotate
            at the root. (Tal 2026-08-12.) */}

        {closing ? (
          <form
            className='kommons-form kommons-form--inline'
            onSubmit={handleCloseSubmitClick}
          >
            <h3 className='kommons-form__heading'>
              <FormattedMessage
                id='governance.close.heading'
                defaultMessage='Close this proposal'
              />
            </h3>
            <p className='kommons-form__hint'>
              <FormattedMessage
                id='governance.close.hint'
                defaultMessage='Happy with the work? Closing returns backers’ stakes and pays the author. Optionally add outcome notes.'
              />
            </p>
            {closeError && <p className='kommons-form__error'>{closeError}</p>}
            <label className='kommons-form__label'>
              <span className='kommons-form__label-text'>
                <FormattedMessage
                  id='governance.close.notes_label'
                  defaultMessage='Outcome notes (optional)'
                />
              </span>
              <textarea
                className='kommons-form__textarea'
                value={closeNotes}
                onChange={handleCloseNotesChange}
                rows={4}
                placeholder='Describe the outcome…'
              />
            </label>
            <div className='kommons-form__actions'>
              <button
                type='button'
                className='kommons-form__cancel-btn'
                onClick={handleCloseCancel}
                disabled={closePending}
              >
                <FormattedMessage
                  id='governance.form.cancel'
                  defaultMessage='Cancel'
                />
              </button>
              <button
                type='submit'
                className='kommons-form__submit-btn kommons-form__submit-btn--deliver'
                disabled={closePending}
              >
                {closePending ? (
                  <FormattedMessage
                    id='governance.close.submitting'
                    defaultMessage='Closing…'
                  />
                ) : (
                  <FormattedMessage
                    id='governance.close.submit'
                    defaultMessage='Close proposal'
                  />
                )}
              </button>
            </div>
          </form>
        ) : editing ? (
          <form
            className='kommons-form kommons-form--inline'
            onSubmit={handleEditSaveSubmit}
          >
            <h3 className='kommons-form__heading'>
              <FormattedMessage
                id='governance.edit_proposal'
                defaultMessage='Edit proposal'
              />
            </h3>
            {editError && <p className='kommons-form__error'>{editError}</p>}
            <label className='kommons-form__label'>
              <span className='kommons-form__label-text'>
                <FormattedMessage
                  id='governance.form.title'
                  defaultMessage='Title'
                />
              </span>
              <input
                className='kommons-form__input'
                type='text'
                value={editTitle}
                onChange={handleEditTitleChange}
                maxLength={TITLE_MAX}
                required
              />
            </label>
            <label className='kommons-form__label'>
              <span className='kommons-form__label-text'>
                <FormattedMessage
                  id='governance.form.body'
                  defaultMessage='Description'
                />
              </span>
              <textarea
                className='kommons-form__textarea'
                value={editBody}
                onChange={handleEditBodyChange}
                rows={6}
                required
              />
            </label>
            <div className='kommons-form__actions'>
              <button
                type='button'
                className='kommons-form__cancel-btn'
                onClick={handleEditCancel}
                disabled={saving}
              >
                <FormattedMessage
                  id='governance.form.cancel'
                  defaultMessage='Cancel'
                />
              </button>
              <button
                type='submit'
                className='kommons-form__submit-btn'
                disabled={saving}
              >
                {saving ? (
                  <FormattedMessage
                    id='governance.form.saving'
                    defaultMessage='Saving…'
                  />
                ) : (
                  <FormattedMessage
                    id='governance.form.save'
                    defaultMessage='Save changes'
                  />
                )}
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className='kommons-detail__topbar'>
              <div className='kommons-detail__status-row'>
                <span
                  className={`kommons-detail__status kommons-detail__status--${proposal.status}`}
                >
                  {statusLabels[proposal.status]}
                </span>
                <span className='kommons-detail__kind'>
                  <span aria-hidden='true'>⚖</span>
                  <FormattedMessage
                    id='governance.detail.kind'
                    defaultMessage='Kommons proposal'
                  />
                </span>
                <span className='kommons-detail__size'>
                  <FormattedMessage
                    id='governance.detail.size'
                    defaultMessage='{size} piece of work'
                    values={{ size: sizeLabels[proposal.proposal_type] }}
                  />
                </span>
              </div>
              <div className='kommons-detail__title-row'>
                <h1 className='kommons-detail__title'>{proposal.title}</h1>
                {isProposer && proposal.status === 'actioned' && (
                  <button
                    type='button'
                    className='kommons-detail__mark-complete'
                    onClick={handleCloseOpen}
                  >
                    <FormattedMessage
                      id='governance.action.close'
                      defaultMessage='Close proposal'
                    />
                  </button>
                )}
              </div>
              {proposal.summary && (
                <p className='kommons-detail__summary'>{proposal.summary}</p>
              )}
              <p className='kommons-detail__meta'>
                <FormattedMessage
                  id='governance.detail.proposed_by'
                  defaultMessage='proposed by @{name}'
                  values={{ name: proposal.created_by_account.username }}
                />
                {' · '}
                <FormattedDate
                  value={proposal.created_at}
                  day='numeric'
                  month='short'
                  year='numeric'
                />
                {proposal.node_id && (
                  <Link
                    to={`/hub/kommons/node/${proposal.node_id}`}
                    className='kommons-detail__node-chip'
                  >
                    ◇ {proposal.node_id}
                  </Link>
                )}
                {proposal.claimed_by_account && (
                  <span className='kommons-detail__claimant'>
                    <FormattedMessage
                      id='governance.detail.claimed_by'
                      defaultMessage='claimed by @{name}'
                      values={{ name: proposal.claimed_by_account.username }}
                    />
                  </span>
                )}
              </p>
              {(isProposer || canClaim || canUnclaim) && (
                <div className='kommons-detail__proposer-actions'>
                  {canClaim && (
                    <button
                      type='button'
                      className='kommons-detail__action-btn kommons-detail__action-btn--claim'
                      onClick={handleClaimClick}
                      disabled={claimPending}
                    >
                      <FormattedMessage
                        id='governance.action.claim'
                        defaultMessage='Claim'
                      />
                    </button>
                  )}
                  {canAction && !confirmingAction && (
                    <button
                      type='button'
                      className='kommons-detail__action-btn kommons-detail__action-btn--deliver'
                      onClick={handleActionAsk}
                    >
                      <FormattedMessage
                        id='governance.action.mark_actioned'
                        defaultMessage='Mark actioned'
                      />
                    </button>
                  )}
                  {canUnclaim && !confirmingAction && (
                    <button
                      type='button'
                      className='kommons-detail__action-btn'
                      onClick={handleClaimClick}
                      disabled={claimPending}
                    >
                      <FormattedMessage
                        id='governance.action.unclaim'
                        defaultMessage='Unclaim'
                      />
                    </button>
                  )}
                  {isProposer && proposal.status !== 'actioned' && (
                    <button
                      type='button'
                      className='kommons-detail__action-btn kommons-detail__action-btn--edit'
                      onClick={handleEditOpen}
                    >
                      <FormattedMessage
                        id='governance.action.edit'
                        defaultMessage='Edit'
                      />
                    </button>
                  )}
                  {/* Closing is the proposer confirming an already-actioned
                      proposal. Once actioned, that CTA is the loud
                      "Close proposal" button up across from the title (above) —
                      not a small meta action here. */}
                </div>
              )}
              {canClaim && (
                <p className='kommons-detail__claim-hint'>
                  <FormattedMessage
                    id='governance.detail.claim_hint'
                    defaultMessage='Building this? Ask about anything unclear in the comments first, then claim it so the proposer knows you’re on it.'
                  />
                </p>
              )}
              {claimError && (
                <p className='kommons-form__error'>{claimError}</p>
              )}
              {confirmingAction && (
                <div className='kommons-detail__confirm'>
                  <p className='kommons-detail__confirm-text'>
                    <FormattedMessage
                      id='governance.detail.action_confirm'
                      defaultMessage='Has your work merged to main? Marking it actioned asks @{name} to close it. This can’t be undone.'
                      values={{ name: proposal.created_by_account.username }}
                    />
                  </p>
                  <div className='kommons-form__actions'>
                    <button
                      type='button'
                      className='kommons-form__cancel-btn'
                      onClick={handleActionCancel}
                      disabled={actionPending}
                    >
                      <FormattedMessage
                        id='governance.form.cancel'
                        defaultMessage='Cancel'
                      />
                    </button>
                    <button
                      type='button'
                      className='kommons-form__submit-btn kommons-form__submit-btn--deliver'
                      onClick={handleActionConfirmClick}
                      disabled={actionPending}
                    >
                      <FormattedMessage
                        id='governance.action.mark_actioned_confirm'
                        defaultMessage='Yes, mark actioned'
                      />
                    </button>
                  </div>
                  {actionError && (
                    <p className='kommons-form__error'>{actionError}</p>
                  )}
                </div>
              )}
              {isClaimant && isProposer && proposal.status === 'claimed' && (
                <p className='kommons-detail__claim-hint'>
                  <FormattedMessage
                    id='governance.detail.own_action_hint'
                    defaultMessage='When your work has merged, ask a steward to mark it actioned. You can’t action your own proposal.'
                  />
                </p>
              )}
            </div>

            {/* One scroll, support-model (spec: docs/spaces/kommons.md (Proposal page)).
                Backing is the primary support action (₭ is scarce), then the
                steps checklist, description, and design docs. The old
                Support/Question/Challenge votes are retired; a real comments
                model is the next build. */}
            <ProposalBacking proposal={proposal} onUpdate={onVoteUpdate} />

            <ProposalSteps proposalId={proposal.id} />

            <div className='kommons-detail__content'>
              <section className='kommons-detail__description'>
                <h2 className='kommons-detail__section-heading'>
                  <FormattedMessage
                    id='governance.detail.description'
                    defaultMessage='Description'
                  />
                </h2>
                <div className='kommons-detail__body'>{proposal.body}</div>
              </section>
              <ProposalAttachments proposalId={proposal.id} />
              <ProposalComments proposalId={proposal.id} />
            </div>
          </>
        )}
      </div>
    </div>
  );
};
