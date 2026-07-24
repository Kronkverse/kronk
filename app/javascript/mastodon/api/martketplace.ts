import { apiRequestGet } from 'mastodon/api';
import type { ApiListingJSON } from 'mastodon/api_types/martketplace';

// mARTketplace listings — split by scope so the two sub-views share a
// client but hit the same server endpoint with different params.
//
//   wachuneed → browse others' live listings.
//   wachugot  → the caller's own listings (all states).

export const apiGetWachuneedListings = () =>
  apiRequestGet<ApiListingJSON[]>('v1/martketplace/listings');

export const apiGetWachugotListings = () =>
  apiRequestGet<ApiListingJSON[]>('v1/martketplace/listings', { mine: 'true' });
