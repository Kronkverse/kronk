import { useCallback } from 'react';

import { useHistory, useLocation } from 'react-router-dom';

import { useKorner } from 'mastodon/hooks/useKorner';

import { SpaceViewPicker } from './space_view_picker';

// AutoSpaceViewPicker — renders <SpaceViewPicker> automatically for
// korners that declare a `views` list in their manifest. Current view
// is derived from the URL; selecting a view navigates via
// history.push. This is the Frame-provided per-space nav — every korner
// picks it up from its manifest without wiring up its own switcher.
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

  if (onSettings || !slug || !views?.length) return null;

  const current = subPath ?? views[0]?.key;
  if (!current) return null;

  return (
    <SpaceViewPicker views={views} current={current} onChange={handleChange} />
  );
};
