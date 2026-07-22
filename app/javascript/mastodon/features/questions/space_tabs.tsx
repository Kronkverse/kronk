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
// The gear (space settings) sits alongside the pills but visually
// separate — it's a fifth thing, not a fourth tab.

const messages = defineMessages({
  today: { id: 'kuestions.nav.today', defaultMessage: 'Today' },
  deck: { id: 'kuestions.nav.deck', defaultMessage: 'Deck' },
  answered: { id: 'kuestions.nav.answered', defaultMessage: 'Answered' },
  settings: { id: 'kuestions.nav.settings', defaultMessage: 'Settings' },
});

// Ask / Settings aren't top-level tabs — they're modal-ish sub-panels
// launched from the deck or the gear. When either is active we still
// highlight the "parent" tab so the user knows where they'll return.
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
  const handleSettings = useCallback(() => {
    onChange('settings');
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
      <button
        type='button'
        className='space-tabs__gear'
        onClick={handleSettings}
        aria-label={intl.formatMessage(messages.settings)}
        aria-pressed={active === 'settings'}
        title={intl.formatMessage(messages.settings)}
      >
        <svg
          width='18'
          height='18'
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth='1.75'
        >
          <circle cx='12' cy='12' r='3' />
          <path d='M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z' />
        </svg>
      </button>
    </div>
  );
};
