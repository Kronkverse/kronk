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

import { apiGetFilm, apiListFilms } from 'mastodon/api/cinema';
import type { FilmsScope } from 'mastodon/api/cinema';
import type { ApiFilmJSON } from 'mastodon/api_types/cinema';
import { Stage } from 'mastodon/components/stage';
import { FeedDrum } from 'mastodon/features/home_timeline/components/feed_drum';
import { useIdentity } from 'mastodon/identity_context';

import { FilmComposer } from './components/film_composer';
import { FilmViewer } from './components/film_viewer';

const messages = defineMessages({
  title: { id: 'cinema.title', defaultMessage: 'Cinema' },
  loading: { id: 'cinema.loading', defaultMessage: 'Loading…' },
  emptyAll: {
    id: 'cinema.empty.all',
    defaultMessage: 'No films yet — tap the compose button to post one.',
  },
  emptyMine: {
    id: 'cinema.empty.mine',
    defaultMessage: "You haven't posted any films yet.",
  },
  emptyMates: {
    id: 'cinema.empty.mates',
    defaultMessage: 'None of your mates have posted a film yet.',
  },
});

const SCOPE_KEYS: FilmsScope[] = ['all', 'mine', 'mates'];

const scopeFromPath = (pathname: string): FilmsScope => {
  const match = /^\/hub\/cinema\/([a-z]+)$/.exec(pathname);
  const seg = match?.[1];
  return seg && (SCOPE_KEYS as string[]).includes(seg)
    ? (seg as FilmsScope)
    : 'all';
};

const useCurrentScope = (): FilmsScope => {
  const { pathname } = useLocation();
  return scopeFromPath(pathname);
};

export const Cinema: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();

  return (
    <Stage label={intl.formatMessage(messages.title)}>
      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
      </Helmet>

      <Switch>
        <Route path='/hub/cinema/composer' exact>
          <Directory autoOpenComposer />
        </Route>
        <Route path='/hub/cinema/mine' exact>
          <Directory />
        </Route>
        <Route path='/hub/cinema/mates' exact>
          <Directory />
        </Route>
        <Route path='/hub/cinema' exact>
          <Directory />
        </Route>
        <Route path='/hub/cinema/:id' exact>
          <FilmRoute />
        </Route>
      </Switch>
    </Stage>
  );
};

// eslint-disable-next-line import/no-default-export
export default Cinema;

interface DirectoryProps {
  autoOpenComposer?: boolean;
}

const Directory: React.FC<DirectoryProps> = ({ autoOpenComposer }) => {
  const intl = useIntl();
  const history = useHistory();
  const { signedIn } = useIdentity();
  const scope = useCurrentScope();
  const [films, setFilms] = useState<ApiFilmJSON[] | null>(null);
  const [composerOpen, setComposerOpen] = useState(Boolean(autoOpenComposer));

  useEffect(() => {
    if (autoOpenComposer) setComposerOpen(true);
  }, [autoOpenComposer]);

  const load = useCallback(async () => {
    setFilms(null);
    try {
      setFilms(await apiListFilms(scope));
    } catch {
      setFilms([]);
    }
  }, [scope]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleScopeChange = useCallback(
    (next: string) => {
      history.push(next === 'all' ? '/hub/cinema' : `/hub/cinema/${next}`);
    },
    [history],
  );

  const closeComposer = useCallback(() => {
    setComposerOpen(false);
    if (autoOpenComposer) history.replace('/hub/cinema');
  }, [autoOpenComposer, history]);

  const handleCreated = useCallback(
    (created: ApiFilmJSON) => {
      setComposerOpen(false);
      setFilms((prev) => (prev ? [created, ...prev] : [created]));
      history.push(`/hub/cinema/${created.id}`);
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

  const gridContent =
    films === null ? (
      <p className='space-subtitle'>{intl.formatMessage(messages.loading)}</p>
    ) : films.length === 0 ? (
      <p className='space-subtitle cinema-directory__empty'>{emptyMessage}</p>
    ) : (
      <ul className='cinema-directory__grid'>
        {films.map((f) => (
          <li key={f.id} className='cinema-directory__cell'>
            <Link to={`/hub/cinema/${f.id}`} className='cinema-card'>
              <div className='cinema-card__poster' aria-hidden />
              <div className='cinema-card__body'>
                <div className='cinema-card__title'>{f.title}</div>
                <div className='cinema-card__owner'>@{f.owner.acct}</div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    );

  return (
    <div className='cinema-directory'>
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
        <FilmComposer onCancel={closeComposer} onCreated={handleCreated} />
      )}
    </div>
  );
};

interface RouteParams {
  id: string;
}

const FilmRoute: React.FC = () => {
  const match = useRouteMatch<RouteParams>();
  const [film, setFilm] = useState<ApiFilmJSON | null>(null);
  const staleRef = useRef({ stale: false });

  useEffect(() => {
    const guard = { stale: false };
    staleRef.current = guard;
    void (async () => {
      try {
        const data = await apiGetFilm(match.params.id);
        if (!guard.stale) setFilm(data);
      } catch {
        if (!guard.stale) setFilm(null);
      }
    })();
    return () => {
      guard.stale = true;
    };
  }, [match.params.id]);

  if (!film) {
    return (
      <p className='space-subtitle'>
        <FormattedMessage id='cinema.loading' defaultMessage='Loading…' />
      </p>
    );
  }

  return <FilmViewer film={film} onChange={setFilm} />;
};
