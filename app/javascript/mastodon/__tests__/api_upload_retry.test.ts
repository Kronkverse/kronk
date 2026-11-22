import axios, { AxiosError } from 'axios';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';

import api from '../api';

const ok = (config: InternalAxiosRequestConfig) =>
  Promise.resolve({
    data: '{"id":"1"}',
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  });

const dropped = (config: InternalAxiosRequestConfig) =>
  Promise.reject(
    new AxiosError('Network Error', AxiosError.ERR_NETWORK, config),
  );

const withAdapter = (adapter: AxiosAdapter) => {
  const before = axios.defaults.adapter;
  axios.defaults.adapter = adapter;
  return () => {
    axios.defaults.adapter = before;
  };
};

const photo = () => {
  const form = new FormData();
  form.append('file', new File(['x'], 'a.png', { type: 'image/png' }));
  return form;
};

describe('media uploads', () => {
  test('are sent again when the connection drops', async () => {
    const calls: string[] = [];
    const restore = withAdapter((config) => {
      calls.push(config.url ?? '');
      return calls.length === 1 ? dropped(config) : ok(config);
    });
    try {
      const { data } = await api().post<{ id: string }>(
        '/api/v2/media',
        photo(),
      );
      expect(data).toEqual({ id: '1' });
      expect(calls).toHaveLength(2);
    } finally {
      restore();
    }
  });

  test('give up after two more tries', async () => {
    let calls = 0;
    const restore = withAdapter((config) => {
      calls += 1;
      return dropped(config);
    });
    try {
      await expect(api().post('/api/v2/media', photo())).rejects.toThrow(
        'Network Error',
      );
      expect(calls).toBe(3);
    } finally {
      restore();
    }
  });

  test('other writes are not sent again', async () => {
    let calls = 0;
    const restore = withAdapter((config) => {
      calls += 1;
      return dropped(config);
    });
    try {
      await expect(api().post('/api/v1/statuses', {})).rejects.toThrow();
      expect(calls).toBe(1);
    } finally {
      restore();
    }
  });
});
