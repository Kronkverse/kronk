// The manifest JSON shape returned by /api/v1/korners.
// Mirrors Kronk::KornerRegistry::Manifest#to_h from the Ruby side.
//
// Any newly-added manifest field on the backend surfaces here; we
// keep types loose (Record<string, unknown>) for the structural blocks
// so we don't have to rev this file alongside every YAML edit.

export interface ApiKornerNotificationTypeJSON {
  name: string;
  subject_type?: string;
  default_push?: boolean;
  interactive?: boolean;
  aggregation?: string | Record<string, unknown>;
}

export interface ApiKornerSettingJSON {
  name: string;
  kind: string;
  default?: unknown;
  options?: unknown[];
  scope?: 'user' | 'steward' | string;
}

export interface ApiKornerResourceJSON {
  name: string;
  primary?: boolean;
}

export interface ApiKornerJSON {
  slug: string;
  name: string;
  icon?: string;
  render_target?: string;
  version?: string;
  resources?: ApiKornerResourceJSON[];
  storage?: Record<string, unknown> | null;
  security?: Record<string, unknown> | null;
  aesthetic?: Record<string, unknown> | null;
  notifications?: ApiKornerNotificationTypeJSON[];
  feed_projection?: Record<string, unknown> | null;
  settings?: ApiKornerSettingJSON[];
  emits?: string[];
  listens?: string[];
  hub_teaser?: Record<string, unknown> | null;
  launch?: Record<string, unknown> | null;
  feature_flag?: string | null;
  enforced?: boolean;
}
