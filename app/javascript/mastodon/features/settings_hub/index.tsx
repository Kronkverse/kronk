import { useCallback, useMemo } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import { useHistory } from 'react-router-dom';

import SettingsIcon from '@/material-icons/400-24px/settings.svg?react';
import {
  persistWalkthroughDismissed,
  restartWalkthrough,
} from 'mastodon/actions/walkthrough';
import type { IconProp } from 'mastodon/components/icon';
import { KronkWheel, KronkWheelCentre } from 'mastodon/components/kronk_wheel';
import type { KronkWheelSpoke } from 'mastodon/components/kronk_wheel';
import { SpaceHeader } from 'mastodon/components/space_header';
import { Stage } from 'mastodon/components/stage';
import { useSettingsSections } from 'mastodon/features/settings/nav';
import { useKorner } from 'mastodon/hooks/useKorner';
import { useAppDispatch } from 'mastodon/store';

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
  restartTour: {
    id: 'settings_hub.restart_tour',
    defaultMessage: 'Restart the walkthrough tour',
  },
});

export const SettingsHub: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();
  const history = useHistory();
  const dispatch = useAppDispatch();
  const personal = useSettingsSections();

  // Title comes from the manifest via SpaceHeader; the intl fallback
  // is only for the <title>/aria-label pre-registry-resolve window.
  const settingsSpace = useKorner('settings');
  const title = settingsSpace?.name ?? intl.formatMessage(messages.title);
  const centerLabel = intl.formatMessage(messages.centerLabel);

  // Wipe the walkthrough state (client + server) and jump back to
  // /home so the runner picks up the fresh state and auto-fires.
  const handleRestartTour = useCallback(() => {
    dispatch(restartWalkthrough());
    void dispatch(persistWalkthroughDismissed(false));
    history.push('/home');
  }, [dispatch, history]);

  // Section → wheel spoke. Sections without a `to` field render as
  // disabled placeholders — the shared `<KronkWheel>` handles the
  // dashed-border + muted-colour treatment.
  const spokes = useMemo<KronkWheelSpoke[]>(
    () =>
      personal.map((section) => ({
        key: section.key,
        label: intl.formatMessage(section.name),
        // `SectionDef.Icon` is `React.ComponentType<SVGProps>`; the
        // wheel's `IconProp` is the narrower `React.FC<SVGPropsWithTitle>`.
        // The vite `?react` loader always emits an FC, so the cast is
        // safe in practice.
        icon: section.Icon as unknown as IconProp,
        to: section.to,
        disabled: !section.to,
      })),
    [personal, intl],
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

        {/* Row 2 — wheel-mount. Positioning inherited from the shared
            `.kronk-wheel-mount`, so this wheel sits at the same
            absolute Y as /me and /kronk. */}
        <div className='kronk-wheel-mount'>
          <KronkWheel spokes={spokes} label={title}>
            {/* Centre: gear glyph. Not interactive (the wheel is the
                affordance); the sections around it are the buttons. */}
            <KronkWheelCentre role='img' ariaLabel={centerLabel}>
              <SettingsIcon
                className='kronk-wheel__centre-icon'
                aria-hidden='true'
              />
            </KronkWheelCentre>
          </KronkWheel>
        </div>

        {/* Row 3 — small helpers below the wheel. First item + only
            item today: restart the first-run walkthrough — the flag
            lives on `settings_store["web.walkthrough_dismissed"]`, so
            clearing it here rearms the tour on every device the
            account is signed into (docs/kronk_walkthrough.md). */}
        <div className='settings-hub__helpers'>
          <button
            type='button'
            className='settings-hub__helper-btn'
            onClick={handleRestartTour}
          >
            ↻ {intl.formatMessage(messages.restartTour)}
          </button>
        </div>
      </div>
    </Stage>
  );
};
