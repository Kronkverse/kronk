import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import { useLocation } from 'react-router-dom';

import { Stage } from 'mastodon/components/stage';

import { MatesView } from './mates_view';

// Map — three-lens surface (Mates / Treks / Logger). The Frame provides the
// space title, tagline and the SpaceViewPicker pill from the manifest.
//
// The Mates lens is now a native MapLibre GL surface backed by the presence
// API (features/map_v2/mates_view). Treks and Logger still render the
// hand-authored prototype (public/map-preview.html) via an iframe until their
// own backends land (Phase 3 / 4).
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

      {view === 'mates' ? (
        <MatesView />
      ) : (
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
