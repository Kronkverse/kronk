import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';

import PersonIcon from '@/material-icons/400-24px/person.svg?react';
import { Column } from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { YOU_SECTIONS, SectionRow } from 'mastodon/features/settings/nav';

// The "You" list (settings rebuild §4.2) — the personal settings sections,
// drilled into from the hub. Each row is its own canonical /settings/<x>
// route; unshipped ones show "soon".

const messages = defineMessages({
  title: { id: 'settings_you.title', defaultMessage: 'You' },
  intro: {
    id: 'settings_you.intro',
    defaultMessage:
      'Your profile, account and the preferences that follow you everywhere.',
  },
});

export const SettingsYou: React.FC<{ multiColumn?: boolean }> = ({
  multiColumn,
}) => {
  const intl = useIntl();

  return (
    <Column>
      <ColumnHeader
        title={intl.formatMessage(messages.title)}
        icon='person'
        iconComponent={PersonIcon}
        multiColumn={multiColumn}
        showBackButton
      />

      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
      </Helmet>

      <div className='scrollable settings-nav'>
        <header className='settings-nav__hero'>
          <span className='settings-nav__hero-glyph' aria-hidden='true'>
            <PersonIcon />
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

        <div className='settings-nav__list'>
          {YOU_SECTIONS.map((section) => (
            <SectionRow key={section.key} section={section} />
          ))}
        </div>
      </div>
    </Column>
  );
};

