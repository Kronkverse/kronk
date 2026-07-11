import { useState, useCallback, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FormattedMessage } from 'react-intl';

import SettingsIcon from '@/material-icons/400-24px/settings.svg?react';
import EditIcon from '@/material-icons/400-24px/edit-fill.svg?react';
import SearchIcon from '@/material-icons/400-24px/search.svg?react';
import ChatIcon from '@/material-icons/400-24px/chat.svg?react';
import { useAppSelector } from 'mastodon/store';

// Kronk's Ӂ menu — floating action bottom-right. Trimmed to four
// primary verbs: Settings / Post / Search / Nudges. Profile lives at
// the top-right AvatarBubble instead so the Ӂ menu stays a verb-only
// affordance.

export const KronkMenu = () => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const unreadNudgesCount = useAppSelector(
    (state) => state.notificationGroups.unreadNudgeCount ?? 0,
  );

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
        {unreadNudgesCount > 0 && (
          <span className='kronk-menu__badge'>{unreadNudgesCount}</span>
        )}
      </button>

      {open && (
        <div className='kronk-menu__panel' role='menu'>
          <Link className='kronk-menu__item kronk-menu__item--primary' to='/publish' role='menuitem' onClick={close}>
            <span className='kronk-menu__item-glyph' aria-hidden='true'><EditIcon /></span>
            <span className='kronk-menu__item-label'>
              <FormattedMessage id='kronk_menu.post' defaultMessage='Post' />
            </span>
          </Link>
          <Link className='kronk-menu__item' to='/nudges' role='menuitem' onClick={close}>
            <span className='kronk-menu__item-glyph' aria-hidden='true'><ChatIcon /></span>
            <span className='kronk-menu__item-label'>
              <FormattedMessage id='kronk_menu.nudges' defaultMessage='Nudges' />
            </span>
            {unreadNudgesCount > 0 && (
              <span className='kronk-menu__item-badge' aria-label={`${unreadNudgesCount} unread`}>
                {unreadNudgesCount}
              </span>
            )}
          </Link>
          <Link className='kronk-menu__item' to='/search' role='menuitem' onClick={close}>
            <span className='kronk-menu__item-glyph' aria-hidden='true'><SearchIcon /></span>
            <span className='kronk-menu__item-label'>
              <FormattedMessage id='kronk_menu.search' defaultMessage='Search' />
            </span>
          </Link>
          {/* /settings/preferences is Rails-served — force a full nav. */}
          <a className='kronk-menu__item' href='/settings/preferences' role='menuitem' onClick={close}>
            <span className='kronk-menu__item-glyph' aria-hidden='true'><SettingsIcon /></span>
            <span className='kronk-menu__item-label'>
              <FormattedMessage id='kronk_menu.settings' defaultMessage='Settings' />
            </span>
          </a>
        </div>
      )}
    </div>
  );
};
