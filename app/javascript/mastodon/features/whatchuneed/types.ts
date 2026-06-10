export type ListingStatus = 'open' | 'fulfilled' | 'closed';

export type ListingCategory =
  | 'skills'
  | 'tools'
  | 'space'
  | 'transport'
  | 'food'
  | 'care'
  | 'knowledge'
  | 'other';

export interface AccountSummary {
  id: string;
  username: string;
  acct: string;
  display_name: string;
  avatar: string;
  avatar_static: string;
  url: string;
}

export interface WatchuNeedResponse {
  id: string;
  body: string;
  created_at: string;
  account: AccountSummary;
}

export interface WatchuNeedListing {
  id: string;
  title: string;
  body: string;
  category: ListingCategory | null;
  status: ListingStatus;
  response_count: number;
  created_at: string;
  account: AccountSummary;
  responses?: WatchuNeedResponse[];
}

export const CATEGORY_LABELS: Record<ListingCategory, string> = {
  skills: 'Skills',
  tools: 'Tools',
  space: 'Space',
  transport: 'Transport',
  food: 'Food',
  care: 'Care',
  knowledge: 'Knowledge',
  other: 'Other',
};
