import { useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import ChevronLeftIcon from '@/material-icons/400-24px/chevron_left.svg?react';
import ChevronRightIcon from '@/material-icons/400-24px/chevron_right.svg?react';
import { Icon } from 'mastodon/components/icon';

export interface ScopeTitleFace {
  key: string;
  label: string;
  desc?: string;
}

interface Props {
  faces: ScopeTitleFace[];
  value: string;
  onChange: (key: string) => void;
  ariaLabel: string;
}

// ScopeTitle — the home feed's scope label, styled as a space header.
//
// Now that the feed itself turns on the scope drum (FeedDrum), the selector no
// longer needs to be a rotating control — it's just the current scope's name +
// description, in the same fashion as every other space's title/tagline (reuses
// the shared `.space-header__title` / `.space-header__tagline` classes). It
// stays changeable: tap the title (or Enter/Space) steps forward around the
// scope ring, arrow keys step either way, subtle chevrons flanking the title
// step one direction each, and a swipe on the feed does the same on touch.

const messages = defineMessages({
  cycle: {
    id: 'home.scope.cycle',
    defaultMessage: 'Change what you see (currently {scope})',
  },
  prev: {
    id: 'home.scope.prev',
    defaultMessage: 'Previous view',
  },
  next: {
    id: 'home.scope.next',
    defaultMessage: 'Next view',
  },
});

export const ScopeTitle: React.FC<Props> = ({
  faces,
  value,
  onChange,
  ariaLabel,
}) => {
  const intl = useIntl();
  const n = faces.length;
  const found = faces.findIndex((f) => f.key === value);
  const idx = found >= 0 ? found : 0;
  const face = faces[idx];

  const step = useCallback(
    (delta: number) => {
      if (n === 0) return;
      const next = faces[(((idx + delta) % n) + n) % n];
      if (next && next.key !== value) onChange(next.key);
    },
    [faces, idx, n, value, onChange],
  );

  const handleClick = useCallback(() => {
    step(1);
  }, [step]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        step(1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        step(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        step(1);
      }
    },
    [step],
  );

  const handlePrev = useCallback(() => {
    step(-1);
  }, [step]);

  const handleNext = useCallback(() => {
    step(1);
  }, [step]);

  if (!face) return null;

  return (
    <div className='scope-title'>
      {/* Subtle chevrons that step one view each way. They sit absolutely on the
          left/right edges of the title band so they don't push the centred
          `.space-header` around. Kept dim by default and brightened on hover /
          focus so they're an affordance, not chrome that competes with the
          title itself. */}
      <button
        type='button'
        className='scope-title__nav scope-title__nav--prev'
        onClick={handlePrev}
        aria-label={intl.formatMessage(messages.prev)}
        title={intl.formatMessage(messages.prev)}
      >
        <Icon id='chevron-left' icon={ChevronLeftIcon} />
      </button>

      <div
        className='scope-title__label'
        role='button'
        tabIndex={0}
        aria-label={intl.formatMessage(messages.cycle, { scope: face.label })}
        title={ariaLabel}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        {/* Renders the shared `.space-header` block so the scope title sits in
            the exact same place, and at the same scale, as every other space's
            title/tagline. Keyed on the scope so a change replays the fade-in. */}
        <header className='space-header' key={face.key}>
          <h1 className='space-header__title'>{face.label}</h1>
          {face.desc && <p className='space-header__tagline'>{face.desc}</p>}
        </header>
      </div>

      <button
        type='button'
        className='scope-title__nav scope-title__nav--next'
        onClick={handleNext}
        aria-label={intl.formatMessage(messages.next)}
        title={intl.formatMessage(messages.next)}
      >
        <Icon id='chevron-right' icon={ChevronRightIcon} />
      </button>
    </div>
  );
};
