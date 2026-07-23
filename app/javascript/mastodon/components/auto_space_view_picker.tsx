import { useCallback } from 'react';

import { useHistory, useLocation } from 'react-router-dom';

import type { SpaceView } from './space_view_picker';
import { SpaceViewPicker } from './space_view_picker';

// AutoSpaceViewPicker — renders <SpaceViewPicker> automatically for
// korners that declare views in SLUG_TO_VIEWS. Current view is derived
// from the URL; selecting a view navigates via history.push. This is
// the Frame-provided per-space nav — every korner in the map picks it
// up without wiring up its own switcher.
//
// Spec: docs/kronk_frame.md § SpaceNav.

const HUB_ROUTE_RE = /^\/hub\/([a-z0-9-]+)(?:\/([a-z0-9-]+))?/;

// Per-korner view lists. Views are ordered — the first one is the
// default (rendered when the URL is bare `/hub/<slug>`). Selecting a
// view navigates to `/hub/<slug>/<key>`; selecting the default clears
// the sub-path back to `/hub/<slug>`.
//
// Add korners here as they gain a view switcher. Absent slugs render
// no picker at all.
const SLUG_TO_VIEWS: Record<string, SpaceView[]> = {
  kuestions: [
    { key: 'deck', label: 'Deck' },
    { key: 'today', label: 'Today' },
    { key: 'answered', label: 'Answered' },
    { key: 'ask', label: 'Ask' },
  ],
  kommons: [
    { key: 'proposals', label: 'Proposals' },
    { key: 'lattice', label: 'Directory' },
  ],
  kalendar: [
    // `list` = classic /hub/kalendar (Events component).
    // `spiral` = the interactive Spiral prototype at
    // /hub/kalendar/spiral (Kommons proposal #116969253949249128).
    { key: 'list', label: 'List' },
    { key: 'spiral', label: 'Spiral' },
  ],
};

export const AutoSpaceViewPicker: React.FC = () => {
  const location = useLocation();
  const history = useHistory();

  const match = HUB_ROUTE_RE.exec(location.pathname);
  const slug = match?.[1];
  const subPath = match?.[2];

  const views = slug ? SLUG_TO_VIEWS[slug] : undefined;

  const handleChange = useCallback(
    (key: string) => {
      if (!slug || !views) return;
      const defaultKey = views[0]?.key;
      if (key === defaultKey) {
        history.push(`/hub/${slug}`);
      } else {
        history.push(`/hub/${slug}/${key}`);
      }
    },
    [history, slug, views],
  );

  if (!slug || !views) return null;

  const current = subPath ?? views[0]?.key;
  if (!current) return null;

  return (
    <SpaceViewPicker views={views} current={current} onChange={handleChange} />
  );
};
