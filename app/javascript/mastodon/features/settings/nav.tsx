import { defineMessages, useIntl } from 'react-intl';
import type { MessageDescriptor } from 'react-intl';

import { Link } from 'react-router-dom';

import ChevronRightIcon from '@/material-icons/400-24px/chevron_right.svg?react';
import DownloadIcon from '@/material-icons/400-24px/download.svg?react';
import LockIcon from '@/material-icons/400-24px/lock.svg?react';
import NotificationsIcon from '@/material-icons/400-24px/notifications.svg?react';
import PersonIcon from '@/material-icons/400-24px/person.svg?react';
import TuneIcon from '@/material-icons/400-24px/tune.svg?react';
import VisibilityIcon from '@/material-icons/400-24px/visibility.svg?react';
import type { ApiKornerJSON } from 'mastodon/api_types/korners';
import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';
import { me } from 'mastodon/initial_state';
import { useAppSelector } from 'mastodon/store';

// Shared navigation pieces for the settings surfaces (settings rebuild §4).
// The hub drills into a "You" list and a "Korners" list; both, plus the hub
// kards, share these row/section definitions so there is one source of truth.

export const navMessages = defineMessages({
  soon: { id: 'settings_hub.soon', defaultMessage: 'Soon' },
  profile: { id: 'settings_hub.profile', defaultMessage: 'Profile' },
  profileDesc: {
    id: 'settings_hub.profile_desc',
    defaultMessage: 'How your profile looks — the composer.',
  },
  account: { id: 'settings_hub.account', defaultMessage: 'Account & security' },
  accountDesc: {
    id: 'settings_hub.account_desc',
    defaultMessage: 'Email, password, two-factor, sessions, apps.',
  },
  appearance: {
    id: 'settings_hub.appearance',
    defaultMessage: 'Appearance & language',
  },
  appearanceDesc: {
    id: 'settings_hub.appearance_desc',
    defaultMessage: 'Theme, language, posting defaults, motion.',
  },
  privacy: {
    id: 'settings_hub.privacy',
    defaultMessage: 'Relationships & privacy',
  },
  privacyDesc: {
    id: 'settings_hub.privacy_desc',
    defaultMessage: 'Follower approval, who reaches you, filters and blocks.',
  },
  data: { id: 'settings_hub.data', defaultMessage: 'Data' },
  dataDesc: {
    id: 'settings_hub.data_desc',
    defaultMessage: 'Import and export your account data.',
  },
  notifications: {
    id: 'settings_hub.notifications',
    defaultMessage: 'Notifications',
  },
  notificationsDesc: {
    id: 'settings_hub.notifications_desc',
    defaultMessage: 'What reaches you, and how — plus Nudges.',
  },
});

type SvgComponent = React.ComponentType<React.SVGProps<SVGSVGElement>>;

export interface SectionDef {
  key: string;
  to?: string; // set once the section page ships; until then the row is "soon"
  Icon: SvgComponent;
  name: MessageDescriptor;
  desc: MessageDescriptor;
}

// Canonical paths from the settings-rebuild path lock (§5.1). `to` is left
// undefined until each section's page lands in its own slice.
export const YOU_SECTIONS: SectionDef[] = [
  {
    key: 'profile',
    Icon: PersonIcon,
    name: navMessages.profile,
    desc: navMessages.profileDesc,
  },
  {
    key: 'account',
    Icon: LockIcon,
    name: navMessages.account,
    desc: navMessages.accountDesc,
  },
  {
    key: 'appearance',
    to: '/settings/appearance',
    Icon: TuneIcon,
    name: navMessages.appearance,
    desc: navMessages.appearanceDesc,
  },
  {
    key: 'privacy',
    to: '/settings/privacy',
    Icon: VisibilityIcon,
    name: navMessages.privacy,
    desc: navMessages.privacyDesc,
  },
  {
    key: 'data',
    Icon: DownloadIcon,
    name: navMessages.data,
    desc: navMessages.dataDesc,
  },
  {
    key: 'notifications',
    to: '/settings/notifications',
    Icon: NotificationsIcon,
    name: navMessages.notifications,
    desc: navMessages.notificationsDesc,
  },
];

export const SectionRow: React.FC<{ section: SectionDef }> = ({ section }) => {
  const intl = useIntl();
  const { Icon } = section;
  const myAccount = useAppSelector((state) =>
    me ? state.accounts.get(me) : undefined,
  );
  const myAcct = myAccount?.get('acct');
  // Profile "settings" is the composer (owner-only /@:acct/edit).
  const to =
    section.key === 'profile'
      ? myAcct
        ? `/@${myAcct}/edit`
        : undefined
      : section.to;

  const inner = (
    <>
      <span className='settings-nav__row-glyph' aria-hidden='true'>
        <Icon />
      </span>
      <span className='settings-nav__row-body'>
        <span className='settings-nav__row-name'>
          {intl.formatMessage(section.name)}
        </span>
        <span className='settings-nav__row-desc'>
          {intl.formatMessage(section.desc)}
        </span>
      </span>
      {to ? (
        <ChevronRightIcon
          className='settings-nav__row-chevron'
          aria-hidden='true'
        />
      ) : (
        <span className='settings-nav__row-soon'>
          {intl.formatMessage(navMessages.soon)}
        </span>
      )}
    </>
  );

  if (to) {
    return (
      <Link to={to} className='settings-nav__row'>
        {inner}
      </Link>
    );
  }

  return (
    <div
      className='settings-nav__row settings-nav__row--soon'
      aria-disabled='true'
    >
      {inner}
    </div>
  );
};

export const KornerRow: React.FC<{ korner: ApiKornerJSON }> = ({ korner }) => {
  const Icon = useKornerIcon(korner.slug);

  return (
    <Link to={`/hub/${korner.slug}/settings`} className='settings-nav__row'>
      <span className='settings-nav__row-glyph' aria-hidden='true'>
        <Icon />
      </span>
      <span className='settings-nav__row-body'>
        <span className='settings-nav__row-name'>{korner.name}</span>
      </span>
      <ChevronRightIcon
        className='settings-nav__row-chevron'
        aria-hidden='true'
      />
    </Link>
  );
};
