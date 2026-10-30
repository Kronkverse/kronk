// Knowing when Kronk is running inside the Android app.
//
// The app is a Trusted Web Activity (Kronkverse/kronk-app): it opens the site
// full-screen in the phone's browser engine, at `/?source=app&app=<build>`,
// where build is the app's versionCode. Read that once at boot, before the
// router moves off `/`, and remember it:
//   - sessionStorage says "this tab is the app" (the TWA keeps one tab, so it
//     survives the reloads build_watcher does after a deploy);
//   - localStorage keeps the last build seen, for the update check.
// Then take the parameters back out of the address.

const SOURCE_PARAM = 'source';
const BUILD_PARAM = 'app';
const IN_APP_KEY = 'kronk_android_app';
const BUILD_KEY = 'kronk_android_app_build';
const APP_REFERRER = 'android-app://info.kronk.app';

const read = (storage: Storage, key: string): string | null => {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
};

const write = (storage: Storage, key: string, value: string): void => {
  try {
    storage.setItem(key, value);
  } catch {
    // Storage blocked: the app still works, it just isn't recognised.
  }
};

export const noteAndroidApp = (): void => {
  const url = new URL(window.location.href);
  const fromApp = url.searchParams.get(SOURCE_PARAM) === 'app';

  if (fromApp || document.referrer.startsWith(APP_REFERRER)) {
    write(sessionStorage, IN_APP_KEY, '1');
  }

  if (!fromApp) return;

  const build = url.searchParams.get(BUILD_PARAM);
  if (build && /^\d+$/.test(build)) write(localStorage, BUILD_KEY, build);

  url.searchParams.delete(SOURCE_PARAM);
  url.searchParams.delete(BUILD_PARAM);
  window.history.replaceState(window.history.state, '', url.toString());
};

export const inAndroidApp = (): boolean =>
  read(sessionStorage, IN_APP_KEY) === '1';

export const androidAppBuild = (): number | null => {
  const build = read(localStorage, BUILD_KEY);
  return build ? parseInt(build, 10) : null;
};
