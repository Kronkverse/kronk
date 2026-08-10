import { useCallback, useMemo } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { useHistory, useLocation } from 'react-router-dom';

import { ScopeTitle } from 'mastodon/components/scope_title';
import type { ScopeTitleFace } from 'mastodon/components/scope_title';
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
// Header shape:
//
//   * Default             → `<SpaceHeader>` — static `name + tagline`
//   * `header.rotator`    → `<ScopeTitle>`  — cycles through `views:`;
//                           each face carries its view's `label` +
//                           optional `tagline`. The rotator IS the
//                           title, preserving the Standard's
//                           one-title-per-space rule.
//
// Non-korner routes and korners without a resolved manifest render
// null too (via <SpaceHeader>).

const HUB_ROUTE_RE = /^\/hub\/([a-z0-9-]+)(?:\/([a-z0-9-]+))?/;

const messages = defineMessages({
  aria: {
    id: 'auto_space_header.rotator_aria',
    defaultMessage: 'Change which view of {korner} you see',
  },
});

export const AutoSpaceHeader: React.FC = () => {
  const intl = useIntl();
  const location = useLocation();
  const history = useHistory();

  const match = HUB_ROUTE_RE.exec(location.pathname);
  const slug = match?.[1];
  const segment = match?.[2];

  const korner = useKorner(slug);

  // Memoised so the derived array has a stable identity between
  // renders (the `useCallback` for the rotator handler depends on
  // `views`; a fresh literal each render would defeat that).
  const views = useMemo(() => korner?.views ?? [], [korner?.views]);
  const rotator = korner?.header?.rotator === true && views.length > 1;

  // Rotator-driven navigation: convert a face key into the URL segment
  // the framework already uses (`/hub/<slug>` for the default view,
  // `/hub/<slug>/<key>` for the rest). Kept in a `useCallback` so
  // <ScopeTitle> doesn't re-mount its handlers on every location tick.
  const handleRotate = useCallback(
    (nextKey: string) => {
      if (!slug || views.length === 0) return;
      const defaultKey = views[0]?.key;
      const path =
        nextKey === defaultKey ? `/hub/${slug}` : `/hub/${slug}/${nextKey}`;
      if (path !== location.pathname) history.push(path);
    },
    [history, location.pathname, slug, views],
  );

  // Core spaces (e.g. settings at /hub/settings) render their own header, not
  // a korner landing header.
  if (!slug || !korner || korner.core) return null;

  // A path segment that isn't one of the korner's declared views is a
  // detail sub-page (an id, `settings`, `new`, …) — no landing header
  // on those.
  if (segment && !views.some((view) => view.key === segment)) {
    return null;
  }

  if (rotator) {
    const faces: ScopeTitleFace[] = views.map((view) => ({
      key: view.key,
      label: view.label,
      // Per-view tagline is preferred; fall back to the korner-level
      // tagline so a face without its own copy still reads.
      desc: view.tagline ?? korner.tagline ?? undefined,
    }));
    const currentKey = segment ?? views[0]?.key ?? '';
    const ariaLabel = intl.formatMessage(messages.aria, {
      korner: korner.name,
    });

    return (
      <ScopeTitle
        faces={faces}
        value={currentKey}
        onChange={handleRotate}
        ariaLabel={ariaLabel}
        frameHeader
      />
    );
  }

  return <SpaceHeader slug={slug} />;
};
