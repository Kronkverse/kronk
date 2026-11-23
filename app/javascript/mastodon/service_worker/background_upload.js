// The worker's half of a background upload (utils/background_upload): when
// the browser has finished sending a big file, read the server's answer
// and leave it where the page will find it, then tell any open page.

import {
  BG_UPLOAD_CACHE,
  BG_UPLOAD_ID_PREFIX,
  BG_UPLOAD_MESSAGE,
  bgUploadStashUrl,
} from '../utils/background_upload_shared';

const isOurs = registration => registration.id.startsWith(BG_UPLOAD_ID_PREFIX);

const readAnswer = async registration => {
  const [record] = await registration.matchAll();
  if (!record) return null;
  const response = await record.responseReady.catch(() => null);
  if (!response) return null;
  const text = await response.text();
  let data = text;
  try {
    data = JSON.parse(text);
  } catch {
    // Not JSON (an error page); the page shows the status instead.
  }
  return { status: response.status, data };
};

const leave = async (registration, outcome) => {
  const cache = await caches.open(BG_UPLOAD_CACHE);
  await cache.put(
    bgUploadStashUrl(registration.id),
    new Response(JSON.stringify(outcome), {
      headers: { 'Content-Type': 'application/json' },
    }),
  );
  const pages = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  pages.forEach(page => page.postMessage({ type: BG_UPLOAD_MESSAGE, id: registration.id }));
};

export const handleBackgroundFetchSuccess = event => {
  if (!isOurs(event.registration)) return;
  event.waitUntil((async () => {
    const answer = await readAnswer(event.registration);
    await leave(event.registration, answer ?? { failure: 'no-answer' });
    await event.updateUI({ title: 'Uploaded to Kronk' });
  })());
};

// A refused upload (too big, say) still has the server's answer; a dropped
// one has none, and the page sends it again itself.
export const handleBackgroundFetchFail = event => {
  if (!isOurs(event.registration)) return;
  event.waitUntil((async () => {
    const answer = await readAnswer(event.registration).catch(() => null);
    await leave(event.registration, answer ?? { failure: event.registration.failureReason || 'fetch-error' });
    await event.updateUI({ title: 'Upload didn’t finish' });
  })());
};

export const handleBackgroundFetchAbort = event => {
  if (!isOurs(event.registration)) return;
  event.waitUntil(leave(event.registration, { failure: 'aborted' }));
};

// Tapping the notification brings Kronk back to the front.
export const handleBackgroundFetchClick = event => {
  if (!isOurs(event.registration)) return;
  event.waitUntil((async () => {
    const pages = await self.clients.matchAll({ type: 'window' });
    if (pages.length) return pages[0].focus();
    return self.clients.openWindow('/');
  })());
};
