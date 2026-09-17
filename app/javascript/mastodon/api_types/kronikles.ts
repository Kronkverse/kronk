import type { ApiAccountJSON } from './accounts';

// Reach ladder. Matches Chronicle#visibility in the Ruby model. Krew
// isn't offered on Kronikles in v1 (single-author korner).
export type ChronicleVisibility = 'public' | 'orbit' | 'mates' | 'self_only';

// Kind label — a display badge, not a schema constraint. Matches
// Chronicle#kind. `other` catches anything the six named kinds don't.
export type ChronicleKind =
  | 'essay'
  | 'short_story'
  | 'poetry'
  | 'letter'
  | 'journal'
  | 'other';

export interface ApiChronicleJSON {
  id: string;
  title: string;
  body: string; // raw markdown, no length limit
  excerpt: string;
  kind: ChronicleKind;
  visibility: ChronicleVisibility;
  is_owner: boolean;
  created_at: string;
  owner: ApiAccountJSON;
}

export interface ChronicleSummaryJSON {
  id: string;
  title: string;
  kind: ChronicleKind;
  visibility: ChronicleVisibility;
  excerpt: string;
  owner_acct: string;
}
