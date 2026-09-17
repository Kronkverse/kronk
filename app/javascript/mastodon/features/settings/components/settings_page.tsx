import type { ReactNode } from 'react';

import { Helmet } from 'react-helmet';

import { AllSettingsFooter } from 'mastodon/components/all_settings_footer';
import { Stage } from 'mastodon/components/stage';
import { SettingsSpaceHeader } from 'mastodon/features/settings/space_header';

import { SettingsStatus } from './settings_status';
import type { SaveStatus } from './settings_status';

// Shared shell every /settings/* page renders inside. Locks the header
// treatment, the Stage frame, the Helmet title, the autosave status
// pill placement, and the footer — so per-page components only own
// their sections + fields.
//
// Design: docs/kronk_settings_ia.md (Kronk 2.0 settings rebuild — Tal
// 2026-09-12 "we need a standardisation across all settings pages").

interface Props {
  // Rendered in the header + <title> + Stage label. Should already
  // be i18n-resolved by the caller.
  title: string;
  // One-line description under the title. Optional — pages with
  // self-explanatory titles can omit it.
  tagline?: string;
  // Autosave state. Pages that don't autosave (Account, Data)
  // simply pass `undefined` and no status pill renders.
  status?: SaveStatus;
  // Section blocks and any other body content.
  children: ReactNode;
}

export const SettingsPage: React.FC<Props> = ({
  title,
  tagline,
  status,
  children,
}) => (
  <Stage label={title}>
    <Helmet>
      <title>{title}</title>
    </Helmet>

    <div className='scrollable settings-page'>
      <SettingsSpaceHeader title={title} tagline={tagline} />

      {status !== undefined && (
        <div className='settings-page__status-row'>
          <SettingsStatus status={status} />
        </div>
      )}

      <div className='settings-page__body'>{children}</div>

      <AllSettingsFooter />
    </div>
  </Stage>
);
