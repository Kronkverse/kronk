// /me — the "Me" hub. Sits between the HubSwitcher's Me pillar and
// the user's public profile at `/@{username}`. A radial menu of
// self-related functions arrayed around the viewer's own avatar in
// the middle. Follows Tal's 2026-08-05 mockup.
//
// Not a full-featured settings surface — the shortcuts here are the
// six that mattered enough to earn a spoke:
//
//   * Profile   → /@{username}          (public profile view)
//   * Timeline  → /@{username}          (their own posts stream; same
//                                        target today; will diverge
//                                        when a "your posts" view lands)
//   * Mates     → /@{username}/mates    (mates list)
//   * Invite    → opens the invite modal (same modal the top-band
//                                        Invite FAB opens)
//   * Switch    → placeholder for account-switcher (real UX in a
//                                        follow-up when multi-account
//                                        infrastructure lands)
//   * Sign out  → /auth/sign_out (Rails-served, DELETE)
//
// Two `?` slots on the ring are visible placeholders — the mockup
// shows them; keeping them makes the future extension obvious.
//
// Center avatar tap navigates to the public profile. Subtitle
// "Tap your face to see yourself the way a mate does" is
// aspirational — the "as-a-mate" preview mode isn't built yet.

import { useCallback } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import { useHistory } from 'react-router-dom';

import GroupIcon from '@/material-icons/400-24px/group.svg?react';
import HistoryIcon from '@/material-icons/400-24px/history.svg?react';
import KeyIcon from '@/material-icons/400-24px/key.svg?react';
import LogoutIcon from '@/material-icons/400-24px/logout.svg?react';
import PersonIcon from '@/material-icons/400-24px/person.svg?react';
import QuestionMarkIcon from '@/material-icons/400-24px/question_mark.svg?react';
import SwapIcon from '@/material-icons/400-24px/sync_alt.svg?react';
import { openModal } from 'mastodon/actions/modal';
import { Column } from 'mastodon/components/column';
import { Icon } from 'mastodon/components/icon';
import type { IconProp } from 'mastodon/components/icon';
import { me } from 'mastodon/initial_state';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

const messages = defineMessages({
  title: { id: 'me_hub.title', defaultMessage: 'Me' },
  profile: { id: 'me_hub.profile', defaultMessage: 'Profile' },
  timeline: { id: 'me_hub.timeline', defaultMessage: 'Timeline' },
  mates: { id: 'me_hub.mates', defaultMessage: 'Mates' },
  invite: { id: 'me_hub.invite', defaultMessage: 'Invite' },
  switchAccount: { id: 'me_hub.switch', defaultMessage: 'Switch' },
  signOut: { id: 'me_hub.sign_out', defaultMessage: 'Sign out' },
  placeholder: { id: 'me_hub.placeholder', defaultMessage: 'Coming soon' },
  centerHint: {
    id: 'me_hub.center_hint',
    defaultMessage: 'Tap your face to see yourself the way a mate does.',
  },
});

// Spoke definitions in the render-order they appear around the ring.
// Positions are declared as angle (degrees, 0° = top, clockwise) so
// the CSS can compute placement uniformly with no per-spoke class.
interface Spoke {
  key: string;
  labelId: keyof typeof messages;
  icon: IconProp | null; // null = ? placeholder
  angle: number;
  // One of:
  //   `to`     — SPA route (uses history.push)
  //   `href`   — full-page nav (used for Rails-served /auth/sign_out)
  //   `action` — dispatch (invite modal, switch stub)
  //   nothing  — inert placeholder
  to?: string;
  href?: string;
  action?: 'invite' | 'switch';
  method?: 'delete';
}

interface MeHubProps {
  // multiColumn / advancedInterface — kept for parity with other
  // top-level column components. Not consumed today.
  multiColumn?: boolean;
}

export const MeHub: React.FC<MeHubProps> = () => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const history = useHistory();
  const myAccount = useAppSelector((state) =>
    me ? state.accounts.get(me) : undefined,
  );

  const username = myAccount?.username ?? '';
  const profilePath = username ? `/@${username}` : '/getting-started';
  const matesPath = username ? `/@${username}/mates` : '/getting-started';

  // Spokes clockwise from top. Two `?` placeholders inherit the
  // `placeholder` label + null icon; they render but don't act.
  const spokes: Spoke[] = [
    {
      key: 'profile',
      labelId: 'profile',
      icon: PersonIcon,
      angle: 0,
      to: profilePath,
    },
    {
      key: 'mates',
      labelId: 'mates',
      icon: GroupIcon,
      angle: 45,
      to: matesPath,
    },
    { key: 'ph-e', labelId: 'placeholder', icon: null, angle: 90 },
    {
      key: 'switch',
      labelId: 'switchAccount',
      icon: SwapIcon,
      angle: 135,
      action: 'switch',
    },
    {
      key: 'signout',
      labelId: 'signOut',
      icon: LogoutIcon,
      angle: 180,
      href: '/auth/sign_out',
      method: 'delete',
    },
    {
      key: 'invite',
      labelId: 'invite',
      icon: KeyIcon,
      angle: 225,
      action: 'invite',
    },
    { key: 'ph-w', labelId: 'placeholder', icon: null, angle: 270 },
    {
      key: 'timeline',
      labelId: 'timeline',
      icon: HistoryIcon,
      angle: 315,
      to: profilePath,
    },
  ];

  const handleCenterClick = useCallback(() => {
    history.push(profilePath);
  }, [history, profilePath]);

  const handleSpokeClick = useCallback(
    (spoke: Spoke) => {
      if (spoke.action === 'invite') {
        dispatch(openModal({ modalType: 'INVITE', modalProps: {} }));
      } else if (spoke.action === 'switch') {
        // TODO(me-hub): wire the account switcher when the multi-
        // account infrastructure lands. No-op today so the button
        // renders but doesn't route somewhere confusing.
      } else if (spoke.to) {
        history.push(spoke.to);
      }
      // `href` spokes are anchors — the click's default navigation
      // handles them (no explicit action here).
    },
    [dispatch, history],
  );

  const title = intl.formatMessage(messages.title);
  // Fallback chain for the center glyph when no avatar loads:
  // display_name → username → literal 'K'. Coerce empties via the
  // trim + explicit-length check rather than `||` (ESLint prefers
  // `??`, but `??` doesn't fall through empty strings). Explicit
  // check makes the intent obvious.
  const trimmedName = myAccount?.display_name.trim() ?? '';
  const trimmedUser = myAccount?.username.trim() ?? '';
  const glyphSource =
    trimmedName.length > 0
      ? trimmedName
      : trimmedUser.length > 0
        ? trimmedUser
        : 'K';
  const displayGlyph = glyphSource.charAt(0).toUpperCase();

  return (
    <Column bindToDocument label={title}>
      <Helmet>
        <title>{title}</title>
        <meta name='robots' content='noindex' />
      </Helmet>

      <div className='me-hub' role='navigation' aria-label={title}>
        <div className='me-hub__wheel'>
          {/* Dashed connector ring — decorative, purely visual link
              between the spokes. `aria-hidden` because it carries no
              meaning for AT. */}
          <div className='me-hub__ring' aria-hidden />

          {/* Center: avatar or initial. Also a button — click routes
              to the public profile. Subtitle below establishes the
              aspirational "view as a mate" intent. */}
          <button
            type='button'
            className='me-hub__center'
            onClick={handleCenterClick}
            aria-label={intl.formatMessage(messages.profile)}
          >
            {myAccount?.avatar ? (
              <img
                src={myAccount.avatar}
                alt=''
                aria-hidden
                className='me-hub__center-avatar'
              />
            ) : (
              <span className='me-hub__center-glyph' aria-hidden>
                {displayGlyph}
              </span>
            )}
          </button>

          {spokes.map((spoke) => (
            <Spoke
              key={spoke.key}
              spoke={spoke}
              label={intl.formatMessage(messages[spoke.labelId])}
              onClick={handleSpokeClick}
            />
          ))}
        </div>

        <p className='me-hub__hint'>
          <FormattedMessage {...messages.centerHint} />
        </p>
      </div>
    </Column>
  );
};

interface SpokeProps {
  spoke: Spoke;
  label: string;
  onClick: (spoke: Spoke) => void;
}

const Spoke: React.FC<SpokeProps> = ({ spoke, label, onClick }) => {
  const isPlaceholder = spoke.icon === null && !spoke.to && !spoke.href;
  const IconComponent = spoke.icon ?? QuestionMarkIcon;
  const handleClick = useCallback(() => {
    if (isPlaceholder) return;
    onClick(spoke);
  }, [isPlaceholder, onClick, spoke]);

  const style = {
    // Ring geometry — CSS puts each spoke at `angle` around the wheel.
    // Radius is a CSS variable in `_me_hub.scss` so the layout can
    // breathe responsively.
    '--spoke-angle': `${String(spoke.angle)}deg`,
  } as React.CSSProperties;

  const className = `me-hub__spoke${isPlaceholder ? ' me-hub__spoke--placeholder' : ''}`;

  // `href` spokes render as plain <a> so full-page nav + optional
  // data-method delete (Rails UJS: sign-out) work as they do on any
  // static-chrome link. Everything else renders as a button.
  if (spoke.href) {
    return (
      <a
        href={spoke.href}
        className={className}
        style={style}
        data-method={spoke.method}
      >
        <SpokeInner icon={IconComponent} label={label} spokeKey={spoke.key} />
      </a>
    );
  }

  return (
    <button
      type='button'
      className={className}
      style={style}
      onClick={handleClick}
      disabled={isPlaceholder}
      aria-disabled={isPlaceholder || undefined}
    >
      <SpokeInner icon={IconComponent} label={label} spokeKey={spoke.key} />
    </button>
  );
};

interface SpokeInnerProps {
  icon: IconProp;
  label: string;
  spokeKey: string;
}

const SpokeInner: React.FC<SpokeInnerProps> = ({ icon, label, spokeKey }) => (
  <>
    <span className='me-hub__spoke-bubble' aria-hidden>
      <Icon id={spokeKey} icon={icon} className='me-hub__spoke-icon' />
    </span>
    <span className='me-hub__spoke-label'>{label}</span>
  </>
);

// eslint-disable-next-line import/no-default-export -- async-components loader unwraps `.default`
export default MeHub;
