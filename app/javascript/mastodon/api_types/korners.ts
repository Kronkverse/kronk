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
  scope?: string;
  // Optional label / description — either an i18n message id (spec §K.5)
  // or a plain display string.
  label?: string;
  description?: string;
  // Kind-dependent constraints (spec §K.5).
  min?: number;
  max?: number;
  step?: number;
  max_length?: number;
}

export interface ApiKornerResourceJSON {
  name: string;
  primary?: boolean;
}

export interface ApiKornerComposeJSON {
  label: string;
  route: string;
}

// Manifest `icon:` is normalized server-side into an object shape.
// Legacy string form is coerced into `{ material }` in
// Kronk::KornerRegistry#normalize_icon.
export interface ApiKornerIconJSON {
  material?: string; // Material Symbols name (drives useKornerIcon)
  glyph_path?: string; // Optional line-art SVG path (Hub tile)
  text_glyph?: string; // Optional single-char breadcrumb glyph
}

export interface ApiKornerViewJSON {
  key: string;
  label: string;
}

export interface ApiKornerJSON {
  slug: string;
  name: string;
  icon?: ApiKornerIconJSON;
  render_target?: string;
  version?: string;
  resources?: ApiKornerResourceJSON[];
  storage?: Record<string, unknown> | null;
  security?: Record<string, unknown> | null;
  aesthetic?: Record<string, unknown> | null;
  notifications?: ApiKornerNotificationTypeJSON[];
  feed_projection?: Record<string, unknown> | null;
  settings?: ApiKornerSettingJSON[];
  compose?: ApiKornerComposeJSON | null;
  emits?: string[];
  listens?: string[];
  hub_teaser?: Record<string, unknown> | null;
  // SpaceNav view switcher — ordered; the first entry is the default
  // view (bare `/hub/<slug>`), the rest map to `/hub/<slug>/<key>`.
  // Drives both the nav picker and where the auto intro is shown.
  views?: ApiKornerViewJSON[];
  launch?: Record<string, unknown> | null;
  // Space page — the evolutionary purpose ("why this space exists") and the
  // handle of its steward. Both optional; declared in the manifest.
  purpose?: string | null;
  // Display-voice intro line shown under the space title (`<SpaceHeader>`).
  // Distinct from `purpose` (the mission "why") — this is user-facing copy.
  tagline?: string | null;
  steward?: string | null;
  // Where the space actually lives (a core space declares it, e.g. `/nudges`).
  // Absent for korners, which default to `/hub/<slug>`.
  mount?: string | null;
  feature_flag?: string | null;
  enforced?: boolean;
  // Core spaces (feed / profile / hub / nudges / settings) are part
  // of the platform rather than korners — no Hub tile, no tune-out.
  // /api/v1/korners still returns them so useKornerIcon /
  // AutoSpaceBadge can resolve their identity; consumers that render
  // the Hub grid filter `core === true` out.
  core?: boolean;
  // Populated by /api/v1/korners for the current viewer. Anonymous
  // callers get `true`. Toggle via POST/DELETE /api/v1/korners/:slug/tune_out.
  tuned_in?: boolean;
  // Aggregate number of accounts tuned in to this korner. Powers the
  // default Hub grid ordering. See lib/kronk/tune_in_counts.rb.
  tune_in_count?: number;
}
