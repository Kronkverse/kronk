import { apiRequestGet, apiRequestPost } from 'mastodon/api';

// Requests for Wachuneed listings (docs/spaces/wachuneed.md, Requests): a
// buyer asks with the kind, extras and quantity they chose; the seller
// accepts or declines; the buyer can take it back while it waits.

export type ApiRequestState =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'withdrawn'
  | 'expired';

interface ApiRequestAccountJSON {
  id: string;
  acct: string;
  display_name: string;
  avatar_static: string;
}

export interface ApiRequestJSON {
  id: string;
  state: ApiRequestState;
  quantity: number;
  // As asked: a choice per variation, and the extras with what they added.
  choices: {
    variant?: string[];
    options?: { name: string; choice: string; extra_cents: number }[];
  };
  total_cents: number | null;
  price_currency: string | null;
  message: string | null;
  created_at: string;
  responded_at: string | null;
  buyer: ApiRequestAccountJSON;
  listing: {
    id: string;
    slug: string;
    title: string;
    state: string;
    cover_url: string | null;
    seller: ApiRequestAccountJSON;
  };
}

export interface AskParams {
  variant?: string[];
  options?: { name: string; choice: string }[];
  quantity: number;
  message?: string;
}

export const apiAskForListing = (listingId: string, params: AskParams) =>
  apiRequestPost<ApiRequestJSON>(
    `v1/wachuneed/listings/${listingId}/requests`,
    { ...params },
  );

// `seller`: asked of you. `buyer`: what you asked for.
export const apiGetRequests = (as: 'seller' | 'buyer') =>
  apiRequestGet<ApiRequestJSON[]>('v1/wachuneed/requests', { as });

export const apiAnswerRequest = (
  id: string,
  answer: 'accept' | 'decline' | 'withdraw',
) => apiRequestPost<ApiRequestJSON>(`v1/wachuneed/requests/${id}/${answer}`);
