import { apiRequestGet } from 'mastodon/api';
import type { ApiListingJSON } from 'mastodon/api_types/wachuneed';

export const apiGetWachuneedListings = () =>
  apiRequestGet<ApiListingJSON[]>('v1/wachuneed/listings');
