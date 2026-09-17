# Map (`map`)

**Manifest:** `config/korners/map.yaml` · **Mount:** `/hub/map` · **Status:** prototype (iframe surface; no backend yet)

> Renamed from **Kompass** → **Map** (its original Kommons-proposal name,
> #116969555027300161). The old `/hub/kompass` path 301-redirects to
> `/hub/map`.

## Purpose

Map lets people **signal presence on their own terms** — who's
around, only if they choose to say. Every share is a deliberate act:
nothing is broadcast unless the user flips a toggle each session. The
manifest `hub_teaser`: _"Who's around, if they choose to say."_

## Current shape (2.0.0)

Manifest-declared with a prototype front end; backend not built. What
exists on this branch:

- **Manifest** — `config/korners/map.yaml`: `render_target: native`,
  `version: 0.0.0`, `enforced: true`.
- **Route** — `/hub/map`, `/hub/map/treks`, `/hub/map/logger` all
  mount `MapV2` (`features/map_v2/`), which iframes the hand-authored
  prototype at `public/map-preview.html`. Frame chrome (space title,
  tagline, SpaceViewPicker pill) is provided by the Frame; the URL
  segment is forwarded into the iframe via `postMessage` so a tab
  switch swaps the lens without reloading. The surface is read-only
  until the backend lands.
- **Views** — `mates` (default), `treks`, `logger`; declared under
  `views:` in the manifest.
- **No models yet** — planned primary resource `presence_states` under
  the `presence_` DB namespace (the manifest notes it _may become
  Redis-only_ depending on retention).
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

- **`map.index`** — `/hub/map`, `lifecycle: soon`, SPA.

## Views

Declared under `views:` in the manifest; the Frame renders them as the
SpaceViewPicker pill on `/hub/map`:

- **`mates`** (default) — who's on the map right now (Leaflet canvas).
- **`treks`** — the caller's own routes and mates' shared routes.
- **`logger`** — the private capture surface (nothing shared until it
  is explicitly turned into a Trek).

## Related

- `../kronk_korner_spec.md` — the korner framework spec (§New korners).
- `../rebuild/implementation_plan.md` — the rebuild plan (Map presence + real-time infra).
- `config/korners/map.yaml` — the manifest this doc is drawn from.
