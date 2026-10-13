import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import { useLocation, useHistory } from 'react-router-dom';

import type {
  ApiKuestionJSON,
  ApiProfileKuestionJSON,
} from 'mastodon/api_types/kuestions';
import { Stage } from 'mastodon/components/stage';

import { AnsweredPanel } from './answered_panel';
import { DeckPanel } from './deck_panel';
import { KuestionComposer } from './kuestion_composer';
import { ProfilePanel } from './profile_panel';
import { SettingsPanel } from './settings_panel';
import { TodayPanel } from './today_panel';

// Kuestions v2 shell. Panel state is fully URL-driven now — the
// Frame's <AutoSpaceViewPicker> in KronkFrame.SpaceNav navigates by
// pushing /hub/kuestions/<view>, and this component derives the
// current panel from location.pathname on every render. No internal
// panel state.
//
// The composer is a `<ComposeShell>` overlay (2026-08-12) opened at
// /hub/kuestions/composer via the Ж bubble. It renders on top of the
// current panel background — the deck by default, but any panel if
// the user hits Ж without moving. Legacy /hub/kuestions/ask still
// auto-opens the overlay so pre-shell muscle memory + bookmarks work
// (background there is the Answered panel, which holds your asks since
// Yours merged into it on 2026-10-12).

const messages = defineMessages({
  title: { id: 'kuestions.title', defaultMessage: 'Ƙuestions' },
});

export type KuestionsPanelKey =
  | 'today'
  | 'deck'
  | 'answered'
  | 'profile'
  | 'settings';

const PATH_TO_PANEL: Record<string, KuestionsPanelKey> = {
  today: 'today',
  answered: 'answered',
  yours: 'answered', // legacy: Yours merged into Answered 2026-10-12
  ask: 'answered', // legacy: the composer opens over Answered
  profile: 'profile',
  settings: 'settings',
};

const panelFromPath = (pathname: string): KuestionsPanelKey => {
  const tail = pathname.split('/').filter(Boolean).pop();
  return (tail ? PATH_TO_PANEL[tail] : undefined) ?? 'deck';
};

// `/hub/kuestions/composer` is the canonical shell URL; `/ask` is
// preserved as a legacy alias so pre-2026-08-12 links still open the
// composer.
const composerOpenFromPath = (pathname: string): boolean =>
  pathname.endsWith('/composer') || pathname.endsWith('/ask');

// Route signature keeps `multiColumn` for compatibility with the
// generic route wrapper but the Stage owns its own geometry so the
// prop is not read here.
const Questions: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();
  const location = useLocation();
  const history = useHistory();
  const panel = panelFromPath(location.pathname);
  const composerOpen = composerOpenFromPath(location.pathname);

  // Bumped when a fresh kuestion is posted from the composer overlay
  // so the panel it lands on refetches and shows it without a reload.
  const [answeredRefresh, setAnsweredRefresh] = useState(0);
  const [profileRefresh, setProfileRefresh] = useState(0);

  const handleGoDeck = useCallback(() => {
    if (location.pathname !== '/hub/kuestions') {
      history.replace('/hub/kuestions');
    }
  }, [history, location.pathname]);

  const closeComposer = useCallback(() => {
    // Return to whichever panel URL sits below. The composer URL was
    // `/composer` (fresh) or `/ask` (legacy) — neither is a panel, so
    // drop back to the deck landing to keep the URL clean.
    history.push('/hub/kuestions');
  }, [history]);

  const handleCreated = useCallback(
    (created: ApiKuestionJSON | ApiProfileKuestionJSON) => {
      // A profile Kuestion lands in the Profile grid. Any other lands at
      // the top of Answered, where the asker can answer their own and see
      // the running count.
      if (created.kind === 'profile') {
        setProfileRefresh((n) => n + 1);
        history.push('/hub/kuestions/profile');
        return;
      }
      setAnsweredRefresh((n) => n + 1);
      history.push('/hub/kuestions/answered');
    },
    [history],
  );

  // Keyboard: Escape closes the composer overlay (shell handles this
  // internally too) and closes the Settings panel back to the deck.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (composerOpen) return; // shell owns its own Esc handling
      if (panel === 'settings') {
        handleGoDeck();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [composerOpen, panel, handleGoDeck]);

  return (
    <Stage label={intl.formatMessage(messages.title)}>
      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
      </Helmet>

      {/* SpaceBadge + view picker are Frame-provided via
          <AutoSpaceBadge> and <AutoSpaceViewPicker> in ui/index.jsx —
          same treatment on every korner route. */}

      <div className='kuestions-shell'>
        {/* No star field of its own: the Kosmos behind every page is the
            background here too (Tal 2026-10-12). */}
        <div className='kuestions-panels'>
          {panel === 'today' && <TodayPanel />}
          {panel === 'deck' && <DeckPanel />}
          {panel === 'answered' && (
            <AnsweredPanel
              onGoDeck={handleGoDeck}
              refreshKey={answeredRefresh}
            />
          )}
          {panel === 'profile' && <ProfilePanel refreshKey={profileRefresh} />}
          {panel === 'settings' && <SettingsPanel />}
        </div>
      </div>

      {composerOpen && (
        <KuestionComposer onCancel={closeComposer} onCreated={handleCreated} />
      )}
    </Stage>
  );
};

export { Questions };
