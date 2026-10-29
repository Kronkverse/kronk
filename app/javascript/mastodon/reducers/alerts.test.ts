import { AxiosError, AxiosHeaders } from 'axios';
import type { AxiosResponse } from 'axios';

import { showAlert, showAlertForError } from 'mastodon/actions/alerts';
import type { Alert } from 'mastodon/models/alert';

import { alertsReducer } from './alerts';

const axiosError = (
  status: number,
  data: unknown = '<html>Bad Gateway</html>',
) => {
  const response = {
    status,
    statusText: '',
    headers: {},
    data,
    config: { headers: new AxiosHeaders() },
  } as AxiosResponse;
  return new AxiosError(
    'Request failed',
    'ERR_BAD_RESPONSE',
    undefined,
    undefined,
    response,
  );
};

const run = (...actions: ReturnType<typeof showAlert>[]): Alert[] =>
  actions.reduce<Alert[]>((state, action) => alertsReducer(state, action), []);

describe('alertsReducer', () => {
  test('a burst of identical errors shows a single toast', () => {
    const burst = Array.from({ length: 20 }, () =>
      showAlertForError(axiosError(502)),
    ) as ReturnType<typeof showAlert>[];
    expect(run(...burst)).toHaveLength(1);
  });

  test('a new error replaces the one on screen', () => {
    const state = run(
      showAlertForError(axiosError(502)) as ReturnType<typeof showAlert>,
      showAlertForError(
        axiosError(422, { error: 'Validation failed' }),
      ) as ReturnType<typeof showAlert>,
    );
    expect(state).toHaveLength(1);
    expect(state[0]?.message).toBe('Validation failed');
  });

  test('non-error alerts still stack, but identical ones collapse', () => {
    const state = run(
      showAlert({ message: 'Link copied' }),
      showAlert({ message: 'Saved' }),
      showAlert({ message: 'Saved' }),
    );
    expect(state.map((a) => a.message)).toEqual(['Link copied', 'Saved']);
  });

  test('an error does not remove a non-error alert', () => {
    const state = run(
      showAlert({ message: 'Saved' }),
      showAlertForError(axiosError(502)) as ReturnType<typeof showAlert>,
    );
    expect(state).toHaveLength(2);
  });

  test('a server error with no body reads as words, not a status code', () => {
    const action = showAlertForError(axiosError(502)) as ReturnType<
      typeof showAlert
    >;
    expect(action.payload.title).toMatchObject({
      id: 'alert.server_error.title',
    });
  });
});
