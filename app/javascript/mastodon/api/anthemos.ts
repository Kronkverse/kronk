import { apiRequestGet, apiRequestPost } from 'mastodon/api';

// Asks from Kronk to Anthemos — mirrors
// app/controllers/api/v1/anthemos/asks_controller.rb. The website makes an
// ask and hands Anthemos only its id; the phone reads it with its own
// sign-in, so it must be signed in to this same account, and answers it,
// signed. The website watches the ask for that answer.

export type AnthemosAskKind = 'location.update' | 'location.share';

export type AnthemosAskStatus =
  | 'waiting'
  | 'done'
  | 'declined'
  | 'failed'
  | 'expired';

export interface ApiAnthemosPersonJSON {
  id: string;
  acct: string;
  name: string;
  avatar: string;
}

export interface ApiAnthemosAskJSON {
  id: string;
  kind: AnthemosAskKind;
  status: AnthemosAskStatus;
  // What the phone said it did (the pin's town), or why it couldn't.
  result: string | null;
  expires_at: string;
  account: ApiAnthemosPersonJSON;
  to: ApiAnthemosPersonJSON | null;
}

export const apiCreateAnthemosAsk = (
  kind: AnthemosAskKind,
  payload: Record<string, string> = {},
) => apiRequestPost<ApiAnthemosAskJSON>('v1/anthemos/asks', { kind, payload });

export const apiGetAnthemosAsk = (id: string) =>
  apiRequestGet<ApiAnthemosAskJSON>(`v1/anthemos/asks/${id}`);
