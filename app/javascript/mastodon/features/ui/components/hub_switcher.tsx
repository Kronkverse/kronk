import { useCallback, useMemo } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { NavLink, useLocation } from 'react-router-dom';

import AboriginalFlagIcon from '@/material-icons/400-24px/aboriginal_flag.svg?react';
import AddIcon from '@/material-icons/400-24px/add.svg?react';
import { Icon } from 'mastodon/components/icon';
import type { IconProp } from 'mastodon/components/icon';
import { useKorner } from 'mastodon/hooks/useKorner';
import { kornerIcon } from 'mastodon/hooks/useKornerIcon';
import { me } from 'mastodon/initial_state';
import { useAppSelector } from 'mastodon/store';

// The platform nav: Kronk's four sections with the AWAWB flag in the
// centre (2.2.0, Tal 2026-11-01; docs/decisions.md):
//
//   YOU      → /me      (your avatar)
//   Share    → /share   (what goes out from you)
//   AWAWB    → /awawb   (Always was, always will be)
//   Explore  → /explore (what individuals share with the community)
//   Join     → /join    (people coming together)
//
// Home is the screen in the middle of the five (the wordmark and a swipe
// lead there), and Nudges sits in the top bar beside search
// (top_nudges.tsx), so neither is a pillar any more; nor is the Hub,
// which Explore replaces. One component for the desktop Membrane (top)
// and the phone tab bar (bottom).
//
// Selection is shown by the ACTIVE PILLAR ITSELF, a tinted tile, the
// same method the korner sidebar uses (Tal 2026-08-13). Icons come from
// each pillar's manifest via `kornerIcon` where it has one. Text labels
// stay as visually-hidden text, so the announced names are YOU / Share /
// Always was, always will be / Explore / Join. Spec: docs/design.md
// (Membrane navigation).

interface HubSwitcherProps {
  variant?: 'top' | 'bottom';
  currentAccountUsername?: string;
}

type PillarKey = 'you' | 'share' | 'awawb' | 'explore' | 'join';

const messages = defineMessages({
  you: { id: 'hub_switcher.you', defaultMessage: 'YOU' },
  share: { id: 'hub_switcher.share', defaultMessage: 'Share' },
  awawb: {
    id: 'hub_switcher.awawb',
    defaultMessage: 'Always was, always will be',
  },
  explore: { id: 'hub_switcher.explore', defaultMessage: 'Explore' },
  join: { id: 'hub_switcher.join', defaultMessage: 'Join' },
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

  // YOU goes to /me (the page of self actions, features/me_hub) and stays
  // lit on your public profile too.
  const youPath = currentAccountUsername ? '/me' : '/getting-started';

  const profileManifest = useKorner('profile');
  const hubManifest = useKorner('hub');
  const krewManifest = useKorner('krew');

  // YOU shows your avatar in place of the profile glyph: you're looking
  // at your own face. Falls back to the glyph before the avatar loads.
  const myAvatar = useAppSelector((state) =>
    me ? (state.accounts.get(me)?.avatar_static ?? null) : null,
  );

  const pillars: PillarConfig[] = useMemo(
    () => [
      {
        key: 'you',
        to: youPath,
        label: messages.you,
        Icon: kornerIcon('profile', profileManifest),
        iconId: 'profile',
        isActive: (p) => p === '/me' || p.startsWith('/@'),
      },
      {
        key: 'share',
        to: '/share',
        label: messages.share,
        Icon: AddIcon,
        iconId: 'share',
        isActive: (p) => p === '/share',
      },
      {
        // The centre pillar: the Aboriginal flag and one line of still
        // text, the visual centre of the row.
        key: 'awawb',
        to: '/awawb',
        label: messages.awawb,
        Icon: AboriginalFlagIcon,
        iconId: 'awawb',
        isActive: (p) => p === '/awawb',
      },
      {
        key: 'explore',
        to: '/explore',
        label: messages.explore,
        Icon: kornerIcon('hub', hubManifest),
        iconId: 'explore',
        isActive: (p) => p === '/explore',
      },
      {
        key: 'join',
        to: '/join',
        label: messages.join,
        Icon: kornerIcon('krew', krewManifest),
        iconId: 'join',
        isActive: (p) => p === '/join',
      },
    ],
    [youPath, profileManifest, hubManifest, krewManifest],
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
      ariaLabel={ariaLabel}
      formatLabel={formatLabel}
      myAvatar={myAvatar}
    />
  ) : (
    <BottomTabBar
      pillars={pillars}
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
  ariaLabel: string;
  formatLabel: (m: (typeof messages)[keyof typeof messages]) => string;
  myAvatar: string | null;
}

const MembraneTop = ({
  pillars,
  activeKey,
  ariaLabel,
  formatLabel,
  myAvatar,
}: MembraneTopProps) => {
  return (
    <nav className='hub-switcher hub-switcher--top' aria-label={ariaLabel}>
      <div
        className='hub-switcher__row'
        role='tablist'
        data-walkthrough-anchor='nav-bar'
      >
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
              data-walkthrough-anchor={`nav-${pillar.key}`}
            >
              {pillar.key === 'you' && myAvatar ? (
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
                  readers still announce each pillar even though the
                  visible pillar carries the icon (or avatar, for YOU)
                  only. */}
              <span className='hub-switcher__label hub-switcher__label--sr'>
                {label}
              </span>
            </NavLink>
          );
        })}
      </div>
      {/* The wire: a hairline under the row. It used to carry the glint
          of an arriving Nudge toward the Nudges pillar; Nudges moved to
          the top bar (2026-11-01), so it is only the line now. */}
      <div className='hub-switcher__wire' aria-hidden />
    </nav>
  );
};

// ── Bottom: mobile tab-bar ──────────────────────────────────────────

interface BottomTabBarProps {
  pillars: PillarConfig[];
  ariaLabel: string;
  formatLabel: (m: (typeof messages)[keyof typeof messages]) => string;
  myAvatar: string | null;
}

const BottomTabBar = ({
  pillars,
  ariaLabel,
  formatLabel,
  myAvatar,
}: BottomTabBarProps) => (
  <nav
    className='hub-switcher hub-switcher--bottom'
    aria-label={ariaLabel}
    data-walkthrough-anchor='nav-bar'
  >
    {pillars.map((pillar) => {
      const { Icon } = pillar;
      return (
        <NavLink
          key={pillar.key}
          to={pillar.to}
          className='hub-switcher__item'
          activeClassName='hub-switcher__item--active'
          data-walkthrough-anchor={`nav-${pillar.key}`}
        >
          <span className='hub-switcher__icon' aria-hidden>
            {pillar.key === 'you' && myAvatar ? (
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
        </NavLink>
      );
    })}
  </nav>
);
