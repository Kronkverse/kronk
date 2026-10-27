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

// A picture the body places between paragraphs, written there as
// `![caption](picture:<id>)`.
export interface ChroniclePictureJSON {
  id: string;
  url: string;
  preview_url: string;
  width: number | null;
  height: number | null;
}

// The Series a Kronikle is a chapter of (docs/spaces/kronikles.md, Series).
// `chapter_count` is the chapters you can see.
export interface ChronicleSeriesRefJSON {
  id: string;
  title: string;
  cover_url: string | null;
  chapter_count: number;
}

// Where a chapter sits, counted over the chapters you can see. Only on a
// single Kronikle, not in lists.
export interface ChronicleChapterJSON {
  number: number;
  count: number;
  previous_id: string | null;
  next_id: string | null;
}

export interface ApiChronicleSeriesJSON {
  id: string;
  title: string;
  description: string;
  cover_url: string | null;
  // The cover's upload id, for the owner only.
  cover_id?: string | null;
  chapter_count: number;
  is_owner: boolean;
  owner: ApiAccountJSON;
  created_at: string;
  updated_at: string;
}

export interface ApiChronicleJSON {
  id: string;
  title: string;
  body: string; // raw markdown, no length limit
  excerpt: string;
  kind: ChronicleKind;
  visibility: ChronicleVisibility;
  is_owner: boolean;
  pictures: ChroniclePictureJSON[];
  created_at: string;
  owner: ApiAccountJSON;
  // The Krews it is for, on top of its reach, named where you may see them.
  krews?: { id: string; name: string; slug?: string }[];
  series?: ChronicleSeriesRefJSON | null;
  chapter?: ChronicleChapterJSON | null;
}

export interface ChronicleSummaryJSON {
  id: string;
  title: string;
  kind: ChronicleKind;
  visibility: ChronicleVisibility;
  excerpt: string;
  owner_acct: string;
}
