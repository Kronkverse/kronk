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

import { apiGetChronicle, apiListChronicles } from 'mastodon/api/kronikles';
import type { ChroniclesScope } from 'mastodon/api/kronikles';
import type { ApiChronicleJSON } from 'mastodon/api_types/kronikles';
import { Stage } from 'mastodon/components/stage';
import { FeedDrum } from 'mastodon/features/home_timeline/components/feed_drum';
import { useIdentity } from 'mastodon/identity_context';

import { ChronicleComposer } from './components/chronicle_composer';
import { ChronicleReader } from './components/chronicle_reader';

const messages = defineMessages({
  title: { id: 'kronikles.title', defaultMessage: 'Kronikles' },
  loading: { id: 'kronikles.loading', defaultMessage: 'Loading…' },
  emptyAll: {
    id: 'kronikles.empty.all',
    defaultMessage: 'No Kronikles yet — tap the compose button to write one.',
  },
  emptyMine: {
    id: 'kronikles.empty.mine',
    defaultMessage: "You haven't written any Kronikles yet.",
  },
  emptyMates: {
    id: 'kronikles.empty.mates',
    defaultMessage: 'None of your mates have written a Kronikle yet.',
  },
});

const SCOPE_KEYS: ChroniclesScope[] = ['all', 'mine', 'mates'];

const scopeFromPath = (pathname: string): ChroniclesScope => {
  const match = /^\/hub\/kronikles\/([a-z]+)$/.exec(pathname);
  const seg = match?.[1];
  return seg && (SCOPE_KEYS as string[]).includes(seg)
    ? (seg as ChroniclesScope)
    : 'all';
};

const useCurrentScope = (): ChroniclesScope => {
  const { pathname } = useLocation();
  return scopeFromPath(pathname);
};

// /hub/kronikles — directory of visible Kronikles, plus /:id reader
// child route. Modeled on features/art (Albutts-shaped).
export const Kronikles: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();

  return (
    <Stage label={intl.formatMessage(messages.title)}>
      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
      </Helmet>

      <Switch>
        <Route path='/hub/kronikles/composer' exact>
          <Directory autoOpenComposer />
        </Route>
        <Route path='/hub/kronikles/mine' exact>
          <Directory />
        </Route>
        <Route path='/hub/kronikles/mates' exact>
          <Directory />
        </Route>
        <Route path='/hub/kronikles' exact>
          <Directory />
        </Route>
        {/* :id must come last so the scope segments above match first. */}
        <Route path='/hub/kronikles/:id' exact>
          <ChronicleRoute />
        </Route>
      </Switch>
    </Stage>
  );
};

// eslint-disable-next-line import/no-default-export
export default Kronikles;

interface DirectoryProps {
  autoOpenComposer?: boolean;
}

const Directory: React.FC<DirectoryProps> = ({ autoOpenComposer }) => {
  const intl = useIntl();
  const history = useHistory();
  const { signedIn } = useIdentity();
  const scope = useCurrentScope();
  const [chronicles, setChronicles] = useState<ApiChronicleJSON[] | null>(null);
  const [composerOpen, setComposerOpen] = useState(Boolean(autoOpenComposer));

  useEffect(() => {
    if (autoOpenComposer) setComposerOpen(true);
  }, [autoOpenComposer]);

  const load = useCallback(async () => {
    setChronicles(null);
    try {
      setChronicles(await apiListChronicles(scope));
    } catch {
      setChronicles([]);
    }
  }, [scope]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleScopeChange = useCallback(
    (next: string) => {
      history.push(
        next === 'all' ? '/hub/kronikles' : `/hub/kronikles/${next}`,
      );
    },
    [history],
  );

  const closeComposer = useCallback(() => {
    setComposerOpen(false);
    if (autoOpenComposer) history.replace('/hub/kronikles');
  }, [autoOpenComposer, history]);

  const handleCreated = useCallback(
    (created: ApiChronicleJSON) => {
      setComposerOpen(false);
      setChronicles((prev) => (prev ? [created, ...prev] : [created]));
      history.push(`/hub/kronikles/${created.id}`);
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

  const listContent =
    chronicles === null ? (
      <p className='space-subtitle'>{intl.formatMessage(messages.loading)}</p>
    ) : chronicles.length === 0 ? (
      <p className='space-subtitle kronikles-directory__empty'>
        {emptyMessage}
      </p>
    ) : (
      <ul className='kronikles-directory__list'>
        {chronicles.map((c) => (
          <li key={c.id} className='kronikles-directory__row'>
            <Link to={`/hub/kronikles/${c.id}`} className='kronikles-card'>
              <div className='kronikles-card__kind'>{c.kind}</div>
              <div className='kronikles-card__title'>{c.title}</div>
              <p className='kronikles-card__excerpt'>{c.excerpt}</p>
              <div className='kronikles-card__owner'>@{c.owner.acct}</div>
            </Link>
          </li>
        ))}
      </ul>
    );

  return (
    <div className='kronikles-directory'>
      {signedIn ? (
        <FeedDrum
          reach={scope}
          order={SCOPE_KEYS}
          onScopeChange={handleScopeChange}
        >
          {listContent}
        </FeedDrum>
      ) : (
        listContent
      )}

      {composerOpen && (
        <ChronicleComposer onCancel={closeComposer} onCreated={handleCreated} />
      )}
    </div>
  );
};

interface RouteParams {
  id: string;
}

const ChronicleRoute: React.FC = () => {
  const match = useRouteMatch<RouteParams>();
  const [chronicle, setChronicle] = useState<ApiChronicleJSON | null>(null);
  const staleRef = useRef({ stale: false });

  useEffect(() => {
    const guard = { stale: false };
    staleRef.current = guard;
    void (async () => {
      try {
        const data = await apiGetChronicle(match.params.id);
        if (!guard.stale) setChronicle(data);
      } catch {
        if (!guard.stale) setChronicle(null);
      }
    })();
    return () => {
      guard.stale = true;
    };
  }, [match.params.id]);

  if (!chronicle) {
    return (
      <p className='space-subtitle'>
        <FormattedMessage id='kronikles.loading' defaultMessage='Loading…' />
      </p>
    );
  }

  return <ChronicleReader chronicle={chronicle} onChange={setChronicle} />;
};
