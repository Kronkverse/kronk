import { useCallback, useEffect, useRef, useState } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import {
  Route,
  Switch,
  Link,
  useHistory,
  useRouteMatch,
} from 'react-router-dom';

import {
  apiCreateAlbum,
  apiGetAlbum,
  apiListAlbums,
} from 'mastodon/api/albutts';
import type { AlbumVisibility, ApiAlbumJSON } from 'mastodon/api_types/albutts';
import { Stage } from 'mastodon/components/stage';

import { AlbumComposer } from './components/album_composer';
import { AlbumDetail } from './components/album_detail';

const messages = defineMessages({
  title: { id: 'albutts.title', defaultMessage: 'Albutts' },
  loading: { id: 'albutts.loading', defaultMessage: 'Loading…' },
  empty: {
    id: 'albutts.empty',
    defaultMessage: 'No albums yet — start one below.',
  },
  newAlbum: {
    id: 'albutts.new_album',
    defaultMessage: 'New album',
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
});

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
        <Route path='/hub/albutts' exact>
          <Directory />
        </Route>
      </Switch>
    </Stage>
  );
};

// eslint-disable-next-line import/no-default-export
export default Albutts;

const Directory: React.FC = () => {
  const intl = useIntl();
  const history = useHistory();
  const [albums, setAlbums] = useState<ApiAlbumJSON[] | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);

  const load = useCallback(async () => {
    setAlbums(null);
    try {
      setAlbums(await apiListAlbums());
    } catch {
      setAlbums([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openComposer = useCallback(() => {
    setComposerOpen(true);
  }, []);
  const closeComposer = useCallback(() => {
    setComposerOpen(false);
  }, []);

  const handleCreated = useCallback(
    (created: ApiAlbumJSON) => {
      setComposerOpen(false);
      setAlbums((prev) => (prev ? [created, ...prev] : [created]));
      // `?add_photo=1` opens the contribute-photo composer immediately
      // on the detail page — a freshly-created album is empty and the
      // natural next action is adding the first photo.
      history.push(`/hub/albutts/albums/${created.id}?add_photo=1`);
    },
    [history],
  );

  return (
    <div className='albutts-directory'>
      <div className='albutts-directory__toolbar'>
        <button
          type='button'
          className='albutts-btn albutts-btn--primary'
          onClick={openComposer}
        >
          {intl.formatMessage(messages.newAlbum)}
        </button>
      </div>

      {albums === null ? (
        <p className='space-subtitle'>{intl.formatMessage(messages.loading)}</p>
      ) : albums.length === 0 ? (
        <p className='space-subtitle albutts-directory__empty'>
          {intl.formatMessage(messages.empty)}
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
