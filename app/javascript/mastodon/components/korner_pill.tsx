import classNames from 'classnames';

import { Icon } from './icon';
import type { IconProp } from './icon';

// KornerPill — the pill-shaped action button that populates
// `<KornerActionBar>`. Rounded, purple-accented by default; two
// variants for the situations that already exist across the
// platform:
//
//   • `default`      — the neutral action (Invite, Edit, Share…).
//                      Purple accent, muted background.
//   • `destructive`  — the delete / leave / cancel action. Warn-red
//                      so the intent reads as "this ends something."
//   • `primary`      — the loud CTA (Join Huddle, Play, Attend now).
//                      Filled purple.
//
// Icon slot is optional — a Kronk Icon component reference (imported
// SVG); label is the button text. Callers pass a plain `onClick`;
// no built-in busy state (unlike ComposeShell / ConfirmDialog) —
// state changes at the caller.

type KornerPillVariant = 'default' | 'primary' | 'destructive';

interface KornerPillProps {
  label: React.ReactNode;
  icon?: IconProp;
  iconId?: string;
  variant?: KornerPillVariant;
  active?: boolean;
  disabled?: boolean;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  // Accessible label override — required when the button is icon-only
  // (rare — the primitive expects a text label).
  ariaLabel?: string;
}

export const KornerPill: React.FC<KornerPillProps> = ({
  label,
  icon,
  iconId,
  variant = 'default',
  active = false,
  disabled = false,
  className,
  onClick,
  ariaLabel,
}) => (
  <button
    type='button'
    className={classNames(
      'korner-pill',
      `korner-pill--${variant}`,
      { 'korner-pill--active': active },
      className,
    )}
    disabled={disabled}
    onClick={onClick}
    aria-label={ariaLabel}
  >
    {icon && iconId && (
      <Icon id={iconId} icon={icon} className='korner-pill__icon' />
    )}
    <span className='korner-pill__label'>{label}</span>
  </button>
);
