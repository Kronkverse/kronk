import { useState, useCallback, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FormattedMessage } from 'react-intl';

import { apiRequestGet } from 'mastodon/api';
import type { ApiAccountJSON } from 'mastodon/api_types/accounts';

// Kronk's Ӂ menu — the floating action button that expands into a
// radial cluster of the per-user actions (Profile, Settings, Post,
// Search, Nudges). Placed bottom-right in the app chrome.
//
// Additive shell for Phase 12. The radial-open geometry, focus trap,
// and keyboard shortcuts iterate on shadow. This ships the surface;
// visual polish lands after visual verification.

interface KronkMenuProps {
  currentAccountUsername?: string;
  unreadNudgesCount?: number;
}

export const KronkMenu = ({ currentAccountUsername, unreadNudgesCount = 0 }: KronkMenuProps) => {
  const [open, setOpen] = useState(false);
  const [followRequestCount, setFollowRequestCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const toggle = useCallback(() => setOpen((prev) => !prev), []);
  const close = useCallback(() => setOpen(false), []);

  // Poll follow-request count on mount and when the menu opens. Kept
  // lightweight — a single accounts list request, no reducer wiring.
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const accounts = await apiRequestGet<ApiAccountJSON[]>('v1/follow_requests', { limit: 40 });
        if (!cancelled) setFollowRequestCount(accounts.length);
      } catch {
        // Silent — the badge is informational.
      }
    };
    void refresh();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', handler);
    return () => { document.removeEventListener('mousedown', handler); };
  }, [open, close]);

  const profilePath = currentAccountUsername ? `/@${currentAccountUsername}` : '/getting-started';

  return (
    <div ref={ref} className={`kronk-menu ${open ? 'kronk-menu--open' : ''}`}>
      <button
        type='button'
        className='kronk-menu__trigger'
        aria-expanded={open}
        aria-label='Kronk menu'
        onClick={toggle}
      >
        <span aria-hidden='true'>Ӂ</span>
        {(unreadNudgesCount + followRequestCount) > 0 && (
          <span className='kronk-menu__badge'>{unreadNudgesCount + followRequestCount}</span>
        )}
      </button>

      {open && (
        <div className='kronk-menu__panel' role='menu'>
          <Link className='kronk-menu__item' to={profilePath} role='menuitem' onClick={close}>
            <FormattedMessage id='kronk_menu.profile' defaultMessage='Profile' />
          </Link>
          {/* /settings/preferences is Rails-served, not the SPA — <a> forces
              a full navigation so the classic settings page loads. */}
          <a className='kronk-menu__item' href='/settings/preferences' role='menuitem' onClick={close}>
            <FormattedMessage id='kronk_menu.settings' defaultMessage='Settings' />
          </a>
          <Link className='kronk-menu__item kronk-menu__item--post' to='/publish' role='menuitem' onClick={close}>
            <FormattedMessage id='kronk_menu.post' defaultMessage='Post' />
          </Link>
          <Link className='kronk-menu__item' to='/search' role='menuitem' onClick={close}>
            <FormattedMessage id='kronk_menu.search' defaultMessage='Search' />
          </Link>
          <Link className='kronk-menu__item' to='/nudges' role='menuitem' onClick={close}>
            <FormattedMessage id='kronk_menu.nudges' defaultMessage='Nudges' />
            {unreadNudgesCount > 0 && <span className='kronk-menu__dot' aria-label={`${unreadNudgesCount} unread`} />}
          </Link>
          {currentAccountUsername && (
            <Link
              className='kronk-menu__item'
              to={`/@${currentAccountUsername}/connections`}
              role='menuitem'
              onClick={close}
            >
              <FormattedMessage id='kronk_menu.connections' defaultMessage='Connections' />
              {followRequestCount > 0 && (
                <span className='kronk-menu__badge' aria-label={`${followRequestCount} follow requests`}>
                  {followRequestCount}
                </span>
              )}
            </Link>
          )}
          <Link className='kronk-menu__item' to='/hub/groups' role='menuitem' onClick={close}>
            <FormattedMessage id='kronk_menu.groups' defaultMessage='Groups' />
          </Link>
          <Link className='kronk-menu__item' to='/kronk' role='menuitem' onClick={close}>
            <FormattedMessage id='kronk_menu.about' defaultMessage='About Kronk' />
          </Link>
        </div>
      )}
    </div>
  );
};
