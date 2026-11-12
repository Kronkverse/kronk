import type {
  AxiosError,
  AxiosResponse,
  Method,
  RawAxiosRequestHeaders,
} from 'axios';
import axios from 'axios';
import LinkHeader from 'http-link-header';

import { getAccessToken } from './initial_state';
import ready from './ready';
import { holdScreenAwake } from './utils/wake_lock';

export const getLinks = (response: AxiosResponse) => {
  const value = response.headers.link as string | undefined;

  if (!value) {
    return new LinkHeader();
  }

  return LinkHeader.parse(value);
};

export interface AsyncRefreshHeader {
  id: string;
  retry: number;
}

const isAsyncRefreshHeader = (obj: object): obj is AsyncRefreshHeader =>
  'id' in obj && 'retry' in obj;

export const getAsyncRefreshHeader = (
  response: AxiosResponse,
): AsyncRefreshHeader | null => {
  const value = response.headers['mastodon-async-refresh'] as
    | string
    | undefined;

  if (!value) {
    return null;
  }

  const asyncRefreshHeader: Record<string, unknown> = {};

  value.split(/,\s*/).forEach((pair) => {
    const [key, val] = pair.split('=', 2);

    let typedValue: string | number;

    if (key && ['id', 'retry'].includes(key) && val) {
      if (val.startsWith('"')) {
        typedValue = val.slice(1, -1);
      } else {
        typedValue = parseInt(val);
      }

      asyncRefreshHeader[key] = typedValue;
    }
  });

  if (isAsyncRefreshHeader(asyncRefreshHeader)) {
    return asyncRefreshHeader;
  }

  return null;
};

const csrfHeader: RawAxiosRequestHeaders = {};

const setCSRFHeader = () => {
  const csrfToken = document.querySelector<HTMLMetaElement>(
    'meta[name=csrf-token]',
  );

  if (csrfToken) {
    csrfHeader['X-CSRF-Token'] = csrfToken.content;
  }
};

void ready(setCSRFHeader);

const authorizationTokenFromInitialState = (): RawAxiosRequestHeaders => {
  const accessToken = getAccessToken();

  if (!accessToken) return {};

  return {
    Authorization: `Bearer ${accessToken}`,
  };
};

// eslint-disable-next-line import/no-default-export
export default function api(withAuthorization = true) {
  const instance = axios.create({
    transitional: {
      clarifyTimeoutError: true,
    },
    headers: {
      ...csrfHeader,
      ...(withAuthorization ? authorizationTokenFromInitialState() : {}),
    },

    transformResponse: [
      function (data: unknown) {
        try {
          return JSON.parse(data as string) as unknown;
        } catch {
          return data;
        }
      },
    ],
  });

  // Every composer uploads media through here, so this is the one place to
  // keep the phone's screen on until an upload is sent (utils/wake_lock).
  const awake = new WeakMap<object, () => void>();
  const letSleep = (config: object | undefined) => {
    if (!config) return;
    awake.get(config)?.();
    awake.delete(config);
  };

  // `synchronous` + `runWhen`: an ordinary async request interceptor makes
  // axios send every request a tick later, which is enough to change page
  // timing. This one runs only for uploads, in step.
  const isUpload = (config: { method?: string; url?: string }) =>
    config.method?.toLowerCase() === 'post' &&
    !!config.url?.startsWith('/api/v2/media');
  // A big phone video is shrunk on the device first (utils/compress_video),
  // loaded only when one is uploaded. Registered before the wake lock so it
  // runs after it: axios runs request interceptors last-registered first,
  // and the screen should stay on while the video is encoded too. Async, but
  // only for video uploads, so every other request keeps its timing.
  const videoIn = (data: unknown) => {
    if (!(data instanceof FormData)) return null;
    const file = data.get('file');
    return file instanceof File && file.type.startsWith('video/') ? file : null;
  };
  instance.interceptors.request.use(
    async (config) => {
      const file = videoIn(config.data);
      if (file && config.data instanceof FormData) {
        const { shrinkVideo } = await import('./utils/compress_video');
        const smaller = await shrinkVideo(file);
        if (smaller !== file) config.data.set('file', smaller);
      }
      return config;
    },
    null,
    { runWhen: (config) => isUpload(config) && !!videoIn(config.data) },
  );
  instance.interceptors.request.use(
    (config) => {
      awake.set(config, holdScreenAwake());
      return config;
    },
    null,
    { synchronous: true, runWhen: isUpload },
  );

  instance.interceptors.response.use(
    (response: AxiosResponse) => {
      letSleep(response.config);
      if (response.headers.deprecation) {
        console.warn(
          `Deprecated request: ${response.config.method} ${response.config.url}`,
        );
      }
      return response;
    },
    (error: AxiosError) => {
      letSleep(error.config);
      return Promise.reject(error);
    },
  );

  return instance;
}

export type ApiUrl = `v${1 | '1_alpha' | 2}/${string}`;
type RequestParamsOrData = Record<string, unknown>;

export async function apiRequest<ApiResponse = unknown>(
  method: Method,
  url: string,
  args: {
    signal?: AbortSignal;
    params?: RequestParamsOrData;
    data?: RequestParamsOrData;
    timeout?: number;
  } = {},
) {
  const { data } = await api().request<ApiResponse>({
    method,
    url: '/api/' + url,
    ...args,
  });

  return data;
}

export async function apiRequestGet<ApiResponse = unknown>(
  url: ApiUrl,
  params?: RequestParamsOrData,
) {
  return apiRequest<ApiResponse>('GET', url, { params });
}

export async function apiRequestPost<ApiResponse = unknown>(
  url: ApiUrl,
  data?: RequestParamsOrData,
) {
  return apiRequest<ApiResponse>('POST', url, { data });
}

export async function apiRequestPut<ApiResponse = unknown>(
  url: ApiUrl,
  data?: RequestParamsOrData,
) {
  return apiRequest<ApiResponse>('PUT', url, { data });
}

export async function apiRequestPatch<ApiResponse = unknown>(
  url: ApiUrl,
  data?: RequestParamsOrData,
) {
  return apiRequest<ApiResponse>('PATCH', url, { data });
}

export async function apiRequestDelete<ApiResponse = unknown>(
  url: ApiUrl,
  params?: RequestParamsOrData,
) {
  return apiRequest<ApiResponse>('DELETE', url, { params });
}
