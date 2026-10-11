// A Wachuneed listing, as served by /api/v1/wachuneed/listings and
// embedded on statuses (REST::WachuneedListingSummarySerializer).
// One photo of a listing: `url` is the small variant, `full_url` the
// original. The id is the media attachment's, which is what the edit form
// sends back as `media_attachment_ids`.
export interface ApiListingPhotoJSON {
  id: string;
  url: string;
  full_url?: string | null;
}

export interface ApiListingJSON {
  id: string;
  title: string;
  description?: string | null;
  category: string;
  subcategory?: string | null;
  price_display?: string | null;
  location?: string | null;
  state: string;
  // `offer` (on offer, the Wachuneed view) or `wanted` (looking for, the
  // Wachumissing view). Older servers omit it: treat absent as `offer`.
  kind?: 'offer' | 'wanted';
  // First attached photo URL (small variant), null when the listing
  // has no photos. The card lays out around this — no photo, no tile.
  photo_url?: string | null;
  // Every photo in order, the cover first. Older servers omit it.
  photos?: ApiListingPhotoJSON[];
  // Detail endpoint only: the raw price (so the owner's edit form can
  // prefill it) and the full-size photo for the detail page.
  price_cents?: number | null;
  price_currency?: string | null;
  photo_full_url?: string | null;
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
