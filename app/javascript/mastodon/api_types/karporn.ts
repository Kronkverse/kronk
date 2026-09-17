import type { ApiAccountJSON } from './accounts';

export type KarVisibility = 'public' | 'orbit' | 'mates' | 'self_only';

export interface KarLocation {
  lat?: number;
  lng?: number;
  label?: string;
}

export interface ApiKarPhotoJSON {
  id: string;
  caption: string | null;
  position: number;
  url: string | null;
  created_at: string;
}

export interface ApiKarJSON {
  id: string;
  title: string;
  description: string | null;
  year: number;
  make: string;
  model: string;
  visibility: KarVisibility;
  photo_count: number;
  cover_url: string | null;
  is_owner: boolean;
  created_at: string;
  owner: ApiAccountJSON;
  photos: ApiKarPhotoJSON[];
  location: KarLocation | null;
}

export interface KarSummaryJSON {
  id: string;
  title: string;
  year: number;
  make: string;
  model: string;
  visibility: KarVisibility;
  photo_count: number;
  cover_url: string | null;
  owner_acct: string;
  location_label: string | null;
}
