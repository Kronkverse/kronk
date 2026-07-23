# Moments (`moments`)

**Manifest:** `config/korners/moments.yaml` · **Mount:** `/hub/moments` · **Status:** stub (route ships a placeholder; no backend yet)

## Purpose

Moments makes space for the **ephemeral** — posts that are gone by
morning. You share something in the moment; it self-expires (default 24
hours) rather than accreting into a permanent timeline. The manifest
`hub_teaser` sums it up: *"Gone by morning."*

## Current shape (1.7.x)

Manifest-declared, backend not built. What exists on this branch:

- **Manifest** — `config/korners/moments.yaml`: `render_target: native`,
  `version: 0.0.0`, `enforced: false` (boot validator stays quiet until
  the models + composer land).
- **Route** — `/hub/moments` mounts `MomentsStub`
  (`features/ui/index.jsx`); a placeholder, not the real surface.
- **No models yet** — planned tables `moments`, `moment_views` under the
  `moment_` DB namespace; media under `spaces/moments/`.
- **Primary resource** — `moments`.

## Rebuild vision (2.0.0)

The 2.x build lands the models, the composer, and the surface:

- **Feed projection** — `moments_card` (to be built), titled from
  `caption`, `status_association: moment`, deep-linking to
  `/hub/moments/<id>`, `default_visibility: followers`.
- **Auto-expiry** — the per-user `auto_expire_hours` setting (default
  24) drives the "gone by morning" lifecycle.
- **View signalling** — the `notify_on_view` setting (default off) and
  the planned `moment_views` table.
- `emits: []` / `listens: []` — no cross-korner event wiring declared
  yet.

## Settings (manifest-declared)

- **`auto_expire_hours`** — integer, default `24`, user scope.
- **`notify_on_view`** — boolean, default `false`, user scope.

## Nodes

- **`moments.index`** — `/hub/moments`, `lifecycle: soon`, SPA.

## Related

- `../kronk_korner_spec.md` — the korner framework spec (§New korners; feed projection §8).
- `../rebuild/implementation_plan.md` — the rebuild plan (Moments models + composer).
- `config/korners/moments.yaml` — the manifest this doc is drawn from.
