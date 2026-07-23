# Kompass (`kompass`)

**Manifest:** `config/korners/kompass.yaml` · **Mount:** `/hub/kompass` · **Status:** stub (route ships a placeholder; no backend yet)

## Purpose

Kompass lets people **signal presence on their own terms** — who's
around, only if they choose to say. Every share is a deliberate act:
nothing is broadcast unless the user flips a toggle each session. The
manifest `hub_teaser`: *"Who's around, if they choose to say."*

## Current shape (1.7.x)

Manifest-declared, backend not built. What exists on this branch:

- **Manifest** — `config/korners/kompass.yaml`: `render_target: native`,
  `version: 0.0.0`, `enforced: false`.
- **Route** — `/hub/kompass` mounts `KompassStub`
  (`features/ui/index.jsx`); a placeholder.
- **No models yet** — planned primary resource `presence_states` under
  the `presence_` DB namespace (the manifest notes it *may become
  Redis-only* depending on retention).
- **Infrastructure-heavy** — presence needs real-time transport
  (WebSocket or similar) that hasn't been built; the manifest flags this
  as one of the more infrastructure-heavy 2.x korners.

## Rebuild vision (2.0.0)

- **No feed projection** — `feed_projection.card: null`; presence is not
  a feed item, by design.
- **Opt-in, per-session** — the `default_share_scope` setting gates who
  can see presence; `auto_expire_minutes` bounds how long a share lives.
- `emits: []` / `listens: []` — no cross-korner event wiring declared
  yet.

## Settings (manifest-declared)

- **`default_share_scope`** — enum `[none, friends, groups, kommunity]`,
  default `none`, user scope.
- **`auto_expire_minutes`** — integer, default `60`, user scope.

## Nodes

- **`kompass.index`** — `/hub/kompass`, `lifecycle: soon`, SPA.

## Related

- `../kronk_korner_spec.md` — the korner framework spec (§New korners).
- `../rebuild/implementation_plan.md` — the rebuild plan (Kompass presence + real-time infra).
- `config/korners/kompass.yaml` — the manifest this doc is drawn from.
