import { useCallback, useEffect } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import { useLocation, useHistory } from 'react-router-dom';

import { Stage } from 'mastodon/components/stage';

import { AnsweredPanel } from './answered_panel';
import { AskPanel } from './ask_panel';
import { DeckPanel } from './deck_panel';
import { SettingsPanel } from './settings_panel';
import { StarsBackground } from './stars_background';
import { TodayPanel } from './today_panel';

// Kuestions v2 shell. Panel state is fully URL-driven now — the
// Frame's <AutoSpaceViewPicker> in KronkFrame.SpaceNav navigates by
// pushing /hub/kuestions/<view>, and this component derives the
// current panel from location.pathname on every render. No internal
// state, no per-space in-Stage nav bar; the Frame provides both.

const messages = defineMessages({
  title: { id: 'kuestions.title', defaultMessage: 'Ƙuestions' },
});

export type KuestionsPanelKey =
  | 'today'
  | 'deck'
  | 'answered'
  | 'ask'
  | 'settings';

const PATH_TO_PANEL: Record<string, KuestionsPanelKey> = {
  ask: 'ask',
  today: 'today',
  answered: 'answered',
  settings: 'settings',
};

const panelFromPath = (pathname: string): KuestionsPanelKey => {
  const tail = pathname.split('/').filter(Boolean).pop();
  return (tail ? PATH_TO_PANEL[tail] : undefined) ?? 'deck';
};

// Route signature keeps `multiColumn` for compatibility with the
// generic route wrapper but the Stage owns its own geometry so the
// prop is not read here.
const Questions: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();
  const location = useLocation();
  const history = useHistory();
  const panel = panelFromPath(location.pathname);

  const handleGoDeck = useCallback(() => {
    if (location.pathname !== '/hub/kuestions') {
      history.replace('/hub/kuestions');
    }
  }, [history, location.pathname]);

  // Keyboard: Escape closes any sheet-y modal panel (Ask / Settings)
  // back to the deck. Deck / Today / Answered are top-level; leave
  // them alone. Matches the prototype's "back to deck" affordance.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (panel === 'ask' || panel === 'settings') {
        handleGoDeck();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [panel, handleGoDeck]);

  return (
    <Stage label={intl.formatMessage(messages.title)}>
      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
      </Helmet>

      {/* SpaceBadge + view picker are Frame-provided via
          <AutoSpaceBadge> and <AutoSpaceViewPicker> in ui/index.jsx —
          same treatment on every korner route. */}

      <div className='kuestions-shell'>
        <StarsBackground />

        <div className='kuestions-panels'>
          {panel === 'today' && <TodayPanel />}
          {panel === 'deck' && <DeckPanel />}
          {panel === 'answered' && <AnsweredPanel onGoDeck={handleGoDeck} />}
          {panel === 'ask' && <AskPanel onDone={handleGoDeck} />}
          {panel === 'settings' && <SettingsPanel />}
        </div>
      </div>
    </Stage>
  );
};

export { Questions };
