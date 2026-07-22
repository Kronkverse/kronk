import { useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import type { KuestionsPanelKey } from './index';

// In-space tabs for Kuestions. Deliberately DIFFERENT from the top
// Membrane switcher (Me / Home / Hub / Nudges) so the two layers read
// as distinct:
//
//   Top membrane  → text-only pillars with a gliding purple wire pool
//                   underline. The primary Kronk nav; one per session.
//   Space tabs    → pill segments with a filled active state. The
//                   secondary nav *inside* a korner; every space that
//                   needs a sub-nav can adopt this pattern.
//
// Space-level settings are reached via the gear on the KornerSubBar
// breadcrumb — no gear in the tab row.

const messages = defineMessages({
  today: { id: 'kuestions.nav.today', defaultMessage: 'Today' },
  deck: { id: 'kuestions.nav.deck', defaultMessage: 'Deck' },
  answered: { id: 'kuestions.nav.answered', defaultMessage: 'Answered' },
});

// Ask / Settings aren't top-level tabs — they're modal-ish sub-panels
// launched from the deck or the breadcrumb gear. When either is
// active we still highlight the "parent" tab so the user knows where
// they'll return.
const PARENT_TAB: Record<KuestionsPanelKey, KuestionsPanelKey> = {
  today: 'today',
  deck: 'deck',
  answered: 'answered',
  ask: 'deck',
  settings: 'answered',
};

interface SpaceTabsProps {
  active: KuestionsPanelKey;
  onChange: (next: KuestionsPanelKey) => void;
}

export const SpaceTabs: React.FC<SpaceTabsProps> = ({ active, onChange }) => {
  const intl = useIntl();

  const handleToday = useCallback(() => {
    onChange('today');
  }, [onChange]);
  const handleDeck = useCallback(() => {
    onChange('deck');
  }, [onChange]);
  const handleAnswered = useCallback(() => {
    onChange('answered');
  }, [onChange]);

  const parent = PARENT_TAB[active];

  return (
    <div className='space-tabs'>
      <div className='space-tabs__group' role='tablist'>
        <button
          type='button'
          role='tab'
          className='space-tabs__pill'
          aria-selected={parent === 'today'}
          onClick={handleToday}
        >
          {intl.formatMessage(messages.today)}
        </button>
        <button
          type='button'
          role='tab'
          className='space-tabs__pill'
          aria-selected={parent === 'deck'}
          onClick={handleDeck}
        >
          {intl.formatMessage(messages.deck)}
        </button>
        <button
          type='button'
          role='tab'
          className='space-tabs__pill'
          aria-selected={parent === 'answered'}
          onClick={handleAnswered}
        >
          {intl.formatMessage(messages.answered)}
        </button>
      </div>
    </div>
  );
};
