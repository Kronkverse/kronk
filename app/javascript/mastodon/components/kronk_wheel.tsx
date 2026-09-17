// Kronk's shared radial wheel. Powers /me, /settings, /kronk — one
// geometry contract, one interaction model, one place to change
// the ring's dashed pattern or the active-spoke glow.
//
// **Balance and fit.** The wheel auto-sizes to spoke count (few
// spokes → small wheel, many spokes → larger wheel) and caps to
// the viewport width so spokes never get cut off on phones. All
// derived from `--kronk-wheel-count`, set inline from React —
// nothing here needs a media query.
//
// **Interaction.** A spoke renders as `<Link>` (SPA route, `to:`),
// `<a>` (full-page nav / Rails-served, `href:`), `<button>`
// (action, `onClick:`), or an inert placeholder (none of the
// above, or `disabled: true`).
//
// **Centre.** Consumers compose a `<KronkWheelCentre>` companion —
// picks the semantic element (Link / button / static) so the
// bubble at the middle can navigate, open an overlay, or just sit
// there without a container that assumes one shape.
//
// See `docs/spaces/settings.md`, `docs/spaces/you.md`,
// `docs/spaces/kronk.md` for the three consumers.

import type { CSSProperties, MouseEventHandler, ReactNode } from 'react';

import classNames from 'classnames';
import { Link } from 'react-router-dom';

import { Icon } from 'mastodon/components/icon';
import type { IconProp } from 'mastodon/components/icon';

export interface KronkWheelSpoke {
  key: string;
  label: string;
  // Either a material icon (the norm) OR a text glyph (Ж, ₭, etc.).
  // Setting neither renders as a placeholder bubble; consumers
  // typically don't do that unless a page is deliberately "soon".
  icon?: IconProp;
  glyph?: string;
  // Where clicking a spoke lands. Exactly one is expected:
  //   `to`      — SPA route (uses <Link>).
  //   `href`    — full-page nav (uses <a>; Rails-served, external).
  //   `onClick` — custom action (uses <button>).
  // If all three are absent, the spoke is inert.
  to?: string;
  href?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  // Rails UJS DELETE (e.g. sign-out); only meaningful with `href`.
  method?: 'delete';
  // Filled-purple emphasis for the current page.
  active?: boolean;
  // Explicit disable — overrides the "has a target" inference above.
  disabled?: boolean;
  // Accessible name; defaults to `label`.
  ariaLabel?: string;
}

interface KronkWheelProps {
  spokes: KronkWheelSpoke[];
  // The wheel's aria-label — the surface's name (e.g. "Settings").
  label?: string;
  // Optional class on the outer <nav>, for consumer-specific
  // adjustments (positioning, backdrop, etc.).
  className?: string;
  // Children slot — where a `<KronkWheelCentre>` goes.
  children?: ReactNode;
}

export const KronkWheel: React.FC<KronkWheelProps> = ({
  spokes,
  label,
  className,
  children,
}) => {
  const count = Math.max(spokes.length, 1);
  const wheelStyle = {
    // Set inline so `_kronk_wheel.scss` can derive radius + label
    // width from a real integer. React accepts custom properties on
    // `style` when the key starts with `--`.
    '--kronk-wheel-count': count,
  } as CSSProperties;

  return (
    <nav
      className={classNames('kronk-wheel', className)}
      aria-label={label}
      style={wheelStyle}
    >
      <div className='kronk-wheel__ring' aria-hidden />
      {children}
      {spokes.map((spoke, i) => (
        <SpokeElement key={spoke.key} spoke={spoke} angle={(i / count) * 360} />
      ))}
    </nav>
  );
};

const SpokeElement: React.FC<{
  spoke: KronkWheelSpoke;
  angle: number;
}> = ({ spoke, angle }) => {
  const style = {
    '--spoke-angle': `${angle}deg`,
  } as CSSProperties;

  const className = classNames('kronk-wheel__spoke', {
    'kronk-wheel__spoke--active': spoke.active,
    'kronk-wheel__spoke--placeholder': spoke.disabled,
  });

  const ariaLabel = spoke.ariaLabel ?? spoke.label;
  const inner = <SpokeInner spoke={spoke} />;

  if (spoke.disabled) {
    return (
      <button
        type='button'
        className={className}
        style={style}
        disabled
        aria-disabled='true'
        aria-label={ariaLabel}
      >
        {inner}
      </button>
    );
  }

  if (spoke.to) {
    return (
      <Link
        to={spoke.to}
        className={className}
        style={style}
        aria-label={ariaLabel}
      >
        {inner}
      </Link>
    );
  }

  if (spoke.href) {
    return (
      <a
        href={spoke.href}
        className={className}
        style={style}
        data-method={spoke.method}
        aria-label={ariaLabel}
      >
        {inner}
      </a>
    );
  }

  return (
    <button
      type='button'
      className={className}
      style={style}
      onClick={spoke.onClick}
      aria-label={ariaLabel}
    >
      {inner}
    </button>
  );
};

const SpokeInner: React.FC<{ spoke: KronkWheelSpoke }> = ({ spoke }) => (
  <>
    <span className='kronk-wheel__spoke-bubble' aria-hidden>
      {spoke.glyph ? (
        <span className='kronk-wheel__spoke-glyph'>{spoke.glyph}</span>
      ) : spoke.icon ? (
        <Icon
          id={spoke.key}
          icon={spoke.icon}
          className='kronk-wheel__spoke-icon'
        />
      ) : null}
    </span>
    <span className='kronk-wheel__spoke-label'>{spoke.label}</span>
  </>
);

// Wheel centre. Three variants — pick the one that matches the
// surface's affordance:
//
//   <KronkWheelCentre to="/kronk">           — SPA navigation
//   <KronkWheelCentre href="/settings">      — full-page nav (rare)
//   <KronkWheelCentre onClick={openPreview}> — action (avatar preview)
//   <KronkWheelCentre>                       — inert (settings gear)
//
// Consumers hand the styled content (avatar image, glyph span, icon
// SVG) as children. The centre class carries the bubble chrome
// (round, purple border, hover glow) so nothing needs to be
// restyled per-hub.
interface KronkWheelCentreProps {
  to?: string;
  href?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  ariaLabel?: string;
  role?: string;
  children?: ReactNode;
}

export const KronkWheelCentre: React.FC<KronkWheelCentreProps> = ({
  to,
  href,
  onClick,
  ariaLabel,
  role,
  children,
}) => {
  if (to) {
    return (
      <Link to={to} className='kronk-wheel__centre' aria-label={ariaLabel}>
        {children}
      </Link>
    );
  }

  if (href) {
    return (
      <a href={href} className='kronk-wheel__centre' aria-label={ariaLabel}>
        {children}
      </a>
    );
  }

  if (onClick) {
    return (
      <button
        type='button'
        className='kronk-wheel__centre'
        onClick={onClick}
        aria-label={ariaLabel}
      >
        {children}
      </button>
    );
  }

  return (
    <div className='kronk-wheel__centre' role={role} aria-label={ariaLabel}>
      {children}
    </div>
  );
};

// Reuse this in consumers to render a purple text glyph inside the
// centre bubble (Ж, ₭, initial letter).
export const KronkWheelCentreGlyph: React.FC<{ children: ReactNode }> = ({
  children,
}) => (
  <span className='kronk-wheel__centre-glyph' aria-hidden>
    {children}
  </span>
);
