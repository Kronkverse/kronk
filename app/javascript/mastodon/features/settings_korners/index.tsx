import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';

import { Stage } from 'mastodon/components/stage';
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

export const SettingsKorners: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();
  const korners = useAllKorners()
    .filter((k) => k.enforced !== false)
    .sort((a, b) => a.name.localeCompare(b.name));

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
          {korners.map((korner) => (
            <KornerRow key={korner.slug} korner={korner} />
          ))}
        </div>
      </div>
    </Stage>
  );
};
