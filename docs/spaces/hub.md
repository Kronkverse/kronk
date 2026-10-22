# Hub

**Manifest:** `config/korners/hub.yaml` (`core: true`, mount `/hub`) ·
**Node:** `hub.landing` · **Cross-cutting.**

## Purpose

Hub is where you find the korners. `/hub` is a grid of korner tiles; each
tile taps through to `/hub/<slug>`. Hub is a core space, not a korner: it
cannot be a tile inside itself and cannot be tuned out of. It owns no
tables.

Hub is one of the pillars in the top-level switcher
(`app/javascript/mastodon/features/ui/components/hub_switcher.tsx`), which
renders **Me · Home · Always was, always will be (`/awawb`) · Hub ·
Nudges**.

## The grid

`app/javascript/mastodon/features/hub/index.tsx`, styles in
`app/javascript/styles/mastodon/_hub_page.scss`.

- **Data.** `GET /api/v1/korners` returns every registered manifest with
  `tuned_in`, `tune_in_count` and an unread count. Hub drops `core`
  manifests client-side.
- **Order.** Alphabetical by name. Tune-in count was the order until
  2026-08-14; it made the grid reshuffle, so it was dropped.
- **Two boards.** Live korners first, then "coming soon". A korner is live
  if it is `enforced: true` or is a portal with a `portal.url` (YOU).
- **Tiles.** Square tile with the manifest icon (via `kornerIcon(slug)`),
  a hover-only settings gear, a tuned-in dot, and an unread count (see
  Updates). The hover tip is the manifest `tagline`.
- **"+" tile.** Always last on the live board. It opens the Kommons
  proposer in new-korner mode.
- **Layout.** 3 columns on mobile, 4 from 890px wide.

## Updates

The number on a tile, and on the korner in the side nav: how many updates
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
- **Kommunity:** someone new you could find there, a member who joined since
  you last looked. Who you could find follows their findability
  (`Account.kommunity_discoverable_to`), not who you follow. It has no posts,
  so "Since you were last here" shows the count only.

Elsewhere, only updates from people you follow or are Mates with count, and
never your own, replies, or ones you've already reacted to. Opening a korner
(`POST /api/v1/korners/:slug/seen`) moves your baseline to its newest update
and the number goes to zero. A korner you've never opened counts from when
you joined, not from everything ever posted.

**Since you were last here.** The same call answers with what it cleared:
`since_last_visit`, the count and the newest 20 updates as posts. Under the
header, on the korner's landing and its views, `<SinceLastVisit>`
(`components/since_last_visit.tsx`, mounted by `<Stage>`) shows them as the
feed's own cards: three, then "Show all", and how many more are further down
if there were over 20. It stays while you move between the korner's views and
goes when you hide it or reload. Moments has none: it's seen Moment by Moment
and never cleared on opening.

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
