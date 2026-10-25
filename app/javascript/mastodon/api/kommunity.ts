import api, { apiRequestGet, getLinks } from 'mastodon/api';
import type { ApiAccountJSON } from 'mastodon/api_types/accounts';

// Kommunity discover-drawer layer endpoints. Same paginated account
// shape for all three so the client can render each with one widget.
// Server:
//   Api::V1::Kommunity::LayersController#kronkers
//                                       #orbit
//                                       #krews
export type KommunityLayer = 'kronkers' | 'orbit' | 'krews';

const buildQuery = (
  maxId: string | null,
  limit: number,
): Record<string, string> => {
  const q: Record<string, string> = { limit: String(limit) };
  if (maxId) q.max_id = maxId;
  return q;
};

export const apiGetKommunityLayer = (
  layer: KommunityLayer,
  maxId: string | null,
  limit = 40,
) =>
  apiRequestGet<ApiAccountJSON[]>(
    `v1/kommunity/${layer}`,
    buildQuery(maxId, limit),
  );

// Kommunity Everyone — the full alphabetical directory of people the
// viewer may find (Api::V1::Kommunity::EveryoneController). Paged by
// offset; the next page's offset comes from the Link header, or `null`
// when there is none.
export const apiGetKommunityEveryone = async (
  query: string,
  offset: number,
  limit = 40,
): Promise<{ accounts: ApiAccountJSON[]; nextOffset: number | null }> => {
  const params: Record<string, string> = {
    limit: String(limit),
    offset: String(offset),
  };
  if (query) params.q = query;

  const response = await api().get<ApiAccountJSON[]>(
    '/api/v1/kommunity/everyone',
    { params },
  );
  const next = getLinks(response).refs.find((link) => link.rel === 'next');
  const nextParam = next ? new URL(next.uri).searchParams.get('offset') : null;

  return {
    accounts: response.data,
    nextOffset: nextParam ? Number(nextParam) : null,
  };
};
