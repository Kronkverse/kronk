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

import { apiGetKar, apiListKars } from 'mastodon/api/karporn';
import type { KarsScope } from 'mastodon/api/karporn';
import type { ApiKarJSON } from 'mastodon/api_types/karporn';
import { Stage } from 'mastodon/components/stage';
import { FeedDrum } from 'mastodon/features/home_timeline/components/feed_drum';
import { useIdentity } from 'mastodon/identity_context';

import { KarComposer } from './components/kar_composer';
import { KarViewer } from './components/kar_viewer';

const messages = defineMessages({
  title: { id: 'karporn.title', defaultMessage: 'Karporn' },
  loading: { id: 'karporn.loading', defaultMessage: 'Loading…' },
  emptyAll: {
    id: 'karporn.empty.all',
    defaultMessage: 'No cars yet — tap the compose button to post one.',
  },
  emptyMine: {
    id: 'karporn.empty.mine',
    defaultMessage: "You haven't posted any cars yet.",
  },
  emptyMates: {
    id: 'karporn.empty.mates',
    defaultMessage: 'None of your mates have posted a car yet.',
  },
  photos: {
    id: 'karporn.photos',
    defaultMessage: '{count, plural, one {# photo} other {# photos}}',
  },
});

const SCOPE_KEYS: KarsScope[] = ['all', 'mine', 'mates'];

const scopeFromPath = (pathname: string): KarsScope => {
  const match = /^\/hub\/karporn\/([a-z]+)$/.exec(pathname);
  const seg = match?.[1];
  return seg && (SCOPE_KEYS as string[]).includes(seg)
    ? (seg as KarsScope)
    : 'all';
};

const useCurrentScope = (): KarsScope => {
  const { pathname } = useLocation();
  return scopeFromPath(pathname);
};

export const Karporn: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();

  return (
    <Stage label={intl.formatMessage(messages.title)}>
      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
      </Helmet>

      <Switch>
        <Route path='/hub/karporn/composer' exact>
          <Directory autoOpenComposer />
        </Route>
        <Route path='/hub/karporn/mine' exact>
          <Directory />
        </Route>
        <Route path='/hub/karporn/mates' exact>
          <Directory />
        </Route>
        <Route path='/hub/karporn' exact>
          <Directory />
        </Route>
        <Route path='/hub/karporn/:id' exact>
          <KarRoute />
        </Route>
      </Switch>
    </Stage>
  );
};

// eslint-disable-next-line import/no-default-export
export default Karporn;

interface DirectoryProps {
  autoOpenComposer?: boolean;
}

const Directory: React.FC<DirectoryProps> = ({ autoOpenComposer }) => {
  const intl = useIntl();
  const history = useHistory();
  const { signedIn } = useIdentity();
  const scope = useCurrentScope();
  const [kars, setKars] = useState<ApiKarJSON[] | null>(null);
  const [composerOpen, setComposerOpen] = useState(Boolean(autoOpenComposer));

  useEffect(() => {
    if (autoOpenComposer) setComposerOpen(true);
  }, [autoOpenComposer]);

  const load = useCallback(async () => {
    setKars(null);
    try {
      setKars(await apiListKars(scope));
    } catch {
      setKars([]);
    }
  }, [scope]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleScopeChange = useCallback(
    (next: string) => {
      history.push(next === 'all' ? '/hub/karporn' : `/hub/karporn/${next}`);
    },
    [history],
  );

  const closeComposer = useCallback(() => {
    setComposerOpen(false);
    if (autoOpenComposer) history.replace('/hub/karporn');
  }, [autoOpenComposer, history]);

  const handleCreated = useCallback(
    (created: ApiKarJSON) => {
      setComposerOpen(false);
      setKars((prev) => (prev ? [created, ...prev] : [created]));
      history.push(`/hub/karporn/${created.id}`);
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
    kars === null ? (
      <p className='space-subtitle'>{intl.formatMessage(messages.loading)}</p>
    ) : kars.length === 0 ? (
      <p className='space-subtitle karporn-directory__empty'>{emptyMessage}</p>
    ) : (
      <ul className='karporn-directory__grid'>
        {kars.map((k) => (
          <li key={k.id} className='karporn-directory__cell'>
            <Link to={`/hub/karporn/${k.id}`} className='karporn-card'>
              {k.cover_url ? (
                <img className='karporn-card__cover' src={k.cover_url} alt='' />
              ) : (
                <div className='karporn-card__cover karporn-card__cover--empty' />
              )}
              <div className='karporn-card__body'>
                <div className='karporn-card__title'>{k.title}</div>
                <div className='karporn-card__meta'>
                  {k.year} {k.make} {k.model}
                </div>
                <div className='karporn-card__submeta'>
                  {intl.formatMessage(messages.photos, {
                    count: k.photo_count,
                  })}
                  {k.location?.label && ` · ${k.location.label}`}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    );

  return (
    <div className='karporn-directory'>
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
        <KarComposer onCancel={closeComposer} onCreated={handleCreated} />
      )}
    </div>
  );
};

interface RouteParams {
  id: string;
}

const KarRoute: React.FC = () => {
  const match = useRouteMatch<RouteParams>();
  const [kar, setKar] = useState<ApiKarJSON | null>(null);
  const staleRef = useRef({ stale: false });

  useEffect(() => {
    const guard = { stale: false };
    staleRef.current = guard;
    void (async () => {
      try {
        const data = await apiGetKar(match.params.id);
        if (!guard.stale) setKar(data);
      } catch {
        if (!guard.stale) setKar(null);
      }
    })();
    return () => {
      guard.stale = true;
    };
  }, [match.params.id]);

  if (!kar) {
    return (
      <p className='space-subtitle'>
        <FormattedMessage id='karporn.loading' defaultMessage='Loading…' />
      </p>
    );
  }

  return <KarViewer kar={kar} onChange={setKar} />;
};
