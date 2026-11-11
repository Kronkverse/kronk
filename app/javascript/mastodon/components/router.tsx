import type { PropsWithChildren } from 'react';
import type React from 'react';

import type { useLocation } from 'react-router';
import { Router as OriginalRouter, useHistory } from 'react-router';

import type {
  LocationDescriptor,
  LocationDescriptorObject,
  Path,
} from 'history';
import { createBrowserHistory, parsePath } from 'history';

import { layoutFromWindow } from 'mastodon/is_mobile';
import { isDevelopment } from 'mastodon/utils/environment';

import { comeBackHere } from './space_back';

interface MastodonLocationState {
  fromMastodon?: boolean;
  mastodonModalKey?: string;
  // Where the Frame's back badge should return to, when that is not simply
  // the korner's landing page (components/auto_space_badge.tsx).
  backTo?: string;
  // Set with a `backTo` in another korner: the name the badge shows for it.
  backLabel?: string;
}

export type LocationState = MastodonLocationState | null | undefined;

export type MastodonLocation = ReturnType<typeof useLocation<LocationState>>;

type HistoryPath = Path | LocationDescriptor<LocationState>;

export const browserHistory = createBrowserHistory<LocationState>();
const originalPush = browserHistory.push.bind(browserHistory);
const originalReplace = browserHistory.replace.bind(browserHistory);

export function useAppHistory() {
  return useHistory<LocationState>();
}

function normalizePath(
  path: HistoryPath,
  state?: LocationState,
): LocationDescriptorObject<LocationState> {
  // A string path keeps its ?query and #hash apart from the pathname, as
  // history's own push does: `{ pathname: '/hub/map?country=X' }` matches no
  // route (a profile's Country link opened a broken page, 2026-10-30).
  const location: LocationDescriptorObject<LocationState> =
    typeof path === 'string'
      ? { ...parsePath(path), state: undefined }
      : { ...path };

  if (location.state === undefined && state !== undefined) {
    location.state = state;
  } else if (
    location.state !== undefined &&
    state !== undefined &&
    isDevelopment()
  ) {
    // eslint-disable-next-line no-console
    console.log(
      'You should avoid providing a 2nd state argument to push when the 1st argument is a location-like object that already has state; it is ignored',
    );
  }

  if (
    layoutFromWindow() === 'multi-column' &&
    location.pathname &&
    !location.pathname.startsWith('/deck')
  ) {
    location.pathname = `/deck${location.pathname}`;
  }

  return location;
}

const KORNER_RE = /^(?:\/deck)?\/hub\/([a-z0-9-]+)/;

browserHistory.push = (path: HistoryPath, state?: MastodonLocationState) => {
  const location = normalizePath(path, state);

  location.state = location.state ?? {};
  location.state.fromMastodon = true;

  // Leaving a page that asked to be come back to (useComeBackHere) for a
  // page of another korner: say so, so that page's badge returns here.
  const here = comeBackHere();
  const to = KORNER_RE.exec(location.pathname ?? '')?.[1];
  if (
    here &&
    to &&
    !location.state.backTo &&
    to !== KORNER_RE.exec(here.href)?.[1]
  ) {
    location.state.backTo = here.href;
    location.state.backLabel = here.label;
  }

  originalPush(location);
};

browserHistory.replace = (path: HistoryPath, state?: MastodonLocationState) => {
  const location = normalizePath(path, state);

  if (!location.pathname) return;

  if (browserHistory.location.state?.fromMastodon) {
    location.state = location.state ?? {};
    location.state.fromMastodon = true;
  }

  originalReplace(location);
};

// history v4 gives the initial (fresh page load) location no `key`. Our scroll
// restoration (containers/scroll_container) files saved scroll positions in
// sessionStorage under that key and treats the initial load as a POP — so every
// reload of e.g. /home collides on the same blank key and restores the previous
// session's scroll position, dropping you mid-feed instead of at the top. Stamp
// a unique key on the initial entry so a reload starts at the top, while genuine
// back-navigation (its own keyed POP) still restores your place.
if (!browserHistory.location.key) {
  originalReplace({
    pathname: browserHistory.location.pathname,
    search: browserHistory.location.search,
    hash: browserHistory.location.hash,
    state: browserHistory.location.state,
  });
}

export const Router: React.FC<PropsWithChildren> = ({ children }) => {
  return <OriginalRouter history={browserHistory}>{children}</OriginalRouter>;
};
