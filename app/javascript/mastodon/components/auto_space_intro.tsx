import { useLocation } from 'react-router-dom';

import { useKorner } from 'mastodon/hooks/useKorner';

import { SpaceIntro } from './space_intro';

// AutoSpaceIntro — the Frame-provided space description. Renders the
// korner's manifest intro (`tagline`, via <SpaceIntro>) automatically
// atop the Stage, so title (AutoSpaceBadge), description (this), and
// navigation (AutoSpaceViewPicker) all derive from the same
// manifest + route and stay in sync across every korner.
//
// It mounts once inside the shared <Stage> and self-scopes by route:
//
//   * `/hub/<slug>`            → shown (korner landing / default view)
//   * `/hub/<slug>/<view-key>` → shown when <view-key> is a declared
//                                manifest view (a first-level view)
//   * anything deeper / an unrecognised segment (`/hub/krew/:id`,
//     `/hub/kommons/p/:id`, `/hub/<slug>/settings`, …) → null
//
// so the intro sits where the space header belongs, not on every
// detail sub-page. Non-korner routes and korners without a tagline
// resolve to null too (via <SpaceIntro>).

const HUB_ROUTE_RE = /^\/hub\/([a-z0-9-]+)(?:\/([a-z0-9-]+))?/;

export const AutoSpaceIntro: React.FC = () => {
  const location = useLocation();

  const match = HUB_ROUTE_RE.exec(location.pathname);
  const slug = match?.[1];
  const segment = match?.[2];

  const korner = useKorner(slug);

  if (!slug || !korner) return null;

  // A path segment that isn't one of the korner's declared views is a
  // detail sub-page (an id, `settings`, `new`, …) — no header intro there.
  if (segment && !korner.views?.some((view) => view.key === segment)) {
    return null;
  }

  return <SpaceIntro slug={slug} />;
};
