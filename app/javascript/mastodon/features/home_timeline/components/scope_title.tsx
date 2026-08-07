import { useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

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
// stays changeable: tap (or Enter/Space) steps forward around the scope ring,
// arrow keys step either way, and a swipe on the feed does the same on touch.

const messages = defineMessages({
  cycle: {
    id: 'home.scope.cycle',
    defaultMessage: 'Change what you see (currently {scope})',
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

  if (!face) return null;

  return (
    <div
      className='scope-title'
      role='button'
      tabIndex={0}
      aria-label={intl.formatMessage(messages.cycle, { scope: face.label })}
      title={ariaLabel}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {/* Keyed on the scope so a change remounts and replays the fade-in. */}
      <div className='scope-title__inner' key={face.key}>
        <h1 className='space-header__title'>{face.label}</h1>
        {face.desc && <p className='space-header__tagline'>{face.desc}</p>}
      </div>
    </div>
  );
};
