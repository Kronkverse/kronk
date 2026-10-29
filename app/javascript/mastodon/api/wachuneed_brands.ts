import {
  apiRequestDelete,
  apiRequestGet,
  apiRequestPatch,
  apiRequestPost,
} from 'mastodon/api';

// Brands in Wachuneed (docs/spaces/wachuneed.md, Brands): brands whose
// mission members have looked into and respect. Any member proposes one;
// it is listed once `backers_to_list` members back it, the proposer
// included.

// The fixed list a brand's category comes from (WachuneedBrand::CATEGORIES).
export const BRAND_CATEGORIES = [
  'clothing',
  'art',
  'food',
  'home',
  'wellbeing',
  'outdoors',
  'other',
] as const;

export type BrandCategory = (typeof BRAND_CATEGORIES)[number];

export const isBrandCategory = (value: unknown): value is BrandCategory =>
  typeof value === 'string' &&
  (BRAND_CATEGORIES as readonly string[]).includes(value);

export interface ApiBrandFaceJSON {
  id: string;
  acct: string;
  display_name: string;
  avatar: string;
  avatar_static: string;
}

export interface ApiBrandJSON {
  id: string;
  name: string;
  url: string;
  why: string;
  category: BrandCategory | null;
  picture_url: string | null;
  backers_count: number;
  // How many backers a brand needs to be listed. From the server, so the
  // number lives in one place.
  backers_to_list: number;
  listed: boolean;
  // Whether you back it. The proposer always does.
  backed: boolean;
  // The proposer.
  can_edit: boolean;
  // The proposer, or staff.
  can_remove: boolean;
  // Who proposed it.
  account: ApiBrandFaceJSON;
  created_at: string;
  // One brand only (its page, and the edit form).
  picture_id?: string | null;
  backers?: ApiBrandFaceJSON[];
}

// `listed` (the Brands list, A to Z) or `proposed` (still gathering
// backers, newest first).
export type BrandsStatus = 'listed' | 'proposed';

export const apiGetWachuneedBrands = (status: BrandsStatus) =>
  apiRequestGet<ApiBrandJSON[]>(
    'v1/wachuneed/brands',
    status === 'proposed' ? { status } : undefined,
  );

export const apiGetWachuneedBrand = (id: string) =>
  apiRequestGet<ApiBrandJSON>(`v1/wachuneed/brands/${id}`);

export interface SaveBrandParams {
  name: string;
  url: string;
  why: string;
  category: BrandCategory | null;
  // An upload's id, or null to remove the picture. Omit to leave it.
  picture_id?: string | null;
}

export const apiCreateWachuneedBrand = (params: SaveBrandParams) =>
  apiRequestPost<ApiBrandJSON>(
    'v1/wachuneed/brands',
    params as unknown as Record<string, unknown>,
  );

// The proposer only.
export const apiUpdateWachuneedBrand = (id: string, params: SaveBrandParams) =>
  apiRequestPatch<ApiBrandJSON>(
    `v1/wachuneed/brands/${id}`,
    params as unknown as Record<string, unknown>,
  );

// The proposer, or staff. Its backings go with it.
export const apiRemoveWachuneedBrand = (id: string) =>
  apiRequestDelete(`v1/wachuneed/brands/${id}`);

export const apiBackWachuneedBrand = (id: string) =>
  apiRequestPost<ApiBrandJSON>(`v1/wachuneed/brands/${id}/backing`);

export const apiUnbackWachuneedBrand = (id: string) =>
  apiRequestDelete<ApiBrandJSON>(`v1/wachuneed/brands/${id}/backing`);
