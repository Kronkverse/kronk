import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { Helmet } from 'react-helmet';
import { useLocation } from 'react-router-dom';

import api from 'mastodon/api';
import { Stage } from 'mastodon/components/stage';

import { KoinGlance } from './components/koin_glance';
import type { Wallet } from './components/koin_glance';
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

// Manifest `views:` are the source of truth for face order (see
// kommons.yaml). This keys off the URL segment the Frame produces:
// bare `/hub/kommons` = the default face (`open`); the rest map to
// `/hub/kommons/<key>`. Kept in sync with the manifest — a mismatch
// silently falls through to `open`.
const FILTER_KEYS = ['open', 'completed', 'drafts', 'involved'] as const;
type FilterType = (typeof FILTER_KEYS)[number];

const filterFromPath = (pathname: string): FilterType => {
  const match = /^\/hub\/kommons\/([a-z]+)/.exec(pathname);
  const seg = match?.[1];
  return seg && (FILTER_KEYS as readonly string[]).includes(seg)
    ? (seg as FilterType)
    : 'open';
};

const SORT_ORDER = ['most_backed', 'newest'] as const;
type SortType = (typeof SORT_ORDER)[number];

const sortMessages = defineMessages({
  most_backed: {
    id: 'governance.sort.most_backed',
    defaultMessage: 'Most backed',
  },
  newest: { id: 'governance.sort.newest', defaultMessage: 'Newest' },
});

const emptyMessages = defineMessages({
  open: {
    id: 'governance.empty.open',
    defaultMessage: 'No open proposals yet.',
  },
  completed: {
    id: 'governance.empty.completed',
    defaultMessage: 'Nothing has been completed yet.',
  },
  drafts: {
    id: 'governance.empty.drafts',
    defaultMessage: 'Drafts land here once the writer stage ships.',
  },
  involved: {
    id: 'governance.empty.involved',
    defaultMessage:
      "You haven't voted, backed, or commented on any proposals yet.",
  },
});

// Renders into the Frame's Stage. The title + rotating view faces are
// Frame-provided via <AutoSpaceHeader> reading `header.rotator: true`
// from kommons.yaml — this page renders neither its own `<h1>` nor a
// bespoke tab row. See docs/kronk_frame.md and Standard L11.
const Kommons: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();
  const { pathname } = useLocation();
  const filter = filterFromPath(pathname);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [sort, setSort] = useState<SortType>('most_backed');
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

  // Selecting into a proposal detail is a per-face concern; the URL
  // face change should clear any open detail so the caller lands on
  // the new face's list, not on an unrelated proposal from the old
  // face still open in state.
  useEffect(() => {
    setSelectedId(null);
  }, [filter]);

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

  const handleSortChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setSort(e.target.value as SortType);
    },
    [],
  );

  const handleSelectProposal = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const selected = proposals.find((p) => p.id === selectedId) ?? null;

  return (
    <Stage label={intl.formatMessage(messages.title)}>
      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
      </Helmet>

      <div className='kommons-page'>
        {selectedId && selected ? (
          <ProposalDetail
            proposal={selected}
            onBack={handleBack}
            onVoteUpdate={handleVoteUpdate}
          />
        ) : (
          <>
            {/* Single toolbar row — count on the left, Koin glance +
                sort on the right. No local `<h1>`, no bespoke tab row:
                the Frame's `<AutoSpaceHeader>` (rotator) is the title,
                and the rotator IS the filter switcher. */}
            <div className='kommons-page__toolbar'>
              <span className='kommons-page__count'>
                {!loading &&
                  intl.formatMessage(messages.count, {
                    count: proposals.length,
                  })}
              </span>
              <span className='kommons-page__toolbar-grow' />
              {wallet && <KoinGlance wallet={wallet} />}
              <select
                className='kommons-page__sort'
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
              <div className='kommons-page__empty'>
                <FormattedMessage
                  id='governance.loading'
                  defaultMessage='Loading proposals…'
                />
              </div>
            )}

            {!loading && proposals.length === 0 && (
              <div className='kommons-page__empty'>
                {intl.formatMessage(emptyMessages[filter])}
              </div>
            )}

            <div className='kommons-page__list'>
              {proposals.map((proposal) => (
                <ProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  onSelect={handleSelectProposal}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </Stage>
  );
};

export { Kommons };
