import { useCallback, useEffect, useRef } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import type { KuestionsPanelKey } from './index';

// Prototype's membrane nav: Ƙ glyph → three pillars (Today, Ƙuestions,
// Answered) → gear → gliding light pool underline. Ask / Settings
// don't get their own pillar; the pool parks under the nearest peer
// so the visual affordance still reads.

const messages = defineMessages({
  today: { id: 'kuestions.nav.today', defaultMessage: 'Today' },
  deck: { id: 'kuestions.nav.deck', defaultMessage: 'Ƙuestions' },
  answered: { id: 'kuestions.nav.answered', defaultMessage: 'Answered' },
  settings: { id: 'kuestions.nav.settings', defaultMessage: 'Settings' },
});

// Which "true" pillar (today/deck/answered) does a modal panel park under?
const POOL_PARK: Record<KuestionsPanelKey, KuestionsPanelKey> = {
  today: 'today',
  deck: 'deck',
  answered: 'answered',
  ask: 'today',
  settings: 'answered',
};

interface MembraneNavProps {
  active: KuestionsPanelKey;
  onChange: (next: KuestionsPanelKey) => void;
}

export const MembraneNav: React.FC<MembraneNavProps> = ({
  active,
  onChange,
}) => {
  const intl = useIntl();
  const poolRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLButtonElement>(null);
  const deckRef = useRef<HTMLButtonElement>(null);
  const answeredRef = useRef<HTMLButtonElement>(null);

  const movePool = useCallback(() => {
    const target: KuestionsPanelKey = POOL_PARK[active];
    const el =
      target === 'today'
        ? todayRef.current
        : target === 'answered'
          ? answeredRef.current
          : deckRef.current;
    const pool = poolRef.current;
    if (!el || !pool) return;
    const container = el.parentElement?.parentElement; // .kuestions-membrane
    if (!container) return;
    const r = el.getBoundingClientRect();
    const cr = container.getBoundingClientRect();
    pool.style.left = `${r.left - cr.left + r.width / 2}px`;
    pool.style.width = `${Math.max(40, r.width - 20)}px`;
    pool.classList.remove('kuestions-membrane__pool--glint');
    // Force reflow so re-applying the class re-triggers the animation.
    void pool.offsetWidth;
    pool.classList.add('kuestions-membrane__pool--glint');
  }, [active]);

  useEffect(() => {
    movePool();
    window.addEventListener('resize', movePool);
    return () => {
      window.removeEventListener('resize', movePool);
    };
  }, [movePool]);

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

  return (
    <div className='kuestions-membrane'>
      <div className='kuestions-membrane__glyph' aria-hidden>
        Ƙ
      </div>
      <div className='kuestions-membrane__pillars' role='tablist'>
        <button
          ref={todayRef}
          role='tab'
          type='button'
          className='kuestions-membrane__pillar'
          aria-selected={active === 'today'}
          onClick={handleToday}
        >
          {intl.formatMessage(messages.today)}
        </button>
        <button
          ref={deckRef}
          role='tab'
          type='button'
          className='kuestions-membrane__pillar'
          aria-selected={active === 'deck' || active === 'ask'}
          onClick={handleDeck}
        >
          {intl.formatMessage(messages.deck)}
        </button>
        <button
          ref={answeredRef}
          role='tab'
          type='button'
          className='kuestions-membrane__pillar'
          aria-selected={active === 'answered' || active === 'settings'}
          onClick={handleAnswered}
        >
          {intl.formatMessage(messages.answered)}
        </button>
      </div>
      <button
        type='button'
        className='kuestions-membrane__gear'
        onClick={handleSettings}
        aria-label={intl.formatMessage(messages.settings)}
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
      <div className='kuestions-membrane__wire'>
        <div ref={poolRef} className='kuestions-membrane__pool' />
      </div>
    </div>
  );
};
