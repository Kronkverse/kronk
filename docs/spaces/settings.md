# Settings

**Node bucket:** `settings` — its own core space (manifest
`config/korners/settings.yaml`, `core: true`, mount `/settings`). Every
personal/account `settings.*` section page sits **flat on the Settings limb**
(`config/kronk_nodes.yaml`) — the limb is the entry, so there is no `/settings`
landing node to open through; `settings.feed` and `settings.hub` stay in the
feed/hub buckets — a space configures itself in its own limb. **Cross-cutting.**

> Updated 2026-07-20. Settings previously had no honest home under the
> three-bucket scheme and was filed under `profile`; it now owns the `settings`
> bucket and a core-space manifest per the "every space gets a manifest"
> decision — see [`../rebuild/decisions.md`](../rebuild/decisions.md). (It read
> "`hub` sub-tree at `/settings/*`" before 2026-07-19, which was never true in
> the registry.)

## Purpose

Settings is the surface where users shape **how they experience
Kronk** — appearance, posting defaults, privacy, notifications,
data. It is both a hub and a contextual entry: `/settings` aggregates the
account/global controls, while each korner owns its own settings sub-page
under `/hub/<slug>/settings` and each core space configures itself in its own
limb (`settings.feed` → `/home/settings`, `settings.hub` → `/settings/korners`).

## Nodes in the Skeleton

Declared in `config/kronk_nodes.yaml`:

- **`settings.profile`** — profile settings entry.
- **`settings.sections`** — sectioned-profile section order + toggles.
- **`settings.prefs`** — general preferences.
- **`settings.you`** — the "Me"/You settings section (`/settings/you`,
  `lifecycle: live`, SPA).
- **`settings.appearance`** — theme, palette, font, scale (Personal
  Appearance layer — see `docs/kronk_aesthetic_system.md` §"Personal
  Appearance").
- **`settings.posting`** — post defaults (default visibility, poll
  defaults, kategory-taggability).
- **`settings.privacy`** — visibility scopes, block/mute lists,
  discoverability.
- **`settings.notifications`** — a standalone live page
  (`/settings/notifications`, `lifecycle: live`, SPA) for notification
  type toggles; not a per-korner surface.
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
