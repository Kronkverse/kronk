import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';

import AddIcon from '@/material-icons/400-24px/add.svg?react';
import ListAltIcon from '@/material-icons/400-24px/list_alt.svg?react';
import api from 'mastodon/api';
import { Column } from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { Icon } from 'mastodon/components/icon';
import { useKorner } from 'mastodon/hooks/useKorner';
import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';

import { ProposalCard } from './components/proposal_card';
import { ProposalDetail } from './components/proposal_detail';
import type { Proposal } from './types';

const messages = defineMessages({
  title: { id: 'governance.title', defaultMessage: '₭ommons' },
});

type FilterType = 'open' | 'delivered' | 'completed' | 'annulled';

const Governance: React.FC<{ multiColumn?: boolean }> = ({ multiColumn }) => {
  const korner = useKorner('kommons');
  const kornerIcon = useKornerIcon('kommons');
  const intl = useIntl();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [filter, _setFilter] = useState<FilterType>('open');
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  const handleVoteUpdate = useCallback((updated: Proposal) => {
    setProposals((prev) =>
      prev.map((p) => (p.id === updated.id ? updated : p)),
    );
  }, []);

  const handleBack = useCallback(() => {
    setSelectedId(null);
  }, []);

  const handleArchived = useCallback((updated: Proposal) => {
    setProposals((prev) =>
      prev.map((p) => (p.id === updated.id ? updated : p)),
    );
    setSelectedId(null);
  }, []);

  const handleSelectProposal = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const selected = proposals.find((p) => p.id === selectedId) ?? null;

  return (
    <Column>
      <ColumnHeader
        title={korner?.name ?? 'Kommons'}
        icon='kommons'
        iconComponent={kornerIcon}
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
              <Link to='/hub/kommons/pick' className='governance-page__new-btn'>
                <Icon id='add' icon={AddIcon} />
                <FormattedMessage
                  id='governance.new_proposal'
                  defaultMessage='Plant a seed'
                />
              </Link>
              <Link
                to='/hub/kommons/skeleton'
                className='governance-page__tree-link'
              >
                <Icon id='list_alt' icon={ListAltIcon} />
                <FormattedMessage
                  id='governance.browse_by_page'
                  defaultMessage='Browse by page'
                />
              </Link>
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
              {[
                ...proposals.filter((p) => !p.archived_at),
                ...proposals.filter((p) => p.archived_at),
              ].map((proposal) => (
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

export { Governance };
