import { useLocation } from 'react-router-dom';

import { useAppSelector } from 'mastodon/store';

import { SpaceBadge } from './space_badge';

// AutoSpaceBadge — renders <SpaceBadge> automatically for any /hub/<slug>
// route by matching the current pathname against the loaded korner
// registry (fetched by fetchKorners on app boot). Wired into
// <KronkFrame.SpaceNav> so every korner picks up the same chrome
// without opting in per-space.
//
// Spec: docs/kronk_frame.md § SpaceNav — the space badge is the shared
// affordance across every Stage-based korner. This is what makes that
// promise real.

const HUB_ROUTE_RE = /^\/hub\/([a-z0-9-]+)/;
// On /hub/<slug>/settings, AutoSettingsBadge takes over the SpaceNav
// slot (see components/auto_settings_badge.tsx). Skip here so the two
// don't double up.
const SETTINGS_SUBROUTE_RE = /^\/hub\/[a-z0-9-]+\/settings(?:\/|$)/;

// The decorative letterform slot between the arrow and the korner
// name was retired 2026-08-06 (Tal: "superfluous"); SpaceBadge now
// renders `[← <name>]` only.

export const AutoSpaceBadge: React.FC = () => {
  const location = useLocation();
  const korners = useAppSelector((state) => state.korners);

  if (SETTINGS_SUBROUTE_RE.test(location.pathname)) return null;

  const match = HUB_ROUTE_RE.exec(location.pathname);
  const slug = match?.[1];
  if (!slug) return null;

  const korner = korners[slug];
  // Core spaces (e.g. settings at /hub/settings) are not korners and get no
  // korner badge — their own chrome (SettingsBadge) takes the slot instead.
  if (!korner || korner.core) return null;

  return <SpaceBadge name={korner.name} backTo='/hub' />;
};
