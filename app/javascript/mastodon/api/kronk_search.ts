import { apiRequestGet } from 'mastodon/api';

// Kronk Search — API client for the v2 endpoint that PR 3 wired to
// route through Kronk::Search.adapter when SEARCH_BACKEND=meilisearch.
// Response shape is the standard Mastodon v2 search shape
// (accounts / statuses / hashtags) so this remains API-compat.

export type SearchType = 'accounts' | 'statuses' | 'hashtags';

// Response shape mirrors REST::SearchSerializer on the server.
export interface ApiSearchResults {
  accounts: unknown[];
  statuses: unknown[];
  hashtags: unknown[];
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
