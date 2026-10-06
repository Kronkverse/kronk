# Kommunity

**Manifest:** `config/korners/kommunity.yaml` · **Mount:** `/hub/kommunity` · `enforced: true`

> The Kronk follow graph as a 3D orb you can spin, zoom and explore. Every
> member is a node on a 150-socket Fibonacci sphere; every follow is a
> chord bowing through the interior.

## Purpose

Kommunity lets a member see Kronk as a whole rather than as a timeline,
and find people they don't know yet. It has two views, cycled by the
header rotator: **Orb** (default) and **Discover**.

**Kronk-local only.** Remote accounts are out of scope by design. The
korner owns no tables; it reads accounts and follows.

## Orb

### Data

`GET /api/v1/kommunity/orb` (`Api::V1::Kommunity::OrbController`) returns
`{ generated_at, socket_count, accounts[], follows[] }`:

- **Accounts** — up to 150 local, active accounts, most-connected first
  (followers + following). "Active" means not suspended, silenced,
  memorialised or moved, with an approved, enabled user who has signed in
  at least once. Email confirmation is not required. The same filter
  backs Discover, so the two never disagree on who counts.
- **Per account** — `id`, `connections` (drives colour and size),
  `following` / `followers`, `interconnections` (mutual follows), `rank`.
- **Follows** — every follow between two orb members, as directed
  `[source_id, target_id]` pairs.

The response is cached for 5 minutes and busted when a user or a follow
between orb members changes, so a new signup shows up on the next fetch.

Every point is a real account. There is **no fallback fixture**: a
bundled synthesised graph was removed on 2026-08-28 because 99 invented
accounts drowned a real community of a few dozen. On failure the client
draws 150 dim empty sockets, which reads as room to grow. A sparse orb on
shadow is shadow's data, not a bug.

The client hook is `useMatesOrb()` in
`app/javascript/mastodon/features/kosmos/use_mates_orb.ts`.

### Interaction

`app/javascript/mastodon/features/kommunity/orb.tsx` (three.js):

- **Drag** — spin. Idle drift resumes when nothing else has happened.
- **Wheel / pinch** — zoom, clamped to `[R·1.12, R·7.6]`.
- **Hover a node** — rank, connections, follows out / in, mutuals.
- **Click a node** — isolates its neighbourhood: its chords go bright
  (`FOCUS_OPACITY = 0.95`), other nodes fade to 0.22, ambient chords dim
  to 0.05. Click empty space or another node to move focus.
- **Reduced motion** — no idle drift; the sphere stays where you leave it.

### Shared geometry with Kosmos

The ambient Kosmos background (`<KronkKosmos>`, a Frame layer, not a
korner) draws from the same data and the same geometry: the 150 sockets,
the chord curves, the cool-to-warm colour ramp indexed by
`log(1 + connections)`. Shared code is
`app/javascript/mastodon/features/kosmos/orb_geometry.ts`, so if the orb
changes, Kosmos follows. Kommunity is the interactive WebGL view; Kosmos
is a slow 2D projection that turns once every ~10 minutes. See
`docs/design.md` (Kosmos background canvas).

## Discover

A drawer of profile cards, one layer per screen, swiping sideways within
a layer (`features/kommunity/drawer.tsx`). Layers, top to bottom:

- **Kronkers** — `GET /api/v1/kommunity/kronkers`: people who set
  themselves findable by everyone.
- **Orbit** — `GET /api/v1/kommunity/orbit`: mates of your Mates, with
  findability `everyone` or `orbit`.
- **Krews** — `GET /api/v1/kommunity/krews`: people who share a Krew with
  you. No findability filter; sharing a Krew is already an introduction.

Every layer leaves out you and your existing Mates. Mates live on the
profile's Mates tab (`/@user/mates`), not here.

Each account chooses its findability with `kommunity_discoverability`
(`everyone`, `orbit` or `nobody`), set in privacy settings
(`features/privacy_settings/`). The older flat list,
`GET /api/v1/kommunity/discover`, is kept for external callers; the SPA
doesn't use it. `/directory` redirects to `/hub/kommunity/discover`.

## Files

- `config/korners/kommunity.yaml` — manifest.
- `app/javascript/mastodon/features/kommunity/` — `index.tsx` (mount),
  `orb.tsx`, `drawer.tsx`, `profile_card_deck.tsx`.
- `app/javascript/mastodon/features/kosmos/orb_geometry.ts` — shared with
  Kosmos.
- `app/controllers/api/v1/kommunity/` — `orb`, `layers`, `discover`.
- `app/javascript/styles/mastodon/_kommunity.scss`.

## Open

- **The orb ignores findability.** An account set to `nobody` is hidden
  from Discover but still a node on the orb, with its follows drawn.
  Whether the orb should respect the setting, or show locked accounts'
  edges, is undecided.
- **Stable positions.** Accounts are placed by rank, so a member's spot
  shifts when the roster changes. A stored per-account socket index would
  keep everyone in place. Cosmetic.
- **Stale manifest comment.** `config/korners/kommunity.yaml` still says
  the orb runs on a bundled synthesised graph pending a
  `/api/v1/kronk/kommunity/orb` endpoint. The live endpoint is
  `/api/v1/kommunity/orb` and the bundle is gone.

## History

Rewritten 2026-10-05 to describe what is built. Earlier designs and notes:
`git show 231cca937:docs/spaces/kommunity.md`.
