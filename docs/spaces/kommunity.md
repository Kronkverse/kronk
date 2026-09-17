# Kommunity

**Manifest:** `config/korners/kommunity.yaml` · **Mount:** `/hub/kommunity` · **Status:** live (bundled data) — Mates endpoint pending

> The whole Kronk follow graph as a 3D orb the user can spin, zoom,
> and explore. Every member is a node on a 150-socket Fibonacci
> sphere; every follow is a chord bowing through the interior.
> Density reads as brightness. The sky is the graph, seen from
> outside.

## Purpose

Kommunity lets a member see Kronk as a whole rather than as an
individual timeline. Node colour and size both carry connection
count, so the platform's shape reads at a glance — where the hubs
are, where the long tail sits, how the community distributes.
Selecting a node isolates its neighbourhood, dimming the rest of the
graph and drawing that member's direct chords bright.

**Kronk-local only.** Remote and federated accounts are out of scope
by design (Orb brief §Data).

## The shared skeleton

Kommunity and the ambient `KronkKosmos` background layer render from
the same geometry — the 150 Fibonacci sockets, the same chord
bezier curves, the same 10-stop cool→warm colour ramp indexed by
`log(1 + connections)`. If Kommunity moves, Kosmos follows for free.
The two rendering strategies differ:

- **Kommunity** — WebGL scene, full lines rendered, camera orbits
  around the sphere. Interactive.
- **Kosmos** — canvas 2D, sweeps a horizontal plane through the
  sphere once every ~10 minutes and paints each chord crossing as a
  faint star. Ambient. Never interactive.

Shared code: `app/javascript/mastodon/features/kosmos/orb_geometry.ts`.

## Data

- **Hook:** `useMatesOrb()` at `features/kosmos/use_mates_orb.ts`.
- **Payload:** `{ generated_at, socket_count, accounts[], follows[] }`
  per `KRONK_ORB_DATA_BRIEF.md`.
- **Current source:** bundled synthesised edge assignment against
  the real production degree sequence from 2026-07-19 (99 accounts,
  1103 follows). Density and rhythm true to the community; specific
  chord identities are placeholders.
- **Future source:** live `GET /api/v1/kronk/kommunity/orb` endpoint,
  shipped as part of the Mates proposal (Kommons #116990859270976043).
  Swap point is the hook — no other file changes.

Fields per `accounts[]`:

| field                     | notes                          |
| ------------------------- | ------------------------------ |
| `id`                      | snowflake, string-serialised   |
| `connections`             | drives node colour + size      |
| `following` / `followers` | detail tooltip                 |
| `interconnections`        | mutual follows, detail tooltip |
| `rank`                    | ordinal by connection count    |

`follows[]` is a flat array of `[source_id, target_id]` pairs.
Directed — reciprocal edges are two entries. Client-side dedupe for
the current focus-neighbourhood set only; ambient chords render every
edge.

## Interaction

- **Drag** — spin (theta/phi). Idle drift resumes when no other
  interaction has fired in the current mount.
- **Wheel / pinch** — zoom. Radius clamped to `[R·1.12, R·7.6]`.
- **Hover a node** — tooltip surfaces rank, connection count,
  follows-out / -in split, and mutual count.
- **Click a node** — isolates its neighbourhood: direct chords ramp
  to `FOCUS_OPACITY = 0.95`, all other nodes fade to `0.22`, the
  ambient chord set dims to `0.05`. Click empty space or select a
  different node to shift focus.

Reduced-motion:

- Idle drift disables.
- Camera easing to target still applies but with no automatic
  motion — the sphere stays where the user leaves it.

## Frame adherence (Standard L11)

- No local `<h1>` in the Kommunity feature — `AutoSpaceHeader` owns
  the title from the manifest.
- No local tab row — the manifest declares a single view (`orb`) so
  `AutoSpaceViewPicker` renders nothing today; adding a `list` or
  `roster` view later means adding one entry to `views:` in the
  manifest and one thunk to `KornerShell`.
- No tagline paragraph inlined — the manifest carries it.
- The three.js canvas lives inside the `Stage` cell of the Frame; the
  ambient `KronkKosmos` sky is behind that at `z-0` and paints
  through the canvas's transparent clear.

## Open

- **Persisted `socket_index` per account** — position as identity
  (Orb brief §Open). Currently even-stride placement, so a member's
  position shifts when the account roster changes; persisting a
  server-assigned socket index would keep everyone in the same spot
  on the sphere. Deferrable — cosmetic recognition improvement, no
  functional impact today.
- **Visibility** — the orb makes every follow list legible at once.
  Opt-in appearance? Locked accounts' edges? Members-only route?
  Needs settling before the real edge list from a live endpoint
  lands (the current synthesised data doesn't expose any real
  relationship).

## Not in this space

- The **Mates timeline tab** (per-member invite tree, mate + invitee
  rows over time) lives on the profile at `/@user/mates`, not here.
  See `KRONK_KOMMUNITY.md` (misleadingly named — it's the Mates
  timeline brief).
- The **Kosmos ambient layer** is at Frame level, not a korner; see
  `docs/kronk_frame.md § Kosmos`.

## Files

- `config/korners/kommunity.yaml` — manifest.
- `app/javascript/mastodon/features/kommunity/index.tsx` — mount.
- `app/javascript/mastodon/features/kommunity/orb.tsx` — three.js
  scene, camera, picking, focus highlight.
- `app/javascript/mastodon/features/kosmos/orb_geometry.ts` — shared
  geometry with Kosmos.
- `app/javascript/styles/mastodon/_kommunity.scss` — layer chrome
  (canvas positioning, tooltip, hint).
