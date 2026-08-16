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
  // Marks the rendered `<header>` as Frame-provided chrome so the
  // Stage's dev-only Frame-parasite warning (see
  // `docs/korners/korner_standard.md` L11) exempts its `<h1>` from
  // the "no local <h1>" check. Set true when this component is the
  // korner's title (rendered from `<AutoSpaceHeader>`); leave false
  // when a non-korner surface (e.g. `/home` Column) drives it.
  frameHeader?: boolean;
}

// ScopeTitle — the shared rotating space header. Renders as the same
// `.space-header` typography every korner uses, but with chevron
// affordances flanking the title so the caller can step through
// faces (view scopes on /home, view keys on a korner). Tap the
// title steps forward; arrow keys step either way.
//
// Was previously `/home`-only under `features/home_timeline/`. Now
// promoted so `<AutoSpaceHeader>` can render it for korners whose
// manifest opts in (`header.rotator: true`) — keeping the Standard's
// one-title-per-space rule while giving spaces with view faces the
// same rotator metaphor `/home` already uses. See
// `docs/korners/korner_standard.md` L11.

const messages = defineMessages({
  cycle: {
    id: 'scope_title.cycle',
    defaultMessage: 'Change what you see (currently {scope})',
  },
  prev: {
    id: 'scope_title.prev',
    defaultMessage: 'Previous view',
  },
  next: {
    id: 'scope_title.next',
    defaultMessage: 'Next view',
  },
});

export const ScopeTitle: React.FC<Props> = ({
  faces,
  value,
  onChange,
  ariaLabel,
  frameHeader = false,
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

  // Tap-anywhere-on-title advances forward — but the click MUST NOT
  // fire when the user meant to tap a chevron. React click bubbling
  // from an inner `<button>` shouldn't reach a sibling `<div>` on
  // paper, but Tal 2026-08-16 reported that on shadow both chevrons
  // step forward. Defensive guard: if the raw event was born on
  // (or inside) a `<button>`, treat it as the button's click and
  // do nothing here — the button's own handler took care of it.
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('button')) return;
      step(1);
    },
    [step],
  );

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

  // Chevron handlers stop propagation belt-and-suspenders so ANY
  // ancestor click listener (Frame chrome, feature-flag overlays,
  // future gesture wrappers) can never intercept the intent.
  const handlePrev = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      step(-1);
    },
    [step],
  );

  const handleNext = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      step(1);
    },
    [step],
  );

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
            title/tagline. Keyed on the scope so a change replays the fade-in.
            `data-frame-header` marks this as Frame-provided chrome when the
            caller sits inside `<Stage>` (Standard L11's parasite check
            exempts headers carrying this attribute). */}
        <header
          className='space-header'
          data-frame-header={frameHeader ? '' : undefined}
          key={face.key}
        >
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

      {/* Position strip across the bottom of the title space: one segment per
          face, the filled one showing where the rotator currently sits. It
          answers "how many views are there, and which am I on?" — which the
          chevrons alone don't, since they give no sense of extent.

          Hidden from assistive tech on purpose: it is a visual restatement of
          the title, which already announces the current view via the label's
          aria-label. Announcing it twice would be noise.

          Skipped entirely at one face — there is no position to show. */}
      {n > 1 && (
        <div className='scope-title__progress' aria-hidden='true'>
          <div
            className='scope-title__progress-thumb'
            style={{
              width: `${100 / n}%`,
              transform: `translateX(${idx * 100}%)`,
            }}
          />
        </div>
      )}
    </div>
  );
};
