import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';

import { AllSettingsFooter } from 'mastodon/components/all_settings_footer';
import { Stage } from 'mastodon/components/stage';
import {
  useSettingsSections,
  SectionRow,
} from 'mastodon/features/settings/nav';

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

export const SettingsYou: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();
  const sections = useSettingsSections();

  return (
    <Stage label={intl.formatMessage(messages.title)}>
      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
      </Helmet>

      <div className='scrollable settings-nav'>
        <header className='space-header' data-frame-header=''>
          <h1 className='space-header__title'>
            {intl.formatMessage(messages.title)}
          </h1>
          <p className='space-header__tagline'>
            {intl.formatMessage(messages.intro)}
          </p>
        </header>

        <div className='settings-nav__list'>
          {sections.map((section) => (
            <SectionRow key={section.key} section={section} />
          ))}
        </div>

        <AllSettingsFooter />
      </div>
    </Stage>
  );
};
