# Settings

**Node bucket:** `hub` sub-tree at `/settings/*` (Kronk::NodeRegistry) · **Cross-cutting.**

## Purpose

Settings is the surface where users shape **how they experience
Kronk** — appearance, posting defaults, privacy, notifications,
data. Each korner also owns its own settings sub-page under
`/hub/<slug>/settings`; the top-level settings hub aggregates the
account/global controls.

## Nodes in the Skeleton

Declared in `config/kronk_nodes.yaml`:

- **`settings.profile`** — profile settings entry.
- **`settings.sections`** — sectioned-profile section order + toggles.
- **`settings.prefs`** — general preferences.
- **`settings.appearance`** — theme, palette, font, scale (Personal
  Appearance layer — see `docs/kronk_aesthetic_system.md` §"Personal
  Appearance").
- **`settings.posting`** — post defaults (default visibility, poll
  defaults, kategory-taggability).
- **`settings.privacy`** — visibility scopes, block/mute lists,
  discoverability.
- **`settings.notifications`** — notification type toggles per korner.
- **`settings.account`** — account-level (email, password, delete).
- **`settings.data`** — data export/import.
- **`settings.feed`** — feed display prefs (see PR #325 Feed surface
  UI).
- **`settings.hub`** — Hub landing prefs (Hub-tile ordering, per-korner
  tune-in gate).

## Cross-references

- Framework: `docs/kronk_korner_spec.md` §K "Settings space".
- Per-korner settings: each korner declares its own `settings:` block
  in its manifest; the settings kit renders them at
  `/hub/<slug>/settings`.
- IA reference: `docs/kronk_settings_ia.md`.

## Status

Registry-driven settings nav shipped (#326). Feed + You sections
rendering (#325 + #326). Further per-korner settings surfaces
scheduled per the implementation plan.

*This is a stub. Contributions welcome.*
