import { apiGetWachugotListings } from 'mastodon/api/martketplace';

import { WachuneedListings } from './wachuneed_view';

// Wachugot — the caller's own listings, across every state (live /
// reserved / closed). Reuses the shared WachuneedListings surface;
// only the loader differs.
export const WachugotListings: React.FC = () => (
  <WachuneedListings loader={apiGetWachugotListings} scope='wachugot' />
);
