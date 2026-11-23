// A big upload handed to the browser to finish (Background Fetch), so it
// keeps going when the member switches apps and Chrome shows its progress
// in the phone's notifications (Tal, 2026-11-23: "Can an upload just keep
// uploading if you switch apps? maybe showing a notification with a
// progress bar"). Chrome on Android, which the Kronk app runs in, has it;
// where it doesn't exist (iPhone, Firefox) uploads go as before, sent again
// once the page is back if the connection dropped (api.ts).
//
// The service worker (service_worker/background_upload.js) reads the
// server's answer when the browser has it and leaves it in a cache for the
// page; that works whether the page was open, frozen or in the background.

import axios, { AxiosError, AxiosHeaders, CanceledError } from 'axios';
import type {
  AxiosAdapter,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';

import {
  BG_UPLOAD_CACHE,
  BG_UPLOAD_ID_PREFIX,
  BG_UPLOAD_MESSAGE,
  bgUploadStashUrl,
} from './background_upload_shared';
import type { BgUploadOutcome } from './background_upload_shared';

// Under this a phone sends the file in moments; over it (a video, mostly)
// leaving the app mid-way is likely.
export const BG_UPLOAD_MIN_BYTES = 10 * 1024 * 1024;

// Chrome draws the notification's bar from bytes only when the fetch says
// how much it will download (components/background_fetch/job_details.cc,
// ShouldReportProgressBySize); without it the bar sits at 0 until done.
// The answer is a MediaAttachment's JSON, a few kilobytes. Too low a figure
// fails the fetch, so this is generous.
const ANSWER_ALLOWANCE = 256 * 1024;

const POLL_MS = 2000;

// The parts of Background Fetch Kronk uses; TypeScript's DOM types don't
// carry it.
interface BgFetchRegistration extends EventTarget {
  id: string;
  uploadTotal: number;
  uploaded: number;
  result: '' | 'success' | 'failure';
  failureReason: string;
  abort: () => Promise<boolean>;
}
interface BgFetchManager {
  fetch: (
    id: string,
    requests: Request[],
    options: {
      title: string;
      icons: { src: string; sizes: string; type: string }[];
      downloadTotal: number;
    },
  ) => Promise<BgFetchRegistration>;
}
type WithBgFetch = ServiceWorkerRegistration & {
  backgroundFetch?: BgFetchManager;
};

export const uploadFile = (data: unknown) => {
  if (!(data instanceof FormData)) return null;
  const file = data.get('file');
  return file instanceof Blob ? file : null;
};

const hasBackgroundFetch = () =>
  typeof window !== 'undefined' &&
  'BackgroundFetchManager' in window &&
  'serviceWorker' in navigator;

// Whether an upload goes through the browser (true) or as a page request.
// A send-again after a dropped connection (api.ts) is a page request.
export const goesInBackground = (
  config: { data?: unknown },
  isRetry: boolean,
) => {
  if (isRetry || !hasBackgroundFetch()) return false;
  const file = uploadFile(config.data);
  return !!file && file.size >= BG_UPLOAD_MIN_BYTES;
};

// The server's answer, once the service worker has left it. Taken once.
export const takeOutcome = async (
  id: string,
): Promise<BgUploadOutcome | null> => {
  const cache = await caches.open(BG_UPLOAD_CACHE);
  const url = bgUploadStashUrl(id);
  const stored = await cache.match(url);
  if (!stored) return null;
  const outcome = (await stored.json()) as BgUploadOutcome;
  await cache.delete(url);
  return outcome;
};

// Resolves with the outcome when the worker has it. Asked when the worker
// says so, when the page comes back into view, when the fetch reports it
// has finished, and every couple of seconds as a backstop (a message sent
// while the page was frozen may not arrive).
export const waitForOutcome = (
  id: string,
  registration: EventTarget | null,
  signal?: AbortSignal,
) =>
  new Promise<BgUploadOutcome>((resolve, reject) => {
    let done = false;
    const finish = () => {
      done = true;
      window.clearInterval(timer);
      navigator.serviceWorker.removeEventListener('message', onMessage);
      document.removeEventListener('visibilitychange', check);
      registration?.removeEventListener('progress', check);
      signal?.removeEventListener('abort', onAbort);
    };
    const check = () => {
      if (done) return;
      takeOutcome(id)
        .then((outcome) => {
          if (!outcome || done) return;
          finish();
          resolve(outcome);
        })
        // Not there yet, or the cache couldn't be read: the next check
        // tries again.
        .catch(() => undefined);
    };
    const onMessage = (event: MessageEvent) => {
      const message = event.data as { type?: string; id?: string } | null;
      if (message?.type === BG_UPLOAD_MESSAGE && message.id === id) check();
    };
    const onAbort = () => {
      finish();
      reject(new CanceledError());
    };
    const timer = window.setInterval(check, POLL_MS);
    navigator.serviceWorker.addEventListener('message', onMessage);
    document.addEventListener('visibilitychange', check);
    registration?.addEventListener('progress', check);
    signal?.addEventListener('abort', onAbort);
    check();
  });

const headersFor = (config: InternalAxiosRequestConfig) => {
  const headers = new Headers();
  const from = AxiosHeaders.from(config.headers);
  for (const name of ['Authorization', 'X-CSRF-Token']) {
    const value = from.get(name);
    if (typeof value === 'string') headers.set(name, value);
  }
  return headers;
};

// What the page would have got from axios, from what the worker read.
export const toResponse = (
  outcome: BgUploadOutcome,
  config: InternalAxiosRequestConfig,
): AxiosResponse => {
  if (outcome.status === undefined) {
    throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config, null);
  }
  const response: AxiosResponse = {
    data: outcome.data,
    status: outcome.status,
    statusText: '',
    headers: {},
    config,
  };
  if (outcome.status >= 200 && outcome.status < 300) return response;
  throw new AxiosError(
    `Request failed with status code ${outcome.status}`,
    outcome.status >= 500
      ? AxiosError.ERR_BAD_RESPONSE
      : AxiosError.ERR_BAD_REQUEST,
    config,
    null,
    response,
  );
};

const pageAdapter = (config: InternalAxiosRequestConfig) =>
  axios.getAdapter(axios.defaults.adapter)(config);

// An axios adapter, so every caller of api() keeps what it had: the same
// response (200, or 202 while a video is processed), the same errors, and
// onUploadProgress fed from the browser's count of bytes sent. When the
// browser won't take it (no worker yet, downloads blocked), it goes as an
// ordinary page request.
export const backgroundUploadAdapter: AxiosAdapter = async (config) => {
  const worker = (await navigator.serviceWorker.getRegistration('/')) as
    | WithBgFetch
    | undefined;
  const manager = worker?.active ? worker.backgroundFetch : undefined;
  if (!manager || !(config.data instanceof FormData)) {
    return pageAdapter(config);
  }

  const id = `${BG_UPLOAD_ID_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const url = new URL(config.url ?? '/api/v2/media', window.location.origin);
  const request = new Request(url.href, {
    method: 'POST',
    body: config.data,
    headers: headersFor(config),
    credentials: 'same-origin',
  });

  let registration: BgFetchRegistration;
  try {
    registration = await manager.fetch(id, [request], {
      title: 'Uploading to Kronk',
      icons: [
        {
          src: '/android-chrome-192x192.png',
          sizes: '192x192',
          type: 'image/png',
        },
      ],
      downloadTotal: ANSWER_ALLOWANCE,
    });
  } catch {
    return pageAdapter(config);
  }

  const { onUploadProgress, signal } = config;
  const report = () => {
    if (!onUploadProgress || !registration.uploadTotal) return;
    onUploadProgress({
      loaded: registration.uploaded,
      total: registration.uploadTotal,
      progress: registration.uploaded / registration.uploadTotal,
      bytes: registration.uploaded,
      lengthComputable: true,
      upload: true,
    });
  };
  registration.addEventListener('progress', report);

  const abortSignal = signal as AbortSignal | undefined;
  const stop = () => void registration.abort();
  abortSignal?.addEventListener('abort', stop);

  try {
    const outcome = await waitForOutcome(id, registration, abortSignal);
    if (outcome.failure === 'aborted') throw new CanceledError();
    return toResponse(outcome, config);
  } finally {
    registration.removeEventListener('progress', report);
    abortSignal?.removeEventListener('abort', stop);
  }
};
