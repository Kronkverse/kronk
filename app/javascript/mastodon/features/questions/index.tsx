import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';

import { Column } from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';

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

const messages = defineMessages({
  title: { id: 'kuestions.title', defaultMessage: 'Ƙuestions' },
});

export type KuestionsPanelKey =
  | 'today'
  | 'deck'
  | 'answered'
  | 'ask'
  | 'settings';

const Questions: React.FC<{ multiColumn?: boolean }> = ({ multiColumn }) => {
  const intl = useIntl();
  const Icon = useKornerIcon('kuestions');
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
    <Column bindToDocument label={intl.formatMessage(messages.title)}>
      <ColumnHeader
        title={intl.formatMessage(messages.title)}
        icon='korner'
        iconComponent={Icon}
        multiColumn={multiColumn}
      />

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
    </Column>
  );
};

export { Questions };
