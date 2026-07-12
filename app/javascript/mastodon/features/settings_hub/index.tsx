import { defineMessages, useIntl, FormattedMessage } from 'react-intl';
import type { MessageDescriptor } from 'react-intl';

import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';

import ChevronRightIcon from '@/material-icons/400-24px/chevron_right.svg?react';
import DownloadIcon from '@/material-icons/400-24px/download.svg?react';
import LockIcon from '@/material-icons/400-24px/lock.svg?react';
import NotificationsIcon from '@/material-icons/400-24px/notifications.svg?react';
import PersonIcon from '@/material-icons/400-24px/person.svg?react';
import SettingsIcon from '@/material-icons/400-24px/settings.svg?react';
import TuneIcon from '@/material-icons/400-24px/tune.svg?react';
import VisibilityIcon from '@/material-icons/400-24px/visibility.svg?react';
import type { ApiKornerJSON } from 'mastodon/api_types/korners';
import Column from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { useAllKorners } from 'mastodon/hooks/useKorner';
import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';

// The settings hub (spec: settings rebuild §4.1). A map of everything —
// the personal "You" sections plus every korner's own settings — reachable
// here or in-context. Each section is also its own canonical route; this is
// the launchpad. Personal section pages land in later slices; until a
// section ships it renders as a non-interactive "soon" row so the map is
// truthful and never links into a dead end.

const messages = defineMessages({
  title: { id: 'settings_hub.title', defaultMessage: 'Settings' },
  intro: {
    id: 'settings_hub.intro',
    defaultMessage:
      'Everything about you, and every korner you are in — in one place.',
  },
  you: { id: 'settings_hub.group.you', defaultMessage: 'You' },
  korners: { id: 'settings_hub.group.korners', defaultMessage: 'Korners' },
  kornersHint: {
    id: 'settings_hub.korners_hint',
    defaultMessage:
      'Tune-in, notifications and preferences for each korner you are in.',
  },
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

interface SectionDef {
  key: string;
  to?: string; // set once the section page ships; until then the row is "soon"
  Icon: SvgComponent;
  name: MessageDescriptor;
  desc: MessageDescriptor;
}

// Canonical paths from the settings-rebuild path lock (§5.1). `to` is left
// undefined until each section's page lands in its own slice.
const YOU_SECTIONS: SectionDef[] = [
  {
    key: 'profile',
    Icon: PersonIcon,
    name: messages.profile,
    desc: messages.profileDesc,
  },
  {
    key: 'account',
    Icon: LockIcon,
    name: messages.account,
    desc: messages.accountDesc,
  },
  {
    key: 'appearance',
    to: '/settings/appearance',
    Icon: TuneIcon,
    name: messages.appearance,
    desc: messages.appearanceDesc,
  },
  {
    key: 'privacy',
    Icon: VisibilityIcon,
    name: messages.privacy,
    desc: messages.privacyDesc,
  },
  {
    key: 'data',
    Icon: DownloadIcon,
    name: messages.data,
    desc: messages.dataDesc,
  },
  {
    key: 'notifications',
    Icon: NotificationsIcon,
    name: messages.notifications,
    desc: messages.notificationsDesc,
  },
];

const SectionRow: React.FC<{ section: SectionDef }> = ({ section }) => {
  const intl = useIntl();
  const { Icon } = section;

  const inner = (
    <>
      <span className='settings-hub__row-glyph' aria-hidden='true'>
        <Icon />
      </span>
      <span className='settings-hub__row-body'>
        <span className='settings-hub__row-name'>
          {intl.formatMessage(section.name)}
        </span>
        <span className='settings-hub__row-desc'>
          {intl.formatMessage(section.desc)}
        </span>
      </span>
      {section.to ? (
        <ChevronRightIcon
          className='settings-hub__row-chevron'
          aria-hidden='true'
        />
      ) : (
        <span className='settings-hub__row-soon'>
          {intl.formatMessage(messages.soon)}
        </span>
      )}
    </>
  );

  if (section.to) {
    return (
      <Link to={section.to} className='settings-hub__row'>
        {inner}
      </Link>
    );
  }

  return (
    <div
      className='settings-hub__row settings-hub__row--soon'
      aria-disabled='true'
    >
      {inner}
    </div>
  );
};

const KornerRow: React.FC<{ korner: ApiKornerJSON }> = ({ korner }) => {
  const Icon = useKornerIcon(korner.slug);

  return (
    <Link to={`/hub/${korner.slug}/settings`} className='settings-hub__row'>
      <span className='settings-hub__row-glyph' aria-hidden='true'>
        <Icon />
      </span>
      <span className='settings-hub__row-body'>
        <span className='settings-hub__row-name'>{korner.name}</span>
      </span>
      <ChevronRightIcon
        className='settings-hub__row-chevron'
        aria-hidden='true'
      />
    </Link>
  );
};

export const SettingsHub: React.FC<{ multiColumn?: boolean }> = ({
  multiColumn,
}) => {
  const intl = useIntl();
  const korners = useAllKorners()
    .filter((k) => k.enforced !== false)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Column>
      <ColumnHeader
        title={intl.formatMessage(messages.title)}
        icon='settings'
        iconComponent={SettingsIcon}
        multiColumn={multiColumn}
        showBackButton
      />

      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
      </Helmet>

      <div className='scrollable settings-hub'>
        <header className='settings-hub__hero'>
          <span className='settings-hub__hero-glyph' aria-hidden='true'>
            <SettingsIcon />
          </span>
          <div>
            <h1 className='settings-hub__hero-title'>
              <FormattedMessage
                id='settings_hub.hero_title'
                defaultMessage='Settings'
              />
            </h1>
            <p className='settings-hub__hero-intro'>
              {intl.formatMessage(messages.intro)}
            </p>
          </div>
        </header>

        <section className='settings-hub__group'>
          <h2 className='settings-hub__group-title'>
            {intl.formatMessage(messages.you)}
          </h2>
          <div className='settings-hub__list'>
            {YOU_SECTIONS.map((section) => (
              <SectionRow key={section.key} section={section} />
            ))}
          </div>
        </section>

        <section className='settings-hub__group'>
          <h2 className='settings-hub__group-title'>
            {intl.formatMessage(messages.korners)}
          </h2>
          <p className='settings-hub__group-hint'>
            {intl.formatMessage(messages.kornersHint)}
          </p>
          <div className='settings-hub__list'>
            {korners.map((korner) => (
              <KornerRow key={korner.slug} korner={korner} />
            ))}
          </div>
        </section>
      </div>
    </Column>
  );
};

export default SettingsHub;
