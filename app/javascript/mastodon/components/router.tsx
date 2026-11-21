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

const kornerOf = (pathname: string | undefined) =>
  KORNER_RE.exec(pathname ?? '')?.[1];

// A composer opened from a record (`?konnect=`, the Konnect picker's
// New …, or the older `?krew=`, a Krew's own New album) that was itself opened from a page to come back to: the record
// it makes comes back there too. An album made from a Krew backed up to
// Albutts (Tal's proposal "Konnected sources", 2026-11-18); now it backs
// up to the Krew, as the composer did. Only for the composer's own korner,
// which is where a composer goes when it has made something.
const konnectedFrom = (
  location: LocationDescriptorObject<LocationState>,
): Pick<MastodonLocationState, 'backTo' | 'backLabel'> | null => {
  const { search, state, pathname } = browserHistory.location;
  if (!state?.backTo || !state.backLabel) return null;
  const params = new URLSearchParams(search);
  if (!params.has('konnect') && !params.has('krew')) return null;
  const from = kornerOf(pathname);
  if (!from || from !== kornerOf(location.pathname)) return null;
  if (from === kornerOf(state.backTo)) return null;
  return { backTo: state.backTo, backLabel: state.backLabel };
};

browserHistory.push = (path: HistoryPath, state?: MastodonLocationState) => {
  const location = normalizePath(path, state);
  const carried = konnectedFrom(location);

  location.state = location.state ?? {};
  location.state.fromMastodon = true;

  // Leaving a page that asked to be come back to (useComeBackHere) for a
  // page of another korner: say so, so that page's badge returns here.
  const here = comeBackHere();
  const to = kornerOf(location.pathname);
  if (here && to && !location.state.backTo && to !== kornerOf(here.href)) {
    location.state.backTo = here.href;
    location.state.backLabel = here.label;
  }

  if (carried && !location.state.backTo) {
    location.state.backTo = carried.backTo;
    location.state.backLabel = carried.backLabel;
  }

  originalPush(location);
};

browserHistory.replace = (path: HistoryPath, state?: MastodonLocationState) => {
  const location = normalizePath(path, state);

  if (!location.pathname) return;

  const carried = konnectedFrom(location);

  if (browserHistory.location.state?.fromMastodon) {
    location.state = location.state ?? {};
    location.state.fromMastodon = true;
  }

  if (carried && !location.state?.backTo) {
    location.state = { ...location.state, ...carried };
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
