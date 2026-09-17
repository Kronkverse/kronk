import { useLocation } from 'react-router-dom';

import { SettingsBadge } from './settings_badge';

// AutoSettingsBadge — URL-scoped mount. Renders SettingsBadge in the
// Frame's SpaceNav slot whenever the caller is on a settings LEAF:
//
//   * /settings/<section>        → personal settings sub-page
//   * /hub/settings              → the Hub's own settings (korners list)
//   * /hub/<slug>/settings       → per-korner settings page
//   * /home/settings             → Feed limb-settings (settings.feed node)
//
// Skips the Settings Hub itself (bare /settings) — the hub IS the
// "All settings" destination, so back-to-self would be a null
// affordance there. Non-settings routes render null too, so
// AutoSpaceBadge (which handles /hub/<slug> without the /settings
// suffix) can stay mounted alongside without doubling up.
//
// /home/settings is included because the settings IA places
// `settings.feed` in the FEED limb (kronk_nodes.yaml) — "a space
// configures itself in its own limb". Feed's config still IS a
// settings page, so the L12 badge fires for it too; back-nav lands
// at the Settings Hub like every other settings surface.

const SETTINGS_LEAF_RE =
  /^\/(?:settings\/[^/]+|hub\/(?:[a-z0-9-]+\/)?settings(?:\/|$)|home\/settings(?:\/|$))/;

export const AutoSettingsBadge: React.FC = () => {
  const { pathname } = useLocation();
  if (!SETTINGS_LEAF_RE.test(pathname)) return null;
  return <SettingsBadge />;
};
