# Map (`map`)

**Manifest:** `config/korners/map.yaml` · **Mount:** `/hub/map` · `enforced: true`

Renamed from **Kompass** to **Map**, its original Kommons-proposal name
(#116969555027300161). `/hub/kompass` redirects to `/hub/map`.

## Purpose

Map lets people **signal presence on their own terms**: where they are,
only if they choose to say, and only to their Mates. It also holds
**treks**, recorded walks, runs and rides that you can share with Mates.
Location never federates (`federates: false`).

## Views

The header rotator cycles three faces (manifest `views:`). Frontend is
`app/javascript/mastodon/features/map_v2/`.

- **Map** (`mates`, default, `/hub/map`) — a MapLibre map with your Mates'
  pins, a people strip (your own slot on top, then a face per pin; tap to
  centre), and upcoming Kalendar events as markers.
- **My treks** (`/hub/map/my-treks`) — your treks, drafts included.
- **Mates' treks** (`/hub/map/mates-treks`) — treks your Mates published.

Also: `/hub/map/treks/:id` (a trek's detail page; feed cards link here)
and `/hub/map/composer` (the trek composer in the shared compose-shell
overlay; `/hub/map/logger` and `/hub/map/treks` are legacy aliases).

The basemap is self-hosted OpenStreetMap: a Protomaps `.pmtiles` file in
DO Spaces, drawn in Kronk colours (`basemap.ts`). No third-party map
provider.

## Presence

You place a pin by searching for a place (`GET /api/v1/map/geocode`, a
server-side Nominatim proxy so your IP doesn't reach a third party; results
cached 24h). You can add a short note (60 characters, "Travelling China").

The privacy rules:

- **The raw point is never stored.** `PresenceState.place!` coarsens it
  first with `Kronk::GeoCoarsen` (`app/lib/kronk/geo_coarsen.rb`): round
  to a grid, then add jitter seeded by the account, so the pin is stable
  but not the exact spot. Tiers are `hood` (~600 m fuzz) and `city`
  (~6 km). The UI always sends `city`. An `exact` tier is deliberately
  absent until there's a home anchor to keep "exact" away from home.
- **Mates only.** `GET /api/v1/map/presence` returns pins with
  `share_scope: friends` from your Mates (mutual follows), nobody else.
  The controller builds each row by hand so it can't leak more than the
  coarsened point.
- **One pin per account, until you remove it.** Placing again replaces it.
  Pins don't auto-expire; `expires_at` is set a century out as a backstop.
  `placed_at` only moves when the coordinate changes, so "Here since June"
  survives a note edit.
- **Remove is a hard delete** (`DELETE /api/v1/map/presence`). No history
  table.

Model: `PresenceState` (`presence_states`, one row per account, cascades
with the account).

## Treks

A trek is a recorded activity: run, walk, hike, swim, ride or paddle. You
log one by hand or import a GPX/TCX file. The file is parsed in the
browser (`gpx.ts`); only `[lng, lat]` points and distance, time and climb
are sent. Heart rate, cadence, power and device fields are never read.

- **Route trimming.** `Kronk::RoutePrivacy.trim` drops the points within
  250 m of the start and end (usually home) and downsamples to at most 500
  points before storage. The full distance is kept as a stat.
- **Draft, then publish.** A trek starts as a private draft.
  `POST /api/v1/map/treks/:id/publish` posts a timeline Status at the
  reach you pick (`public`, `orbit`, `mates` or `self_only`; default
  `mates`) and links it via `status_id`. `unpublish` deletes that Status
  and returns the trek to draft.
- **Froth and comments** are a Favourite and replies on that Status.
- **Feed card.** `StatusTrekCard` (`source_korner == 'map'`), linking to
  `/hub/map/treks/<id>`.
- **Who sees what.** `Trek.feed_for(viewer)` is your own treks plus
  published treks by your Mates.

Model: `Trek` (`treks`).

## Events

`GET /api/v1/map/events` returns upcoming Kalendar events with a parseable
OpenStreetMap `location_url` that you're allowed to see. The event page's
location link goes to `/hub/map?event=<slug>`, which focuses that event.

## API

All under `/api/v1/map` (`config/routes/api.rb`): `presence` (index,
create, destroy), `presence/self`, `geocode`, `treks` (index, show,
create, destroy, publish, unpublish), `events`.

## Open

- **Manifest settings are unused.** `default_share_scope` and
  `auto_expire_minutes` are declared but nothing reads them. Pins default
  to Mates and never expire.
- **Unused share scopes.** `PresenceState` still has `groups` (meant for
  Krew) and `kommunity` (whole instance) in its enum. Neither is offered
  or shown; presence is Mates-only by decision.
- **The `hood` tier** exists server-side but the UI never offers it.
- **`/hub/map?lat=&lng=`** — Karporn links here with coordinates, but Map
  only reads `?event=`.
- **Leftover prototype.** `public/map-preview.html` is no longer loaded by
  the app.

## History

Rewritten 2026-10-05 to describe what is built. The earlier doc described
an iframe prototype with no backend. Earlier designs and notes:
`git show 231cca937:docs/spaces/map.md`.
