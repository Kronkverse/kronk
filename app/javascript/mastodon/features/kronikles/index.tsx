import { useCallback, useEffect, useRef, useState } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import {
  Route,
  Switch,
  useHistory,
  useLocation,
  useRouteMatch,
} from 'react-router-dom';

import { apiGetChronicle, apiListChronicles } from 'mastodon/api/kronikles';
import type { ChroniclesScope } from 'mastodon/api/kronikles';
import type { ApiChronicleJSON } from 'mastodon/api_types/kronikles';
import { FeedDrum } from 'mastodon/components/feed_drum';
import { Icon } from 'mastodon/components/icon';
import { SpaceCard, SpaceGrid } from 'mastodon/components/space_grid';
import { Stage } from 'mastodon/components/stage';
import { useKonnectReturn } from 'mastodon/hooks/useKonnectReturn';
import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';
import { useIdentity } from 'mastodon/identity_context';

import { ChronicleComposer } from './components/chronicle_composer';
import { ChronicleReader, KIND_LABEL } from './components/chronicle_reader';
import { SeriesRoute } from './components/series_page';
import { SeriesRow } from './components/series_row';

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
        <Route path='/hub/kronikles/series/:id' exact>
          <SeriesRoute />
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
  const kornerGlyph = useKornerIcon('kronikles');

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

  const returnToSource = useKonnectReturn();
  const closeComposer = useCallback(() => {
    setComposerOpen(false);
    // Opened from a record (`?konnect=`): back to it.
    if (returnToSource('/hub/kronikles')) return;
    if (autoOpenComposer) history.replace('/hub/kronikles');
  }, [autoOpenComposer, history, returnToSource]);

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
      // The shared tile grid, like every other space's list of made things
      // (docs/design.md, Platform primitives): the first picture in the
      // Kronikle, or the korner's glyph, over its title, author and kind. A
      // Series is one tile.
      <SpaceGrid className='kronikles-directory__grid'>
        {chronicles.map((c) =>
          c.series ? (
            <SeriesRow
              key={`series-${c.series.id}`}
              chronicle={c}
              series={c.series}
            />
          ) : (
            <SpaceCard
              key={c.id}
              to={`/hub/kronikles/${c.id}`}
              image={c.pictures[0]?.preview_url ?? null}
              placeholder={<Icon id='korner-kronikles' icon={kornerGlyph} />}
              title={c.title}
              meta={`@${c.owner.acct}`}
              tag={intl.formatMessage(KIND_LABEL[c.kind])}
            />
          ),
        )}
      </SpaceGrid>
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
