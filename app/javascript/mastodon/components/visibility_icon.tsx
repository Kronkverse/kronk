import { defineMessages, useIntl } from 'react-intl';

import AlternateEmailIcon from '@/material-icons/400-24px/alternate_email.svg?react';
import Diversity2Icon from '@/material-icons/400-24px/diversity_2.svg?react';
import GroupsIcon from '@/material-icons/400-24px/groups.svg?react';
import LockIcon from '@/material-icons/400-24px/lock.svg?react';
import OrbitIcon from '@/material-icons/400-24px/orbit.svg?react';
import PublicIcon from '@/material-icons/400-24px/public.svg?react';
import QuietTimeIcon from '@/material-icons/400-24px/quiet_time.svg?react';
import type { StatusVisibility } from 'mastodon/models/status';

import { Icon } from './icon';

const messages = defineMessages({
  public_short: { id: 'privacy.public.short', defaultMessage: 'Public' },
  unlisted_short: {
    id: 'privacy.unlisted.short',
    defaultMessage: 'Quiet public',
  },
  private_short: {
    id: 'privacy.private.short',
    defaultMessage: 'Followers',
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

  const visibilityIconInfo = {
    public: {
      icon: 'globe',
      iconComponent: PublicIcon,
      text: intl.formatMessage(messages.public_short),
    },
    unlisted: {
      icon: 'unlock',
      iconComponent: QuietTimeIcon,
      text: intl.formatMessage(messages.unlisted_short),
    },
    private: {
      icon: 'lock',
      iconComponent: LockIcon,
      text: intl.formatMessage(messages.private_short),
    },
    direct: {
      icon: 'at',
      iconComponent: AlternateEmailIcon,
      text: intl.formatMessage(messages.direct_short),
    },
    krew: {
      icon: 'group',
      iconComponent: GroupsIcon,
      text: intl.formatMessage(messages.krew_short),
    },
    orbit: {
      icon: 'orbit',
      iconComponent: OrbitIcon,
      text: intl.formatMessage(messages.orbit_short),
    },
    mates: {
      icon: 'group',
      iconComponent: Diversity2Icon,
      text: intl.formatMessage(messages.mates_short),
    },
    self_only: {
      icon: 'lock',
      iconComponent: LockIcon,
      text: intl.formatMessage(messages.self_only_short),
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
