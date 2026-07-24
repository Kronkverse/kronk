import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';

import ChevronRightIcon from '@/material-icons/400-24px/chevron_right.svg?react';
import type { ApiKornerJSON } from 'mastodon/api_types/korners';
import { Icon } from 'mastodon/components/icon';
import { Stage } from 'mastodon/components/stage';
import { useSettingsSections } from 'mastodon/features/settings/nav';
import type { SectionDef } from 'mastodon/features/settings/nav';
import { useKorners } from 'mastodon/hooks/useKorner';
import { kornerIcon } from 'mastodon/hooks/useKornerIcon';

// Settings Hub — the "All settings" destination. Every settings page
// (personal + per-korner) reaches back here via the SettingsBadge in
// SpaceNav, and here you can jump to any of them. Chrome mirrors the
// korner surfaces (Stage + SpaceHeader-styled title/description) so
// the settings surface reads as its own space rather than a subsection
// of Mastodon's classic settings.
//
// Layout is flat: two sections (Personal + Korners), each a card grid.
// The old two-kard drill-down (You / Korners) is retired — the hub
// itself is the map.

const messages = defineMessages({
  title: { id: 'settings_hub.title', defaultMessage: 'Settings' },
  intro: {
    id: 'settings_hub.intro',
    defaultMessage: 'Everything about you, and every korner you are in.',
  },
  sectionPersonal: {
    id: 'settings_hub.section.personal',
    defaultMessage: 'Personal',
  },
  sectionKorners: {
    id: 'settings_hub.section.korners',
    defaultMessage: 'Korners',
  },
  kornerCardDesc: {
    id: 'settings_hub.korner_card_desc',
    defaultMessage: 'Tune-in, notifications, defaults.',
  },
  comingSoon: {
    id: 'settings_hub.coming_soon',
    defaultMessage: 'Coming soon',
  },
});

interface KardProps {
  to: string;
  glyph: React.ReactNode;
  title: string;
  desc: string;
  disabled?: boolean;
  disabledLabel?: string;
}

const Kard: React.FC<KardProps> = ({
  to,
  glyph,
  title,
  desc,
  disabled,
  disabledLabel,
}) => {
  const body = (
    <>
      <span className='settings-nav__kard-glyph' aria-hidden='true'>
        {glyph}
      </span>
      <span className='settings-nav__kard-body'>
        <span className='settings-nav__kard-title'>{title}</span>
        <span className='settings-nav__kard-desc'>{desc}</span>
        {disabled && disabledLabel && (
          <span className='settings-nav__kard-meta'>{disabledLabel}</span>
        )}
      </span>
      {!disabled && (
        <ChevronRightIcon
          className='settings-nav__kard-chevron'
          aria-hidden='true'
        />
      )}
    </>
  );

  if (disabled) {
    return (
      <span
        className='settings-nav__kard settings-nav__kard--disabled'
        aria-disabled='true'
      >
        {body}
      </span>
    );
  }

  return (
    <Link to={to} className='settings-nav__kard'>
      {body}
    </Link>
  );
};

const PersonalKard: React.FC<{ section: SectionDef }> = ({ section }) => {
  const intl = useIntl();
  const soon = !section.to;
  const SectionIcon = section.Icon;
  return (
    <Kard
      to={section.to ?? '#'}
      glyph={<SectionIcon />}
      title={intl.formatMessage(section.name)}
      desc={intl.formatMessage(section.desc)}
      disabled={soon}
      disabledLabel={soon ? intl.formatMessage(messages.comingSoon) : undefined}
    />
  );
};

const KornerKard: React.FC<{ korner: ApiKornerJSON }> = ({ korner }) => {
  const intl = useIntl();
  const spec = kornerIcon(korner.slug, korner);
  return (
    <Kard
      to={`/hub/${korner.slug}/settings`}
      glyph={<Icon id={korner.icon?.material ?? korner.slug} icon={spec} />}
      title={korner.name}
      desc={intl.formatMessage(messages.kornerCardDesc)}
    />
  );
};

export const SettingsHub: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();
  const personal = useSettingsSections();
  const korners = useKorners()
    .slice()
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

        <section className='settings-nav__section'>
          <h2 className='settings-nav__section-title'>
            {intl.formatMessage(messages.sectionPersonal)}
          </h2>
          <div className='settings-nav__kards'>
            {personal.map((section) => (
              <PersonalKard key={section.key} section={section} />
            ))}
          </div>
        </section>

        <section className='settings-nav__section'>
          <h2 className='settings-nav__section-title'>
            {intl.formatMessage(messages.sectionKorners)}
          </h2>
          <div className='settings-nav__kards'>
            {korners.map((korner) => (
              <KornerKard key={korner.slug} korner={korner} />
            ))}
          </div>
        </section>
      </div>
    </Stage>
  );
};
