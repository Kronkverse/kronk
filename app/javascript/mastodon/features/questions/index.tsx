import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';

import { Stage } from 'mastodon/components/stage';

import { AnsweredPanel } from './answered_panel';
import { AskPanel } from './ask_panel';
import { DeckPanel } from './deck_panel';
import { MembraneNav } from './membrane_nav';
import { SettingsPanel } from './settings_panel';
import { StarsBackground } from './stars_background';
import { TodayPanel } from './today_panel';

// Kuestions v2 shell. Membrane nav across the top (Today / Ƙuestions
// / Answered), gear ➞ Settings, FAB ➞ Ask. Prototype:
// docs/kronk_kuestions_prototype.html (visual source of truth).
// Space doc: docs/spaces/kuestions.md.
//
// First korner on the new Stage layer (see components/stage.tsx). The
// Stage sits inside the invariant Frame edges; Kuestions attaches its
// own backdrop (StarsBackground + MembraneNav) directly to the Stage
// so the space's chrome MESHES with the frame instead of sitting in a
// boxed sub-panel.

const messages = defineMessages({
  title: { id: 'kuestions.title', defaultMessage: 'Ƙuestions' },
});

export type KuestionsPanelKey =
  | 'today'
  | 'deck'
  | 'answered'
  | 'ask'
  | 'settings';

// Route signature keeps `multiColumn` for compatibility with the
// generic route wrapper but the Stage owns its own geometry so the
// prop is not read here.
const Questions: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();
  const [panel, setPanel] = useState<KuestionsPanelKey>('deck');

  const handleGoDeck = useCallback(() => {
    setPanel('deck');
  }, []);

  // Keyboard: Escape closes any sheet-y modal panel (Ask / Settings)
  // to the deck. Deck / Today / Answered are top-level; leave them
  // alone. Matches the prototype's "back to deck" affordance.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (panel === 'ask' || panel === 'settings') {
        setPanel('deck');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [panel]);

  return (
    <Stage label={intl.formatMessage(messages.title)}>
      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
      </Helmet>

      <div className='kuestions-shell'>
        <StarsBackground />
        <MembraneNav active={panel} onChange={setPanel} />

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
