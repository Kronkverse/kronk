import { useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import { useHistory, useLocation } from 'react-router-dom';

import { Stage } from 'mastodon/components/stage';

import { MatesView } from './mates_view';
import { TrekComposer } from './trek_composer';
import { TreksView } from './treks_view';

// Map — three browse faces (Mates / My treks / Mates' treks) plus the
// trek composer overlay. The Frame provides the rotating space title
// from the manifest (`header.rotator: true`), so this component just
// dispatches the current URL to the right view.
//
// All browse faces are native: Mates and both treks surfaces are
// MapLibre GL / list surfaces backed by their own APIs. The composer
// (was the full-page "Logger") records a trek by hand or by importing
// a GPS file — now a `<ComposeShell>` overlay opened at
// /hub/map/composer (or the legacy /hub/map/logger alias), matching
// the pilot Albutts + Moments composers.
//
// Kommons proposal #116969555027300161.

const messages = defineMessages({
  title: { id: 'map.title', defaultMessage: 'Map' },
});

// The browse faces (`mates` / `my-treks` / `mates-treks`) come from the
// manifest `views:` list; the Frame's `<AutoSpaceHeader>` rotator steps
// between them. `composer` is NOT a browse face — it's the korner's
// compose action (manifest `compose.route`), opened from the Ж menu
// bubble — but it still resolves here so /hub/map/composer opens the
// TrekComposer overlay on top of the Mates landing. `treks-detail` is
// the deep-link surface at /hub/map/treks/:id (feed cards link here)
// and is detected by regex rather than a URL segment so trek IDs
// (numeric) can't clash with the scope segments.
const VIEWS = [
  'mates',
  'my-treks',
  'mates-treks',
  'composer',
  'treks-detail',
] as const;
type MapView = (typeof VIEWS)[number];
const DEFAULT_VIEW: MapView = 'mates';

const HUB_ROUTE_RE = /^\/hub\/map(?:\/([a-z0-9-]+))?/;
const TREK_DETAIL_RE = /^\/hub\/map\/treks\/\d+$/;

const resolveView = (pathname: string): MapView => {
  if (TREK_DETAIL_RE.test(pathname)) return 'treks-detail';
  const segment = HUB_ROUTE_RE.exec(pathname)?.[1];
  // Legacy bare /hub/map/treks (the retired outer picker landed here)
  // still resolves — treat it as the default treks face so old
  // bookmarks and any stale in-app links don't break.
  if (segment === 'treks') return 'my-treks';
  // Legacy /hub/map/logger — the pre-shell full-page compose surface.
  // Route it to the same overlay the new /hub/map/composer opens.
  if (segment === 'logger') return 'composer';
  return (VIEWS as readonly string[]).includes(segment ?? '')
    ? (segment as MapView)
    : DEFAULT_VIEW;
};

const MapV2: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();
  const location = useLocation();
  const history = useHistory();
  const view = resolveView(location.pathname);

  // Both scope faces + the deep-link detail all render through the
  // same TreksView instance so it stays mounted across scope changes
  // — that's what lets FeedDrum snapshot the outgoing list before
  // the URL swap.
  const onTreks =
    view === 'my-treks' || view === 'mates-treks' || view === 'treks-detail';

  // Composer close / success handlers. Close drops the caller back to
  // the Mates landing (Albutts-style — the composer is a Map-wide
  // action, not scope-specific). Success sends them straight to My
  // treks so the freshly-logged trek is right there.
  const closeComposer = useCallback(() => {
    history.push('/hub/map');
  }, [history]);
  const onTrekCreated = useCallback(() => {
    history.push('/hub/map/my-treks');
  }, [history]);

  return (
    <Stage label={intl.formatMessage(messages.title)}>
      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
        <meta name='robots' content='noindex' />
      </Helmet>

      {onTreks ? <TreksView /> : <MatesView />}

      {view === 'composer' && (
        <TrekComposer onCancel={closeComposer} onCreated={onTrekCreated} />
      )}
    </Stage>
  );
};

// eslint-disable-next-line import/no-default-export
export default MapV2;
