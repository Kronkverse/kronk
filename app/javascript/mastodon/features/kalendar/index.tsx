import { useCallback, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import { useHistory, useLocation } from 'react-router-dom';

import { Stage } from 'mastodon/components/stage';
import { FeedDrum } from 'mastodon/features/home_timeline/components/feed_drum';

import { EventComposer } from './event_composer';
import type { CreatedEvent } from './event_composer';
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

// When mounted on `/hub/kalendar/composer` (or the legacy alias
// `/hub/kalendar/new`), the router passes `autoOpenComposer: true`
// so the `<EventComposer>` overlay opens on top of the Spiral face.
// Same treatment as Krews / Albutts / Moments (see
// docs/rebuild/decisions.md 2026-08-12 for the shared shape).
interface KalendarProps {
  multiColumn?: boolean;
  autoOpenComposer?: boolean;
}

const Kalendar: React.FC<KalendarProps> = ({ autoOpenComposer }) => {
  const intl = useIntl();
  const location = useLocation();
  const history = useHistory();
  const view = resolveView(location.pathname);
  const title = intl.formatMessage(messages.title);
  const [composerOpen, setComposerOpen] = useState(Boolean(autoOpenComposer));

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

  const closeComposer = useCallback(() => {
    setComposerOpen(false);
    // If we arrived via /composer or /new, drop back to the plain
    // Spiral URL so the composer doesn't reopen on refresh.
    if (autoOpenComposer) history.replace('/hub/kalendar');
  }, [autoOpenComposer, history]);

  const handleCreated = useCallback(
    (created: CreatedEvent) => {
      setComposerOpen(false);
      // Slug is preferred (human-readable URL, added 2026-08-14);
      // `id` is the fallback for older events lacking a slug.
      history.push(`/hub/kalendar/${created.slug ?? created.id}`);
    },
    [history],
  );

  return (
    <Stage label={title}>
      <Helmet>
        <title>{title}</title>
        <meta name='robots' content='noindex' />
      </Helmet>

      {/* `<FeedDrum>` was designed for the /home column-scroll feed,
          which is document-scrolled and gets its height from content.
          Kalendar's faces (iframe + list) need to fill Stage instead.
          `.stage-fill` is the shared Stage archetype for that shape
          (see `_kronk_stage.scss` — it grows to fill the Stage cell
          AND stretches its `.feed-drum` / `.feed-drum__live` children
          so the iframe/list get real vertical space). Was the local
          `.kalendar-shell` when this landed 2026-08-13 (Tal: "the
          view is all too small"); systemised into the shared archetype
          same day so Map, Kommunity etc. can adopt-not-copy it. */}
      <div className='stage-fill'>
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

      {composerOpen && (
        <EventComposer onCancel={closeComposer} onCreated={handleCreated} />
      )}
    </Stage>
  );
};

// eslint-disable-next-line import/no-default-export
export default Kalendar;
