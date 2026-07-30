import { useLocation } from 'react-router-dom';

import { useKorner } from 'mastodon/hooks/useKorner';

import { SpaceHeader } from './space_header';

// AutoSpaceHeader — the Frame-provided in-content header. Renders the
// manifest-driven title + tagline for the current korner automatically
// atop the Stage's scrollable region. Sibling to AutoSpaceBadge
// (SpaceNav pill) and AutoSpaceViewPicker (tab row); together they
// keep every korner's landing chrome derived from the same manifest.
//
// Route scoping:
//
//   * `/hub/<slug>`            → shown (korner landing / default view)
//   * `/hub/<slug>/<view-key>` → shown when <view-key> is a declared
//                                manifest view
//   * anything deeper / an unrecognised segment (`/hub/krew/:id`,
//     `/hub/kommons/p/:id`, `/hub/<slug>/settings`, …) → null
//
// Non-korner routes and korners without a resolved manifest render
// null too (via <SpaceHeader>).

const HUB_ROUTE_RE = /^\/hub\/([a-z0-9-]+)(?:\/([a-z0-9-]+))?/;

export const AutoSpaceHeader: React.FC = () => {
  const location = useLocation();

  const match = HUB_ROUTE_RE.exec(location.pathname);
  const slug = match?.[1];
  const segment = match?.[2];

  const korner = useKorner(slug);

  // Core spaces (e.g. settings at /hub/settings) render their own header, not
  // a korner landing header.
  if (!slug || !korner || korner.core) return null;

  // A path segment that isn't one of the korner's declared views is a
  // detail sub-page (an id, `settings`, `new`, …) — no landing header
  // on those.
  if (segment && !korner.views?.some((view) => view.key === segment)) {
    return null;
  }

  return <SpaceHeader slug={slug} />;
};
