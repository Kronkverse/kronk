import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import { useLocation } from 'react-router-dom';

import { Stage } from 'mastodon/components/stage';

import { MatesView } from './mates_view';
import { TreksView } from './treks_view';

// Map — three-lens surface (Mates / Treks / Logger). The Frame provides the
// space title, tagline and the SpaceViewPicker pill from the manifest.
//
// Mates and Treks are native MapLibre GL surfaces backed by their own APIs
// (features/map_v2/mates_view, treks_view). The Logger lens still renders the
// hand-authored prototype (public/map-preview.html) via an iframe until its
// backend lands (Phase 4).
//
// Kommons proposal #116969555027300161.

const messages = defineMessages({
  title: { id: 'map.title', defaultMessage: 'Map' },
});

const VIEWS = ['mates', 'treks', 'logger'] as const;
type MapView = (typeof VIEWS)[number];
const DEFAULT_VIEW: MapView = 'mates';

const HUB_ROUTE_RE = /^\/hub\/map(?:\/([a-z0-9-]+))?/;

const resolveView = (pathname: string): MapView => {
  const segment = HUB_ROUTE_RE.exec(pathname)?.[1];
  return (VIEWS as readonly string[]).includes(segment ?? '')
    ? (segment as MapView)
    : DEFAULT_VIEW;
};

const MapV2: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();
  const location = useLocation();
  const view = resolveView(location.pathname);

  return (
    <Stage label={intl.formatMessage(messages.title)}>
      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
        <meta name='robots' content='noindex' />
      </Helmet>

      {view === 'mates' && <MatesView />}
      {view === 'treks' && <TreksView />}
      {view === 'logger' && (
        <iframe
          key={view}
          title={intl.formatMessage(messages.title)}
          src={`/map-preview.html?view=${view}`}
          className='korner-iframe'
        />
      )}
    </Stage>
  );
};

// eslint-disable-next-line import/no-default-export
export default MapV2;
