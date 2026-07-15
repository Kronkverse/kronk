import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';

import ChevronRightIcon from '@/material-icons/400-24px/chevron_right.svg?react';
import GroupIcon from '@/material-icons/400-24px/group.svg?react';
import PersonIcon from '@/material-icons/400-24px/person.svg?react';
import SettingsIcon from '@/material-icons/400-24px/settings.svg?react';
import { Column } from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { useSettingsSections } from 'mastodon/features/settings/nav';
import { useAllKorners } from 'mastodon/hooks/useKorner';

// The settings hub (spec: settings rebuild §4.1). Two kards — "You" and
// "Korners" — that drill into their own lists. The hub is the map; the
// section pages and per-korner settings live one level down.

type SvgComponent = React.ComponentType<React.SVGProps<SVGSVGElement>>;

const messages = defineMessages({
  title: { id: 'settings_hub.title', defaultMessage: 'Settings' },
  intro: {
    id: 'settings_hub.intro',
    defaultMessage: 'Everything about you, and every korner you are in.',
  },
  you: { id: 'settings_hub.group.you', defaultMessage: 'You' },
  youDesc: {
    id: 'settings_hub.you_desc',
    defaultMessage:
      'Profile, account, appearance, privacy, data, notifications.',
  },
  korners: { id: 'settings_hub.group.korners', defaultMessage: 'Korners' },
  kornersDesc: {
    id: 'settings_hub.korners_desc',
    defaultMessage: 'Tune-in, notifications and preferences for each korner.',
  },
  sectionCount: {
    id: 'settings_hub.section_count',
    defaultMessage: '{count} sections',
  },
  kornerCount: {
    id: 'settings_hub.korner_count',
    defaultMessage: '{count, plural, one {# korner} other {# korners}}',
  },
});

const Kard: React.FC<{
  to: string;
  Icon: SvgComponent;
  title: string;
  desc: string;
  meta: string;
}> = ({ to, Icon, title, desc, meta }) => (
  <Link to={to} className='settings-nav__kard'>
    <span className='settings-nav__kard-glyph' aria-hidden='true'>
      <Icon />
    </span>
    <span className='settings-nav__kard-body'>
      <span className='settings-nav__kard-title'>{title}</span>
      <span className='settings-nav__kard-desc'>{desc}</span>
      <span className='settings-nav__kard-meta'>{meta}</span>
    </span>
    <ChevronRightIcon
      className='settings-nav__kard-chevron'
      aria-hidden='true'
    />
  </Link>
);

export const SettingsHub: React.FC<{ multiColumn?: boolean }> = ({
  multiColumn,
}) => {
  const intl = useIntl();
  const youCount = useSettingsSections().length;
  const kornerCount = useAllKorners().filter(
    (k) => k.enforced !== false,
  ).length;

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

      <div className='scrollable settings-nav'>
        <header className='settings-nav__hero'>
          <span className='settings-nav__hero-glyph' aria-hidden='true'>
            <SettingsIcon />
          </span>
          <div>
            <h1 className='settings-nav__hero-title'>
              {intl.formatMessage(messages.title)}
            </h1>
            <p className='settings-nav__hero-intro'>
              {intl.formatMessage(messages.intro)}
            </p>
          </div>
        </header>

        <div className='settings-nav__kards'>
          <Kard
            to='/settings/you'
            Icon={PersonIcon}
            title={intl.formatMessage(messages.you)}
            desc={intl.formatMessage(messages.youDesc)}
            meta={intl.formatMessage(messages.sectionCount, {
              count: youCount,
            })}
          />
          <Kard
            to='/settings/korners'
            Icon={GroupIcon}
            title={intl.formatMessage(messages.korners)}
            desc={intl.formatMessage(messages.kornersDesc)}
            meta={intl.formatMessage(messages.kornerCount, {
              count: kornerCount,
            })}
          />
        </div>
      </div>
    </Column>
  );
};

