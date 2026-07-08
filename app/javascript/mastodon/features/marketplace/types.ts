export type MarketplaceCategory = 'creation' | 'marketplace' | 'service';

export type MarketplaceStatus = 'active' | 'paused' | 'sold' | 'archived';

export interface MarketplaceListingAccount {
  id: string;
  username: string;
  acct: string;
  display_name: string;
  avatar: string;
}

// Narrow subset of Mastodon's MediaAttachment shape — just the fields the
// marketplace UI actually renders. The full serializer returns more.
export interface MarketplaceMediaAttachment {
  id: string;
  type: 'image' | 'video' | 'gifv' | 'audio' | 'unknown';
  url: string | null;
  preview_url: string | null;
  description: string | null;
  blurhash: string | null;
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
  media_attachments: MarketplaceMediaAttachment[];
}
