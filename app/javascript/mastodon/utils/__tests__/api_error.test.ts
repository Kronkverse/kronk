import { errorText, serverError } from '../api_error';

const refused = (data: unknown) =>
  Object.assign(new Error('Request failed with status code 422'), {
    response: { data },
  });

describe('serverError', () => {
  it('reads the reason the server gave', () => {
    expect(serverError(refused({ error: 'Already Konnected' }))).toBe(
      'Already Konnected',
    );
  });

  it('is null without one', () => {
    expect(serverError(refused({}))).toBeNull();
    expect(serverError(refused({ error: '  ' }))).toBeNull();
    expect(serverError(refused({ error: 42 }))).toBeNull();
    expect(serverError(new Error('offline'))).toBeNull();
    expect(serverError(null)).toBeNull();
  });
});

describe('errorText', () => {
  it('prefers the server’s reason to the request’s', () => {
    expect(errorText(refused({ error: 'Already Konnected' }))).toBe(
      'Already Konnected',
    );
  });

  it('falls back to the error’s own message, then nothing', () => {
    expect(errorText(refused(null))).toBe(
      'Request failed with status code 422',
    );
    expect(errorText('nope')).toBe('');
  });
});
