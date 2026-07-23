import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';

import ListAltIcon from '@/material-icons/400-24px/list_alt.svg?react';
import api from 'mastodon/api';
import { Column } from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { Icon } from 'mastodon/components/icon';
import { useKorner } from 'mastodon/hooks/useKorner';
import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';

import { KoinWallet } from './components/koin_wallet';
import type { Wallet } from './components/koin_wallet';
import { ProposalCard } from './components/proposal_card';
import { ProposalDetail } from './components/proposal_detail';
import type { Proposal } from './types';

const messages = defineMessages({
  title: { id: 'governance.title', defaultMessage: '₭ommons' },
  count: {
    id: 'governance.count',
    defaultMessage: '{count, plural, one {# proposal} other {# proposals}}',
  },
});

// Only the three states worth browsing as a record. Delivered isn't a tab: a
// proposer's delivered proposals already surface at the top of Open.
const FILTER_ORDER = ['open', 'completed', 'annulled'] as const;
type FilterType = (typeof FILTER_ORDER)[number];

const SORT_ORDER = ['most_backed', 'newest'] as const;
type SortType = (typeof SORT_ORDER)[number];

const filterMessages = defineMessages({
  open: { id: 'governance.filter.open', defaultMessage: 'Open' },
  completed: { id: 'governance.filter.completed', defaultMessage: 'Completed' },
  annulled: { id: 'governance.filter.annulled', defaultMessage: 'Annulled' },
});

const headingMessages = defineMessages({
  open: { id: 'governance.heading.open', defaultMessage: 'Open proposals' },
  completed: {
    id: 'governance.heading.completed',
    defaultMessage: 'Completed proposals',
  },
  annulled: {
    id: 'governance.heading.annulled',
    defaultMessage: 'Annulled proposals',
  },
});

const sortMessages = defineMessages({
  most_backed: {
    id: 'governance.sort.most_backed',
    defaultMessage: 'Most backed',
  },
  newest: { id: 'governance.sort.newest', defaultMessage: 'Newest' },
});

const Governance: React.FC<{ multiColumn?: boolean }> = ({ multiColumn }) => {
  const korner = useKorner('kommons');
  const kornerIcon = useKornerIcon('kommons');
  const intl = useIntl();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [filter, setFilter] = useState<FilterType>('open');
  const [sort, setSort] = useState<SortType>('most_backed');
  const [lens, setLens] = useState<'all' | 'mine'>('all');
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [balanceRefresh, setBalanceRefresh] = useState(0);

  const fetchProposals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api().get('/api/v1/proposals', {
        params: { filter, sort },
      });
      setProposals(res.data as Proposal[]);
    } catch (err) {
      console.error('Failed to fetch proposals:', err);
    } finally {
      setLoading(false);
    }
  }, [filter, sort]);

  useEffect(() => {
    void fetchProposals();
  }, [fetchProposals]);

  useEffect(() => {
    let active = true;
    api()
      .get<Wallet>('/api/v1/token_balance')
      .then((res) => {
        if (active) setWallet(res.data);
        return undefined;
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [balanceRefresh]);

  const handleVoteUpdate = useCallback((updated: Proposal) => {
    setProposals((prev) =>
      prev.map((p) => (p.id === updated.id ? updated : p)),
    );
    // Backing / completing moves Koin — nudge the wallet to refetch.
    setBalanceRefresh((n) => n + 1);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedId(null);
  }, []);

  const handleFilterClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      setFilter(e.currentTarget.dataset.filter as FilterType);
      setSelectedId(null);
    },
    [],
  );

  const handleSortChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setSort(e.target.value as SortType);
    },
    [],
  );

  const handleSelectProposal = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const handleToggleBacked = useCallback(() => {
    setLens((l) => (l === 'mine' ? 'all' : 'mine'));
    setSelectedId(null);
  }, []);

  const selected = proposals.find((p) => p.id === selectedId) ?? null;
  const shown =
    lens === 'mine'
      ? proposals.filter((p) => p.backing.my_stake > 0)
      : proposals;
  const maxBacking = Math.max(0, ...shown.map((p) => p.backing.total));

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
          />
        ) : (
          <>
            {wallet && (
              <div className='kommons-wallet-row'>
                <KoinWallet wallet={wallet} />
                <button
                  type='button'
                  className={`kommons-backed${lens === 'mine' ? ' active' : ''}`}
                  onClick={handleToggleBacked}
                  aria-pressed={lens === 'mine'}
                >
                  <span className='kommons-backed__num'>
                    {wallet.staked_seeds}
                  </span>
                  <span className='kommons-backed__label'>
                    <FormattedMessage
                      id='governance.backed'
                      defaultMessage='Backed'
                    />
                  </span>
                </button>
              </div>
            )}

            <div className='governance-page__head'>
              <div className='governance-page__head-text'>
                <h1 className='governance-page__head-title'>
                  {intl.formatMessage(headingMessages[filter])}
                </h1>
                {!loading && (
                  <span className='governance-page__head-count'>
                    {intl.formatMessage(messages.count, {
                      count: shown.length,
                    })}
                  </span>
                )}
              </div>
              <div className='governance-page__head-actions'>
                <Link
                  to='/hub/kommons/lattice'
                  className='governance-page__browse'
                >
                  <Icon id='list_alt' icon={ListAltIcon} />
                  <FormattedMessage
                    id='governance.browse_by_page'
                    defaultMessage='Browse by page'
                  />
                </Link>
              </div>
            </div>

            <div className='governance-page__strip'>
              <div className='governance-page__filters' role='tablist'>
                {FILTER_ORDER.map((key) => (
                  <button
                    key={key}
                    type='button'
                    role='tab'
                    aria-selected={filter === key}
                    data-filter={key}
                    className={`governance-page__filter-btn${filter === key ? ' active' : ''}`}
                    onClick={handleFilterClick}
                  >
                    {intl.formatMessage(filterMessages[key])}
                  </button>
                ))}
              </div>
              <span className='governance-page__strip-grow' />
              <select
                className='governance-page__sort'
                value={sort}
                onChange={handleSortChange}
                aria-label={intl.formatMessage(sortMessages.most_backed)}
              >
                {SORT_ORDER.map((key) => (
                  <option key={key} value={key}>
                    {intl.formatMessage(sortMessages[key])}
                  </option>
                ))}
              </select>
            </div>

            {loading && proposals.length === 0 && (
              <div className='governance-page__empty'>
                <FormattedMessage
                  id='governance.loading'
                  defaultMessage='Loading proposals…'
                />
              </div>
            )}

            {!loading && shown.length === 0 && (
              <div className='governance-page__empty'>
                {lens === 'mine' ? (
                  <FormattedMessage
                    id='governance.empty_backed'
                    defaultMessage="You haven't backed anything here yet."
                  />
                ) : filter === 'open' ? (
                  <FormattedMessage
                    id='governance.empty'
                    defaultMessage='No open proposals yet.'
                  />
                ) : (
                  <FormattedMessage
                    id='governance.empty_filtered'
                    defaultMessage='Nothing here yet.'
                  />
                )}
              </div>
            )}

            <div className='governance-page__list'>
              {shown.map((proposal) => (
                <ProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  maxBacking={maxBacking}
                  onSelect={handleSelectProposal}
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
