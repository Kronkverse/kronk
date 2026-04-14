import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { Helmet } from 'react-helmet';

import GavelIcon from '@/material-icons/400-24px/gavel.svg?react';
import AddIcon from '@/material-icons/400-24px/add.svg?react';

import Column from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { Icon } from 'mastodon/components/icon';
import api from 'mastodon/api';
import { me } from 'mastodon/initial_state';
import { useAppSelector } from 'mastodon/store';

import { CreateProposalForm } from './components/create_proposal_form';
import { ProposalCard } from './components/proposal_card';
import { ProposalDetail } from './components/proposal_detail';

const messages = defineMessages({
  title: { id: 'governance.title', defaultMessage: 'Commons' },
});

export type Proposal = {
  id: string;
  title: string;
  body: string;
  status: string;
  decision_type: string;
  opens_at: string | null;
  closes_at: string | null;
  outcome: string | null;
  outcome_notes: string | null;
  participation_count: number;
  created_at: string;
  current_vote: { position: string; statement: string | null } | null;
  vote_summary: { agree: number; abstain: number; block: number };
  task_summary: { open: number; in_progress: number; done: number };
  budget_total: number;
  created_by_account: { id: string; username: string; display_name: string; avatar: string };
};

type FilterType = 'active' | 'closed';

const Governance: React.FC<{ multiColumn?: boolean }> = ({ multiColumn }) => {
  const intl = useIntl();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [filter, setFilter] = useState<FilterType>('active');
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const accountRole = useAppSelector((state) =>
    me ? (state.accounts.getIn([me, 'role', 'name']) as string | undefined) : undefined,
  );
  const canManage = accountRole === 'Admin' || accountRole === 'Moderator';

  const fetchProposals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api().get('/api/v1/proposals', { params: { filter } });
      setProposals(res.data as Proposal[]);
    } catch (err) {
      console.error('Failed to fetch proposals:', err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void fetchProposals();
  }, [fetchProposals]);

  const handleProposalCreated = useCallback(
    (proposal: Proposal) => {
      setProposals((prev) => [proposal, ...prev]);
      setShowForm(false);
      setSelectedId(proposal.id);
    },
    [],
  );

  const handleVoteUpdate = useCallback((updated: Proposal) => {
    setProposals((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }, []);

  const selected = proposals.find((p) => p.id === selectedId) ?? null;

  return (
    <Column>
      <ColumnHeader
        title={intl.formatMessage(messages.title)}
        icon='gavel'
        iconComponent={GavelIcon}
        multiColumn={multiColumn}
      />

      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
      </Helmet>

      <div className='governance-page'>
        {selectedId && selected ? (
          <ProposalDetail
            proposal={selected}
            onBack={() => setSelectedId(null)}
            onVoteUpdate={handleVoteUpdate}
          />
        ) : (
          <>
            <div className='governance-page__header'>
              <div className='governance-page__filters'>
                <button
                  className={`governance-page__filter-btn ${filter === 'active' ? 'active' : ''}`}
                  onClick={() => setFilter('active')}
                >
                  <FormattedMessage id='governance.filter.active' defaultMessage='Active' />
                </button>
                <button
                  className={`governance-page__filter-btn ${filter === 'closed' ? 'active' : ''}`}
                  onClick={() => setFilter('closed')}
                >
                  <FormattedMessage id='governance.filter.closed' defaultMessage='Archive' />
                </button>
              </div>

              {canManage && !showForm && (
                <button className='governance-page__new-btn' onClick={() => setShowForm(true)}>
                  <Icon id='add' icon={AddIcon} />
                  <FormattedMessage id='governance.new_proposal' defaultMessage='New Proposal' />
                </button>
              )}
            </div>

            {showForm && (
              <CreateProposalForm
                onCreated={handleProposalCreated}
                onCancel={() => setShowForm(false)}
              />
            )}

            {loading && proposals.length === 0 && (
              <div className='governance-page__empty'>
                <FormattedMessage id='governance.loading' defaultMessage='Loading proposals…' />
              </div>
            )}

            {!loading && proposals.length === 0 && (
              <div className='governance-page__empty'>
                <FormattedMessage
                  id='governance.empty'
                  defaultMessage='No proposals yet. Check back soon.'
                />
              </div>
            )}

            <div className='governance-page__list'>
              {proposals.map((proposal) => (
                <ProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  onClick={() => setSelectedId(proposal.id)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </Column>
  );
};

export default Governance;
