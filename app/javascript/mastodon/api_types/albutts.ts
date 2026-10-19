import type { ApiAccountJSON } from './accounts';
import type { ApiStatusJSON } from './statuses';

export type AlbumVisibility =
  | 'public'
  | 'orbit'
  | 'mates'
  | 'self_only'
  | 'krew';

// Split from `AlbumVisibility` on 2026-08-05 (docs/spaces/albutts.md
// (Who can add photos)). Mirrors the `Album#contribution` enum.
export type AlbumContribution =
  | 'open'
  | 'closed'
  | 'invited'
  | 'krew'
  | 'event';

// Since 2026-07-31 an AlbumPhoto is a thin join to a Status. The
// Status carries the caption (text), media, favourites (froths), and
// reply thread. `caption` + `url` are kept as top-level convenience
// fields — they mirror the linked Status.
export interface ApiAlbumPhotoJSON {
  id: string;
  caption: string | null;
  // The original file: for the lightbox and for downloading.
  url: string | null;
  // A small rendition, for grids. Absent on a server from before it.
  thumb_url?: string | null;
  // Bytes of the original file, for sizing a download.
  size?: number;
  created_at: string;
  contributor: ApiAccountJSON;
  status: ApiStatusJSON;
}

export type KrewAlbumAudience = 'krew' | 'everyone';

export interface ApiAlbumJSON {
  id: string;
  title: string;
  description: string | null;
  visibility: AlbumVisibility;
  contribution: AlbumContribution;
  // Additive contribution roster (2026-08-11). `contribution_open` is the
  // base (anyone who can see it may add); when false, the roster is the union
  // of `invited_contributor_ids` (people) and the members of
  // `contributor_krew_ids`. `krews` (audience) is exposed separately.
  contribution_open: boolean;
  contributor_krew_ids: string[];
  invited_contributor_ids: string[];
  // Audience Krews. The server only sends it when the album has any.
  krews?: { id: string; name: string; slug?: string; listed?: boolean }[];
  // A Krew album (docs/spaces/albutts.md, Krew albums) belongs to this Krew,
  // and is seen by the Krew or by everyone. Null for a personal album.
  krew_id?: string | null;
  krew_name?: string;
  audience?: KrewAlbumAudience | null;
  // What the viewer may do: edit (the owner, or any member of a Krew
  // album's Krew) and delete (the owner, or the Krew's sole member).
  can_manage?: boolean;
  can_delete?: boolean;
  contributor_count: number;
  photo_count: number;
  cover_url: string | null;
  // The cover the owner chose (a media attachment id), or null when the
  // first photo is standing in.
  cover_media_attachment_id?: string | null;
  is_owner: boolean;
  // Asking to add photos (docs/spaces/albutts.md): whether the viewer has
  // asked, and, for the owner, how many are asking. Album page only.
  contribution_requested?: boolean;
  contribution_requests_count?: number;
  can_contribute: boolean;
  created_at: string;
  owner: ApiAccountJSON;
  photos: ApiAlbumPhotoJSON[];
}

// An album as the list of albums sends it: everything but the photos, which
// only the album's own page needs.
export type ApiAlbumListItemJSON = Omit<ApiAlbumJSON, 'photos'>;

export interface AlbumSummaryJSON {
  id: string;
  title: string;
  visibility: AlbumVisibility;
  contributor_count: number;
  photo_count: number;
  cover_url: string | null;
  contributor_avatars: { id: string; acct: string; avatar: string }[];
}
