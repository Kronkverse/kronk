export type MarketplaceCategory = 'creation' | 'marketplace' | 'service';

export type MarketplaceStatus = 'active' | 'paused' | 'sold' | 'archived';

export interface MarketplaceListingAccount {
  id: string;
  username: string;
  acct: string;
  display_name: string;
  avatar: string;
}

export interface MarketplaceListing {
  id: string;
  title: string;
  description: string;
  category: MarketplaceCategory;
  subcategory: string | null;
  price_display: string | null;
  price_numeric: string | null;
  location: string | null;
  status: MarketplaceStatus;
  created_at: string;
  updated_at: string;
  account: MarketplaceListingAccount;
}
