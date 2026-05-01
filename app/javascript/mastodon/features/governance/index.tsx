import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { Helmet } from 'react-helmet';

import AddIcon from '@/material-icons/400-24px/add.svg?react';
import GavelIcon from '@/material-icons/400-24px/gavel.svg?react';
import api from 'mastodon/api';
import Column from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { Icon } from 'mastodon/components/icon';

import { CreateProposalForm } from './components/create_proposal_form';
import { ProposalCard } from './components/proposal_card';
import { ProposalDetail } from './components/proposal_detail';

const messages = defineMessages({
  title: { id: 'governance.title', defaultMessage: '₭ommons' },
});

export interface Proposal {
  id: string;
  title: string;
  body: string;
  status: 'open' | 'vetoed' | 'delivered' | 'in_progress';
  proposal_type: 'small' | 'medium' | 'large';
  categories: string[];
  discussion_status_id: string | null;
  opens_at: string | null;
  outcome_notes: string | null;
  support_count: number;
  veto_count: number;
  participation_count: number;
  created_at: string;
  current_vote: {
    position: string;
    title: string | null;
    statement: string | null;
  } | null;
  vote_summary: { agree: number; abstain: number; block: number };
  task_summary: { open: number; in_progress: number; done: number };
  budget_total: number;
  created_by_account: {
    id: string;
    username: string;
    display_name: string;
    avatar: string;
  };
  voters: {
    id: string;
    position: 'agree' | 'abstain' | 'block';
    title: string | null;
    statement: string | null;
    created_at: string;
    account: {
      id: string;
      username: string;
      display_name: string;
      avatar: string;
    };
  }[];
  challenges: {
    id: string;
    title: string | null;
    statement: string | null;
    account: {
      id: string;
      username: string;
      display_name: string;
      avatar: string;
    };
    conditions: {
      id: string;
      text: string;
      met: boolean;
      met_at: string | null;
      responses: {
        id: string;
        body: string;
        created_at: string;
        account: {
          id: string;
          username: string;
          display_name: string;
          avatar: string;
        };
      }[];
    }[];
  }[];
}

type FilterType = 'open' | 'vetoed' | 'delivered' | 'in_progress';

const Governance: React.FC<{ multiColumn?: boolean }> = ({ multiColumn }) => {
  const intl = useIntl();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [filter, _setFilter] = useState<FilterType>('open');
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

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

  const handleProposalCreated = useCallback((proposal: Proposal) => {
    setProposals((prev) => [proposal, ...prev]);
    setShowForm(false);
    setSelectedId(proposal.id);
  }, []);

  const handleVoteUpdate = useCallback((updated: Proposal) => {
    setProposals((prev) =>
      prev.map((p) => (p.id === updated.id ? updated : p)),
    );
  }, []);

  const handleBack = useCallback(() => {
    setSelectedId(null);
  }, []);

  const handleArchived = useCallback((updated: Proposal) => {
    setProposals((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setSelectedId(null);
  }, []);

  const handleShowForm = useCallback(() => {
    setShowForm(true);
  }, []);

  const handleHideForm = useCallback(() => {
    setShowForm(false);
  }, []);

  const handleSelectProposal = useCallback((id: string) => {
    setSelectedId(id);
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
            onBack={handleBack}
            onVoteUpdate={handleVoteUpdate}
            onArchived={handleArchived}
          />
        ) : showForm ? (
          <div className='governance-plant'>
            <button className='governance-plant__back' onClick={handleHideForm}>
              <FormattedMessage id='governance.back_to_seeds' defaultMessage='← All seeds' />
            </button>
            <CreateProposalForm
              onCreated={handleProposalCreated}
              onCancel={handleHideForm}
            />
          </div>
        ) : (
          <>
            <section className='governance-page__hero'>
              <h1 className='governance-page__hero-title'>
                <FormattedMessage
                  id='governance.hero_title'
                  defaultMessage='₭ommons'
                />
              </h1>
              <p className='governance-page__hero-intro'>
                <FormattedMessage
                  id='governance.hero_intro'
                  defaultMessage="₭ommons is where we build Kronk together. Plant seeds, support what matters most, let's grow Kronk as we want it."
                />
              </p>
            </section>

            <div className='governance-page__header'>
              <button
                className='governance-page__new-btn'
                onClick={handleShowForm}
              >
                <Icon id='add' icon={AddIcon} />
                <FormattedMessage
                  id='governance.new_proposal'
                  defaultMessage='Plant a seed'
                />
              </button>
            </div>

            {!loading && proposals.length > 0 && (
              <p className='governance-page__result-count'>
                <FormattedMessage
                  id='governance.result_count'
                  defaultMessage='{count, plural, one {# seed} other {# seeds}}'
                  values={{ count: proposals.length }}
                />
              </p>
            )}

            {loading && proposals.length === 0 && (
              <div className='governance-page__empty'>
                <FormattedMessage
                  id='governance.loading'
                  defaultMessage='Loading seeds…'
                />
              </div>
            )}

            {!loading && proposals.length === 0 && (
              <div className='governance-page__empty'>
                <FormattedMessage
                  id='governance.empty'
                  defaultMessage='No seeds yet. Be the first to plant one.'
                />
              </div>
            )}

            <div className='governance-page__list'>
              {[...proposals.filter((p) => !p.archived_at), ...proposals.filter((p) => p.archived_at)].map((proposal) => (
                <ProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  onSelect={handleSelectProposal}
                  onVoteUpdate={handleVoteUpdate}
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
