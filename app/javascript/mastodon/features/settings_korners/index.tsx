import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';

import { Stage } from 'mastodon/components/stage';
import { KornerRow } from 'mastodon/features/settings/nav';
import { useKorners } from 'mastodon/hooks/useKorner';

// The "Korners" list (settings rebuild §4.2) — the korner spaces you're in,
// drilled into from the Hub's own settings. Each row toggles tune-in and opens
// that korner's own settings space (§K) at /hub/<slug>/settings.
//
// Only korners (useKorners = non-core). Core spaces — feed, hub, nudges,
// profile, settings — carry manifests for icon/name resolution but are NOT
// korners you tune in and out of, so they must not appear here.

const messages = defineMessages({
  title: { id: 'settings_korners.title', defaultMessage: 'Korners' },
  intro: {
    id: 'settings_korners.intro',
    defaultMessage: 'Tune in or out, and open each korner’s own settings.',
  },
  tunedOut: {
    id: 'settings_korners.tuned_out_section',
    defaultMessage: 'Tuned out',
  },
  soon: { id: 'settings_korners.soon_section', defaultMessage: 'Coming soon' },
});

export const SettingsKorners: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();
  const korners = useKorners().sort((a, b) => a.name.localeCompare(b.name));

  const live = korners.filter((k) => k.enforced !== false);
  const soon = korners.filter((k) => k.enforced === false);
  const tunedIn = live.filter((k) => k.tuned_in !== false);
  const tunedOut = live.filter((k) => k.tuned_in === false);

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
          {tunedIn.map((korner) => (
            <KornerRow key={korner.slug} korner={korner} />
          ))}
        </div>

        {tunedOut.length > 0 && (
          <>
            <h2 className='settings-nav__section-heading'>
              {intl.formatMessage(messages.tunedOut)}
            </h2>
            <div className='settings-nav__list'>
              {tunedOut.map((korner) => (
                <KornerRow key={korner.slug} korner={korner} />
              ))}
            </div>
          </>
        )}

        {soon.length > 0 && (
          <>
            <h2 className='settings-nav__section-heading'>
              {intl.formatMessage(messages.soon)}
            </h2>
            <div className='settings-nav__list'>
              {soon.map((korner) => (
                <KornerRow key={korner.slug} korner={korner} />
              ))}
            </div>
          </>
        )}
      </div>
    </Stage>
  );
};
