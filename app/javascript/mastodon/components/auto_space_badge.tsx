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

// Per-slug display glyphs. Manifests carry `icon` (a Material Icons
// name) but the display glyph is a distinct piece of identity — a
// hand-picked character that reads as "this space" at a glance. Add
// entries here as new korners take over Stage-based rendering. Any
// slug not in the map falls back to the first letter of the space's
// name.
// Hand-picked text glyphs — deliberately NOT emoji, so a badge reads
// as a Kronk letterform rather than colour-emoji chrome from the OS.
// Add entries here as korners take over Stage-based rendering; a slug
// without a mapping falls back to the first letter of the space name.
const SLUG_TO_GLYPH: Record<string, string> = {
  kuestions: 'Ƙ',
  kommons: '✦',
  nudges: '◉',
  booth: 'Ƀ',
  kalendar: 'Ķ',
  kompass: 'Ǩ',
  huddle: '◊',
  inflow: '≈',
  klot: 'Ł',
  groups: 'ĸ', // Kronk vocab: slug stays `groups`, display label is "Krews".
};

export const AutoSpaceBadge: React.FC = () => {
  const location = useLocation();
  const korners = useAppSelector((state) => state.korners);

  const match = HUB_ROUTE_RE.exec(location.pathname);
  const slug = match?.[1];
  if (!slug) return null;

  const korner = korners[slug];
  if (!korner) return null;

  const glyph = SLUG_TO_GLYPH[slug] ?? korner.name.charAt(0).toUpperCase();
  return <SpaceBadge glyph={glyph} name={korner.name} backTo='/hub' />;
};
