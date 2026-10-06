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
  a hover-only settings gear, a tuned-in dot, and an unread count for
  new feed-visible content (`lib/kronk/korner_seen.rb`). The hover tip is
  the manifest `tagline`.
- **"+" tile.** Always last on the live board. It opens the Kommons
  proposer in new-korner mode.
- **Layout.** 3 columns on mobile, 4 from 890px wide.

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
- **The tune-in gate on the feed is off.** `Kronk::TuneInGate` only
  filters when the `tune_in_enforced` flag is on, and the flag is not set
  in `config/feature_flags.yaml`, so it resolves to off everywhere.

## History

Rewritten 2026-10-05 to describe what is built. Earlier designs and notes:
`git show 231cca937:docs/spaces/hub.md`.
