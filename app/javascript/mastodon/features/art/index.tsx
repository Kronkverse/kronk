import { useCallback, useEffect, useRef, useState } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import {
  Route,
  Switch,
  Link,
  useHistory,
  useLocation,
  useRouteMatch,
} from 'react-router-dom';

import { apiGetPiece, apiListPieces } from 'mastodon/api/art';
import type { PiecesScope } from 'mastodon/api/art';
import type { ApiArtPieceJSON } from 'mastodon/api_types/art';
import { Stage } from 'mastodon/components/stage';
import { FeedDrum } from 'mastodon/features/home_timeline/components/feed_drum';
import { useIdentity } from 'mastodon/identity_context';

import { ArtPieceComposer } from './components/art_piece_composer';
import { ArtPieceDetail } from './components/art_piece_detail';

const messages = defineMessages({
  title: { id: 'art.title', defaultMessage: 'Art' },
  loading: { id: 'art.loading', defaultMessage: 'Loading…' },
  emptyAll: {
    id: 'art.empty.all',
    defaultMessage: 'No pieces yet — tap the compose button to post one.',
  },
  emptyMine: {
    id: 'art.empty.mine',
    defaultMessage: "You haven't posted any pieces yet.",
  },
  emptyMates: {
    id: 'art.empty.mates',
    defaultMessage: 'None of your mates have posted a piece yet.',
  },
  photos: {
    id: 'art.photos',
    defaultMessage: '{count, plural, one {# photo} other {# photos}}',
  },
});

// Path segment that follows /hub/art drives which scope face is
// selected. Must stay in sync with `views:` in art.yaml — the manifest
// is the source of truth; the frontend keeps this list for (a) the API
// scope enum and (b) the FeedDrum's rotation order.
const SCOPE_KEYS: PiecesScope[] = ['all', 'mine', 'mates'];

const scopeFromPath = (pathname: string): PiecesScope => {
  const match = /^\/hub\/art\/([a-z]+)$/.exec(pathname);
  const seg = match?.[1];
  return seg && (SCOPE_KEYS as string[]).includes(seg)
    ? (seg as PiecesScope)
    : 'all';
};

const useCurrentScope = (): PiecesScope => {
  const { pathname } = useLocation();
  return scopeFromPath(pathname);
};

// /hub/art — directory of visible pieces, plus /pieces/:id detail
// child route. Modeled on features/albutts.
const Art: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();

  return (
    <Stage label={intl.formatMessage(messages.title)}>
      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
      </Helmet>

      <Switch>
        <Route path='/hub/art/pieces/:id' exact>
          <PieceDetailRoute />
        </Route>
        <Route path='/hub/art/composer' exact>
          <Directory autoOpenComposer />
        </Route>
        {/* Scope segments — one per manifest view other than the
            default `all` (bare /hub/art). Title rotation lives in the
            Frame's `<AutoSpaceHeader>` (manifest opt-in
            `header.rotator: true`); Directory reads the scope from
            the URL so refresh + back + share preserve the view. */}
        <Route path='/hub/art/mine' exact>
          <Directory />
        </Route>
        <Route path='/hub/art/mates' exact>
          <Directory />
        </Route>
        <Route path='/hub/art' exact>
          <Directory />
        </Route>
      </Switch>
    </Stage>
  );
};

// eslint-disable-next-line import/no-default-export
export default Art;

interface DirectoryProps {
  // When true (the /hub/art/composer route), the composer opens
  // automatically on mount. The Ж floating bubble sends the user
  // there via the manifest's `compose.route`.
  autoOpenComposer?: boolean;
}

const Directory: React.FC<DirectoryProps> = ({ autoOpenComposer }) => {
  const intl = useIntl();
  const history = useHistory();
  const { signedIn } = useIdentity();
  const scope = useCurrentScope();
  const [pieces, setPieces] = useState<ApiArtPieceJSON[] | null>(null);
  const [composerOpen, setComposerOpen] = useState(Boolean(autoOpenComposer));

  // Opening the composer is a prop change, not a mount — see the
  // sibling comment in features/albutts/index.tsx.
  useEffect(() => {
    if (autoOpenComposer) setComposerOpen(true);
  }, [autoOpenComposer]);

  const load = useCallback(async () => {
    setPieces(null);
    try {
      setPieces(await apiListPieces(scope));
    } catch {
      setPieces([]);
    }
  }, [scope]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleScopeChange = useCallback(
    (next: string) => {
      history.push(next === 'all' ? '/hub/art' : `/hub/art/${next}`);
    },
    [history],
  );

  const closeComposer = useCallback(() => {
    setComposerOpen(false);
    if (autoOpenComposer) history.replace('/hub/art');
  }, [autoOpenComposer, history]);

  const handleCreated = useCallback(
    (created: ApiArtPieceJSON) => {
      setComposerOpen(false);
      setPieces((prev) => (prev ? [created, ...prev] : [created]));
      history.push(`/hub/art/pieces/${created.id}`);
    },
    [history],
  );

  const emptyMessage = intl.formatMessage(
    scope === 'mine'
      ? messages.emptyMine
      : scope === 'mates'
        ? messages.emptyMates
        : messages.emptyAll,
  );

  // The grid, empty state, and loading state all live inside the drum
  // so it stays mounted across scope changes. Snapshotting requires a
  // live DOM to clone; unmounting the drum mid-turn would abort the
  // animation.
  const gridContent =
    pieces === null ? (
      <p className='space-subtitle'>{intl.formatMessage(messages.loading)}</p>
    ) : pieces.length === 0 ? (
      <p className='space-subtitle art-directory__empty'>{emptyMessage}</p>
    ) : (
      <ul className='art-directory__grid'>
        {pieces.map((p) => (
          <li key={p.id} className='art-directory__cell'>
            <Link to={`/hub/art/pieces/${p.id}`} className='art-card'>
              {p.cover_url ? (
                <img className='art-card__cover' src={p.cover_url} alt='' />
              ) : (
                <div className='art-card__cover art-card__cover--empty' />
              )}
              <div className='art-card__body'>
                <div className='art-card__title'>{p.title}</div>
                <div className='art-card__meta'>
                  {p.kind}
                  {' · '}
                  {intl.formatMessage(messages.photos, {
                    count: p.photo_count,
                  })}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    );

  return (
    <div className='art-directory'>
      {signedIn ? (
        <FeedDrum
          reach={scope}
          order={SCOPE_KEYS}
          onScopeChange={handleScopeChange}
        >
          {gridContent}
        </FeedDrum>
      ) : (
        gridContent
      )}

      {composerOpen && (
        <ArtPieceComposer onCancel={closeComposer} onCreated={handleCreated} />
      )}
    </div>
  );
};

interface RouteParams {
  id: string;
}

const PieceDetailRoute: React.FC = () => {
  const match = useRouteMatch<RouteParams>();
  const [piece, setPiece] = useState<ApiArtPieceJSON | null>(null);
  const staleRef = useRef({ stale: false });

  useEffect(() => {
    const guard = { stale: false };
    staleRef.current = guard;
    void (async () => {
      try {
        const data = await apiGetPiece(match.params.id);
        if (!guard.stale) setPiece(data);
      } catch {
        if (!guard.stale) setPiece(null);
      }
    })();
    return () => {
      guard.stale = true;
    };
  }, [match.params.id]);

  if (!piece) {
    return (
      <p className='space-subtitle'>
        <FormattedMessage id='art.loading' defaultMessage='Loading…' />
      </p>
    );
  }

  return <ArtPieceDetail piece={piece} onChange={setPiece} />;
};
