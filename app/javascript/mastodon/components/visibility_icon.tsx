import { defineMessages, useIntl } from 'react-intl';

import AlternateEmailIcon from '@/material-icons/400-24px/alternate_email.svg?react';
import GroupIcon from '@/material-icons/400-24px/group.svg?react';
import GroupsIcon from '@/material-icons/400-24px/groups.svg?react';
import LockIcon from '@/material-icons/400-24px/lock.svg?react';
import OrbitIcon from '@/material-icons/400-24px/orbit.svg?react';
import ZheIcon from '@/material-icons/400-24px/zhe.svg?react';
import type { StatusVisibility } from 'mastodon/models/status';

import { Icon } from './icon';

// Kronk reach ladder (docs/kronk_feed_and_reach.md — Kronkverse /
// Orbit / Mates / Krew / Just-me), rendered here as the small
// visibility glyph shown in status headers.
//
// Path B rollout (Phase 1 — 2026-08-12): the Mastodon-primitive
// values (`unlisted`, `private`, `direct`, `limited`) are being
// retired from the composer, but still exist in the DB enum + in
// inbound (historical + any future federated) posts. They stay
// display-mapped to the closest Kronk-native tier below so those
// legacy rows still render sensibly. Phase 2 lands the DB migration
// that folds them; Phase 3 gets the ActivityPub layer.
//
// Icon changes vs the previous mapping:
//   * public → Kronkverse: `zhe.svg` (the Kronk Ж) instead of the
//     generic globe. Public IS Kronkverse in the new model.
//   * mates: `group.svg` (matches the /me Membrane's Mates spoke)
//     instead of `diversity_2.svg` (three heads — read too much
//     like a huddle icon; Tal 2026-08-12).
//   * unlisted → aliased to `self_only` for display (Just me), per
//     Tal's mapping ("unlisted is basically self-only"). Legacy rows
//     render with the lock + "Just me" label.
//   * private → aliased to `mates` for display, per Tal's mapping
//     ("private is now essentially mates").

const messages = defineMessages({
  kronkverse_short: {
    id: 'privacy.kronkverse.short',
    defaultMessage: 'Kronkverse',
  },
  direct_short: {
    id: 'privacy.direct.short',
    defaultMessage: 'Specific people',
  },
  krew_short: {
    id: 'privacy.krew.short',
    defaultMessage: 'Krew',
  },
  orbit_short: {
    id: 'privacy.orbit.short',
    defaultMessage: 'Orbit',
  },
  mates_short: {
    id: 'privacy.mates.short',
    defaultMessage: 'Mates',
  },
  self_only_short: {
    id: 'privacy.self_only.short',
    defaultMessage: 'Just me',
  },
});

export const VisibilityIcon: React.FC<{ visibility: StatusVisibility }> = ({
  visibility,
}) => {
  const intl = useIntl();

  const kronkverseFace = {
    icon: 'zhe',
    iconComponent: ZheIcon,
    text: intl.formatMessage(messages.kronkverse_short),
  };
  const matesFace = {
    icon: 'group',
    iconComponent: GroupIcon,
    text: intl.formatMessage(messages.mates_short),
  };
  const justMeFace = {
    icon: 'lock',
    iconComponent: LockIcon,
    text: intl.formatMessage(messages.self_only_short),
  };

  const visibilityIconInfo = {
    // Kronk-native reach tiers
    public: kronkverseFace,
    orbit: {
      icon: 'orbit',
      iconComponent: OrbitIcon,
      text: intl.formatMessage(messages.orbit_short),
    },
    mates: matesFace,
    self_only: justMeFace,
    krew: {
      icon: 'group',
      iconComponent: GroupsIcon,
      text: intl.formatMessage(messages.krew_short),
    },
    // Retired-from-composer, display-only aliases for legacy rows +
    // inbound federated posts (Phase 1 rollout — see file header).
    unlisted: justMeFace,
    private: matesFace,
    direct: {
      icon: 'at',
      iconComponent: AlternateEmailIcon,
      text: intl.formatMessage(messages.direct_short),
    },
  };

  const visibilityIcon = visibilityIconInfo[visibility];

  return (
    <Icon
      id={visibilityIcon.icon}
      icon={visibilityIcon.iconComponent}
      aria-label={visibilityIcon.text}
    />
  );
};
