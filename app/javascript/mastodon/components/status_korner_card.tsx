import { useCallback } from 'react';

import classNames from 'classnames';

import type { IconProp } from 'mastodon/components/icon';
import { Icon } from 'mastodon/components/icon';

// Shared "Korner card" — the frame that every space (Kommons, Kuestions,
// Marketplace, Booth, Events…) uses when its post_type or attached record
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
  onClick?: (e: React.MouseEvent) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  role?: string;
  tabIndex?: number;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export const StatusKornerCard: React.FC<Props> = ({
  korner,
  variant,
  className,
  badge,
  onClick,
  onKeyDown,
  role,
  tabIndex,
  children,
  style,
}) => {
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
    },
    [onClick],
  );

  return (
    <div
      className={rootClass}
      style={style}
      onClick={handleClick}
      onKeyDown={onKeyDown}
      role={role}
      tabIndex={tabIndex}
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
