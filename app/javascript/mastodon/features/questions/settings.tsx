import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';

import { Stage } from 'mastodon/components/stage';

import { SettingsPanel } from './settings_panel';

// /hub/kuestions/settings — bespoke settings page for Kuestions per
// Standard §L8 (revised) + §L12. Reuses the existing SettingsPanel
// (dial + toggles + prompt-in-post-box preview) and wraps it in
// Frame chrome (Stage + .space-header + SettingsBadge from the
// SpaceNav slot).
//
// SettingsPanel is also mounted inside the main Questions surface
// as the "settings" panel of its internal panel switcher — the two
// mounts share code so no drift. Both hit
// /api/v1/korners/kuestions/settings.

const messages = defineMessages({
  title: { id: 'kuestions.settings.title', defaultMessage: 'Kuestions' },
  intro: {
    id: 'kuestions.settings.intro',
    defaultMessage:
      'How the Q&A reaches you, and how your answers reach others. Kuestions live on Kronk; nothing federates.',
  },
});

const KuestionsSettings: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();
  return (
    <Stage label={intl.formatMessage(messages.title)}>
      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
      </Helmet>

      <div className='scrollable kuestions-settings-page'>
        <header className='space-header' data-frame-header=''>
          <h1 className='space-header__title'>
            {intl.formatMessage(messages.title)}
          </h1>
          <p className='space-header__tagline'>
            {intl.formatMessage(messages.intro)}
          </p>
        </header>

        <SettingsPanel />
      </div>
    </Stage>
  );
};

// eslint-disable-next-line import/no-default-export
export default KuestionsSettings;
