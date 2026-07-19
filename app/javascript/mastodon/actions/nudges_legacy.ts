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
  // `onData` receives the whole result from `loadData`, which here is the
  // array of notifications. The previous form destructured it — `([data])` —
  // and so kept only the first notification, discarding the rest of the page
  // and handing the reducer an object where it expected a list. That is what
  // the two "must have a [Symbol.iterator]" errors in reducers/nudges_legacy
  // were reporting: `state.entries.push(...payload)` cannot spread a single
  // notification, so paginating the Legacy tab threw.
  (data) => data,
);
