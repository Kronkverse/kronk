import api, {
  apiRequestGet,
  apiRequestPatch,
  apiRequestPost,
} from 'mastodon/api';
import type {
  ApiListingJSON,
  ApiListingOptionJSON,
  ApiListingVariantsJSON,
  ListingAvailability,
  ListingVisibility,
} from 'mastodon/api_types/wachuneed';

// Wachuneed listings — split by scope so the sub-views share a client
// but hit the same server endpoint with different params.
//
//   offered → live listings on offer.
//   desired → live listings someone is looking for (wanted).
//   mine    → the caller's own listings (all states, both kinds).

export const apiGetWachuneedListings = () =>
  apiRequestGet<ApiListingJSON[]>('v1/wachuneed/listings', { kind: 'offer' });

export const apiGetWachumissingListings = () =>
  apiRequestGet<ApiListingJSON[]>('v1/wachuneed/listings', {
    kind: 'wanted',
  });

export const apiGetWachugotListings = () =>
  apiRequestGet<ApiListingJSON[]>('v1/wachuneed/listings', {
    mine: 'true',
  });

// Detail endpoint — returns a single listing with poster account
// attached (used by /hub/wachuneed/listings/:id).
// A listing's page, by name (decisions.md, 2026-10-22).
export const listingPath = (listing: { id: string; slug?: string }) =>
  `/hub/wachuneed/listings/${listing.slug ?? listing.id}`;

export const apiGetWachuneedListing = (id: string) =>
  apiRequestGet<ApiListingJSON>(`v1/wachuneed/listings/${id}`);

// Create a new listing (composer at /hub/wachuneed/new). Categories
// are the server-side enum: creation | goods | service (display labels
// Art / Stuff / Offerings live in the frontend).
export interface CreateListingParams {
  title: string;
  description?: string;
  category: 'creation' | 'goods' | 'service';
  // `wanted` posts what you're looking for (Desired); default offer.
  kind?: 'offer' | 'wanted';
  subcategory?: string;
  price_cents?: number | null;
  price_currency?: string;
  location?: string;
  state?: 'draft' | 'live';
  // One of your own shop's sections, or null for none.
  listing_shop_section_id?: string | null;
  // Replaces the listing's options when sent; an empty list removes them.
  options?: ApiListingOptionJSON[];
  // Replaces what the item comes in when sent; an empty object removes it.
  variants?: ApiListingVariantsJSON | Record<string, never>;
  ongoing?: boolean;
  availability?: ListingAvailability;
  // false adds the listing without posting it to the feed.
  announced?: boolean;
  // Who can see it, and so who can message you about it.
  visibility?: ListingVisibility;
  // Which choice a photo shows, by media id. Read with the photos.
  photo_variants?: Record<string, string>;
  // Optional photos — media_attachment_ids returned from
  // apiUploadListingMedia. Position is preserved by order.
  media_attachment_ids?: string[];
}

export const apiCreateWachuneedListing = (params: CreateListingParams) =>
  apiRequestPost<ApiListingJSON>(
    'v1/wachuneed/listings',
    // apiRequestPost declares `data?: Record<string, unknown>`; our
    // interface has fixed keys, so the widening cast is safe.
    params as unknown as Record<string, unknown>,
  );

// Owner-only edit (/hub/wachuneed/listings/:id/edit). Same fields as
// create. `media_attachment_ids` replaces the photos when present (an
// empty array removes them) and leaves them alone when omitted.
export const apiUpdateWachuneedListing = (
  id: string,
  params: Partial<CreateListingParams>,
) =>
  apiRequestPatch<ApiListingJSON>(
    `v1/wachuneed/listings/${id}`,
    params as unknown as Record<string, unknown>,
  );

// Owner-only take-down: closes the listing and removes its feed post. It
// stays in the owner's Mine section. There is no reopening.
export const apiCloseWachuneedListing = (id: string) =>
  apiRequestPost<ApiListingJSON>(`v1/wachuneed/listings/${id}/close`);

// Upload a photo attachment and return the media_attachment id +
// preview URL. Same endpoint the composer + nudges use; the pattern
// is repeated here so wachuneed can move independently without
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
