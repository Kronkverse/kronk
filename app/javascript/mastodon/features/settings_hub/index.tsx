import type { CSSProperties } from 'react';
import { useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import { useHistory } from 'react-router-dom';

import SettingsIcon from '@/material-icons/400-24px/settings.svg?react';
import { SpaceHeader } from 'mastodon/components/space_header';
import { Stage } from 'mastodon/components/stage';
import { useSettingsSections } from 'mastodon/features/settings/nav';
import type { SectionDef } from 'mastodon/features/settings/nav';
import { useKorner } from 'mastodon/hooks/useKorner';

// Settings Hub — the "All settings" destination. Mirrors /me's radial
// wheel so the two hubs feel like a matched pair: central gear glyph
// with a ring of section spokes around it (Profile, Account, Appearance,
// etc.).
//
// The old docked korner-tune-in list under the wheel was removed
// 2026-09-12 — that surface lives at /hub/settings (the Hub korner's
// own settings), and duplicating it here made /settings feel like two
// pages stitched together. Tap the Hub pillar in the nav to manage
// korner visibility.

const messages = defineMessages({
  // The title/tagline for the page itself come from the core-space
  // manifest (config/korners/settings.yaml) via <SpaceHeader> — this
  // fallback covers the sub-second window before the registry
  // resolves. Every other space title on Kronk works this way.
  title: { id: 'settings_hub.title', defaultMessage: 'Settings' },
  centerLabel: {
    id: 'settings_hub.center_label',
    defaultMessage: 'Settings',
  },
});

// Distribute N spokes evenly around the wheel starting from top (0°),
// increasing clockwise. Matches the compass convention /me uses.
const angleForIndex = (index: number, count: number): number =>
  count === 0 ? 0 : (index * 360) / count;

interface SpokeProps {
  section: SectionDef;
  label: string;
  angle: number;
  onNavigate: (to: string | undefined) => void;
}

const Spoke: React.FC<SpokeProps> = ({ section, label, angle, onNavigate }) => {
  const disabled = !section.to;
  const SectionIcon = section.Icon;
  const handleClick = useCallback(() => {
    if (!disabled) onNavigate(section.to);
  }, [disabled, onNavigate, section.to]);

  const style = {
    '--spoke-angle': `${angle}deg`,
  } as CSSProperties;

  const className = disabled
    ? 'settings-hub__spoke settings-hub__spoke--placeholder'
    : 'settings-hub__spoke';

  return (
    <button
      type='button'
      className={className}
      style={style}
      onClick={handleClick}
      disabled={disabled}
      aria-disabled={disabled || undefined}
    >
      <span className='settings-hub__spoke-bubble' aria-hidden>
        <SectionIcon className='settings-hub__spoke-icon' aria-hidden='true' />
      </span>
      <span className='settings-hub__spoke-label'>{label}</span>
    </button>
  );
};

export const SettingsHub: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();
  const history = useHistory();
  const personal = useSettingsSections();

  // Title comes from the manifest via SpaceHeader; the intl fallback
  // is only for the <title>/aria-label pre-registry-resolve window.
  const settingsSpace = useKorner('settings');
  const title = settingsSpace?.name ?? intl.formatMessage(messages.title);
  const centerLabel = intl.formatMessage(messages.centerLabel);

  const handleNavigate = useCallback(
    (to?: string) => {
      if (to) history.push(to);
    },
    [history],
  );

  return (
    <Stage label={title}>
      <Helmet>
        <title>{title}</title>
      </Helmet>

      <div className='settings-hub' role='navigation' aria-label={title}>
        {/* Space header. `/settings` is a core space (manifest at
            config/korners/settings.yaml, `core: true`), so
            <AutoSpaceHeader> skips it and we render <SpaceHeader>
            directly with our own slug. Title + tagline come from the
            manifest, matching every other space header on Kronk. */}
        <SpaceHeader slug='settings' className='settings-hub__title' />

        <div className='settings-hub__stack'>
          <div className='settings-hub__wheel'>
            {/* Dashed connector ring — decorative, purely visual link
                between the spokes. `aria-hidden` because it carries
                no meaning for AT. */}
            <div className='settings-hub__ring' aria-hidden />

            {/* Centre: gear glyph. Not interactive (the wheel is the
                affordance); the sections around it are the buttons. */}
            <div
              className='settings-hub__center'
              role='img'
              aria-label={centerLabel}
            >
              <SettingsIcon
                className='settings-hub__center-glyph'
                aria-hidden='true'
              />
            </div>

            {personal.map((section, i) => (
              <Spoke
                key={section.key}
                section={section}
                label={intl.formatMessage(section.name)}
                angle={angleForIndex(i, personal.length)}
                onNavigate={handleNavigate}
              />
            ))}
          </div>
        </div>
      </div>
    </Stage>
  );
};
