import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import { useLocation } from 'react-router-dom';

import { Stage } from 'mastodon/components/stage';

import { LoggerView } from './logger_view';
import { MatesView } from './mates_view';
import { TreksView } from './treks_view';

// Map — three-lens surface (Mates / Treks / Logger). The Frame provides the
// space title, tagline and the SpaceViewPicker pill from the manifest.
//
// All three lenses are native now: Mates and Treks are MapLibre GL surfaces
// backed by their own APIs; Logger records a trek by hand or by importing a
// GPS file (parsed in the browser). The prototype iframe is retired.
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
      {view === 'logger' && <LoggerView />}
    </Stage>
  );
};

// eslint-disable-next-line import/no-default-export
export default MapV2;
