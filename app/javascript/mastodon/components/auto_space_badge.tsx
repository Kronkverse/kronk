import { useLocation } from 'react-router-dom';

import type { LocationState } from 'mastodon/components/router';
import { useAppSelector } from 'mastodon/store';

import { useSpaceBackTarget } from './space_back';
import { SpaceBadge } from './space_badge';

// AutoSpaceBadge — renders <SpaceBadge> automatically for any /hub/<slug>
// route by matching the current pathname against the loaded korner
// registry (fetched by fetchKorners on app boot). Wired into
// <KronkFrame.SpaceNav> so every korner picks up the same chrome
// without opting in per-space.
//
// Back-target follows the URL hierarchy:
//
//   * `/hub/<slug>`             → `/hub` (label: "Hub")
//   * `/hub/<slug>/<view-key>`  → `/hub` (a rotator/picker face is
//                                  still the space landing; the ring
//                                  cycles, it doesn't descend)
//   * `/hub/<slug>/<anything-else>` and deeper → `/hub/<slug>`
//                                  (label: the korner's name)
//
// Deep sub-pages (`/propose`, `/pick`, `/p/:id`, `/space/:slug`, …)
// therefore back up one level to the korner root; the korner root
// backs out to the Hub grid. Matches Tal's "up the hierarchy"
// direction (2026-08-11).
//
// One exception (Tal 2026-10-12, Kommons proposal "Back button nav"): a
// sub-page opened from another page of the same korner goes back to that
// page, when the link that opened it says so in `location.state.backTo`.
// Opening a proposal from Kommons' Open face returns to the Open face, not
// to the Directory. Arriving any other way (a feed card, a shared link) has
// no such state and backs up the hierarchy as above.
//
// And a page whose layers the URL doesn't show (a FreeTheDream fractal is
// `/p/:id` like its gang and its emergence) says its own parent through
// `useSpaceBack` (components/space_back.ts); the badge then goes one layer
// up, named for that parent (Tal, 2026-10-19).
//
// Spec: docs/design.md (Frame) § SpaceNav — the space badge is the shared
// affordance across every Stage-based korner. This is what makes that
// promise real.

const HUB_ROUTE_RE = /^\/hub\/([a-z0-9-]+)(?:\/([a-z0-9-]+))?/;
// On /hub/<slug>/settings, AutoSettingsBadge takes over the SpaceNav
// slot (see components/auto_settings_badge.tsx). Skip here so the two
// don't double up.
const SETTINGS_SUBROUTE_RE = /^\/hub\/[a-z0-9-]+\/settings(?:\/|$)/;

// The decorative letterform slot between the arrow and the korner
// name was retired 2026-08-06 (Tal: "superfluous"); SpaceBadge now
// renders `[← <name>]` only.

export const AutoSpaceBadge: React.FC = () => {
  const location = useLocation<LocationState>();
  const korners = useAppSelector((state) => state.korners);
  const parent = useSpaceBackTarget();

  if (SETTINGS_SUBROUTE_RE.test(location.pathname)) return null;

  const match = HUB_ROUTE_RE.exec(location.pathname);
  const slug = match?.[1];
  if (!slug) return null;

  const korner = korners[slug];
  // Core spaces (e.g. settings at /hub/settings) are not korners and get no
  // korner badge — their own chrome (SettingsBadge) takes the slot instead.
  if (!korner || korner.core) return null;

  const segment = match[2];
  const isView =
    segment !== undefined &&
    (korner.views ?? []).some((view) => view.key === segment);
  const atSpaceRoot = segment === undefined || isView;

  // Only ever a page of this same korner, so the label stays true.
  const cameFrom = location.state?.backTo;
  const withinSpace =
    cameFrom === `/hub/${slug}` || cameFrom?.startsWith(`/hub/${slug}/`);

  const ownParent =
    !atSpaceRoot && parent?.href.startsWith(`/hub/${slug}`) ? parent : null;

  const backTo = atSpaceRoot
    ? '/hub'
    : withinSpace && cameFrom
      ? cameFrom
      : (ownParent?.href ?? `/hub/${slug}`);
  const name = atSpaceRoot
    ? 'Hub'
    : withinSpace && cameFrom
      ? korner.name
      : (ownParent?.label ?? korner.name);

  return <SpaceBadge name={name} backTo={backTo} />;
};
