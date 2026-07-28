import { useCallback } from 'react';

import classNames from 'classnames';
import { useHistory } from 'react-router-dom';

import type { IconProp } from 'mastodon/components/icon';
import { Icon } from 'mastodon/components/icon';

// Shared "Korner card" — the frame that every space (Kommons, Kuestions,
// Wachuneed, Booth, Events…) uses when its post_type or attached record
// warrants a distinguished feed presentation.
//
// The wrapper owns:
//   - the outer container (border, box-shadow)
//   - the badge row (icon + label + optional tag)
//
// Everything below the badge (body, footer, per-space chrome) is passed
// in as children so each Korner can compose the details it needs. Per-
// Korner SCSS lives in its own partial and continues to apply because we
// pass the Korner's legacy class name through via `className`.

export interface KornerBadge {
  icon: IconProp;
  iconId: string;
  label: React.ReactNode;
  tag?: React.ReactNode;
}

interface Props {
  korner: string;
  variant?: string;
  className?: string;
  badge: KornerBadge;
  // When set, the whole card becomes a link to this SPA path: clicking
  // anywhere on it (that isn't an inner control calling stopPropagation)
  // navigates there, with keyboard (Enter/Space) support, `role="link"`,
  // and a focus ring / hover affordance from the shared stylesheet. Inner
  // controls (e.g. Event RSVP buttons) opt out by stopping propagation.
  to?: string;
  onClick?: (e: React.MouseEvent) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  role?: string;
  tabIndex?: number;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export const StatusKornerCard: React.FC<Props> = ({
  // `korner` is part of the card's stable prop surface (every card
  // variant declares which korner it belongs to); rendering doesn't
  // consume it directly today but callers depend on the signature.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  korner,
  variant,
  className,
  badge,
  to,
  onClick,
  onKeyDown,
  role,
  tabIndex,
  children,
  style,
}) => {
  const history = useHistory();
  const rootClass = classNames(
    'status-korner-card',
    variant && `status-korner-card--${variant}`,
    className,
  );

  const badgeClass = classNames(
    'status-korner-card__badge',
    className && `${className}__badge`,
  );

  const badgeIconClass = classNames(
    'status-korner-card__badge-icon',
    className && `${className}__badge-icon`,
  );

  const badgeTagClass = classNames(
    'status-korner-card__type-tag',
    className && `${className}__type-tag`,
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      onClick?.(e);
      if (to && !e.defaultPrevented) {
        e.stopPropagation();
        history.push(to);
      }
    },
    [onClick, to, history],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      onKeyDown?.(e);
      if (to && !e.defaultPrevented && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        e.stopPropagation();
        history.push(to);
      }
    },
    [onKeyDown, to, history],
  );

  // A `to` card is a link by default (callers can still override the role).
  const effectiveRole = role ?? (to ? 'link' : undefined);
  const effectiveTabIndex = tabIndex ?? (to ? 0 : undefined);

  return (
    <div
      className={rootClass}
      style={style}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role={effectiveRole}
      tabIndex={effectiveTabIndex}
    >
      <div className={badgeClass}>
        <span className={badgeIconClass}>
          <Icon id={badge.iconId} icon={badge.icon} />
        </span>
        <span className='status-korner-card__badge-label'>{badge.label}</span>
        {badge.tag !== undefined && badge.tag !== null && (
          <span className={badgeTagClass}>{badge.tag}</span>
        )}
      </div>
      {children}
    </div>
  );
};
