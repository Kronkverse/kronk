import { apiRequestGet } from 'mastodon/api';
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
