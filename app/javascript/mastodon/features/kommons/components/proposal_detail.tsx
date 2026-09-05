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
  completed: 'Completed',
  annulled: 'Annulled',
  delivered: 'Delivered',
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
  const [delivering, setDelivering] = useState(false);
  const [deliverNotes, setDeliverNotes] = useState('');
  const [deliverPending, setDeliverPending] = useState(false);
  const [deliverError, setDeliverError] = useState<string | null>(null);

  const isProposer = proposal.created_by_account.id === me;

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

  const handleDeliverOpen = useCallback(() => {
    setDeliverNotes('');
    setDeliverError(null);
    setDelivering(true);
  }, []);

  const handleDeliverCancel = useCallback(() => {
    setDelivering(false);
  }, []);

  const handleDeliverNotesChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setDeliverNotes(e.target.value);
    },
    [],
  );

  const handleDeliverSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setDeliverPending(true);
      setDeliverError(null);
      try {
        const res = await api().post<Proposal>(
          `/api/v1/proposals/${proposal.id}/complete`,
          {
            outcome_notes: deliverNotes.trim() || null,
          },
        );
        onVoteUpdate(res.data);
        setDelivering(false);
      } catch {
        setDeliverError('Failed to confirm completion.');
      } finally {
        setDeliverPending(false);
      }
    },
    [proposal.id, deliverNotes, onVoteUpdate],
  );

  const handleDeliverSubmitClick = useCallback(
    (e: React.FormEvent) => {
      void handleDeliverSubmit(e);
    },
    [handleDeliverSubmit],
  );

  return (
    <div className='kommons-detail'>
      <div className='kommons-detail__page'>
        {/* No local ← All proposals — the Frame's SpaceBadge in the
            SpaceNav slot returns to /hub/kommons (the korner root).
            Users who want the proposal list specifically can rotate
            at the root. (Tal 2026-08-12.) */}

        {delivering ? (
          <form
            className='kommons-form kommons-form--inline'
            onSubmit={handleDeliverSubmitClick}
          >
            <h3 className='kommons-form__heading'>
              <FormattedMessage
                id='governance.deliver.heading'
                defaultMessage='Confirm completion'
              />
            </h3>
            <p className='kommons-form__hint'>
              <FormattedMessage
                id='governance.deliver.hint'
                defaultMessage='Confirm this delivered proposal is done. Backers’ stakes are returned and the author is paid. Optionally add outcome notes.'
              />
            </p>
            {deliverError && (
              <p className='kommons-form__error'>{deliverError}</p>
            )}
            <label className='kommons-form__label'>
              <span className='kommons-form__label-text'>
                <FormattedMessage
                  id='governance.deliver.notes_label'
                  defaultMessage='Outcome notes (optional)'
                />
              </span>
              <textarea
                className='kommons-form__textarea'
                value={deliverNotes}
                onChange={handleDeliverNotesChange}
                rows={4}
                placeholder='Describe the outcome…'
              />
            </label>
            <div className='kommons-form__actions'>
              <button
                type='button'
                className='kommons-form__cancel-btn'
                onClick={handleDeliverCancel}
                disabled={deliverPending}
              >
                <FormattedMessage
                  id='governance.form.cancel'
                  defaultMessage='Cancel'
                />
              </button>
              <button
                type='submit'
                className='kommons-form__submit-btn kommons-form__submit-btn--deliver'
                disabled={deliverPending}
              >
                {deliverPending ? (
                  <FormattedMessage
                    id='governance.deliver.submitting'
                    defaultMessage='Confirming…'
                  />
                ) : (
                  <FormattedMessage
                    id='governance.deliver.submit'
                    defaultMessage='Confirm completion'
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
              </div>
              <div className='kommons-detail__title-row'>
                <h1 className='kommons-detail__title'>{proposal.title}</h1>
                {isProposer && proposal.status === 'delivered' && (
                  <button
                    type='button'
                    className='kommons-detail__mark-complete'
                    onClick={handleDeliverOpen}
                  >
                    <FormattedMessage
                      id='governance.action.mark_complete'
                      defaultMessage='Mark Complete'
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
              </p>
              {isProposer && (
                <div className='kommons-detail__proposer-actions'>
                  {proposal.status !== 'delivered' && (
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
                  {/* Completion is the proposer confirming an already-delivered
                      proposal. Once delivered, that CTA is the loud
                      "Mark Complete" button up across from the title (above) —
                      not a small meta action here. */}
                </div>
              )}
            </div>

            {/* One scroll, support-model (spec: kommons_proposal_page.md).
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
