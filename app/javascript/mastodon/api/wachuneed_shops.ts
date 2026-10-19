import { apiRequestDelete, apiRequestGet, apiRequestPut } from 'mastodon/api';
import type { ApiListingJSON } from 'mastodon/api_types/wachuneed';

// Wachuneed shop fronts (docs/spaces/wachuneed.md, Shops): one seller's
// live offers on a page of their own, under sections they name.

export interface ApiShopSectionJSON {
  id: string;
  name: string;
}

export interface ApiShopJSON {
  id: string;
  name: string;
  description?: string | null;
  // The shop's own picture; the seller's avatar stands in when absent.
  picture_url?: string | null;
  listings_count: number;
  // Who may message the seller about a listing.
  enquiries: 'mates' | 'anyone';
  show_on_profile: boolean;
  // The town or area, under the shop's name.
  based_in?: string | null;
  // Cover photos of the shop's newest items, for its card and banner.
  // Older servers omit it.
  preview_photos?: string[];
  account: {
    id: string;
    acct: string;
    display_name: string;
    avatar: string;
    avatar_static: string;
  };
  // One shop only (the shop page and the owner's form), not the row.
  sections?: ApiShopSectionJSON[];
  listings?: ApiListingJSON[];
  picture_id?: string | null;
  // Said once for the shop, shown on every item of it.
  payment?: string | null;
  handover?: string | null;
  about?: string | null;
  // The shop page only: whether you may message the seller (their Mate, or
  // the shop takes enquiries from anyone).
  can_message?: boolean;
}

// Every shop with something on offer, your Mates' first: the Shops section,
// and the first few at the top of Offered.
export const apiGetWachuneedShops = () =>
  apiRequestGet<ApiShopJSON[]>('v1/wachuneed/shops');

// One shop, by the seller's username or account id. 404 when they have none.
export const apiGetWachuneedShop = (who: string) =>
  apiRequestGet<ApiShopJSON>(`v1/wachuneed/shops/${who}`);

// Your own, or null until you open one.
export const apiGetMyWachuneedShop = () =>
  apiRequestGet<ApiShopJSON | null>('v1/wachuneed/shop');

// What a profile shows: the shop's name, when its owner chose to show it.
export const apiGetProfileShop = (accountId: string) =>
  apiRequestGet<{ shop: { name: string; acct: string } | null }>(
    `v1/wachuneed/shops/${accountId}/profile`,
  );

export interface SaveShopParams {
  name: string;
  description?: string;
  // An upload's id, or null to go back to your avatar. Omit to leave it.
  picture_id?: string | null;
  enquiries?: 'mates' | 'anyone';
  show_on_profile?: boolean;
  payment?: string;
  handover?: string;
  based_in?: string;
  about?: string;
  // In order. A row with an id is kept (renamed, moved); one without is
  // new; a section left out is removed.
  sections?: { id?: string; name: string }[];
}

// Opens the shop the first time, saves changes after that.
export const apiSaveWachuneedShop = (params: SaveShopParams) =>
  apiRequestPut<ApiShopJSON>(
    'v1/wachuneed/shop',
    params as unknown as Record<string, unknown>,
  );

// Closes the shop. The listings stay exactly as they are.
export const apiCloseWachuneedShop = () =>
  apiRequestDelete('v1/wachuneed/shop');
