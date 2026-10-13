import { apiGetWachugotListings } from 'mastodon/api/wachuneed';

import { WachuneedListings } from './wachuneed_view';

// Mine — the caller's own listings, across every state (live /
// reserved / closed). Reuses the shared WachuneedListings surface;
// only the loader differs.
export const WachugotListings: React.FC = () => (
  <WachuneedListings loader={apiGetWachugotListings} scope='mine' />
);
