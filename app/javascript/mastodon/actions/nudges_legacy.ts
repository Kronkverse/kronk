import { apiGetNudgesLegacyArchive } from 'mastodon/api/nudges_legacy';
import { createDataLoadingThunk } from 'mastodon/store/typed_functions';

// Fetched when the Nudges surface is opened to the "Legacy" tab.
// Cursor-paginated forward on max_id.
export const fetchNudgesLegacyArchive = createDataLoadingThunk(
  'nudges_legacy/fetch',
  ({
    maxId,
    minId,
    limit,
  }: { maxId?: string; minId?: string; limit?: number } = {}) =>
    apiGetNudgesLegacyArchive({ max_id: maxId, min_id: minId, limit }),
  ([data]) => data ?? [],
);
