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
// Kronk::KornerRegistry#normalize_icon. `text_glyph` was retired
// 2026-08-06 — SpaceBadge no longer renders a decorative letter.
export interface ApiKornerIconJSON {
  material?: string; // Material Symbols name (drives useKornerIcon)
  glyph_path?: string; // Optional line-art SVG path (Hub tile)
}

export interface ApiKornerViewJSON {
  key: string;
  label: string;
  // Optional Material Symbol name. When present, the SpaceViewPicker
  // renders the icon (with `label` as the aria-label + tooltip) instead
  // of the text label. Resolves via `useKornerIcon.tsx#MATERIAL_TO_ICON`.
  icon?: string;
  // Optional per-view tagline. When the manifest opts into
  // `header.rotator: true`, the `<AutoSpaceHeader>` rotates through
  // views and renders this text as the tagline under the face's
  // label. Falls back to the korner's top-level `tagline` if
  // absent. Ignored when the header rotator is off.
  tagline?: string;
}

export interface ApiKornerHeaderJSON {
  // When true, `<AutoSpaceHeader>` renders the korner's title as a
  // rotator (`<ScopeTitle>`) driven by the manifest's `views:` list
  // instead of a static `name + tagline`. Each view's `label` +
  // optional `tagline` become one face; the current URL segment
  // picks which face is front. The Standard's "one title per space"
  // rule (Korner Standard L11) is preserved — the rotator is the
  // title.
  rotator?: boolean;
  // Shape of the Frame's `<AutoSpaceViewPicker>`:
  //
  //   `pills` (default) — segmented pill row; every view is a
  //     visible button. Fits ≤3 views over the same material.
  //   `menu`            — compact dropdown; trigger shows the current
  //     face, tap opens a list. For korners whose views are
  //     genuinely separate workflows (Kommons: Feed / Backing /
  //     Tasks / Budget) or where the count exceeds a comfortable
  //     pill row.
  //
  // Ignored when `rotator` is on (the title carries the switch).
  picker?: 'pills' | 'menu';
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
  // Cross-korner attachments — `attaches:` names the (target, kind)
  // pairs this korner may source; `accepts:` names the (source, kind)
  // pairs it accepts as target. `'*'` wildcards allowed on either
  // side. See `docs/kronk_korner_attachments.md` §2.2.
  attaches?: {
    to: string;
    kind: 'spawn' | 'link' | 'reference';
    trigger?: string;
    lifecycle?: 'cascade' | 'keep';
  }[];
  accepts?: {
    from: string;
    kind: 'spawn' | 'link' | 'reference';
  }[];
  hub_teaser?: Record<string, unknown> | null;
  // SpaceNav view switcher — ordered; the first entry is the default
  // view (bare `/hub/<slug>`), the rest map to `/hub/<slug>/<key>`.
  // Drives both the nav picker and where the auto intro is shown.
  views?: ApiKornerViewJSON[];
  // Per-korner header configuration. Currently only `rotator` — opts
  // the `<AutoSpaceHeader>` into rendering as a `<ScopeTitle>` that
  // cycles through `views:`.
  header?: ApiKornerHeaderJSON;
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
  // Present when the korner is a portal — a Kronk-native landing that
  // links out to an external app (e.g. YOU at you.kronk.info). The Hub
  // treats portal korners as live regardless of `enforced` (portals
  // ship at enforced:false because they own no Kronk-side resources).
  portal?: { url: string } | null;
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
  // Count of new, feed-visible items in this korner the current viewer
  // hasn't seen yet — drives the unread badge on Hub tiles and the side
  // nav. Cleared by opening the korner or interacting with its posts in
  // your own feed. Absent/undefined for anonymous callers (treated as 0).
  // See lib/kronk/korner_seen.rb.
  unread_count?: number;
}
