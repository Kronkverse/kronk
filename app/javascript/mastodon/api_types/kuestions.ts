// Kuestions v2 REST shapes. Backend:
// Api::V2::KuestionsController + nested Answers/Skips/DailyPrompt.

import type { ApiAccountJSON } from './accounts';

export type KuestionAnswerFormat = 'text' | 'mc' | 'yn';

export type KuestionVisibilityScope =
  | 'everyone'
  | 'kronk_members'
  | 'connections'
  | 'vouched'
  | 'only_me';

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

export interface ApiKuestionJSON {
  id: string;
  title: string;
  prompt: string | null;
  answer_format: KuestionAnswerFormat;
  mc_options: ApiKuestionMcOption[];
  locked: boolean;
  has_answered: boolean;
  answers_count: number;
  created_at: string;
  asker: ApiAccountJSON;
  // Only present on the detail (`show`) endpoint, and only when the
  // gate is open (viewer has answered or Question is unlocked).
  answers?: ApiKuestionAnswerJSON[];
  aggregate?: ApiKuestionAggregateEntry[];
}

export interface ApiKuestionDailyPromptJSON {
  date: string;
  prompt: string | null;
}
