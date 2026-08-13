import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import { useLocation } from 'react-router-dom';

import { Stage } from 'mastodon/components/stage';

import { KalendarListView } from './list_view';

// Kalendar — the two-face rotator korner (Tal 2026-08-13: "I want the
// /kalendar page to be on a similar rotator view, to change across
// to the list view"). Faces come from the manifest's `views:` block
// (see `config/korners/kalendar.yaml`), and the Frame's
// `<AutoSpaceHeader>` renders the rotating title itself — this
// component just resolves the current URL segment to one of the
// faces and mounts the corresponding body.
//
// Faces:
//   - `spiral` (default, bare `/hub/kalendar`) — the shipped Kalendar
//     Spiral prototype, mounted through `<iframe>` as it was before
//     the rotator landed.
//   - `list`   (`/hub/kalendar/list`) — new: upcoming events as a
//     scrollable list of `<EventCard>`s.
//
// `/hub/kalendar/<numeric-id>` continues to route to `EventDetail`
// via a separate WrappedRoute at the app-router level, so this
// component only sees the two face URLs.

const messages = defineMessages({
  title: { id: 'kalendar.title', defaultMessage: '₭alendar' },
});

const VIEWS = ['spiral', 'list'] as const;
type KalendarView = (typeof VIEWS)[number];
const DEFAULT_VIEW: KalendarView = 'spiral';

const HUB_ROUTE_RE = /^\/hub\/kalendar(?:\/([a-z0-9-]+))?/;

const resolveView = (pathname: string): KalendarView => {
  const segment = HUB_ROUTE_RE.exec(pathname)?.[1];
  return (VIEWS as readonly string[]).includes(segment ?? '')
    ? (segment as KalendarView)
    : DEFAULT_VIEW;
};

const Kalendar: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();
  const location = useLocation();
  const view = resolveView(location.pathname);
  const title = intl.formatMessage(messages.title);

  return (
    <Stage label={title}>
      <Helmet>
        <title>{title}</title>
        <meta name='robots' content='noindex' />
      </Helmet>

      {view === 'spiral' && (
        <iframe
          title={title}
          src='/kalendar-spiral-preview.html'
          className='korner-iframe'
        />
      )}
      {view === 'list' && <KalendarListView />}
    </Stage>
  );
};

// eslint-disable-next-line import/no-default-export
export default Kalendar;
