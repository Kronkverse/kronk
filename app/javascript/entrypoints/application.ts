import { loadLocale } from 'mastodon/locales';
import main from 'mastodon/main';
import { loadPolyfills } from 'mastodon/polyfills';

// Guard against the browser's back/forward cache (bfcache) restoring an
// authenticated page after logout. Safari/WebKit restore pages from bfcache
// even when they were served with `Cache-Control: no-store`, so a user who
// logs out and presses Back would see the previous account's UI rehydrated
// from an in-memory snapshot. Forcing a reload on a bfcache restore makes the
// browser re-fetch from the server, which — with no session — lands on login.
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    window.location.reload();
  }
});

loadPolyfills()
  .then(loadLocale)
  .then(main)
  .catch((e: unknown) => {
    console.error(e);
  });
