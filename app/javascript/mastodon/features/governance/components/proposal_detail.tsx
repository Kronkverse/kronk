import { useCallback, useState } from 'react';

import { FormattedMessage, FormattedDate } from 'react-intl';

import { Link } from 'react-router-dom';

import ArrowBackIcon from '@/material-icons/400-24px/arrow_back.svg?react';
import api from 'mastodon/api';
import { Icon } from 'mastodon/components/icon';
import { me } from 'mastodon/initial_state';

import type { Proposal } from '../types';

import { ProposalAttachments } from './proposal_attachments';
import { ProposalSteps } from './proposal_steps';
import { TabProposal } from './proposal_tabs/tab_proposal';


const statusLabels: Record<Proposal['status'], string> = {
  open: 'Open',
  completed: 'Completed',
  annulled: 'Annulled',
  delivered: 'Delivered',
};

const TITLE_MAX = 240;

export const ProposalDetail: React.FC<{
  proposal: Proposal;
  onBack: () => void;
  onVoteUpdate: (updated: Proposal) => void;
  onArchived: (updated: Proposal) => void;
}> = ({ proposal, onBack, onVoteUpdate, onArchived }) => {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(proposal.title);
  const [editBody, setEditBody] = useState(proposal.body);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [delivering, setDelivering] = useState(false);
  const [deliverNotes, setDeliverNotes] = useState('');
  const [deliverPending, setDeliverPending] = useState(false);
  const [deliverError, setDeliverError] = useState<string | null>(null);

  const isSeeder = proposal.created_by_account.id === me;

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

  const handleArchive = useCallback(async () => {
    if (
      !window.confirm(
        'Archive this seed? It will be hidden from the main list.',
      )
    )
      return;
    setArchiving(true);
    try {
      const res = await api().post<Proposal>(
        `/api/v1/proposals/${proposal.id}/archive`,
      );
      onArchived(res.data);
    } catch {
      setArchiving(false);
    }
  }, [proposal.id, onArchived]);

  const handleUnarchive = useCallback(async () => {
    setArchiving(true);
    try {
      const res = await api().post<Proposal>(
        `/api/v1/proposals/${proposal.id}/unarchive`,
      );
      onVoteUpdate(res.data);
    } catch {
    } finally {
      setArchiving(false);
    }
  }, [proposal.id, onVoteUpdate]);

  const handleArchiveClick = useCallback(() => {
    void handleArchive();
  }, [handleArchive]);
  const handleUnarchiveClick = useCallback(() => {
    void handleUnarchive();
  }, [handleUnarchive]);

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
    <div className='governance-detail'>
      <div className='governance-detail__page'>
        <button className='governance-detail__back' onClick={onBack}>
          <Icon id='arrow-back' icon={ArrowBackIcon} />
          <FormattedMessage id='governance.back' defaultMessage='All seeds' />
        </button>

        {delivering ? (
          <form
            className='governance-form governance-form--inline'
            onSubmit={handleDeliverSubmitClick}
          >
            <h3 className='governance-form__heading'>
              <FormattedMessage
                id='governance.deliver.heading'
                defaultMessage='Confirm completion'
              />
            </h3>
            <p className='governance-form__hint'>
              <FormattedMessage
                id='governance.deliver.hint'
                defaultMessage='Confirm this delivered proposal is done. Backers’ stakes are returned and the author is paid. Optionally add outcome notes.'
              />
            </p>
            {deliverError && (
              <p className='governance-form__error'>{deliverError}</p>
            )}
            <label className='governance-form__label'>
              <span className='governance-form__label-text'>
                <FormattedMessage
                  id='governance.deliver.notes_label'
                  defaultMessage='Outcome notes (optional)'
                />
              </span>
              <textarea
                className='governance-form__textarea'
                value={deliverNotes}
                onChange={handleDeliverNotesChange}
                rows={4}
                placeholder='Describe the outcome…'
              />
            </label>
            <div className='governance-form__actions'>
              <button
                type='button'
                className='governance-form__cancel-btn'
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
                className='governance-form__submit-btn governance-form__submit-btn--deliver'
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
            className='governance-form governance-form--inline'
            onSubmit={handleEditSaveSubmit}
          >
            <h3 className='governance-form__heading'>
              <FormattedMessage
                id='governance.edit_seed'
                defaultMessage='Edit seed'
              />
            </h3>
            {editError && <p className='governance-form__error'>{editError}</p>}
            <label className='governance-form__label'>
              <span className='governance-form__label-text'>
                <FormattedMessage
                  id='governance.form.title'
                  defaultMessage='Title'
                />
              </span>
              <input
                className='governance-form__input'
                type='text'
                value={editTitle}
                onChange={handleEditTitleChange}
                maxLength={TITLE_MAX}
                required
              />
            </label>
            <label className='governance-form__label'>
              <span className='governance-form__label-text'>
                <FormattedMessage
                  id='governance.form.body'
                  defaultMessage='Description'
                />
              </span>
              <textarea
                className='governance-form__textarea'
                value={editBody}
                onChange={handleEditBodyChange}
                rows={6}
                required
              />
            </label>
            <div className='governance-form__actions'>
              <button
                type='button'
                className='governance-form__cancel-btn'
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
                className='governance-form__submit-btn'
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
            <div className='governance-detail__topbar'>
              <div className='governance-detail__status-row'>
                <span
                  className={`governance-detail__status governance-detail__status--${proposal.status}`}
                >
                  {statusLabels[proposal.status]}
                </span>
                <span className='governance-detail__kind'>
                  <span aria-hidden='true'>⚖</span>
                  <FormattedMessage
                    id='governance.detail.kind'
                    defaultMessage='Kommons proposal'
                  />
                </span>
              </div>
              <h1 className='governance-detail__title'>{proposal.title}</h1>
              {proposal.summary && (
                <p className='governance-detail__summary'>{proposal.summary}</p>
              )}
              <p className='governance-detail__meta'>
                <FormattedMessage
                  id='governance.detail.seeded_by'
                  defaultMessage='seeded by @{name}'
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
                    className='governance-detail__node-chip'
                  >
                    ◇ {proposal.node_id}
                  </Link>
                )}
              </p>
              {isSeeder && (
                <div className='governance-detail__seeder-actions'>
                  {!proposal.archived_at && proposal.status !== 'delivered' && (
                    <button
                      type='button'
                      className='governance-detail__action-btn governance-detail__action-btn--edit'
                      onClick={handleEditOpen}
                    >
                      <FormattedMessage
                        id='governance.action.edit'
                        defaultMessage='Edit'
                      />
                    </button>
                  )}
                  {/* Completion is the proposer confirming an already-delivered
                      proposal (delivery itself is a dev action via `tootctl
                      kommons deliver`). POSTing /complete on an open proposal
                      422s, so this only shows once status is `delivered`. */}
                  {!proposal.archived_at && proposal.status === 'delivered' && (
                    <button
                      type='button'
                      className='governance-detail__action-btn governance-detail__action-btn--deliver'
                      onClick={handleDeliverOpen}
                    >
                      <FormattedMessage
                        id='governance.action.deliver'
                        defaultMessage='Confirm completion'
                      />
                    </button>
                  )}
                  {proposal.archived_at ? (
                    <button
                      type='button'
                      className='governance-detail__action-btn governance-detail__action-btn--unarchive'
                      onClick={handleUnarchiveClick}
                      disabled={archiving}
                    >
                      {archiving ? (
                        <FormattedMessage
                          id='governance.action.unarchiving'
                          defaultMessage='Unarchiving…'
                        />
                      ) : (
                        <FormattedMessage
                          id='governance.action.unarchive'
                          defaultMessage='Unarchive'
                        />
                      )}
                    </button>
                  ) : (
                    <button
                      type='button'
                      className='governance-detail__action-btn governance-detail__action-btn--archive'
                      onClick={handleArchiveClick}
                      disabled={archiving}
                    >
                      {archiving ? (
                        <FormattedMessage
                          id='governance.action.archiving'
                          defaultMessage='Archiving…'
                        />
                      ) : (
                        <FormattedMessage
                          id='governance.action.archive'
                          defaultMessage='Archive'
                        />
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* One scroll — the Seed/Kontribute tabs are retired (spec:
                docs/spaces/kommons_proposal_page.md). Steps up front (they own
                the task checklist), then the proposal's description / votes /
                backing / discussion, then the design docs. Budget + task
                claim/assign are deferred, to fold into the steps checklist. */}
            <ProposalSteps proposalId={proposal.id} />

            <div className='governance-detail__content'>
              <TabProposal proposal={proposal} onVoteUpdate={onVoteUpdate} />
              <ProposalAttachments proposalId={proposal.id} />
            </div>
          </>
        )}
      </div>
    </div>
  );
};
