import { NavLink } from 'react-router-dom';
import { FormattedMessage } from 'react-intl';

// Three-way switcher between Kronk's primary user surfaces (Feed / Profile / Hub).
// Ships as its own component so the layout can slot it into either the
// top chrome (desktop) or the bottom tab-bar (mobile) without duplication.
//
// Wire-up to routes:
//   Feed    → /home
//   Profile → /@me   (SPA resolves to the signed-in account)
//   Hub     → /hub

interface HubSwitcherProps {
  variant?: 'top' | 'bottom';
  currentAccountUsername?: string;
}

export const HubSwitcher = ({ variant = 'top', currentAccountUsername }: HubSwitcherProps) => {
  const profilePath = currentAccountUsername ? `/@${currentAccountUsername}` : '/getting-started';

  return (
    <nav className={`hub-switcher hub-switcher--${variant}`} aria-label='Primary surfaces'>
      <NavLink to='/home' className='hub-switcher__item' activeClassName='hub-switcher__item--active'>
        <FormattedMessage id='hub_switcher.feed' defaultMessage='Feed' />
      </NavLink>
      <NavLink to={profilePath} className='hub-switcher__item' activeClassName='hub-switcher__item--active'>
        <FormattedMessage id='hub_switcher.profile' defaultMessage='Profile' />
      </NavLink>
      <NavLink to='/hub' className='hub-switcher__item' activeClassName='hub-switcher__item--active'>
        <FormattedMessage id='hub_switcher.hub' defaultMessage='Hub' />
      </NavLink>
    </nav>
  );
};
