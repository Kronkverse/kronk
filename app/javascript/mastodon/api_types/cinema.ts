import type { ApiAccountJSON } from './accounts';

// Reach ladder. Matches Film#visibility in the Ruby model. Krew is not
// offered on Cinema in v1.
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
}

export interface FilmSummaryJSON {
  id: string;
  title: string;
  visibility: FilmVisibility;
  video_url: string | null;
  owner_acct: string;
}
