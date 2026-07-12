import { FormattedMessage } from 'react-intl';

import { NavLink } from 'react-router-dom';

import ExploreIcon from '@/material-icons/400-24px/explore.svg?react';
import HomeIcon from '@/material-icons/400-24px/home.svg?react';
import PersonIcon from '@/material-icons/400-24px/person.svg?react';

// Three-way switcher between Kronk's primary user surfaces (Feed / Profile / Hub).
// Ships as its own component so the layout can slot it into either the top
// chrome (desktop, text-only) or the bottom tab-bar (mobile, icon+label)
// without duplication.
//
// Wire-up to routes:
//   Feed    → /home
//   Profile → /@me   (SPA resolves to the signed-in account)
//   Hub     → /hub

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

  return (
    <nav
      className={`hub-switcher hub-switcher--${variant}`}
      aria-label='Primary surfaces'
    >
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
          <FormattedMessage id='hub_switcher.feed' defaultMessage='Feed' />
        </span>
      </NavLink>
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
          <FormattedMessage
            id='hub_switcher.profile'
            defaultMessage='Profile'
          />
        </span>
      </NavLink>
      <NavLink
        to='/hub'
        className='hub-switcher__item'
        activeClassName='hub-switcher__item--active'
      >
        {showIcons && (
          <span className='hub-switcher__icon' aria-hidden>
            <ExploreIcon />
          </span>
        )}
        <span className='hub-switcher__label'>
          <FormattedMessage id='hub_switcher.hub' defaultMessage='Hub' />
        </span>
      </NavLink>
    </nav>
  );
};
