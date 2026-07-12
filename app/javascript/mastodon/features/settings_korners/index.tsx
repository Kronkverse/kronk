import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';

import GroupIcon from '@/material-icons/400-24px/group.svg?react';
import Column from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { KornerRow } from 'mastodon/features/settings/nav';
import { useAllKorners } from 'mastodon/hooks/useKorner';

// The "Korners" list (settings rebuild §4.2) — every korner you are in,
// drilled into from the hub. Each row opens that korner's own settings
// space (§K) at /hub/<slug>/settings.

const messages = defineMessages({
  title: { id: 'settings_korners.title', defaultMessage: 'Korners' },
  intro: {
    id: 'settings_korners.intro',
    defaultMessage:
      'Tune-in, notifications and preferences for each korner you are in.',
  },
});

export const SettingsKorners: React.FC<{ multiColumn?: boolean }> = ({
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
        icon='group'
        iconComponent={GroupIcon}
        multiColumn={multiColumn}
        showBackButton
      />

      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
      </Helmet>

      <div className='scrollable settings-nav'>
        <header className='settings-nav__hero'>
          <span className='settings-nav__hero-glyph' aria-hidden='true'>
            <GroupIcon />
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
          {korners.map((korner) => (
            <KornerRow key={korner.slug} korner={korner} />
          ))}
        </div>
      </div>
    </Column>
  );
};

export default SettingsKorners;
