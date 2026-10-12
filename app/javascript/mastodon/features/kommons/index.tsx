import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { Helmet } from 'react-helmet';
import { useHistory, useLocation } from 'react-router-dom';

import { showAlert } from 'mastodon/actions/alerts';
import api from 'mastodon/api';
import { apiGetKommonsNodes } from 'mastodon/api/kommons_nodes';
import { FeedDrum } from 'mastodon/components/feed_drum';
import type { LocationState } from 'mastodon/components/router';
import { Stage } from 'mastodon/components/stage';
import { Lattice } from 'mastodon/features/kommons_lattice/components/lattice';
import { fromApiNodes } from 'mastodon/features/kommons_tree/data/nodes';
import type { KommonsNode } from 'mastodon/features/kommons_tree/data/nodes';
import { useAppDispatch } from 'mastodon/store';

import { ProposalCard } from './components/proposal_card';
import { KommonsComposer } from './kommons_composer';
import type { Proposal } from './types';

const messages = defineMessages({
  title: { id: 'governance.title', defaultMessage: '₭ommons' },
  opened: {
    id: 'governance.proposal_opened',
    defaultMessage: 'Your proposal is open. Find it in Kommons.',
  },
});

// Manifest `views:` are the source of truth for face order (see
// kommons.yaml). This keys off the URL segment the Frame produces:
// bare `/hub/kommons` = the default face (`open`, the proposal list, since
// 2026-10-12); the rest map to `/hub/kommons/<key>`. Kept in sync with the
// manifest — a mismatch silently falls through to `open`.
const FACE_KEYS = [
  'open',
  'involved',
  'drafts',
  'closed',
  'directory',
] as const;
const DEFAULT_FACE: FaceKey = 'open';
type FaceKey = (typeof FACE_KEYS)[number];

// Every face other than `directory` is a proposal filter. Narrow type
// used by fetchProposals + the per-face empty-message map.
type FilterKey = Exclude<FaceKey, 'directory'>;

const faceFromPath = (pathname: string): FaceKey => {
  const match = /^\/hub\/kommons\/([a-z]+)/.exec(pathname);
  const seg = match?.[1];
  return seg && (FACE_KEYS as readonly string[]).includes(seg)
    ? (seg as FaceKey)
    : DEFAULT_FACE;
};

const emptyMessages = defineMessages({
  open: {
    id: 'governance.empty.open',
    defaultMessage: 'No open proposals yet.',
  },
  closed: {
    id: 'governance.empty.closed',
    defaultMessage: 'Nothing has been closed yet.',
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
// bespoke tab row. See docs/design.md (Frame) and Standard L11.
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
  const dispatch = useAppDispatch();
  const { pathname, state } = useLocation<LocationState>();
  // The page the composer was opened from, when the Ж menu opened it from
  // another space. Closing the composer, either way, goes back there.
  const returnTo = state?.returnTo;
  const face = faceFromPath(pathname);
  const [composerOpen, setComposerOpen] = useState(Boolean(autoOpenComposer));
  // Opening the composer is a prop change, not a mount. Tapping "New album"
  // in the Ж menu while already in the space swaps which <Route> matches, but
  // the component underneath is the same type in the same slot — so React
  // updates it in place and a `useState` initialiser never runs a second
  // time. Seeding the state from the prop worked only when the composer URL
  // was where you arrived, which is why this looked fine from a cold load and
  // did nothing from the menu.
  useEffect(() => {
    if (autoOpenComposer) setComposerOpen(true);
  }, [autoOpenComposer]);

  const closeComposer = useCallback(() => {
    setComposerOpen(false);
    // If we arrived via `/composer` or the legacy `/propose`, drop
    // back to the bare Kommons page so the composer doesn't
    // reopen on refresh. Query params (?space, ?node) drop too —
    // opening the composer again is a fresh scope selection.
    if (returnTo) history.replace(returnTo);
    else if (autoOpenComposer) history.replace('/hub/kommons');
  }, [autoOpenComposer, history, returnTo]);

  const handleCreated = useCallback(
    (proposalId: string) => {
      setComposerOpen(false);
      if (returnTo) {
        // Back to the album, the listing, wherever the idea came up; the
        // proposal itself is in Kommons when they want it.
        history.replace(returnTo);
        dispatch(showAlert({ message: messages.opened }));
        return;
      }
      history.push(`/hub/kommons/p/${proposalId}`);
    },
    [dispatch, history, returnTo],
  );

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(false);

  // Directory face — lazy-loaded on first entry, cached after.
  const [directoryNodes, setDirectoryNodes] = useState<KommonsNode[] | null>(
    null,
  );
  const [directoryError, setDirectoryError] = useState(false);

  const fetchProposals = useCallback(async (filter: FilterKey) => {
    setLoading(true);
    try {
      // Server default order: most backed.
      const res = await api().get('/api/v1/proposals', {
        params: { filter },
      });
      setProposals(res.data as Proposal[]);
    } catch (err) {
      console.error('Failed to fetch proposals:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Narrow the FaceKey union to FilterKey.
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

  // Opening a proposal navigates to its own route (`/hub/kommons/p/:id`)
  // so `proposal_page` renders it in a standalone Stage. Same as any
  // deep-link. The Frame's SpaceBadge on that route returns to the face it
  // was opened from (`backTo`), not to the Directory (Tal 2026-10-12). Was
  // previously a state-only overlay with a local back button, which
  // competed with SpaceBadge (Tal 2026-08-12).
  const handleSelectProposal = useCallback(
    (id: string) => {
      history.push({
        pathname: `/hub/kommons/p/${id}`,
        state: { backTo: pathname },
      });
    },
    [history, pathname],
  );

  // FeedDrum turns the content on scope change, same quarter-turn
  // `/home` uses. Kommons rotates via the AutoSpaceHeader above; this
  // handler is what the drum invokes when a swipe on the content
  // itself asks for the next face. Bare `/hub/kommons` is the default
  // (`open`); others carry the segment.
  const handleScopeChange = useCallback(
    (next: string) => {
      history.push(
        next === DEFAULT_FACE ? '/hub/kommons' : `/hub/kommons/${next}`,
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
        {/* No toolbar between the header and the tiles (Tal
            2026-10-10): the count, Koin glance and sort menu were noise
            between the face and its proposals. Order is the server
            default, most backed. The Koin balance gets a new home next. */}
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
