import { useState, useCallback, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FormattedMessage } from 'react-intl';

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
  const ref = useRef<HTMLDivElement>(null);

  const toggle = useCallback(() => setOpen((prev) => !prev), []);
  const close = useCallback(() => setOpen(false), []);

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
        {unreadNudgesCount > 0 && <span className='kronk-menu__badge'>{unreadNudgesCount}</span>}
      </button>

      {open && (
        <div className='kronk-menu__panel' role='menu'>
          <Link className='kronk-menu__item' to={profilePath} role='menuitem' onClick={close}>
            <FormattedMessage id='kronk_menu.profile' defaultMessage='Profile' />
          </Link>
          <Link className='kronk-menu__item' to='/settings/preferences' role='menuitem' onClick={close}>
            <FormattedMessage id='kronk_menu.settings' defaultMessage='Settings' />
          </Link>
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
        </div>
      )}
    </div>
  );
};
