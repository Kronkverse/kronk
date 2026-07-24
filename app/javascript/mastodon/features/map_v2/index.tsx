import { useEffect, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import { useLocation } from 'react-router-dom';

import { Stage } from 'mastodon/components/stage';

// Map — three-lens surface (Mates / Treks / Logger). The Frame provides
// the space title, the tagline and the SpaceViewPicker pill from the
// manifest; the iframe below just renders the lens the URL selects.
// Runtime lens changes flow one-way from the parent via postMessage —
// no full iframe reload on tab switch.
//
// Kommons proposal #116969555027300161 ("New Korner: Map — To see where
// your mates are and share activities").

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
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const view = resolveView(location.pathname);

  // The iframe src is fixed at first mount — the initial lens rides in
  // as a query param. Later view changes come through postMessage below,
  // so the iframe never has to reload on tab switch.
  const [src] = useState(() => `/map-preview.html?view=${view}`);

  useEffect(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage(
      { type: 'map:set-lens', lens: view },
      window.location.origin,
    );
  }, [view]);

  return (
    <Stage label={intl.formatMessage(messages.title)}>
      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
        <meta name='robots' content='noindex' />
      </Helmet>
      <iframe
        ref={iframeRef}
        title={intl.formatMessage(messages.title)}
        src={src}
        className='korner-iframe'
      />
    </Stage>
  );
};

// eslint-disable-next-line import/no-default-export
export default MapV2;
