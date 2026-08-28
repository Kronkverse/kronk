import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { NavLink, useLocation } from 'react-router-dom';

import AboriginalFlagIcon from '@/material-icons/400-24px/aboriginal_flag.svg?react';
import { Icon } from 'mastodon/components/icon';
import type { IconProp } from 'mastodon/components/icon';
import { WavingHandBadge } from 'mastodon/components/waving_hand_badge';
import { useNudgesBadgeSeed } from 'mastodon/features/nudges_messenger/use_nudges_badge_seed';
import { useKorner } from 'mastodon/hooks/useKorner';
import { kornerIcon } from 'mastodon/hooks/useKornerIcon';
import { me } from 'mastodon/initial_state';
import {
  selectHasUnreadNudges,
  selectUnreadNudgesCount,
} from 'mastodon/selectors/notifications';
import { useAppSelector } from 'mastodon/store';

// Four-way switcher between Kronk's primary personal surfaces —
// Me / Home / Hub / Nudges (in that order). Ships as its own component
// so the layout can slot it into either the top chrome (desktop, the
// Membrane) or the bottom tab-bar (mobile, icon+label) without
// duplication.
//
//   Me      → /me    (radial hub — see features/me_hub)
//   Home    → /home
//   Hub     → /hub
//   Nudges  → /nudges (activity; carries the unread badge)
//
// Top variant renders the Membrane: icon pillars + a hairline wire.
//
// Selection is shown by the ACTIVE PILLAR ITSELF — a tinted tile with a
// filled glyph, the same method the korner sidebar uses (Tal 2026-08-13),
// so one language covers both navigation surfaces. The gliding pool of
// light that used to mark it is gone; the wire remains only as the channel
// for the nudge-arrival glint. Icons are read from
// each pillar's corresponding manifest via `kornerIcon` — editing
// `icon.material` in profile.yaml / feed.yaml / hub.yaml / nudges.yaml
// updates the top nav in place. Text labels stay on the pillars as
// visually-hidden sr-only text so the aria/announced names still
// carry `Me / Home / Hub / Nudges`. Spec: docs/aesthetic — Membrane
// Navigation (KRONK_MEMBRANE_NAV).

interface HubSwitcherProps {
  variant?: 'top' | 'bottom';
  currentAccountUsername?: string;
}

type PillarKey = 'me' | 'home' | 'awawb' | 'hub' | 'nudges';

const messages = defineMessages({
  me: { id: 'hub_switcher.me', defaultMessage: 'Me' },
  home: { id: 'hub_switcher.home', defaultMessage: 'Home' },
  awawb: {
    id: 'hub_switcher.awawb',
    defaultMessage: 'Always was, always will be',
  },
  hub: { id: 'hub_switcher.hub', defaultMessage: 'Hub' },
  nudges: { id: 'hub_switcher.nudges', defaultMessage: 'Nudges' },
  aria: { id: 'hub_switcher.aria', defaultMessage: 'Primary surfaces' },
});

interface PillarConfig {
  key: PillarKey;
  to: string;
  label: (typeof messages)[keyof typeof messages];
  // The pillar's Material icon component — resolved from the manifest
  // of the space it points at. Used in both the top Membrane variant
  // (icon-only, name hidden for a11y) and the bottom mobile tab-bar
  // (icon + label).
  Icon: IconProp;
  // Manifest slug the icon comes from. Rendered as `icon-<slug>` on
  // the Icon element so consumers can style per-korner if they want.
  iconId: string;
  isActive: (pathname: string) => boolean;
}

export const HubSwitcher = ({
  variant = 'top',
  currentAccountUsername,
}: HubSwitcherProps) => {
  const intl = useIntl();
  const location = useLocation();
  const unreadNudges = useAppSelector(selectUnreadNudgesCount);
  // Shows the waving-hand alert for Mate nudges OR korner/system
  // notifications (proposal complete, etc.).
  const hasUnread = useAppSelector(selectHasUnreadNudges);
  // Seed `state.nudges.unread` on boot + keep it live from the
  // account-level stream. Without this the pillar badge stayed at
  // zero until the user opened /nudges (only the messenger seeded
  // it) — defeating the badge's purpose.
  useNudgesBadgeSeed();

  // 2026-08-05: "Me" pillar retargeted from `/@{username}` (public
  // profile) to `/me` (radial hub of self actions — see
  // features/me_hub). The pillar stays highlighted on either surface
  // via `isActive` so the user knows they're still under Me even
  // when they navigate through to the public profile from the hub.
  const meHubPath = currentAccountUsername ? '/me' : '/getting-started';

  const profileManifest = useKorner('profile');
  const feedManifest = useKorner('feed');
  const hubManifest = useKorner('hub');
  const nudgesManifest = useKorner('nudges');

  // Me pillar renders the viewer's avatar in place of the profile
  // korner glyph — you're looking at *your* face, not an abstract
  // account chip. Falls back to the profile-korner icon when the
  // avatar hasn't landed in state yet (initial paint, signed-out).
  const myAvatar = useAppSelector((state) =>
    me ? (state.accounts.get(me)?.avatar_static ?? null) : null,
  );

  const pillars: PillarConfig[] = useMemo(
    () => [
      {
        key: 'me',
        to: meHubPath,
        label: messages.me,
        Icon: kornerIcon('profile', profileManifest),
        iconId: 'profile',
        isActive: (p) => p === '/me' || p.startsWith('/@'),
      },
      {
        key: 'home',
        to: '/home',
        label: messages.home,
        Icon: kornerIcon('feed', feedManifest),
        iconId: 'feed',
        isActive: (p) => p === '/home' || p.startsWith('/home/'),
      },
      {
        // Middle pillar: /awawb — Aboriginal-flag glyph, one line of
        // still text. Sits between Home and Hub so it's the visual
        // centre of the top Membrane row.
        key: 'awawb',
        to: '/awawb',
        label: messages.awawb,
        Icon: AboriginalFlagIcon,
        iconId: 'awawb',
        isActive: (p) => p === '/awawb',
      },
      {
        key: 'hub',
        to: '/hub',
        label: messages.hub,
        Icon: kornerIcon('hub', hubManifest),
        iconId: 'hub',
        isActive: (p) => p === '/hub' || p.startsWith('/hub/'),
      },
      {
        key: 'nudges',
        to: '/nudges',
        label: messages.nudges,
        Icon: kornerIcon('nudges', nudgesManifest),
        iconId: 'nudges',
        isActive: (p) => p === '/nudges' || p.startsWith('/nudges/'),
      },
    ],
    [meHubPath, profileManifest, feedManifest, hubManifest, nudgesManifest],
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
      hasUnread={hasUnread}
      ariaLabel={ariaLabel}
      formatLabel={formatLabel}
      myAvatar={myAvatar}
    />
  ) : (
    <BottomTabBar
      pillars={pillars}
      unreadNudges={unreadNudges}
      hasUnread={hasUnread}
      ariaLabel={ariaLabel}
      formatLabel={formatLabel}
      myAvatar={myAvatar}
    />
  );
};

// ── Top: Membrane treatment ─────────────────────────────────────────

interface MembraneTopProps {
  pillars: PillarConfig[];
  activeKey: PillarKey | null;
  unreadNudges: number;
  hasUnread: boolean;
  ariaLabel: string;
  formatLabel: (m: (typeof messages)[keyof typeof messages]) => string;
  myAvatar: string | null;
}

const MembraneTop = ({
  pillars,
  activeKey,
  unreadNudges,
  hasUnread,
  ariaLabel,
  formatLabel,
  myAvatar,
}: MembraneTopProps) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const [arriving, setArriving] = useState(false);

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
      className={`hub-switcher hub-switcher--top${arriving ? ' is-arriving' : ''}`}
      aria-label={ariaLabel}
    >
      <div className='hub-switcher__row' role='tablist' ref={rowRef}>
        {pillars.map((pillar) => {
          const isActive = pillar.key === activeKey;
          const label = formatLabel(pillar.label);
          return (
            <NavLink
              key={pillar.key}
              to={pillar.to}
              role='tab'
              aria-selected={isActive}
              aria-label={label}
              title={label}
              className='hub-switcher__pillar'
              activeClassName='hub-switcher__pillar--active'
            >
              {pillar.key === 'me' && myAvatar ? (
                <img
                  src={myAvatar}
                  alt=''
                  className='hub-switcher__pillar-icon hub-switcher__pillar-icon--avatar'
                />
              ) : (
                <Icon
                  id={pillar.iconId}
                  icon={pillar.Icon}
                  className='hub-switcher__pillar-icon'
                />
              )}
              {/* Label remains in the DOM as sr-only text so screen
                  readers still announce Me / Home / AWAWB / Hub /
                  Nudges even though the visible pillar carries the
                  icon (or avatar, for Me) only. */}
              <span className='hub-switcher__label hub-switcher__label--sr'>
                {label}
              </span>
              {pillar.key === 'nudges' && hasUnread && (
                <WavingHandBadge
                  className='hub-switcher__badge'
                  label={
                    unreadNudges > 0 ? `${unreadNudges} unread` : 'New activity'
                  }
                />
              )}
            </NavLink>
          );
        })}
      </div>
      {/* The wire stays, but no longer marks selection — that is the pillar
          tile's job now (Tal 2026-08-13). It remains because it is the channel
          for the nudge-arrival glint (`.is-arriving`), which travels its length
          toward the Nudges pillar. */}
      <div className='hub-switcher__wire' aria-hidden />
    </nav>
  );
};

// ── Bottom: mobile tab-bar ──────────────────────────────────────────

interface BottomTabBarProps {
  pillars: PillarConfig[];
  unreadNudges: number;
  hasUnread: boolean;
  ariaLabel: string;
  formatLabel: (m: (typeof messages)[keyof typeof messages]) => string;
  myAvatar: string | null;
}

const BottomTabBar = ({
  pillars,
  unreadNudges,
  hasUnread,
  ariaLabel,
  formatLabel,
  myAvatar,
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
            {pillar.key === 'me' && myAvatar ? (
              <img
                src={myAvatar}
                alt=''
                className='hub-switcher__pillar-icon--avatar'
              />
            ) : (
              <Icon />
            )}
          </span>
          {/* SR-only label — the tab bar is icons-only visually
              (Tal 2026-08-28 "remove the words written on the bottom
              nav hub, that's unnecessary"). */}
          <span className='hub-switcher__label hub-switcher__label--sr'>
            {formatLabel(pillar.label)}
          </span>
          {pillar.key === 'nudges' && hasUnread && (
            <WavingHandBadge
              className='hub-switcher__badge'
              label={
                unreadNudges > 0 ? `${unreadNudges} unread` : 'New activity'
              }
            />
          )}
        </NavLink>
      );
    })}
  </nav>
);
