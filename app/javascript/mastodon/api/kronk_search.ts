import { apiRequestGet } from 'mastodon/api';

// Kronk Search — API client for the v2 endpoint that PR 3 wired to
// route through Kronk::Search.adapter when SEARCH_BACKEND=meilisearch.
// Response shape is the standard Mastodon v2 shape (accounts /
// statuses / hashtags) plus five Kronk-native collections (events /
// proposals / booth sets / listings / krews) when the meilisearch
// backend is active. Third-party clients that only know the classic
// shape ignore the extra keys.

export type SearchType =
  | 'accounts'
  | 'statuses'
  | 'hashtags'
  | 'events'
  | 'proposals'
  | 'booth_sets'
  | 'listings'
  | 'krews';

// Uniform shape for every Kronk-native hit — projected server-side by
// `Kronk::Search::PolicyFilter` from the Meilisearch document. The SPA
// renders a generic result row per korner using `korner` to look up
// the icon (via `useKornerIcon`).
export interface ApiKronkSearchHit {
  id: string;
  korner: string;
  title: string;
  subtitle: string | null;
  url: string;
}

// Response shape mirrors REST::Kronk::SearchSerializer on the server.
// The five Kronk-native fields are optional so the client works against
// both the meilisearch backend (which populates them) and the upstream
// SearchService fallback (which omits them entirely).
export interface ApiSearchResults {
  accounts: unknown[];
  statuses: unknown[];
  hashtags: unknown[];
  events?: ApiKronkSearchHit[];
  proposals?: ApiKronkSearchHit[];
  booth_sets?: ApiKronkSearchHit[];
  listings?: ApiKronkSearchHit[];
  krews?: ApiKronkSearchHit[];
}

export interface ApiSearchParams {
  q: string;
  type?: SearchType;
  limit?: number;
}

export const apiKronkSearch = (params: ApiSearchParams) =>
  apiRequestGet<ApiSearchResults>('v2/search', {
    q: params.q,
    type: params.type,
    limit: params.limit ?? 20,
  });
