// The reason the server gave for refusing a request (`{ error: "…" }`), if
// it gave one: "Validation failed: That record is Konnected already" rather
// than axios's "Request failed with status code 422".
export const serverError = (e: unknown): string | null => {
  if (typeof e !== 'object' || e === null || !('response' in e)) return null;
  const { response } = e as { response?: { data?: { error?: unknown } } };
  const error = response?.data?.error;
  return typeof error === 'string' && error.trim() !== '' ? error : null;
};

// What to tell the person: the server's reason, else the error's own
// message, else nothing.
export const errorText = (e: unknown): string =>
  serverError(e) ?? (e instanceof Error ? e.message : '');
