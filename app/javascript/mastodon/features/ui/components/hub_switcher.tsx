import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { NavLink, useLocation } from 'react-router-dom';

import ExploreIcon from '@/material-icons/400-24px/explore.svg?react';
import HomeIcon from '@/material-icons/400-24px/home.svg?react';
import NotificationsIcon from '@/material-icons/400-24px/notifications.svg?react';
import PersonIcon from '@/material-icons/400-24px/person.svg?react';
import { useAppSelector } from 'mastodon/store';

// Four-way switcher between Kronk's primary personal surfaces —
// Me / Home / Hub / Nudges (in that order). Ships as its own component
// so the layout can slot it into either the top chrome (desktop, the
// Membrane) or the bottom tab-bar (mobile, icon+label) without
// duplication.
//
//   Me      → /@me    (SPA resolves to the signed-in account)
//   Home    → /home
//   Hub     → /hub
//   Nudges  → /nudges (activity; carries the unread badge)
//
// Top variant renders the Membrane: flat labels + a 1px wire + a
// gliding pool of light under the active pillar. Spec:
// docs/aesthetic — Membrane Navigation (KRONK_MEMBRANE_NAV).

interface HubSwitcherProps {
  variant?: 'top' | 'bottom';
  currentAccountUsername?: string;
}

type PillarKey = 'me' | 'home' | 'hub' | 'nudges';

const messages = defineMessages({
  me: { id: 'hub_switcher.me', defaultMessage: 'Me' },
  home: { id: 'hub_switcher.home', defaultMessage: 'Home' },
  hub: { id: 'hub_switcher.hub', defaultMessage: 'Hub' },
  nudges: { id: 'hub_switcher.nudges', defaultMessage: 'Nudges' },
  aria: { id: 'hub_switcher.aria', defaultMessage: 'Primary surfaces' },
});

interface PillarConfig {
  key: PillarKey;
  to: string;
  label: (typeof messages)[keyof typeof messages];
  Icon: React.ComponentType;
  isActive: (pathname: string) => boolean;
}

export const HubSwitcher = ({
  variant = 'top',
  currentAccountUsername,
}: HubSwitcherProps) => {
  const intl = useIntl();
  const location = useLocation();
  const unreadNudges = useAppSelector(
    (state) => state.notificationGroups.unreadNudgeCount,
  );

  const profilePath = currentAccountUsername
    ? `/@${currentAccountUsername}`
    : '/getting-started';

  const pillars: PillarConfig[] = useMemo(
    () => [
      {
        key: 'me',
        to: profilePath,
        label: messages.me,
        Icon: PersonIcon,
        isActive: (p) => p.startsWith('/@'),
      },
      {
        key: 'home',
        to: '/home',
        label: messages.home,
        Icon: HomeIcon,
        isActive: (p) => p === '/home' || p.startsWith('/home/'),
      },
      {
        key: 'hub',
        to: '/hub',
        label: messages.hub,
        Icon: ExploreIcon,
        isActive: (p) => p === '/hub' || p.startsWith('/hub/'),
      },
      {
        key: 'nudges',
        to: '/nudges',
        label: messages.nudges,
        Icon: NotificationsIcon,
        isActive: (p) => p === '/nudges' || p.startsWith('/nudges/'),
      },
    ],
    [profilePath],
  );

  const activeKey =
    pillars.find((pillar) => pillar.isActive(location.pathname))?.key ?? null;

  const formatLabel = useCallback(
    (m: (typeof messages)[keyof typeof messages]) => intl.formatMessage(m),
    [intl],
  );

  const ariaLabel = intl.formatMessage(messages.aria);

  return variant === 'top' ? (
    <MembraneTop
      pillars={pillars}
      activeKey={activeKey}
      unreadNudges={unreadNudges}
      ariaLabel={ariaLabel}
      formatLabel={formatLabel}
    />
  ) : (
    <BottomTabBar
      pillars={pillars}
      unreadNudges={unreadNudges}
      ariaLabel={ariaLabel}
      formatLabel={formatLabel}
    />
  );
};

// ── Top: Membrane treatment ─────────────────────────────────────────

interface MembraneTopProps {
  pillars: PillarConfig[];
  activeKey: PillarKey | null;
  unreadNudges: number;
  ariaLabel: string;
  formatLabel: (m: (typeof messages)[keyof typeof messages]) => string;
}

const MembraneTop = ({
  pillars,
  activeKey,
  unreadNudges,
  ariaLabel,
  formatLabel,
}: MembraneTopProps) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const pillarRefs = useRef<Record<PillarKey, HTMLAnchorElement | null>>({
    me: null,
    home: null,
    hub: null,
    nudges: null,
  });
  const [pool, setPool] = useState<{ left: number; width: number } | null>(
    null,
  );
  const [ready, setReady] = useState(false);
  const [glintKey, setGlintKey] = useState(0);
  const [arriving, setArriving] = useState(false);

  const registerPillar = useCallback(
    (key: PillarKey) => (node: HTMLAnchorElement | null) => {
      pillarRefs.current[key] = node;
    },
    [],
  );

  const measure = useCallback(() => {
    if (!activeKey) {
      setPool(null);
      return;
    }
    const pillar = pillarRefs.current[activeKey];
    const row = rowRef.current;
    if (!pillar || !row) return;
    const pRect = pillar.getBoundingClientRect();
    const rRect = row.getBoundingClientRect();
    const width = Math.max(40, pRect.width - 20);
    const centre = pRect.left - rRect.left + pRect.width / 2;
    setPool({ left: centre - width / 2, width });
  }, [activeKey]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  // Suppress the glide on first mount + on resize — measure the pool in
  // place before enabling the transition. requestAnimationFrame ensures
  // fonts have laid out.
  useLayoutEffect(() => {
    setReady(false);
    const raf = requestAnimationFrame(() => {
      measure();
      requestAnimationFrame(() => {
        setReady(true);
      });
    });
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [measure]);

  useEffect(() => {
    const onResize = () => {
      setReady(false);
      measure();
      requestAnimationFrame(() => {
        setReady(true);
      });
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, [measure]);

  // Landing glint: on every pillar change, re-key the pool so its glint
  // animation re-runs (CSS keyframe with `animation-name` triggers via
  // fresh element via key).
  useEffect(() => {
    setGlintKey((k) => k + 1);
  }, [activeKey]);

  // Arrival signal — glint travels along the wire toward Nudges when a
  // Nudge arrives. Fires on genuine increase in unreadNudges only.
  const prevUnread = useRef(unreadNudges);
  useEffect(() => {
    if (unreadNudges > prevUnread.current) {
      setArriving(true);
      const t = window.setTimeout(() => {
        setArriving(false);
      }, 900);
      prevUnread.current = unreadNudges;
      return () => {
        window.clearTimeout(t);
      };
    }
    prevUnread.current = unreadNudges;
    return undefined;
  }, [unreadNudges]);

  return (
    <nav
      className={`hub-switcher hub-switcher--top${ready ? ' is-ready' : ''}${arriving ? ' is-arriving' : ''}`}
      aria-label={ariaLabel}
    >
      <div className='hub-switcher__row' role='tablist' ref={rowRef}>
        {pillars.map((pillar) => {
          const isActive = pillar.key === activeKey;
          return (
            <NavLink
              key={pillar.key}
              to={pillar.to}
              role='tab'
              aria-selected={isActive}
              className='hub-switcher__pillar'
              activeClassName='hub-switcher__pillar--active'
              innerRef={registerPillar(pillar.key)}
            >
              <span className='hub-switcher__label'>
                {formatLabel(pillar.label)}
              </span>
              {pillar.key === 'nudges' && unreadNudges > 0 && (
                <span
                  className='hub-switcher__badge'
                  aria-label={`${unreadNudges} unread`}
                >
                  {unreadNudges}
                </span>
              )}
            </NavLink>
          );
        })}
      </div>
      <div className='hub-switcher__wire' aria-hidden>
        {pool && (
          <span
            key={glintKey}
            className='hub-switcher__pool'
            style={{ left: `${pool.left}px`, width: `${pool.width}px` }}
          />
        )}
      </div>
    </nav>
  );
};

// ── Bottom: mobile tab-bar ──────────────────────────────────────────

interface BottomTabBarProps {
  pillars: PillarConfig[];
  unreadNudges: number;
  ariaLabel: string;
  formatLabel: (m: (typeof messages)[keyof typeof messages]) => string;
}

const BottomTabBar = ({
  pillars,
  unreadNudges,
  ariaLabel,
  formatLabel,
}: BottomTabBarProps) => (
  <nav className='hub-switcher hub-switcher--bottom' aria-label={ariaLabel}>
    {pillars.map((pillar) => {
      const { Icon } = pillar;
      return (
        <NavLink
          key={pillar.key}
          to={pillar.to}
          className='hub-switcher__item'
          activeClassName='hub-switcher__item--active'
        >
          <span className='hub-switcher__icon' aria-hidden>
            <Icon />
          </span>
          <span className='hub-switcher__label'>
            {formatLabel(pillar.label)}
          </span>
          {pillar.key === 'nudges' && unreadNudges > 0 && (
            <span
              className='hub-switcher__badge'
              aria-label={`${unreadNudges} unread`}
            >
              {unreadNudges}
            </span>
          )}
        </NavLink>
      );
    })}
  </nav>
);
