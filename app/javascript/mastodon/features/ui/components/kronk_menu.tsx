import { useState, useCallback, useRef, useEffect, useMemo } from 'react';

import { FormattedMessage, useIntl, defineMessages } from 'react-intl';

import { Link, useLocation } from 'react-router-dom';

import EditIcon from '@/material-icons/400-24px/edit-fill.svg?react';
import SearchIcon from '@/material-icons/400-24px/search.svg?react';
import SettingsIcon from '@/material-icons/400-24px/settings.svg?react';
import { useKorner } from 'mastodon/hooks/useKorner';
import { me } from 'mastodon/initial_state';
import { useAppSelector } from 'mastodon/store';

// Kronk's Ӂ menu — a FLOATING, user-movable action button. Three primary
// verbs: Post / Search / Settings (Nudges moved to the top-bar switcher).
// The Settings entry is CONTEXT-AWARE — it points at the settings space
// for the surface the user is on. The Post entry is per-space.
//
// The button can be dragged anywhere (touch + mouse, iOS-AssistiveTouch
// style); its position persists (localStorage), is clamped to the
// viewport and snaps to the nearest edge, and a small drag-threshold
// keeps a plain tap opening the menu. It lives in the app shell, so the
// chosen position carries across every space.

const messages = defineMessages({
  post: { id: 'kronk_menu.post', defaultMessage: 'Post' },
  new_chat: { id: 'kronk_menu.new_chat', defaultMessage: 'New chat' },
  search: { id: 'kronk_menu.search', defaultMessage: 'Search' },
  settings: { id: 'kronk_menu.settings', defaultMessage: 'Settings' },
  settings_korner: {
    id: 'kronk_menu.settings_korner',
    defaultMessage: '{name} settings',
  },
  settings_feed: {
    id: 'kronk_menu.settings_feed',
    defaultMessage: 'Feed settings',
  },
  settings_profile: {
    id: 'kronk_menu.settings_profile',
    defaultMessage: 'Profile settings',
  },
});

const KORNER_RE = /^\/hub\/([a-z0-9-]+)(?:\/|$)/;
const PROFILE_RE = /^\/@([^/]+)(?:\/|$)/;
const FEED_RE = /^\/home(?:\/|$)/;
const NUDGES_RE = /^\/nudges(?:\/|$)/;
// A Kommons Space page (/hub/kommons/space/:slug) — used to scope the propose
// action to the space you're looking at.
const SPACE_RE = /^\/hub\/kommons\/space\/([a-z0-9-]+)/;
// A node meta page (/hub/kommons/node/:nodeId) — node ids carry dots.
const NODE_RE = /^\/hub\/kommons\/node\/([^/?]+)/;

// ---- movable-button config ----
const POS_KEY = 'kronk:menu-pos';
const DRAG_THRESHOLD = 6; // px of movement before a press becomes a drag
const EDGE = 12; // px kept clear of the viewport edge
const BTN = 56; // nominal button size for anchor/centre math

interface Pos {
  x: number;
  y: number;
}

const readPos = (): Pos | null => {
  try {
    const raw = localStorage.getItem(POS_KEY);
    return raw ? (JSON.parse(raw) as Pos) : null;
  } catch {
    return null;
  }
};

interface PostTarget {
  href: string;
  label: string;
}

// Resolve the Post button target for the current surface:
//   • Inside a korner with a declared compose block → use its label+route.
//   • Inside a korner without compose → hide (returns null).
//   • On profile / home feed → plain status compose.
//   • Anywhere else (Hub landing, org space, settings, etc.) → hide.
const usePostTarget = (): PostTarget | null => {
  const intl = useIntl();
  const location = useLocation();

  const kornerMatch = KORNER_RE.exec(location.pathname);
  const kornerSlug = kornerMatch?.[1];
  const korner = useKorner(kornerSlug);

  return useMemo(() => {
    if (kornerSlug) {
      if (korner?.compose?.route && korner.compose.label) {
        // On a Kommons Space page the propose action carries the space it's
        // about, so the composer lands the new proposal on that space.
        // On a Kommons space/meta page a space is already chosen, so go
        // straight to the Proposer scoped to it. Everywhere else the korner's
        // compose route applies — for Kommons that's the target picker (choose
        // the page first); for other korners it's their native create action.
        const spaceMatch = SPACE_RE.exec(location.pathname);
        const nodeMatch = NODE_RE.exec(location.pathname);
        const href = spaceMatch
          ? `/hub/kommons/propose?space=${spaceMatch[1]}`
          : nodeMatch
            ? `/hub/kommons/propose?node=${nodeMatch[1]}`
            : korner.compose.route;
        return { href, label: korner.compose.label };
      }
      return null;
    }
    if (PROFILE_RE.exec(location.pathname) || FEED_RE.exec(location.pathname)) {
      return { href: '/publish', label: intl.formatMessage(messages.post) };
    }
    // On the Nudges messenger the "post" verb is "start a new chat".
    // Handing it off to the KronkMenu here is the whole reason we
    // stripped the pencil button from the sidebar — create-actions
    // belong on the floating menu, not scattered per-surface.
    if (NUDGES_RE.exec(location.pathname)) {
      return {
        href: '/nudges?compose=1',
        label: intl.formatMessage(messages.new_chat),
      };
    }
    return null;
  }, [kornerSlug, korner, location.pathname, intl]);
};

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
  const myAccount = useAppSelector((state) =>
    me ? state.accounts.get(me) : undefined,
  );
  const myAcct = myAccount?.get('acct');

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
    if (FEED_RE.exec(location.pathname)) {
      return {
        href: '/home/settings',
        label: intl.formatMessage(messages.settings_feed),
        external: false,
      };
    }
    // Profile space → the composer, symmetric with korner/feed reaching
    // their own settings straight from the menu. Only on YOUR profile (the
    // composer is owner-only); on someone else's, fall through to the hub.
    const profileMatch = PROFILE_RE.exec(location.pathname);
    if (profileMatch && myAcct && profileMatch[1] === myAcct) {
      return {
        href: `/@${myAcct}/edit`,
        label: intl.formatMessage(messages.settings_profile),
        external: false,
      };
    }
    // Fallback: the settings hub (settings rebuild §4.1), SPA-served.
    return {
      href: '/settings',
      label: intl.formatMessage(messages.settings),
      external: false,
    };
  }, [kornerSlug, korner, location.pathname, intl, myAcct]);
};

// Clamp a proposed top-left to the viewport; optionally snap horizontally
// to the nearest edge (release behaviour).
const clampAndSnap = (x: number, y: number, snap: boolean): Pos => {
  const maxX = window.innerWidth - BTN - EDGE;
  const maxY = window.innerHeight - BTN - EDGE;
  let nx = Math.max(EDGE, Math.min(x, maxX));
  const ny = Math.max(EDGE, Math.min(y, maxY));
  if (snap) nx = nx + BTN / 2 < window.innerWidth / 2 ? EDGE : maxX;
  return { x: nx, y: ny };
};

export const KronkMenu = () => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos | null>(() => readPos());
  const [dragging, setDragging] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);
  const suppressClick = useRef(false);

  const settings = useSettingsTarget();
  const post = usePostTarget();

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
    };
  }, [open, close]);

  // Keep the button on-screen across viewport resizes.
  useEffect(() => {
    const onResize = () => {
      setPos((p) => (p ? clampAndSnap(p.x, p.y, true) : null));
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    drag.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: rect.left,
      originY: rect.top,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    d.moved = true;
    setDragging(true);
    setOpen(false);
    setPos(clampAndSnap(d.originX + dx, d.originY + dy, false));
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (!d?.moved) return;
    suppressClick.current = true;
    setDragging(false);
    setPos((p) => {
      if (!p) return p;
      const snapped = clampAndSnap(p.x, p.y, true);
      try {
        localStorage.setItem(POS_KEY, JSON.stringify(snapped));
      } catch {
        // best-effort
      }
      return snapped;
    });
  }, []);

  const onClick = useCallback(() => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    setOpen((prev) => !prev);
  }, []);

  // Which corner the button sits in → which way the panel opens.
  const anchor = useMemo(() => {
    if (!pos) {
      // Default park (matches the CSS): bottom-left on desktop — the
      // right edge is the korner rail — and bottom-right on mobile. The
      // panel opens upward either way, away from the viewport edge.
      return window.innerWidth >= 890 ? 'bottom-left' : 'bottom-right';
    }
    const v = pos.y + BTN / 2 < window.innerHeight / 2 ? 'top' : 'bottom';
    const h = pos.x + BTN / 2 < window.innerWidth / 2 ? 'left' : 'right';
    return `${v}-${h}`;
  }, [pos]);

  const style = pos
    ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' }
    : undefined;

  return (
    <div
      ref={ref}
      className={`kronk-menu ${open ? 'kronk-menu--open' : ''} ${dragging ? 'kronk-menu--dragging' : ''}`}
      style={style}
      data-anchor={anchor}
    >
      <button
        type='button'
        className='kronk-menu__trigger'
        aria-expanded={open}
        aria-label='Kronk menu'
        onClick={onClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <span aria-hidden='true'>Ӂ</span>
      </button>

      {open && (
        <div className='kronk-menu__panel' role='menu'>
          {post && (
            <Link
              className='kronk-menu__item kronk-menu__item--primary'
              to={post.href}
              role='menuitem'
              onClick={close}
            >
              <span className='kronk-menu__item-glyph' aria-hidden='true'>
                <EditIcon />
              </span>
              <span className='kronk-menu__item-label'>{post.label}</span>
            </Link>
          )}
          <Link
            className='kronk-menu__item'
            to='/hub/search'
            role='menuitem'
            onClick={close}
          >
            <span className='kronk-menu__item-glyph' aria-hidden='true'>
              <SearchIcon />
            </span>
            <span className='kronk-menu__item-label'>
              <FormattedMessage {...messages.search} />
            </span>
          </Link>
          {settings.external ? (
            <a
              className='kronk-menu__item'
              href={settings.href}
              role='menuitem'
              onClick={close}
            >
              <span className='kronk-menu__item-glyph' aria-hidden='true'>
                <SettingsIcon />
              </span>
              <span className='kronk-menu__item-label'>{settings.label}</span>
            </a>
          ) : (
            <Link
              className='kronk-menu__item'
              to={settings.href}
              role='menuitem'
              onClick={close}
            >
              <span className='kronk-menu__item-glyph' aria-hidden='true'>
                <SettingsIcon />
              </span>
              <span className='kronk-menu__item-label'>{settings.label}</span>
            </Link>
          )}
        </div>
      )}
    </div>
  );
};
