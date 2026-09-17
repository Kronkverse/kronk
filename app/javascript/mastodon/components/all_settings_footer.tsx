import { FormattedMessage } from 'react-intl';

import { Link } from 'react-router-dom';

import SettingsIcon from '@/material-icons/400-24px/settings.svg?react';
import { Icon } from 'mastodon/components/icon';

// The "All settings" call-to-action that sits at the bottom of every
// settings page (Tal 2026-09-04). The top-left SettingsBadge is now
// contextual — it takes you back to the space you were on when you
// tapped the cog — so a persistent affordance for "just show me
// everything I can configure" needs its own place. Bottom of page is
// natural (after you've done what you came here for) and doesn't
// compete with the top-left back nav.
//
// Small dedicated primitive rather than a bespoke `<Link>` per
// settings page so a change to the treatment lands everywhere at
// once. Drop it in as the last child of a settings surface.

export const AllSettingsFooter: React.FC = () => (
  <div className='all-settings-footer'>
    <Link to='/settings' className='all-settings-footer__link'>
      <Icon
        id='settings'
        icon={SettingsIcon}
        className='all-settings-footer__icon'
      />
      <span className='all-settings-footer__label'>
        <FormattedMessage
          id='all_settings_footer.link'
          defaultMessage='All settings'
        />
      </span>
    </Link>
  </div>
);
