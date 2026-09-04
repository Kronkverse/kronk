import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';

import { Stage } from 'mastodon/components/stage';
import { SettingsSection } from 'mastodon/features/settings/section';

import { SettingsPanel } from './settings_panel';

// /hub/kuestions/settings — Kuestions on the shared settings kit.
// Reuses `SettingsPanel` (dial + toggles + prompt-in-post-box preview)
// wrapped in a `<SettingsSection>` so the outer chrome matches every
// other settings page.
//
// SettingsPanel is also mounted inside the main Questions surface as
// the "settings" panel of its internal panel switcher — both mounts
// share code so nothing drifts. Splitting SettingsPanel into
// individual `<SettingsSection>` blocks (so toggles / dial / preview
// each get their own heading) is a separate step because it would
// break the internal panel switcher's assumption of one panel body.

const messages = defineMessages({
  title: { id: 'kuestions.settings.title', defaultMessage: 'Kuestions' },
  intro: {
    id: 'kuestions.settings.intro',
    defaultMessage:
      'How the Q&A reaches you, and how your answers reach others. Kuestions live on Kronk; nothing federates.',
  },
  preferences: {
    id: 'kuestions.settings.preferences',
    defaultMessage: 'Kuestions preferences',
  },
  proposeSection: {
    id: 'korner_settings.propose_section',
    defaultMessage: 'Propose changes',
  },
  proposeHint: {
    id: 'korner_settings.propose_hint',
    defaultMessage:
      'Want to change how this space works? Open a Kommons proposal — it lands on this space and anyone can back it.',
  },
  proposeCTA: {
    id: 'korner_settings.propose_cta',
    defaultMessage: 'Propose a change to {name}',
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

        <SettingsSection
          heading={<FormattedMessage {...messages.preferences} />}
        >
          <SettingsPanel />
        </SettingsSection>

        <SettingsSection
          heading={<FormattedMessage {...messages.proposeSection} />}
          hint={<FormattedMessage {...messages.proposeHint} />}
        >
          <Link
            to='/hub/kommons/composer?space=kuestions'
            className='korner-settings__propose-cta'
          >
            <FormattedMessage
              {...messages.proposeCTA}
              values={{ name: 'Kuestions' }}
            />
          </Link>
        </SettingsSection>
      </div>
    </Stage>
  );
};

// eslint-disable-next-line import/no-default-export
export default KuestionsSettings;
