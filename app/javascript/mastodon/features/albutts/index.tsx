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

import AddIcon from '@/material-icons/400-24px/add.svg?react';
import {
  apiCreateAlbum,
  apiGetAlbum,
  apiListAlbums,
} from 'mastodon/api/albutts';
import type { AlbumsScope } from 'mastodon/api/albutts';
import type { AlbumVisibility, ApiAlbumJSON } from 'mastodon/api_types/albutts';
import { ComposeFab } from 'mastodon/components/compose_fab';
import { Stage } from 'mastodon/components/stage';
import { FeedDrum } from 'mastodon/features/home_timeline/components/feed_drum';
import { useIdentity } from 'mastodon/identity_context';

import { AlbumComposer } from './components/album_composer';
import { AlbumDetail } from './components/album_detail';

const messages = defineMessages({
  title: { id: 'albutts.title', defaultMessage: 'Albutts' },
  loading: { id: 'albutts.loading', defaultMessage: 'Loading…' },
  emptyAll: {
    id: 'albutts.empty.all',
    defaultMessage: 'No albums yet — tap the compose button to start one.',
  },
  emptyMine: {
    id: 'albutts.empty.mine',
    defaultMessage: "You haven't started any albums yet.",
  },
  emptyContributed: {
    id: 'albutts.empty.contributed',
    defaultMessage: "You haven't contributed to any albums yet.",
  },
  emptyMates: {
    id: 'albutts.empty.mates',
    defaultMessage: 'None of your mates have shared an album yet.',
  },
  photos: {
    id: 'albutts.photos',
    defaultMessage: '{count, plural, one {# photo} other {# photos}}',
  },
  contributors: {
    id: 'albutts.contributors',
    defaultMessage:
      '{count, plural, one {# contributor} other {# contributors}}',
  },
  fab: {
    id: 'albutts.fab.label',
    defaultMessage: 'New album',
  },
});

// Path segment that follows /hub/albutts drives which scope face is
// selected. Must stay in sync with `views:` in albutts.yaml — the
// manifest is the source of truth; the frontend keeps this list for
// (a) the API scope enum and (b) the FeedDrum's rotation order.
const SCOPE_KEYS: AlbumsScope[] = ['all', 'mine', 'contributed', 'mates'];

const scopeFromPath = (pathname: string): AlbumsScope => {
  const match = /^\/hub\/albutts\/([a-z]+)$/.exec(pathname);
  const seg = match?.[1];
  return seg && (SCOPE_KEYS as string[]).includes(seg)
    ? (seg as AlbumsScope)
    : 'all';
};

const useCurrentScope = (): AlbumsScope => {
  const { pathname } = useLocation();
  return scopeFromPath(pathname);
};

// /hub/albutts — directory of visible albums, plus /albums/:id detail
// child route. See docs/spaces/albutts.md.
const Albutts: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();

  return (
    <Stage label={intl.formatMessage(messages.title)}>
      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
      </Helmet>

      <Switch>
        <Route path='/hub/albutts/albums/:id' exact>
          <AlbumDetailRoute />
        </Route>
        {/* Composer routes. The canonical entry is `/composer`
            (matches every other korner's forthcoming standard). The
            legacy `/new` URL is preserved as an alias so bookmarks
            / in-flight tabs / stale Ж-menu targets don't 404 while
            the manifest / callers migrate. Both open the same
            ComposeShell-wrapped AlbumComposer. */}
        <Route path='/hub/albutts/composer' exact>
          <Directory autoOpenComposer />
        </Route>
        <Route path='/hub/albutts/new' exact>
          <Directory autoOpenComposer />
        </Route>
        {/* Scope segments — one per manifest view other than the
            default `all` (bare `/hub/albutts`). Title rotation lives
            in the Frame's `<AutoSpaceHeader>` (manifest opt-in
            `header.rotator: true`); Directory reads the scope from
            the URL so refresh + back + share preserve the view. */}
        <Route path='/hub/albutts/mine' exact>
          <Directory />
        </Route>
        <Route path='/hub/albutts/contributed' exact>
          <Directory />
        </Route>
        <Route path='/hub/albutts/mates' exact>
          <Directory />
        </Route>
        <Route path='/hub/albutts' exact>
          <Directory />
        </Route>
      </Switch>
    </Stage>
  );
};

// eslint-disable-next-line import/no-default-export
export default Albutts;

interface DirectoryProps {
  // When true (the `/hub/albutts/new` route), the composer opens
  // automatically on mount. The Ж floating bubble sends the user
  // there via the manifest's `compose.route`.
  autoOpenComposer?: boolean;
}

const Directory: React.FC<DirectoryProps> = ({ autoOpenComposer }) => {
  const intl = useIntl();
  const history = useHistory();
  const { signedIn } = useIdentity();
  const scope = useCurrentScope();
  const [albums, setAlbums] = useState<ApiAlbumJSON[] | null>(null);
  const [composerOpen, setComposerOpen] = useState(Boolean(autoOpenComposer));

  const load = useCallback(async () => {
    setAlbums(null);
    try {
      setAlbums(await apiListAlbums(scope));
    } catch {
      setAlbums([]);
    }
  }, [scope]);

  useEffect(() => {
    void load();
  }, [load]);

  // FeedDrum drives its wrap direction from `order`; navigating a
  // step is a URL push (same handler shape the AutoSpaceHeader uses).
  const handleScopeChange = useCallback(
    (next: string) => {
      history.push(next === 'all' ? '/hub/albutts' : `/hub/albutts/${next}`);
    },
    [history],
  );

  const closeComposer = useCallback(() => {
    setComposerOpen(false);
    // If we arrived via the composer route (`/composer` or the legacy
    // `/new`), drop back to the plain directory URL so the composer
    // doesn't reopen on refresh.
    if (autoOpenComposer) history.replace('/hub/albutts');
  }, [autoOpenComposer, history]);

  const handleCreated = useCallback(
    (created: ApiAlbumJSON) => {
      setComposerOpen(false);
      setAlbums((prev) => (prev ? [created, ...prev] : [created]));
      history.push(`/hub/albutts/albums/${created.id}`);
    },
    [history],
  );

  const emptyMessage = intl.formatMessage(
    scope === 'mine'
      ? messages.emptyMine
      : scope === 'contributed'
        ? messages.emptyContributed
        : scope === 'mates'
          ? messages.emptyMates
          : messages.emptyAll,
  );

  // The grid, empty state, and loading state all live inside the
  // drum so it stays mounted across scope changes. Snapshotting
  // requires a live DOM to clone; unmounting the drum mid-turn
  // would abort the animation.
  const gridContent =
    albums === null ? (
      <p className='space-subtitle'>{intl.formatMessage(messages.loading)}</p>
    ) : albums.length === 0 ? (
      <p className='space-subtitle albutts-directory__empty'>{emptyMessage}</p>
    ) : (
      <ul className='albutts-directory__grid'>
        {albums.map((a) => (
          <li key={a.id} className='albutts-directory__cell'>
            <Link to={`/hub/albutts/albums/${a.id}`} className='albutts-card'>
              {a.cover_url ? (
                <img className='albutts-card__cover' src={a.cover_url} alt='' />
              ) : (
                <div className='albutts-card__cover albutts-card__cover--empty' />
              )}
              <div className='albutts-card__body'>
                <div className='albutts-card__title'>{a.title}</div>
                <div className='albutts-card__meta'>
                  {intl.formatMessage(messages.photos, {
                    count: a.photo_count,
                  })}
                  {' · '}
                  {intl.formatMessage(messages.contributors, {
                    count: a.contributor_count,
                  })}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    );

  return (
    <div className='albutts-directory'>
      {/* Title lives in the Frame's `<AutoSpaceHeader>` — the
          manifest opts into the shared rotator (`header.rotator:
          true` in albutts.yaml), so the title above cycles through
          the four views. Directory only owns the content grid + the
          drum that rotates it. */}
      {signedIn ? (
        // FeedDrum turns the grid on scope change — same quarter-turn
        // that the /home feed uses under its ScopeTitle, so the top
        // and bottom of the spindle read as one solid object. Stays
        // mounted across scope changes (including the loading beat
        // between old + new data) so the snapshot has something to
        // clone from.
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
        <AlbumComposer onCancel={closeComposer} onCreated={handleCreated} />
      )}

      {/* Every korner surface that supports posting gets one floating
          compose bubble in a consistent bottom-right position. The
          FAB is a Link — pushing to /composer opens the ComposeShell,
          and back-button closes it. Hidden while the composer itself
          is open so it doesn't sit on top of the shell. */}
      {!composerOpen && (
        <ComposeFab
          to='/hub/albutts/composer'
          label={intl.formatMessage(messages.fab)}
          icon={AddIcon}
          iconId='add'
        />
      )}
    </div>
  );
};

interface RouteParams {
  id: string;
}

// Re-export AlbumDetail's own container so callers use the same file
// as the entry point.
export const AlbumDetailRoute: React.FC = () => {
  const match = useRouteMatch<RouteParams>();
  const [album, setAlbum] = useState<ApiAlbumJSON | null>(null);
  const staleRef = useRef({ stale: false });

  useEffect(() => {
    const guard = { stale: false };
    staleRef.current = guard;
    void (async () => {
      try {
        const data = await apiGetAlbum(match.params.id);
        if (!guard.stale) setAlbum(data);
      } catch {
        if (!guard.stale) setAlbum(null);
      }
    })();
    return () => {
      guard.stale = true;
    };
  }, [match.params.id]);

  if (!album) {
    return (
      <p className='space-subtitle'>
        <FormattedMessage id='albutts.loading' defaultMessage='Loading…' />
      </p>
    );
  }

  return <AlbumDetail album={album} onChange={setAlbum} />;
};

export type { AlbumVisibility, ApiAlbumJSON };
export { apiCreateAlbum, apiGetAlbum };
