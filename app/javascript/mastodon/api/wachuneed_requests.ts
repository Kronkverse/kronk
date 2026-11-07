import { apiRequestGet, apiRequestPost } from 'mastodon/api';

// Requests for Wachuneed listings (docs/spaces/wachuneed.md, Requests): a
// buyer asks with the kind, extras and quantity they chose; the seller
// accepts or declines; the buyer can take it back while it waits.

export type ApiRequestState =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'withdrawn'
  | 'expired'
  | 'cancelled';

// One end of a booking's from and to: a point on the Map, maybe named.
export interface ApiRoutePointJSON {
  lat: number;
  lng: number;
  name?: string;
}

export interface ApiRouteJSON {
  from?: ApiRoutePointJSON;
  to?: ApiRoutePointJSON;
}

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
  // A booking (docs/spaces/wachuneed.md, Booking): when, a from and a to
  // (seen only by the two of them), what they need; and, once called
  // off, when and by which side.
  starts_at: string | null;
  ends_at: string | null;
  route: ApiRouteJSON;
  details: string | null;
  cancelled_at: string | null;
  cancelled_by_seller: boolean;
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
  starts_at?: string;
  route?: ApiRouteJSON;
  details?: string;
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
  answer: 'accept' | 'decline' | 'withdraw' | 'cancel',
) => apiRequestPost<ApiRequestJSON>(`v1/wachuneed/requests/${id}/${answer}`);

// A booked listing's free times for two weeks from `from`; `suggest` when
// the seller posted none and the person suggests a time instead.
export const apiGetListingTimes = (listingId: string, from?: string) =>
  apiRequestGet<{ suggest: boolean; times: string[] }>(
    `v1/wachuneed/listings/${listingId}/times`,
    from ? { from } : undefined,
  );
