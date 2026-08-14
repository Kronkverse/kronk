# Profile

**Node bucket:** `profile` (Kronk::NodeRegistry) · **Cross-cutting** — not owned by a single korner manifest.

## Purpose

Profile is the surface for **a person on Kronk** — their public
identity, their sections (per-korner projections + curated
kategories + timeline), and, for the owner, the edit + connections
management flows.

In Kronk 2.0 the profile is _sectioned_ — content is organised by
korner projection + kategory pillar rather than a flat status stream.
The owner picks section order via the `profile_section_order`
column.

## Nodes in the Skeleton

Declared in `config/kronk_nodes.yaml` under the `profile` bucket:

- **`profile.view`** — public profile view (`/@:acct`).
- **`profile.edit`** — profile editor (owner only). Editing is Arrange mode
  on the shelved profile; the `/@:acct/edit` URL redirects to `/@:acct/shelves`
  (the standalone composer was retired).
- **`profile.sections`** — sectioned-profile / shelved-profile surface.
- **`profile.media`** — media gallery (`/@:acct/media`).
- **`profile.connections`** — followers/following (moving to _mates_
  vocabulary; see memory `reference_kronk_vocab_mates.md`).

## Anthemos direction

Self-shaped data (name, bio, avatar, verification, credentials) is
Anthemos-hosted once the membrane ships — projected through the
membrane on demand. Kronk stores the DID + routing pointer, not the
underlying identity data. See
`docs/rebuild/implementation_plan.md` and the profile prototype at
`docs/prototypes/kronk-profile-redesign.html` (already shows
"✓ Anthemos" chips).

## Status

Sectioned profile shipping incrementally (Phase 11) — Me tab
rendering landed via #352; further section-composer + reorder work
in flight.

_This is a stub. Contributions welcome._
