import { Link } from 'react-router-dom';

import ChevronRightIcon from '@/material-icons/400-24px/chevron_right.svg?react';

// Variant of SettingsRow for "tap to go somewhere" — Rails link-outs
// (password, 2FA, delete, exports), SPA drilldowns (Manage lists),
// or destructive actions. Chevron indicates the row is a jump, not
// a toggle.
//
// One of `to` (SPA React Router push) or `href` (native anchor —
// Rails or external) must be provided. `destructive` reds the label.

interface BaseProps {
  label: string;
  description?: string;
  destructive?: boolean;
}

interface SpaProps extends BaseProps {
  to: string;
  href?: never;
}

interface AnchorProps extends BaseProps {
  href: string;
  to?: never;
}

type Props = SpaProps | AnchorProps;

export const SettingsActionRow: React.FC<Props> = ({
  label,
  description,
  destructive = false,
  to,
  href,
}) => {
  const className = `settings-page__action-row${
    destructive ? ' settings-page__action-row--destructive' : ''
  }`;
  const body = (
    <>
      <div className='settings-page__row-body'>
        <div className='settings-page__row-label'>{label}</div>
        {description && (
          <div className='settings-page__row-desc'>{description}</div>
        )}
      </div>
      <ChevronRightIcon
        className='settings-page__action-chevron'
        aria-hidden='true'
      />
    </>
  );
  return to ? (
    <Link to={to} className={className}>
      {body}
    </Link>
  ) : (
    <a href={href} className={className}>
      {body}
    </a>
  );
};
