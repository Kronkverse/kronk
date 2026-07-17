import { FormattedMessage } from 'react-intl';

import { NavLink } from 'react-router-dom';

import ChatIcon from '@/material-icons/400-24px/chat.svg?react';
import HomeIcon from '@/material-icons/400-24px/home.svg?react';
import PersonIcon from '@/material-icons/400-24px/person.svg?react';
import { useAppSelector } from 'mastodon/store';

// Three-way switcher between Kronk's primary personal surfaces —
// Me / Home / Nudges (in that order). Ships as its own component so the
// layout can slot it into either the top chrome (desktop, text) or the
// bottom tab-bar (mobile, icon+label) without duplication.
//
//   Me      → /@me   (SPA resolves to the signed-in account)
//   Home    → /home
//   Nudges  → /nudges  (activity; carries the unread badge)
//
// Hub is NOT here — it lives as an icon at the top of the korner rail.

interface HubSwitcherProps {
  variant?: 'top' | 'bottom';
  currentAccountUsername?: string;
}

export const HubSwitcher = ({
  variant = 'top',
  currentAccountUsername,
}: HubSwitcherProps) => {
  const profilePath = currentAccountUsername
    ? `/@${currentAccountUsername}`
    : '/getting-started';
  const showIcons = variant === 'bottom';

  const unreadNudges = useAppSelector(
    (state) => state.notificationGroups.unreadNudgeCount,
  );

  return (
    <nav
      className={`hub-switcher hub-switcher--${variant}`}
      aria-label='Primary surfaces'
    >
      <NavLink
        to={profilePath}
        className='hub-switcher__item'
        activeClassName='hub-switcher__item--active'
      >
        {showIcons && (
          <span className='hub-switcher__icon' aria-hidden>
            <PersonIcon />
          </span>
        )}
        <span className='hub-switcher__label'>
          <FormattedMessage id='hub_switcher.me' defaultMessage='Me' />
        </span>
      </NavLink>
      <NavLink
        to='/home'
        className='hub-switcher__item'
        activeClassName='hub-switcher__item--active'
      >
        {showIcons && (
          <span className='hub-switcher__icon' aria-hidden>
            <HomeIcon />
          </span>
        )}
        <span className='hub-switcher__label'>
          <FormattedMessage id='hub_switcher.home' defaultMessage='Home' />
        </span>
      </NavLink>
      <NavLink
        to='/nudges'
        className='hub-switcher__item'
        activeClassName='hub-switcher__item--active'
      >
        {showIcons && (
          <span className='hub-switcher__icon' aria-hidden>
            <ChatIcon />
          </span>
        )}
        <span className='hub-switcher__label'>
          <FormattedMessage id='hub_switcher.nudges' defaultMessage='Nudges' />
        </span>
        {unreadNudges > 0 && (
          <span
            className='hub-switcher__badge'
            aria-label={`${unreadNudges} unread`}
          >
            {unreadNudges}
          </span>
        )}
      </NavLink>
    </nav>
  );
};
