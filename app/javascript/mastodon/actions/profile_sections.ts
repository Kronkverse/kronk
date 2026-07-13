import {
  apiGetProfileSections,
  apiReorderProfileSections,
} from 'mastodon/api/profile_sections';
import { createDataLoadingThunk } from 'mastodon/store/typed_functions';

// Fetched once when the account view mounts. Sections are per-viewer's-
// own-account for the write endpoints; read is the currently-viewed
// account's public sections in a later chunk.
export const fetchProfileSections = createDataLoadingThunk(
  'profile_sections/fetch',
  () => apiGetProfileSections(),
  (data) => data,
);

export const reorderProfileSections = createDataLoadingThunk(
  'profile_sections/reorder',
  ({ order }: { order: string[] }) => apiReorderProfileSections(order),
  (data) => data,
);
