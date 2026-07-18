import { useCallback, useState } from 'react';

import { FormattedMessage, FormattedDate } from 'react-intl';

import ArrowBackIcon from '@/material-icons/400-24px/arrow_back.svg?react';
import api from 'mastodon/api';
import { Icon } from 'mastodon/components/icon';
import { me } from 'mastodon/initial_state';

import type { Proposal } from '../types';

import { TabKontribute } from './proposal_tabs/tab_kontribute';
import { TabProposal } from './proposal_tabs/tab_proposal';

type Tab = 'proposal' | 'kontribute';

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
  const [activeTab, setActiveTab] = useState<Tab>('proposal');
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

  const handleProposalTab = useCallback(() => {
    setActiveTab('proposal');
  }, []);
  const handleKontributeTab = useCallback(() => {
    setActiveTab('kontribute');
  }, []);

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
        setDeliverError('Failed to mark as delivered.');
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
                defaultMessage='Mark as delivered'
              />
            </h3>
            <p className='governance-form__hint'>
              <FormattedMessage
                id='governance.deliver.hint'
                defaultMessage='This permanently closes the seed and locks all voting. Optionally describe how it was delivered.'
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
                placeholder='Describe what was shipped…'
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
                    defaultMessage='Marking…'
                  />
                ) : (
                  <FormattedMessage
                    id='governance.deliver.submit'
                    defaultMessage='Mark as delivered'
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
              <span
                className={`governance-detail__status governance-detail__status--${proposal.status}`}
              >
                {statusLabels[proposal.status]}
              </span>
              <h1 className='governance-detail__title'>{proposal.title}</h1>
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
              </p>
              {isSeeder && (
                <div className='governance-detail__seeder-actions'>
                  {!proposal.archived_at && proposal.status !== 'delivered' && (
                    <>
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
                      <button
                        type='button'
                        className='governance-detail__action-btn governance-detail__action-btn--deliver'
                        onClick={handleDeliverOpen}
                      >
                        <FormattedMessage
                          id='governance.action.deliver'
                          defaultMessage='Mark as delivered'
                        />
                      </button>
                    </>
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

            <nav className='governance-detail__tabs'>
              <button
                className={`governance-detail__tab ${activeTab === 'proposal' ? 'active' : ''}`}
                onClick={handleProposalTab}
              >
                <FormattedMessage
                  id='governance.tab.proposal'
                  defaultMessage='Seed'
                />
              </button>
              <button
                className={`governance-detail__tab ${activeTab === 'kontribute' ? 'active' : ''}`}
                onClick={handleKontributeTab}
              >
                <FormattedMessage
                  id='governance.tab.kontribute'
                  defaultMessage='Kontribute'
                />
              </button>
            </nav>

            <div className='governance-detail__content'>
              {activeTab === 'proposal' && (
                <TabProposal proposal={proposal} onVoteUpdate={onVoteUpdate} />
              )}
              {activeTab === 'kontribute' && (
                <TabKontribute proposalId={proposal.id} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
