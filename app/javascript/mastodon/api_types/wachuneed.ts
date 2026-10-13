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

// One option on a listing: a named group of choices ("Length": 30 minutes,
// 1 hour). `extra_cents` is what a choice adds to the listing's price.
export interface ApiListingOptionJSON {
  name: string;
  choices: { label: string; extra_cents: number }[];
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
  // `offer` (on offer, the Offered section) or `wanted` (looking for, the
  // Desired section). Older servers omit it: treat absent as `offer`.
  kind?: 'offer' | 'wanted';
  // The section of the seller's shop it sits in, if any.
  shop_section_id?: string | null;
  // Detail endpoint only: the seller's shop (for "See everything from
  // this shop"), and whether you may message them about the listing
  // (their Mate, or their shop takes enquiries from anyone).
  shop?: { name: string; acct: string } | null;
  can_message?: boolean;
  // Detail endpoint only: what a buyer can choose.
  options?: ApiListingOptionJSON[];
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
