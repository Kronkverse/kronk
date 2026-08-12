import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { Helmet } from 'react-helmet';
import { useHistory, useLocation } from 'react-router-dom';

import api from 'mastodon/api';
import { apiGetKommonsNodes } from 'mastodon/api/kommons_nodes';
import { Stage } from 'mastodon/components/stage';
import { FeedDrum } from 'mastodon/features/home_timeline/components/feed_drum';
import { Lattice } from 'mastodon/features/kommons_lattice/components/lattice';
import { fromApiNodes } from 'mastodon/features/kommons_tree/data/nodes';
import type { KommonsNode } from 'mastodon/features/kommons_tree/data/nodes';

import { KoinGlance } from './components/koin_glance';
import type { Wallet } from './components/koin_glance';
import { ProposalCard } from './components/proposal_card';
import { KommonsComposer } from './kommons_composer';
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
// bare `/hub/kommons` = the default face (`directory`); the rest map to
// `/hub/kommons/<key>`. Kept in sync with the manifest — a mismatch
// silently falls through to `directory`.
const FACE_KEYS = [
  'directory',
  'open',
  'involved',
  'drafts',
  'completed',
] as const;
type FaceKey = (typeof FACE_KEYS)[number];

// Every face other than `directory` is a proposal filter. Narrow type
// used by fetchProposals + the per-face empty-message map.
type FilterKey = Exclude<FaceKey, 'directory'>;

const faceFromPath = (pathname: string): FaceKey => {
  const match = /^\/hub\/kommons\/([a-z]+)/.exec(pathname);
  const seg = match?.[1];
  return seg && (FACE_KEYS as readonly string[]).includes(seg)
    ? (seg as FaceKey)
    : 'directory';
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

const directoryMessages = defineMessages({
  loading: {
    id: 'governance.directory.loading',
    defaultMessage: 'Loading the Directory…',
  },
  loadError: {
    id: 'governance.directory.load_error',
    defaultMessage: "Couldn't load the Directory. Refresh to try again.",
  },
});

// Renders into the Frame's Stage. The title + rotating view faces are
// Frame-provided via <AutoSpaceHeader> reading `header.rotator: true`
// from kommons.yaml — this page renders neither its own `<h1>` nor a
// bespoke tab row. See docs/kronk_frame.md and Standard L11.
//
// One Kommons component owns every face (Directory + the four proposal
// filters) so the FeedDrum can rotate between them without a route
// swap unmounting the drum mid-turn. Directory face embeds the shared
// `<Lattice>` component; proposal faces render the ProposalCard list.
interface KommonsProps {
  multiColumn?: boolean;
  // When true (the `/hub/kommons/composer` or legacy
  // `/hub/kommons/propose` route), the `<KommonsComposer>` overlay
  // opens automatically on mount. The picker (`/hub/kommons/pick`)
  // routes here with the chosen scope via ?space= or ?node= query
  // params, which the composer reads independently.
  autoOpenComposer?: boolean;
}

const Kommons: React.FC<KommonsProps> = ({ autoOpenComposer }) => {
  const intl = useIntl();
  const history = useHistory();
  const { pathname } = useLocation();
  const face = faceFromPath(pathname);
  const isProposalFace = face !== 'directory';
  const [composerOpen, setComposerOpen] = useState(Boolean(autoOpenComposer));

  const closeComposer = useCallback(() => {
    setComposerOpen(false);
    // If we arrived via `/composer` or the legacy `/propose`, drop
    // back to the bare Kommons directory so the composer doesn't
    // reopen on refresh. Query params (?space, ?node) drop too —
    // opening the composer again is a fresh scope selection.
    if (autoOpenComposer) history.replace('/hub/kommons');
  }, [autoOpenComposer, history]);

  const handleCreated = useCallback(
    (proposalId: string) => {
      setComposerOpen(false);
      history.push(`/hub/kommons/p/${proposalId}`);
    },
    [history],
  );

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [sort, setSort] = useState<SortType>('most_backed');
  const [loading, setLoading] = useState(false);

  // Directory face — lazy-loaded on first entry, cached after.
  const [directoryNodes, setDirectoryNodes] = useState<KommonsNode[] | null>(
    null,
  );
  const [directoryError, setDirectoryError] = useState(false);

  const fetchProposals = useCallback(
    async (filter: FilterKey) => {
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
    },
    [sort],
  );

  useEffect(() => {
    // Narrow the FaceKey union to FilterKey via the boolean guard
    // (isProposalFace === face !== 'directory').
    if (face !== 'directory') void fetchProposals(face);
  }, [face, fetchProposals]);

  useEffect(() => {
    if (face !== 'directory' || directoryNodes !== null) return;
    let cancelled = false;
    apiGetKommonsNodes()
      .then((res) => {
        if (!cancelled) setDirectoryNodes(fromApiNodes(res.nodes));
        return undefined;
      })
      .catch(() => {
        if (!cancelled) setDirectoryError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [face, directoryNodes]);

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
  }, []);

  const handleSortChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setSort(e.target.value as SortType);
    },
    [],
  );

  // Opening a proposal navigates to its own route (`/hub/kommons/p/:id`)
  // so `proposal_page` renders it in a standalone Stage. Same as any
  // deep-link — and the Frame's SpaceBadge on that route returns to
  // `/hub/kommons`. Was previously a state-only overlay with a local
  // back button, which competed with SpaceBadge (Tal 2026-08-12).
  const handleSelectProposal = useCallback(
    (id: string) => {
      history.push(`/hub/kommons/p/${id}`);
    },
    [history],
  );

  // FeedDrum turns the content on scope change, same quarter-turn
  // `/home` uses. Kommons rotates via the AutoSpaceHeader above; this
  // handler is what the drum invokes when a swipe on the content
  // itself asks for the next face. Bare `/hub/kommons` is the default
  // (`directory`); others carry the segment.
  const handleScopeChange = useCallback(
    (next: string) => {
      history.push(
        next === 'directory' ? '/hub/kommons' : `/hub/kommons/${next}`,
      );
    },
    [history],
  );

  return (
    <Stage label={intl.formatMessage(messages.title)}>
      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
      </Helmet>

      <div className='kommons-page'>
        {/* Single toolbar row — count + sort only apply to
            proposal faces; Koin glance stays visible on every
            face because it identifies the caller's stake in the
            surface. */}
        <div className='kommons-page__toolbar'>
          <span className='kommons-page__count'>
            {isProposalFace &&
              !loading &&
              intl.formatMessage(messages.count, {
                count: proposals.length,
              })}
          </span>
          <span className='kommons-page__toolbar-grow' />
          {wallet && <KoinGlance wallet={wallet} />}
          {isProposalFace && (
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
          )}
        </div>

        {/* FeedDrum turns the content on scope change — same
                quarter-turn `/home` + Albutts use, so the top of the
                spindle (AutoSpaceHeader rotator) and the bottom
                (this content) read as one solid object. Loading /
                empty states live inside the drum so it stays mounted
                across scope changes (snapshot cloning needs a live
                DOM). Directory + proposal faces share the drum so
                the Directory → Open turn plays too. */}
        <FeedDrum
          reach={face}
          order={[...FACE_KEYS]}
          onScopeChange={handleScopeChange}
        >
          {face === 'directory' ? (
            directoryError ? (
              <div className='kommons-page__empty'>
                {intl.formatMessage(directoryMessages.loadError)}
              </div>
            ) : directoryNodes === null ? (
              <div className='kommons-page__empty'>
                {intl.formatMessage(directoryMessages.loading)}
              </div>
            ) : (
              <div className='kommons-lattice'>
                <Lattice nodes={directoryNodes} />
              </div>
            )
          ) : loading && proposals.length === 0 ? (
            <div className='kommons-page__empty'>
              <FormattedMessage
                id='governance.loading'
                defaultMessage='Loading proposals…'
              />
            </div>
          ) : proposals.length === 0 ? (
            <div className='kommons-page__empty'>
              {intl.formatMessage(emptyMessages[face])}
            </div>
          ) : (
            <div className='kommons-page__list'>
              {proposals.map((proposal) => (
                <ProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  onSelect={handleSelectProposal}
                />
              ))}
            </div>
          )}
        </FeedDrum>
      </div>

      {composerOpen && (
        <KommonsComposer onCancel={closeComposer} onCreated={handleCreated} />
      )}
    </Stage>
  );
};

export { Kommons };
