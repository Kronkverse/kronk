// A marketplace listing, as served by /api/v1/marketplace/listings and
// embedded on statuses (REST::MarketplaceListingSummarySerializer).
export interface ApiListingJSON {
  id: string;
  title: string;
  description?: string | null;
  category: string;
  subcategory?: string | null;
  price_display?: string | null;
  location?: string | null;
  state: string;
}
