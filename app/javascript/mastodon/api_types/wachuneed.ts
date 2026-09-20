// A Wachuneed listing, as served by /api/v1/wachuneed/listings and
// embedded on statuses (REST::WachuneedListingSummarySerializer).
export interface ApiListingJSON {
  id: string;
  title: string;
  description?: string | null;
  category: string;
  subcategory?: string | null;
  price_display?: string | null;
  location?: string | null;
  state: string;
  // First attached photo URL (small variant), null when the listing
  // has no photos. The card lays out around this — no photo, no tile.
  photo_url?: string | null;
  // Only populated on the detail endpoint
  // (GET /api/v1/wachuneed/listings/:id) — the grid + feed embed
  // omit it. Tapping a tile navigates to
  // /hub/wachuneed/listings/:id which renders <ListingDetail> with
  // the poster surfaced as "posted by @acct" + a message-poster
  // action.
  account?: {
    id: string;
    acct: string;
    display_name: string;
    avatar: string;
    avatar_static: string;
  };
}
