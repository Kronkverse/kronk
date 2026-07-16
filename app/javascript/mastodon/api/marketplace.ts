import { apiRequestGet } from 'mastodon/api';
import type { ApiListingJSON } from 'mastodon/api_types/marketplace';

export const apiGetMarketplaceListings = () =>
  apiRequestGet<ApiListingJSON[]>('v1/marketplace/listings');
