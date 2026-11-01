# Hub

**Manifest:** `config/korners/hub.yaml` (`core: true`, mount `/hub`) ·
**Node:** `hub.landing` · **Cross-cutting.**

## Purpose

**Retired as a page on 2026-11-01** (decisions.md, "Four sections"). `/hub`
redirects to **Explore** (`/explore`, `features/sections/explore.tsx`), which
took over the grid: the Moments strip, then the collections, then every korner
no section names yet under "Also on Kronk", then "Propose a new korner" (the
Kommons proposer in new-korner mode). Korners are still reached at
`/hub/<slug>`, and Hub is still a core space (`core: true`) whose manifest
gives its glyph to the Explore pillar.

The top-level switcher (`hub_switcher.tsx`) renders **YOU · Share · Always
was, always will be (`/awawb`) · Explore · Join**. A korner's space badge backs
out to its section (`features/sections/sections.ts`, `sectionOf`), not to the
Hub.

## Updates

The number on a korner's card in Explore and Join, and on the korner in the side nav: how many updates
there are since you last opened the korner. A badge counts updates, not
posts (decisions.md, 2026-10-19, "Hidden posts stay").

`Kronk::KornerSeen` (`lib/kronk/korner_seen.rb`) does the counting, the same
way for every korner. Each korner's adapter in `Kronk::KornerContentStreams`
says what an update is:

- **Default:** a post the korner made (`statuses.source_korner = <slug>`).
  Hidden posts never count, so an album photo is not an update. Albutts
  counts new albums and each "added N photos" post.
- **Kalendar:** an event post, until the event is over. Cancelled events
  don't count.
- **Moments:** each live Moment (it has no post of its own).
- **Map:** its trek posts, plus a Mate putting their pin on the map or
  moving it. A pin has no post, so it counts by when it moved (`placed_at`)
  against the time inside the baseline id.
- **Kommunity:** someone new you could find there, a member who joined since
  you last looked. Who you could find follows their findability
  (`Account.kommunity_discoverable_to`), not who you follow. It has no posts,
  so "Since you were last here" shows the count only.

Elsewhere, only updates from people you follow or are Mates with count, and
never your own, replies, or ones you've already reacted to. Opening a korner
(`POST /api/v1/korners/:slug/seen`) moves your baseline to its newest update
and the number goes to zero. A korner you've never opened counts from when
you joined, not from everything ever posted.

**No "since you were last here".** A strip under a korner's header showing
what opening it cleared was built (#2258) and taken out on 2026-10-22: it
got in the way. Opening a korner clears its number and shows the korner as
it is.

**Decided, not built.**

- **Changes as updates.** "An event you're going to changed" counts in
  Kalendar. Baselines are post ids, so a change needs its own record.

## Nodes

- **`hub.landing`** — `/hub`, declared in `config/kronk_nodes.yaml`.

Each korner declares its own `<slug>.index` node; those are documented in
that korner's doc in this folder.

## Open

- **Per-user ordering.** The backend exists: `UserHubOrder` and
  `GET|PUT|DELETE /api/v1/hub/order` (`Api::V1::Hub::OrdersController`).
  The grid does not call it, so a saved order has no effect, and there is
  no drag-to-arrange UI.
- **Tune-in counts are fetched but unused** by the grid. `Kronk::TuneInCounts`
  still computes them for `/api/v1/korners`.

## History

Rewritten 2026-10-05 to describe what is built. Earlier designs and notes:
`git show 231cca937:docs/spaces/hub.md`.
