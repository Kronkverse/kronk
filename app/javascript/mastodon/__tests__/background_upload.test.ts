import axios, { AxiosError, CanceledError } from 'axios';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';

import api from '../api';
import {
  BG_UPLOAD_MIN_BYTES,
  goesInBackground,
} from '../utils/background_upload';
import {
  BG_UPLOAD_CACHE,
  bgUploadStashUrl,
} from '../utils/background_upload_shared';
import type { BgUploadOutcome } from '../utils/background_upload_shared';

const ok = (config: InternalAxiosRequestConfig) =>
  Promise.resolve({
    data: '{"id":"page"}',
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  });

const withAdapter = (adapter: AxiosAdapter) => {
  const before = axios.defaults.adapter;
  axios.defaults.adapter = adapter;
  return () => {
    axios.defaults.adapter = before;
  };
};

const formWith = (bytes: number) => {
  const form = new FormData();
  form.append(
    'file',
    new File([new Uint8Array(bytes)], 'photo.jpg', { type: 'image/jpeg' }),
  );
  return form;
};

// A Cache API good enough for the stash the worker leaves.
const installCaches = () => {
  const store = new Map<string, Response>();
  const cache = {
    match: (url: string) => Promise.resolve(store.get(url)?.clone()),
    put: (url: string, response: Response) => {
      store.set(url, response);
      return Promise.resolve();
    },
    delete: (url: string) => Promise.resolve(store.delete(url)),
  };
  vi.stubGlobal('caches', {
    open: (name: string) => {
      expect(name).toBe(BG_UPLOAD_CACHE);
      return Promise.resolve(cache);
    },
  });
  return cache;
};

// Background Fetch as Chrome has it: fetch() hands back a registration, and
// the worker (played here by `finish`) leaves the server's answer.
const installBackgroundFetch = (finish: (id: string) => BgUploadOutcome) => {
  const cache = installCaches();
  const fetches: { id: string; options: { downloadTotal: number } }[] = [];
  const backgroundFetch = {
    fetch: vi.fn(
      (
        id: string,
        _requests: Request[],
        options: { downloadTotal: number },
      ) => {
        fetches.push({ id, options });
        const registration = Object.assign(new EventTarget(), {
          id,
          uploadTotal: 0,
          uploaded: 0,
          result: '',
          failureReason: '',
          abort: () => Promise.resolve(true),
        });
        setTimeout(() => {
          void cache
            .put(bgUploadStashUrl(id), new Response(JSON.stringify(finish(id))))
            .then(() => registration.dispatchEvent(new Event('progress')));
        }, 0);
        return Promise.resolve(registration);
      },
    ),
  };
  vi.stubGlobal('BackgroundFetchManager', function BackgroundFetchManager() {
    return undefined;
  });
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: Object.assign(new EventTarget(), {
      getRegistration: () => Promise.resolve({ active: {}, backgroundFetch }),
    }),
  });
  return { fetches, backgroundFetch };
};

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'serviceWorker');
});

describe('which uploads go in the background', () => {
  test('a big one, where the browser has Background Fetch', () => {
    installBackgroundFetch(() => ({ status: 200 }));
    expect(
      goesInBackground({ data: formWith(BG_UPLOAD_MIN_BYTES) }, false),
    ).toBe(true);
  });

  test('not a small one', () => {
    installBackgroundFetch(() => ({ status: 200 }));
    expect(goesInBackground({ data: formWith(1024) }, false)).toBe(false);
  });

  test('not one being sent again after a drop', () => {
    installBackgroundFetch(() => ({ status: 200 }));
    expect(
      goesInBackground({ data: formWith(BG_UPLOAD_MIN_BYTES) }, true),
    ).toBe(false);
  });

  test('not where the browser has no Background Fetch (iPhone)', () => {
    expect(
      goesInBackground({ data: formWith(BG_UPLOAD_MIN_BYTES) }, false),
    ).toBe(false);
  });
});

describe('a background upload', () => {
  test('hands the page what axios would have, 202 and all', async () => {
    const page = vi.fn(ok);
    const restore = withAdapter(page);
    const { fetches } = installBackgroundFetch(() => ({
      status: 202,
      data: { id: '7', type: 'video' },
    }));
    try {
      const response = await api().post<{ id: string }>(
        '/api/v2/media',
        formWith(BG_UPLOAD_MIN_BYTES),
      );
      expect(response.status).toBe(202);
      expect(response.data).toEqual({ id: '7', type: 'video' });
      expect(page).not.toHaveBeenCalled();
      // Without a download total Chrome's notification shows no bar.
      expect(fetches[0]?.options.downloadTotal).toBeGreaterThan(0);
    } finally {
      restore();
    }
  });

  test('says too big when the server refuses it', async () => {
    const restore = withAdapter(ok);
    installBackgroundFetch(() => ({ status: 413, data: { error: 'big' } }));
    try {
      const error: unknown = await api()
        .post('/api/v2/media', formWith(BG_UPLOAD_MIN_BYTES))
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(AxiosError);
      expect((error as AxiosError).response?.status).toBe(413);
    } finally {
      restore();
    }
  });

  test('is sent again from the page when the browser could not finish it', async () => {
    const page = vi.fn(ok);
    const restore = withAdapter(page);
    installBackgroundFetch(() => ({ failure: 'fetch-error' }));
    try {
      const { data } = await api().post<{ id: string }>(
        '/api/v2/media',
        formWith(BG_UPLOAD_MIN_BYTES),
      );
      expect(data).toEqual({ id: 'page' });
      expect(page).toHaveBeenCalledTimes(1);
    } finally {
      restore();
    }
  });

  test('cancelled from the notification ends quietly', async () => {
    const restore = withAdapter(ok);
    installBackgroundFetch(() => ({ failure: 'aborted' }));
    try {
      await expect(
        api().post('/api/v2/media', formWith(BG_UPLOAD_MIN_BYTES)),
      ).rejects.toBeInstanceOf(CanceledError);
    } finally {
      restore();
    }
  });

  test('goes as a page request when the browser will not take it', async () => {
    const page = vi.fn(ok);
    const restore = withAdapter(page);
    const { backgroundFetch } = installBackgroundFetch(() => ({ status: 200 }));
    backgroundFetch.fetch.mockRejectedValueOnce(new TypeError('blocked'));
    try {
      const { data } = await api().post<{ id: string }>(
        '/api/v2/media',
        formWith(BG_UPLOAD_MIN_BYTES),
      );
      expect(data).toEqual({ id: 'page' });
    } finally {
      restore();
    }
  });
});
