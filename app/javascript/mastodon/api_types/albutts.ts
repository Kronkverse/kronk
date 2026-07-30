import type { ApiAccountJSON } from './accounts';

export type AlbumVisibility =
  | 'public'
  | 'orbit'
  | 'mates'
  | 'self_only'
  | 'krew';

export interface ApiAlbumPhotoJSON {
  id: string;
  caption: string | null;
  url: string | null;
  created_at: string;
  contributor: ApiAccountJSON;
  froths_count: number;
  comments_count: number;
  frothed: boolean;
}

export interface ApiAlbumPhotoCommentJSON {
  id: string;
  album_photo_id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  account: ApiAccountJSON;
  // Only present on root comments (one-level threading).
  replies?: ApiAlbumPhotoCommentJSON[];
}

export interface ApiAlbumJSON {
  id: string;
  title: string;
  description: string | null;
  visibility: AlbumVisibility;
  contributor_count: number;
  photo_count: number;
  cover_url: string | null;
  is_owner: boolean;
  can_contribute: boolean;
  created_at: string;
  owner: ApiAccountJSON;
  photos: ApiAlbumPhotoJSON[];
}

export interface AlbumSummaryJSON {
  id: string;
  title: string;
  visibility: AlbumVisibility;
  contributor_count: number;
  photo_count: number;
  cover_url: string | null;
  contributor_avatars: { id: string; acct: string; avatar: string }[];
}
