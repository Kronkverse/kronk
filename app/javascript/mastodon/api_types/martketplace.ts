// A mARTketplace listing, as served by /api/v1/martketplace/listings and
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
}
