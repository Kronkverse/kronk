import api, { apiRequestGet, apiRequestPost } from 'mastodon/api';
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
  // Optional photos — media_attachment_ids returned from
  // apiUploadListingMedia. Position is preserved by order.
  media_attachment_ids?: string[];
}

export const apiCreateMartketplaceListing = (params: CreateListingParams) =>
  apiRequestPost<ApiListingJSON>(
    'v1/martketplace/listings',
    // apiRequestPost declares `data?: Record<string, unknown>`; our
    // interface has fixed keys, so the widening cast is safe.
    params as unknown as Record<string, unknown>,
  );

// Upload a photo attachment and return the media_attachment id +
// preview URL. Same endpoint the composer + nudges use; the pattern
// is repeated here so martketplace can move independently without
// pulling nudges in as a dependency.
interface ApiUploadedMedia {
  id: string;
  type: string;
  url: string | null;
  preview_url: string | null;
}

export const apiUploadListingMedia = async (
  file: File,
): Promise<ApiUploadedMedia> => {
  const form = new FormData();
  form.append('file', file);
  const response = await api().post<ApiUploadedMedia>('/api/v2/media', form);
  return response.data;
};
