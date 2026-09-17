# Klot (`klot`)

**Manifest:** `config/korners/klot.yaml` · **Mount:** `/hub/klot` · **Status:** manifest-only on this branch — runtime lives on the `dev/tbone` contributor branch (live on shadow, **not** on `main`/`rebuild`). There is **no `/hub/klot` route and no models** on this branch; the manifest was retroactively authored from that shipped code.

## Purpose

Klot is a **private menstrual-cycle tracker** with **phase-only
sharing**: kronkers share the _phase_ of their cycle, not the data. The
sovereignty contract is the whole point — raw dates never leave the
owner's account; at most a phase name + moon glyph reaches an explicitly
authorized viewer.

## Current shape

- **Manifest** — `config/korners/klot.yaml`: `render_target: native`,
  `version: 0.1.0`, `icon: nights_stay`, `enforced: false` (the boot
  validator skips it because the runtime lives on a contributor dev
  branch, not here).
- **Runtime (on `dev/tbone`, not this branch)** — a bespoke
  `Api::V1::Klot::PhasesController` + `KlotShareSerializer` enforce the
  phase-only endpoint; models `klot_periods`, `klot_settings`,
  `klot_shares` under the `klot_` DB namespace.
- **Resources** — `periods` (primary; user-logged start dates),
  `settings` (per-account cycle/period length), `shares` (allowlist of
  viewer accounts), and `phases` (not a table — a synthesized read-only
  projection endpoint).

## Security & sharing (manifest-declared)

- **Bespoke capability** — a `klot_phase_viewer` scope, today enforced by
  an ownership check + the `KlotShare` allowlist; a sanctioned exception
  that migrates onto the shared authorization layer (spec §7) when it
  lands. `federates: false` — explicitly local-only.
- **No feed projection** — `feed_projection.card` is deliberately null;
  Klot is a body-data korner and refuses to project. Framework
  conformance here is _refusing_ the projection.
- **No subscription** — the `subscription` primitive is n/a; the
  per-viewer, revocable, owner-controlled `KlotShare` table is the
  correct primitive instead.

## Settings (manifest-declared)

- **`cycle_length_days`** — integer, default `28` (20–45), user scope.
- **`period_length_days`** — integer, default `5` (2–10), user scope.
- **`share_phase_publicly`** — boolean, default `false`, user scope. Even
  when on, only accounts granted a `KlotShare` see the phase; raw dates
  never leave the account. Surfaced at `/hub/klot/settings` (spec §K.3.3).

## Nodes

- **`klot.index`** — `/hub/klot`, `lifecycle: soon`, SPA.

## Related

- `../kronk_korner_spec.md` — the korner framework spec (security §7; settings §K).
- `../rebuild/implementation_plan.md` — the rebuild plan (Klot landing from `dev/tbone`).
- `config/korners/klot.yaml` — the manifest this doc is drawn from.
