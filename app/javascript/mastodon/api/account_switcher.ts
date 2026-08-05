import api from 'mastodon/api';

// The account switcher talks to the server-side multi-session endpoints
// (Auth::SwitchesController). These are session-cookie authenticated (no OAuth
// token), same as log-out — hence `api(false)` + `withCredentials`.

export interface SwitcherAccount {
  id: string;
  acct: string;
  display_name: string;
  avatar: string;
  active: boolean;
}

export async function fetchSwitcherAccounts(): Promise<SwitcherAccount[]> {
  const response = await api(false).get<SwitcherAccount[]>('/auth/accounts', {
    headers: { Accept: 'application/json' },
    withCredentials: true,
  });

  return response.data;
}

// Make an already-authenticated account active. Returns the path to hard-reload
// to (the server re-emits that account's initial_state on the fresh load).
export async function switchAccount(
  userId: string,
): Promise<string | undefined> {
  const response = await api(false).post<{ redirect_to?: string }>(
    '/auth/switch',
    { user_id: userId },
    { headers: { Accept: 'application/json' }, withCredentials: true },
  );

  return response.data.redirect_to;
}
