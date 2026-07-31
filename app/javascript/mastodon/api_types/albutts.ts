import type { ApiAccountJSON } from './accounts';
import type { ApiStatusJSON } from './statuses';

export type AlbumVisibility =
  | 'public'
  | 'orbit'
  | 'mates'
  | 'self_only'
  | 'krew';

// Since 2026-07-31 an AlbumPhoto is a thin join to a Status. The
// Status carries the caption (text), media, favourites (froths), and
// reply thread. `caption` + `url` are kept as top-level convenience
// fields — they mirror the linked Status.
export interface ApiAlbumPhotoJSON {
  id: string;
  caption: string | null;
  url: string | null;
  created_at: string;
  contributor: ApiAccountJSON;
  status: ApiStatusJSON;
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
