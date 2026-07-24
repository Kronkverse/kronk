import { useLocation } from 'react-router-dom';

import { SettingsBadge } from './settings_badge';

// AutoSettingsBadge — URL-scoped mount. Renders SettingsBadge in the
// Frame's SpaceNav slot whenever the caller is on a settings LEAF:
//
//   * /settings/<section>        → personal settings sub-page
//   * /hub/<slug>/settings       → per-korner settings page
//
// Skips the Settings Hub itself (bare /settings) — the hub IS the
// "All settings" destination, so back-to-self would be a null
// affordance there. Non-settings routes render null too, so
// AutoSpaceBadge (which handles /hub/<slug> without the /settings
// suffix) can stay mounted alongside without doubling up.

const SETTINGS_LEAF_RE =
  /^\/(?:settings\/[^/]+|hub\/[a-z0-9-]+\/settings(?:\/|$))/;

export const AutoSettingsBadge: React.FC = () => {
  const { pathname } = useLocation();
  if (!SETTINGS_LEAF_RE.test(pathname)) return null;
  return <SettingsBadge />;
};
