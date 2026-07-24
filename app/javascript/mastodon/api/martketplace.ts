import { apiRequestGet, apiRequestPost } from 'mastodon/api';
import type { ApiListingJSON } from 'mastodon/api_types/martketplace';

// mARTketplace listings — split by scope so the two sub-views share a
// client but hit the same server endpoint with different params.
//
//   wachuneed → browse others' live listings.
//   wachugot  → the caller's own listings (all states).

export const apiGetWachuneedListings = () =>
  apiRequestGet<ApiListingJSON[]>('v1/martketplace/listings');

export const apiGetWachugotListings = () =>
  apiRequestGet<ApiListingJSON[]>('v1/martketplace/listings', {
    mine: 'true',
  });

// Create a new listing (composer at /hub/martketplace/new). Categories
// are the server-side enum: creation | goods | service (display labels
// Art / Stuff / Offerings live in the frontend).
export interface CreateListingParams {
  title: string;
  description?: string;
  category: 'creation' | 'goods' | 'service';
  subcategory?: string;
  price_cents?: number | null;
  price_currency?: string;
  location?: string;
  state?: 'draft' | 'live';
}

export const apiCreateMartketplaceListing = (params: CreateListingParams) =>
  apiRequestPost<ApiListingJSON>(
    'v1/martketplace/listings',
    // apiRequestPost declares `data?: Record<string, unknown>`; our
    // interface has fixed keys, so the widening cast is safe.
    params as unknown as Record<string, unknown>,
  );
