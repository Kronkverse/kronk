// Load a new deploy into tabs that are already open.
//
// A tab (or the phone app) keeps running the JavaScript it loaded, and old
// hashed chunks stay on the server after a deploy, so without this an open
// session can run a stale app for days: 2.0.5's proposal page checked
// `actioned` while open tabs still ran 2.0.4's, which looked for
// `delivered`, so the Close button never appeared.
//
// The page carries the build it was rendered with
// (<meta name="kronk-build">, Kronk::Build). We ask
// /api/v1/kronk_build when the tab comes back into view, on focus and every
// few minutes while visible; a chunk that fails to load (it was removed or
// renamed by a deploy) counts as a new build too. On a new build we reload
// at a safe moment: straight away when nothing is in progress, on the next
// in-app navigation, or once the person stops typing, uploading or
// recording. Never twice for the same build.

import { browserHistory } from 'mastodon/components/router';

export interface PageState {
  /** The build the server reports now (null if unknown). */
  serverBuild: string | null;
  /** The build this tab was loaded with. */
  loadedBuild: string | null;
  /** The build we already reloaded for in this tab, if any. */
  reloadedFor: string | null;
  /** Something must not be lost: typing, unsaved text, upload, recording. */
  busy: boolean;
}

export type Decision = 'nothing' | 'reload' | 'defer';

export const decide = ({
  serverBuild,
  loadedBuild,
  reloadedFor,
  busy,
}: PageState): Decision => {
  if (!serverBuild || !loadedBuild || serverBuild === loadedBuild)
    return 'nothing';
  // Loop guard: we already reloaded for this build and still run an old
  // one (e.g. a CDN served stale HTML). Don't keep reloading.
  if (reloadedFor === serverBuild) return 'nothing';
  return busy ? 'defer' : 'reload';
};

// ── Things that must not be interrupted ──────────────────────────────────

let holds = 0;

/** Hold off reloads while something is in progress (e.g. recording). */
export const holdReload = (): (() => void) => {
  holds += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds -= 1;
  };
};

const hasUnsavedText = (): boolean => {
  const active = document.activeElement;
  if (
    active instanceof HTMLTextAreaElement ||
    active instanceof HTMLInputElement ||
    (active instanceof HTMLElement && active.isContentEditable)
  ) {
    return true;
  }
  for (const el of Array.from(document.querySelectorAll('textarea'))) {
    if (el.value.trim() !== '') return true;
  }
  for (const el of Array.from(
    document.querySelectorAll<HTMLElement>('[contenteditable="true"]'),
  )) {
    if ((el.textContent ?? '').trim() !== '') return true;
  }
  return false;
};

// ── Wiring ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'kronk:reloaded-for-build';
const POLL_MS = 5 * 60 * 1000;
const RETRY_MS = 15 * 1000;

const readReloadedFor = (): string | null => {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

const writeReloadedFor = (build: string) => {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, build);
  } catch {
    // Private mode or storage blocked: the loop guard is best-effort.
  }
};

interface ComposeLike {
  getIn?: (path: string[]) => unknown;
  get?: (key: string) => unknown;
}

export const startBuildWatcher = (getState: () => unknown): void => {
  const loadedBuild =
    document
      .querySelector('meta[name="kronk-build"]')
      ?.getAttribute('content') ?? null;
  if (!loadedBuild) return;

  let serverBuild: string | null = null;
  let retry: ReturnType<typeof setTimeout> | null = null;

  const composeBusy = (): boolean => {
    const state = getState() as { get?: (k: string) => unknown } | undefined;
    const compose = state?.get?.('compose') as ComposeLike | undefined;
    if (!compose?.get) return false;
    return Boolean(
      compose.get('is_uploading') ||
        compose.get('is_submitting') ||
        String(compose.get('text') ?? '').trim() !== '',
    );
  };

  const busy = () => holds > 0 || hasUnsavedText() || composeBusy();

  const apply = (navigateTo?: string) => {
    const decision = decide({
      serverBuild,
      loadedBuild,
      reloadedFor: readReloadedFor(),
      busy: busy(),
    });
    if (decision === 'reload' && serverBuild) {
      writeReloadedFor(serverBuild);
      if (navigateTo) window.location.assign(navigateTo);
      else window.location.reload();
    } else if (decision === 'defer' && !retry) {
      retry = setTimeout(() => {
        retry = null;
        apply();
      }, RETRY_MS);
    }
  };

  const check = async () => {
    if (document.visibilityState !== 'visible') return;
    try {
      const response = await fetch('/api/v1/kronk_build', {
        cache: 'no-store',
        credentials: 'omit',
      });
      if (!response.ok) return;
      const body = (await response.json()) as { build?: string };
      if (body.build) serverBuild = body.build;
    } catch {
      return; // offline or server restarting; try again later
    }
    apply();
  };

  document.addEventListener('visibilitychange', () => void check());
  window.addEventListener('focus', () => void check());
  setInterval(() => void check(), POLL_MS);

  // A chunk that won't load means the deploy removed what this tab expects.
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    void check();
  });

  // In-app navigation is a natural moment: load the new build at the
  // destination instead of rendering it with the old one.
  browserHistory.listen((location) => {
    if (!serverBuild || serverBuild === loadedBuild) return;
    apply(`${location.pathname}${location.search}${location.hash}`);
  });

  void check();
};
