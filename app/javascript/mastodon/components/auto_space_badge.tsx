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

// The badge glyph is now read from the manifest — each korner's
// `icon.text_glyph` field carries a hand-picked character (definitely
// NOT emoji, so the badge reads as a Kronk letterform rather than
// colour-emoji chrome from the OS). Missing entries fall back to the
// first letter of the space name so the layout doesn't collapse.

export const AutoSpaceBadge: React.FC = () => {
  const location = useLocation();
  const korners = useAppSelector((state) => state.korners);

  if (SETTINGS_SUBROUTE_RE.test(location.pathname)) return null;

  const match = HUB_ROUTE_RE.exec(location.pathname);
  const slug = match?.[1];
  if (!slug) return null;

  const korner = korners[slug];
  if (!korner) return null;

  const glyph = korner.icon?.text_glyph ?? korner.name.charAt(0).toUpperCase();
  return <SpaceBadge glyph={glyph} name={korner.name} backTo='/hub' />;
};
