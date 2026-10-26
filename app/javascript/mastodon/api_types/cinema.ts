import type { ApiAccountJSON } from './accounts';

// Reach ladder. Matches Film#visibility in the Ruby model. Krews are on
// top of it (`krews`, Kronk::KrewAudience).
export type FilmVisibility = 'public' | 'orbit' | 'mates' | 'self_only';

export interface ApiFilmJSON {
  id: string;
  title: string;
  description: string | null;
  visibility: FilmVisibility;
  video_url: string | null;
  is_owner: boolean;
  created_at: string;
  owner: ApiAccountJSON;
  // The Krews it is for, on top of its reach, named where you may see them.
  krews?: { id: string; name: string; slug?: string }[];
}

export interface FilmSummaryJSON {
  id: string;
  title: string;
  visibility: FilmVisibility;
  video_url: string | null;
  owner_acct: string;
}
