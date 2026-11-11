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
export type KommunityListSource = 'everyone' | 'mates';

const apiGetKommunityList = async (
  source: KommunityListSource,
  query: string,
  offset: number,
  limit: number,
): Promise<{ accounts: ApiAccountJSON[]; nextOffset: number | null }> => {
  const params: Record<string, string> = {
    limit: String(limit),
    offset: String(offset),
  };
  if (query) params.q = query;

  const response = await api().get<ApiAccountJSON[]>(
    `/api/v1/kommunity/${source}`,
    { params },
  );
  const next = getLinks(response).refs.find((link) => link.rel === 'next');
  const nextParam = next ? new URL(next.uri).searchParams.get('offset') : null;

  return {
    accounts: response.data,
    nextOffset: nextParam ? Number(nextParam) : null,
  };
};

export const apiGetKommunityEveryone = (
  query: string,
  offset: number,
  limit = 40,
) => apiGetKommunityList('everyone', query, offset, limit);

// Kommunity Mates — the viewer's Mates, most recent poster first
// (Api::V1::Kommunity::MatesController). Same search and paging as
// Everyone.
export const apiGetKommunityMates = (
  query: string,
  offset: number,
  limit = 40,
) => apiGetKommunityList('mates', query, offset, limit);
