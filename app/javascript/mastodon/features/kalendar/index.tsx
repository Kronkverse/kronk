import { useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import { useHistory, useLocation } from 'react-router-dom';

import { Stage } from 'mastodon/components/stage';
import { FeedDrum } from 'mastodon/features/home_timeline/components/feed_drum';

import { KalendarListView } from './list_view';

// Kalendar — the two-face rotator korner (Tal 2026-08-13: "I want the
// /kalendar page to be on a similar rotator view, to change across
// to the list view"). Faces come from the manifest's `views:` block
// (see `config/korners/kalendar.yaml`), and the Frame's
// `<AutoSpaceHeader>` renders the rotating title itself — this
// component just resolves the current URL segment to one of the
// faces and mounts the corresponding body inside a shared
// `<FeedDrum>` so the swap plays the same quarter-turn as /home,
// Albutts, Kommons, and Map (Tal follow-up: "this doesn't rotate
// like the feed does").
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
  const history = useHistory();
  const view = resolveView(location.pathname);
  const title = intl.formatMessage(messages.title);

  // FeedDrum drives its wrap direction from `order`; navigating a
  // step is a URL push (same handler shape the AutoSpaceHeader uses).
  // The default face (index 0) rides on the bare `/hub/kalendar` URL;
  // every other face gets a segment suffix.
  const handleScopeChange = useCallback(
    (next: string) => {
      const target =
        next === DEFAULT_VIEW ? '/hub/kalendar' : `/hub/kalendar/${next}`;
      if (target !== location.pathname) history.push(target);
    },
    [history, location.pathname],
  );

  return (
    <Stage label={title}>
      <Helmet>
        <title>{title}</title>
        <meta name='robots' content='noindex' />
      </Helmet>

      {/* `<FeedDrum>` was designed for the /home column-scroll feed,
          which is document-scrolled and gets its height from content.
          Kalendar's faces (iframe + list) need to fill Stage instead
          — so wrap the drum in a flex-column shell (`.kalendar-shell`)
          whose CSS also stretches `.feed-drum` and `.feed-drum__live`
          when they're mounted inside it. Without this the iframe
          collapses to its default 150px height and the list has no
          scroll container (Tal 2026-08-13: "the view is all too
          small"). */}
      <div className='kalendar-shell'>
        <FeedDrum
          reach={view}
          order={[...VIEWS]}
          onScopeChange={handleScopeChange}
        >
          {view === 'spiral' && (
            <iframe
              title={title}
              src='/kalendar-spiral-preview.html'
              className='korner-iframe'
            />
          )}
          {view === 'list' && <KalendarListView />}
        </FeedDrum>
      </div>
    </Stage>
  );
};

// eslint-disable-next-line import/no-default-export
export default Kalendar;
