import { useCallback } from 'react';

import { useHistory, useLocation } from 'react-router-dom';

import { useKorner } from 'mastodon/hooks/useKorner';

import { SpaceViewMenu } from './space_view_menu';
import { SpaceViewPicker } from './space_view_picker';

// AutoSpaceViewPicker — renders one of two shapes automatically for
// korners that declare a `views` list in their manifest. Current view
// is derived from the URL; selecting a view navigates via
// history.push. This is the Frame-provided per-space nav — every korner
// picks it up from its manifest without wiring up its own switcher.
//
// Shape:
//   * `header.picker: 'menu'`   → `<SpaceViewMenu>` (dropdown).
//   * `header.picker: 'pills'`  → `<SpaceViewPicker>` (segmented row).
//   * unset / anything else     → `<SpaceViewPicker>` (default).
//
// When the manifest opts into `header.rotator: true`, the title
// itself carries the switch (via `<AutoSpaceHeader>` → `<ScopeTitle>`)
// and this component renders nothing — a single switcher per surface.
//
// Views come from the manifest (config/korners/<slug>.yaml → `views:`),
// the same source as the space title and intro, so title + description
// + navigation stay in sync. Ordered: the first entry is the default
// (bare `/hub/<slug>`); the rest map to `/hub/<slug>/<key>`.
//
// Spec: docs/kronk_frame.md § SpaceNav.

const HUB_ROUTE_RE = /^\/hub\/([a-z0-9-]+)(?:\/([a-z0-9-]+))?/;
// The `/settings` sub-page belongs to the settings surface, not the
// korner surface — SettingsBadge takes over the SpaceNav slot there,
// and the view picker's tab labels wouldn't apply anyway.
const SETTINGS_SUBROUTE_RE = /^\/hub\/[a-z0-9-]+\/settings(?:\/|$)/;

export const AutoSpaceViewPicker: React.FC = () => {
  const location = useLocation();
  const history = useHistory();

  const match = HUB_ROUTE_RE.exec(location.pathname);
  const slug = match?.[1];
  const subPath = match?.[2];
  const onSettings = SETTINGS_SUBROUTE_RE.test(location.pathname);

  const korner = useKorner(slug);
  const views = korner?.views;

  const handleChange = useCallback(
    (key: string) => {
      if (!slug || !views?.length) return;
      const defaultKey = views[0]?.key;
      if (key === defaultKey) {
        history.push(`/hub/${slug}`);
      } else {
        history.push(`/hub/${slug}/${key}`);
      }
    },
    [history, slug, views],
  );

  if (onSettings || !slug || !korner || korner.core || !views?.length)
    return null;

  // Rotator korners get their view switch through `<AutoSpaceHeader>`
  // (title-as-switcher). Rendering a second picker on the right
  // would be a duplicate — return null here and let the header
  // handle it.
  if (korner.header?.rotator) return null;

  const current = subPath ?? views[0]?.key;
  if (!current) return null;

  if (korner.header?.picker === 'menu') {
    return (
      <SpaceViewMenu views={views} current={current} onChange={handleChange} />
    );
  }

  return (
    <SpaceViewPicker views={views} current={current} onChange={handleChange} />
  );
};
