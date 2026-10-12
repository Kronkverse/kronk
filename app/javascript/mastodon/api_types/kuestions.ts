// Kuestions v2 REST shapes. Backend:
// Api::V2::KuestionsController + nested Answers/Skips/DailyPrompt.

import type { ApiAccountJSON } from './accounts';

export type KuestionAnswerFormat = 'text' | 'mc' | 'yn';

// Profile Kuestions are answered for a profile, not a deck: typed answers
// the profile reads (a list splits on commas or new lines, a date is
// YYYY-MM-DD).
export type KuestionProfileFormat =
  | 'text'
  | 'longtext'
  | 'list'
  | 'link'
  | 'date';

export type KuestionTileSize = 's' | 'm' | 'l' | 'xl';

// Four-tier reach ladder (docs/spaces/feed.md (The reach ladder)). Matches
// Album/Moment/Status. The pre-2026-07-29 vocabulary
// (everyone/kronk_members/connections/vouched/only_me) retired in
// slice 4 of the visibility standardisation; the migration remaps
// stored values.
export type KuestionVisibilityScope =
  | 'public'
  | 'orbit'
  | 'mates'
  | 'self_only';

export interface ApiKuestionMcOption {
  label: string;
}

export interface ApiKuestionAnswerJSON {
  id: string;
  body: string;
  choice_index: number | null;
  visibility_scope: KuestionVisibilityScope;
  mine: boolean;
  edited: boolean;
  edit_history: {
    body: string;
    choice_index: number | null;
    edited_at: string;
  }[];
  created_at: string;
  updated_at: string;
  account: ApiAccountJSON;
}

export interface ApiKuestionAggregateEntry {
  label: string;
  count: number;
  voters: {
    id: string;
    acct: string;
    display_name: string;
    avatar: string;
  }[];
}

interface ApiKuestionBaseJSON {
  id: string;
  title: string;
  prompt: string | null;
  mc_options: ApiKuestionMcOption[];
  locked: boolean;
  has_answered: boolean;
  asked_by_me: boolean;
  answers_count: number;
  created_at: string;
}

// A community Kuestion: asked by a member, answered in the deck, locked
// until you answer. Every list but the Profile view holds only these.
export interface ApiKuestionJSON extends ApiKuestionBaseJSON {
  kind: 'community';
  answer_format: KuestionAnswerFormat;
  asker: ApiAccountJSON;
  // Only on the Answered list (`filter: 'involved'`); null if the viewer
  // asked it but hasn't answered.
  my_answer?: { body: string; choice_index: number | null } | null;
  // Only present on the detail (`show`) endpoint, and only when the
  // gate is open (viewer has answered or Question is unlocked).
  answers?: ApiKuestionAnswerJSON[];
  aggregate?: ApiKuestionAggregateEntry[];
}

export interface ApiProfileKuestionAnswer {
  body: string;
  pinned: boolean;
  visibility_scope: KuestionVisibilityScope;
  size: KuestionTileSize | null;
}

// A profile Kuestion (`filter: 'profile'`): one you answer for your
// profile and pin there. Kronk's own have no asker and carry a `seed_key`,
// a short `label` and the `group` they sit under in the Profile view.
export interface ApiProfileKuestionJSON extends ApiKuestionBaseJSON {
  kind: 'profile';
  answer_format: KuestionProfileFormat;
  asker: ApiAccountJSON | null;
  seed_key: string | null;
  label?: string;
  group?: string;
  my_answer: ApiProfileKuestionAnswer | null;
}

export interface ApiKuestionDailyPromptJSON {
  date: string;
  prompt: string | null;
}
