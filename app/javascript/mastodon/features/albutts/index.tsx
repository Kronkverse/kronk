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
import { ScopeTitle } from 'mastodon/features/home_timeline/components/scope_title';
import type { ScopeTitleFace } from 'mastodon/features/home_timeline/components/scope_title';
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
  scopeAria: {
    id: 'albutts.scope.aria',
    defaultMessage: 'Change which albums you see',
  },
  scopeAll: { id: 'albutts.scope.all', defaultMessage: 'All albums' },
  scopeAllDesc: {
    id: 'albutts.scope.all_desc',
    defaultMessage: 'Every album you can see',
  },
  scopeMine: { id: 'albutts.scope.mine', defaultMessage: 'My albums' },
  scopeMineDesc: {
    id: 'albutts.scope.mine_desc',
    defaultMessage: 'Albums you started',
  },
  scopeContributed: {
    id: 'albutts.scope.contributed',
    defaultMessage: 'Contributed',
  },
  scopeContributedDesc: {
    id: 'albutts.scope.contributed_desc',
    defaultMessage: "Albums you've added a photo to",
  },
  scopeMates: { id: 'albutts.scope.mates', defaultMessage: "Mates'" },
  scopeMatesDesc: {
    id: 'albutts.scope.mates_desc',
    defaultMessage: 'Albums your mates started',
  },
});

// Path segment that follows /hub/albutts drives which scope face is
// selected. Kept in the URL so refresh / back / share stays honest —
// same pattern as the /home feed's scope routing.
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
    // The Directory's `<ScopeTitle>` already carries the korner's
    // identity + current view, so the Frame's auto space header
    // would stack a duplicate title on top of it. Opt out.
    <Stage label={intl.formatMessage(messages.title)} hideSpaceHeader>
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
        {/* Scope segments — one per ScopeTitle face other than the
            default `all` (which is the bare /hub/albutts). Directory
            reads the scope from the URL, so refresh + back + share
            all preserve the view. */}
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

  // Faces are the same order as SCOPE_KEYS + the controller's SCOPES
  // constant, so a keyboard arrow / swipe steps through them in the
  // same order everywhere.
  const scopeFaces: ScopeTitleFace[] = [
    {
      key: 'all',
      label: intl.formatMessage(messages.scopeAll),
      desc: intl.formatMessage(messages.scopeAllDesc),
    },
    {
      key: 'mine',
      label: intl.formatMessage(messages.scopeMine),
      desc: intl.formatMessage(messages.scopeMineDesc),
    },
    {
      key: 'contributed',
      label: intl.formatMessage(messages.scopeContributed),
      desc: intl.formatMessage(messages.scopeContributedDesc),
    },
    {
      key: 'mates',
      label: intl.formatMessage(messages.scopeMates),
      desc: intl.formatMessage(messages.scopeMatesDesc),
    },
  ];

  const handleScopeChange = useCallback(
    (next: string) => {
      // `all` is the bare URL; the others carry the scope as a
      // segment so refresh / back / share all preserve the view.
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

  return (
    <div className='albutts-directory'>
      {/* Scope title — same rotating space-header primitive as the
          /home feed. Signed-in only; the scope faces other than
          `all` require a caller identity to filter against. */}
      {signedIn && (
        <ScopeTitle
          ariaLabel={intl.formatMessage(messages.scopeAria)}
          faces={scopeFaces}
          value={scope}
          onChange={handleScopeChange}
        />
      )}

      {albums === null ? (
        <p className='space-subtitle'>{intl.formatMessage(messages.loading)}</p>
      ) : albums.length === 0 ? (
        <p className='space-subtitle albutts-directory__empty'>
          {emptyMessage}
        </p>
      ) : (
        <ul className='albutts-directory__grid'>
          {albums.map((a) => (
            <li key={a.id} className='albutts-directory__cell'>
              <Link to={`/hub/albutts/albums/${a.id}`} className='albutts-card'>
                {a.cover_url ? (
                  <img
                    className='albutts-card__cover'
                    src={a.cover_url}
                    alt=''
                  />
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
