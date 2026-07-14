import { apiGetKorners } from 'mastodon/api/korners';
import { createDataLoadingThunk } from 'mastodon/store/typed_functions';

// Fetched once on app boot from features/ui/index.jsx#componentDidMount.
// Manifests are static per-deploy so we don't refetch until a page reload.
export const fetchKorners = createDataLoadingThunk(
  'korners/fetch',
  () => apiGetKorners(),
  (data) => data,
);
