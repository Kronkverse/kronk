import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FormattedMessage, useIntl, defineMessages } from 'react-intl';

import SettingsIcon from '@/material-icons/400-24px/settings.svg?react';
import EditIcon from '@/material-icons/400-24px/edit-fill.svg?react';
import SearchIcon from '@/material-icons/400-24px/search.svg?react';
import ChatIcon from '@/material-icons/400-24px/chat.svg?react';
import { useAppSelector } from 'mastodon/store';
import { useKorner } from 'mastodon/hooks/useKorner';

// Kronk's Ӂ menu — floating action bottom-right. Trimmed to four
// primary verbs: Settings / Post / Search / Nudges. The Settings
// entry is CONTEXT-AWARE — it points at the settings space for the
// surface the user is currently on (korner / profile / feed / global).

const messages = defineMessages({
  post: { id: 'kronk_menu.post', defaultMessage: 'Post' },
  nudges: { id: 'kronk_menu.nudges', defaultMessage: 'Nudges' },
  search: { id: 'kronk_menu.search', defaultMessage: 'Search' },
  settings: { id: 'kronk_menu.settings', defaultMessage: 'Settings' },
  settings_korner: {
    id: 'kronk_menu.settings_korner',
    defaultMessage: '{name} settings',
  },
  settings_profile: {
    id: 'kronk_menu.settings_profile',
    defaultMessage: 'Profile settings',
  },
  settings_feed: {
    id: 'kronk_menu.settings_feed',
    defaultMessage: 'Feed settings',
  },
});

const KORNER_RE = /^\/hub\/([a-z0-9-]+)(?:\/|$)/;
const PROFILE_RE = /^\/@([^/]+)(?:\/|$)/;
const FEED_RE = /^\/home(?:\/|$)/;

interface SettingsTarget {
  href: string;
  label: string;
  external: boolean; // Rails-served, needs full nav
}

const useSettingsTarget = (): SettingsTarget => {
  const intl = useIntl();
  const location = useLocation();

  const kornerMatch = KORNER_RE.exec(location.pathname);
  const kornerSlug = kornerMatch?.[1];
  const korner = useKorner(kornerSlug);

  return useMemo(() => {
    if (kornerSlug) {
      return {
        href: `/hub/${kornerSlug}/settings`,
        label: korner
          ? intl.formatMessage(messages.settings_korner, { name: korner.name })
          : intl.formatMessage(messages.settings),
        external: false,
      };
    }
    if (PROFILE_RE.exec(location.pathname)) {
      return {
        href: '/settings/profile_sections',
        label: intl.formatMessage(messages.settings_profile),
        external: false,
      };
    }
    if (FEED_RE.exec(location.pathname)) {
      return {
        href: '/home/settings',
        label: intl.formatMessage(messages.settings_feed),
        external: false,
      };
    }
    // Fallback: global Rails-served preferences.
    return {
      href: '/settings/preferences',
      label: intl.formatMessage(messages.settings),
      external: true,
    };
  }, [kornerSlug, korner, location.pathname, intl]);
};

export const KronkMenu = () => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const settings = useSettingsTarget();

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
              <FormattedMessage {...messages.post} />
            </span>
          </Link>
          <Link className='kronk-menu__item' to='/nudges' role='menuitem' onClick={close}>
            <span className='kronk-menu__item-glyph' aria-hidden='true'><ChatIcon /></span>
            <span className='kronk-menu__item-label'>
              <FormattedMessage {...messages.nudges} />
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
              <FormattedMessage {...messages.search} />
            </span>
          </Link>
          {settings.external ? (
            <a className='kronk-menu__item' href={settings.href} role='menuitem' onClick={close}>
              <span className='kronk-menu__item-glyph' aria-hidden='true'><SettingsIcon /></span>
              <span className='kronk-menu__item-label'>{settings.label}</span>
            </a>
          ) : (
            <Link className='kronk-menu__item' to={settings.href} role='menuitem' onClick={close}>
              <span className='kronk-menu__item-glyph' aria-hidden='true'><SettingsIcon /></span>
              <span className='kronk-menu__item-label'>{settings.label}</span>
            </Link>
          )}
        </div>
      )}
    </div>
  );
};
