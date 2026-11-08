// Keeping the screen on while something long runs in the page.
//
// A phone that locks its screen freezes the page, and a media upload in
// flight dies with it: the browser drops the connection and the server logs
// a 499. Android's default screen timeout is 30 seconds, less than a phone
// video takes to send, so uploads failed at about that point (Kommons "Video
// upload fault", 2026-11-05). Holding a screen wake lock for the length of
// the upload keeps the page awake.
//
// Holds are counted, so overlapping uploads share one lock and it goes when
// the last one finishes. Browsers drop the lock when the page is hidden; it
// is asked for again when the page comes back while a hold is still open.
// Where the Wake Lock API is missing or refused, nothing happens.

interface Sentinel {
  release: () => Promise<void>;
}

interface WakeLockApi {
  request: (type: 'screen') => Promise<Sentinel>;
}

let holds = 0;
let sentinel: Sentinel | null = null;
let requesting = false;
let listening = false;

const wakeLock = (): WakeLockApi | undefined =>
  (navigator as Navigator & { wakeLock?: WakeLockApi }).wakeLock;

const acquire = () => {
  const api = wakeLock();
  if (!api || sentinel || requesting || document.visibilityState !== 'visible')
    return;

  requesting = true;
  api
    .request('screen')
    .then((lock) => {
      requesting = false;
      if (holds > 0) {
        sentinel = lock;
      } else {
        void lock.release();
      }
    })
    .catch(() => {
      // Refused (battery saver, no permission): the upload just runs as it
      // did before.
      requesting = false;
    });
};

const onVisibilityChange = () => {
  if (document.visibilityState === 'visible') {
    // The browser let go of the lock when the page was hidden.
    sentinel = null;
    if (holds > 0) acquire();
  }
};

// Keep the screen on until the returned function is called. Calling it more
// than once is harmless.
export const holdScreenAwake = (): (() => void) => {
  if (!wakeLock()) return () => undefined;

  if (!listening) {
    document.addEventListener('visibilitychange', onVisibilityChange);
    listening = true;
  }

  holds += 1;
  acquire();

  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds -= 1;
    if (holds === 0 && sentinel) {
      const lock = sentinel;
      sentinel = null;
      void lock.release();
    }
  };
};
