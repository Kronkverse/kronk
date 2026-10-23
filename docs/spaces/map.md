# Map (`map`)

**Manifest:** `config/korners/map.yaml` · **Mount:** `/hub/map` · `enforced: true`

Renamed from **Kompass** to **Map**, its original Kommons-proposal name
(#116969555027300161). `/hub/kompass` redirects to `/hub/map`.

## Purpose

Map lets people **signal presence on their own terms**: where they are,
only if they choose to say, and only to their Mates. It also holds
**treks**, recorded walks, runs and rides that you can share with Mates,
and **Places**, exact spots with an address that anything on Kronk can
Konnect to. Location never federates (`federates: false`).

## Views

The header rotator cycles three faces (manifest `views:`). Frontend is
`app/javascript/mastodon/features/map_v2/`.

- **Map** (`mates`, default, `/hub/map`) — a MapLibre map with your Mates'
  pins, a people strip (a face per pin, your own slot last; tap to
  centre), upcoming Kalendar events as markers, and Places.
- **Mates' treks** (`/hub/map/mates-treks`) — treks your Mates published.
- **My treks** (`/hub/map/my-treks`) — your treks, drafts included. Last,
  after your Mates' (Kommons "Treks list of Mates before Mine",
  2026-10-21).

Also: `/hub/map/treks/:id` (a trek's detail page; feed cards link here),
`/hub/map/composer` (the trek composer in the shared compose-shell
overlay; `/hub/map/logger` is a legacy alias for it), and for Places
`/hub/map/places/:id` (a Place's page) and `/hub/map/places/new` (the
Place composer). The legacy bare
`/hub/map/treks` opens **My treks**.

The basemap is self-hosted OpenStreetMap: a Protomaps `.pmtiles` file in
DO Spaces, drawn in Kronk colours (`basemap.ts`). No third-party map
provider.

### First Nations Country

A **First Nations Country** button under the zoom buttons (Kommons, @mangobee,
2026-10-23) lays a map of the Countries of Aboriginal and Torres Strait
Islander peoples over Australia, under the pins. Off until you turn it on; the
choice is kept in your browser (`kronk.map.country_layer`). While it is on, a
note under the button credits the map to @mangobee and says the boundaries are
approximate.

It is a picture (`app/javascript/images/first-nations-country.webp`, a MapLibre
`image` source over 111.5°E–155°E, 8.8°S–44.6°S), not data. @mangobee drew
it in a Lambert conformal conic projection (standard parallels −18° and −36°);
it was fitted to 21 towns marked on it (about 4 px off on average) and redrawn
into web mercator, with the white paper taken out by colour-to-alpha (so the
lettering keeps no white fringe). The Country colours are baked in at 75%
while the names, town dots and coastline stay at full strength (@mangobee,
2026-10-23: calmer, but still readable; then 75%, and the picture redrawn
at 3600 px wide with lossless edges so the small names pixelate less). It fades out between zoom 7 and 9,
where the picture would blur. Because it is a picture it can't tell you which Country a
point is on; see `decisions.md`, 2026-10-23.

## Presence

You place a pin by searching for a place (`GET /api/v1/map/geocode`, a
server-side Nominatim proxy so your IP doesn't reach a third party; results
cached 24h). You can add a short note (60 characters, "Travelling China").

You are the last face in the Mates list (Tal, 2026-10-17; it was the first,
and the Ж menu had an **Edit location** moon too, now gone). Before you have
a pin it is the pin icon, **Put me on the map**. Once you have one it is your
avatar, which centres the map on you, with two small badges: the pencil,
**Move my pin**, which opens the same search starting from the note you
already have, and ×, **Remove me from the map**. That slot is the one way to
place or move your pin: your pin's card had a **Change location** button for
a day, removed as a duplicate (Tal, 2026-10-12).

**Asking someone to update.** A Mate's pin card has **Out of date? Ask for an
update** (Tal, 2026-10-12). It sends them a Nudges notification with your
name, "Ana thinks your pin on the Map is out of date", which opens the Map
with the place search up (`/hub/map?place=1`). Once a week per person, held
as a Redis key with a seven-day life (`POST
/api/v1/map/presence/:account_id/challenge`, event `map.pin.challenged`). It
only works on a pin you can already see.

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

A trek is a recorded activity: run, walk, hike, swim, ride, paddle or
motorbike (which shows speed, not pace). You
log one by hand or import a GPX/TCX file. The file is parsed in the
browser (`gpx.ts`); only `[lng, lat]` points and distance, time and climb
are sent. Heart rate, cadence, power and device fields are never read.

- **When it happened.** `recorded_at` is the day of the trek, not the day
  it was logged. The composer has a date field, filled from the GPS file's
  first timestamp when it has one, and the feed card and trek page show it.
  A future date is stored as now. It does not move the post on the timeline.
- **Route trimming.** `Kronk::RoutePrivacy.trim` drops the points within
  250 m of the start and end (usually home) and downsamples to at most 500
  points before storage. The full distance is kept as a stat.
- **Draft, then publish.** A trek starts as a private draft.
  `POST /api/v1/map/treks/:id/publish` posts a timeline Status at the
  reach you pick (`public`, `orbit`, `mates` or `self_only`; default
  `mates`) and links it via `status_id`. `unpublish` deletes that Status
  and returns the trek to draft.
- **Froth and comments** are a Favourite and replies on that Status, shown
  on the trek page with the shared reactions bar and reply thread
  (`StatusEngagement`), as on every other space.
- **Feed card.** `StatusTrekCard` (`source_korner == 'map'`), linking to
  `/hub/map/treks/<id>`.
- **Who sees what.** `Trek.feed_for(viewer)` is your own treks plus
  published treks by your Mates.

Model: `Trek` (`treks`).

## Places

A Place is an exact spot with a name and an address: a venue, a park, a
workshop. It is **Map's linkable record**: a location is a Konnection to a
Place, not a field on each space's record (decisions.md, 2026-10-23).
Model: `MapPlace` (`map_places`: `name` up to 120, `address`, `latitude`
and `longitude` as exact decimals, `account_id` of its maker).

- **A Place is seen by whoever can see something Konnected to it, and its
  maker** (`MapPlace#visible_to?`, Tal 2026-10-23). It has no audience of
  its own: a Place linked from a Mates-only party is seen by that party's
  Mates, one linked from a public event by every member, and one with
  nothing Konnected by its maker alone. "Can see" is the linked record's
  own rule (`Kronk::KornerRecords.visible?`). One you can't see answers
  404 everywhere (its page, `GET /places/:id`, the map, the Konnect
  picker), so a guessed id says nothing. It says where something is, never
  who is there: presence (people's pins) is separate, Mates-only and
  coarsened, and never takes part in Konnecting.
- **Its maker looks after it**: they edit and delete it and decide what it
  links out to. Anyone who can see a Place can Konnect their own record to
  it (which widens who sees it to that record's audience). If the maker's
  account goes, the Place stays (`account_id` is nulled).
- **How lists check it.** Who sees a linked event or album has no SQL
  form, so a list reads Places the viewer made or that have any
  Konnection (`made_or_konnected`, at most 1000 rows, after the box or
  search narrows them), loads their Konnections in one query, and checks
  each in Ruby (`MapPlace.visible_among`). The Konnect picker does the
  same through `KornerRecords::FOUND_BY`.
- **Konnecting.** `map.yaml`'s primary resource is `map_places` (`path:
/hub/map/places/:id`), with `attaches:`/`accepts:` links to and from
  anything, so `KornerRegistry.model_for('map')` is `MapPlace` and every
  `map/<id>` attachment end is a Place. Presence and treks are listed
  resources but never primary, so they never resolve as one. The Konnect
  picker finds Places by name or address and shows the address under the
  name.
- **On the Map.** A Places layer (`place_layer.tsx`) draws the Places in
  view as pin glyphs, reloading as the map moves. Tapping one opens a card
  with its address and what's Konnected to it (both ways), and a link to
  its page. `/hub/map?place=<id>` flies to a Place and opens its card.
- **Its page** (`place_page.tsx`) is a `<KornerDetail>`: the pin as hero
  (`<MapPinPreview>`), the address, who added it, See on the map, Delete
  for its maker, and the Konnected block.
- **Making one.** `/hub/map/places/new` (`place_composer.tsx`, in
  `<ComposeShell>`): a name, an address, and a pin from the shared
  `<MapPinPicker>` (search an address, or tap the map; a pin dropped on a
  search result fills the address and name). Without a pin, the server
  looks the address up (`Kronk::Geocoder`) and refuses one it can't find.
  Opened with `?konnect=<slug>:<id>`, it links that record to the new
  Place once it is made, then opens the Place. The Ж bubble still logs a
  trek (`compose:`); the Place composer is reached from a Konnect (the
  manifest's `konnect: { make: true, route: /hub/map/places/new, label:
'New place' }`), or by its URL.
- **New place, from a composer.** Composers have no location fields
  (decisions.md, 2026-10-23, "Location fields become Konnect → Map"). In
  a composer's Konnect picker, Map offers **New place**: a small form in
  the picker (`components/konnect_new_place.tsx`: name, an optional
  address, **Pin on the map**) makes the Place at once and picks it, and
  the record links to it when it posts. It needs an address or a pin.
- **Where a record is.** Whatever reads a location falls back to the
  record's Konnected Place when its own old fields are empty
  (`Kronk::RecordPlace`; own fields still win, for older records and the
  Android app): an event's `location_name` (the Place's name) and
  `location_url` (an OpenStreetMap link to its point), a kar's `location`
  (`{ lat, lng, label }`), a listing's `location`, and the event pins
  below. Only a link the record's owner made counts, either way round;
  the oldest wins. Lists read the Places in two queries
  (`Kronk::RecordPlace.preload`); an event inside a status reads its own
  when it has no location.
- **Pins moved over.** Migration `20261023140100` gave every pinned event
  (`location_url` an OpenStreetMap pin) and every kar with coordinates a
  Place and a link to it, whatever its reach: the Place is seen by whoever
  sees the record. One owner's records with the same name at the same spot
  share a Place; different owners' never do. The old columns stay.

API, all under `/api/v1/map/places`: `GET` (with `bbox=<west>,<south>,
<east>,<north>`, or `near=<lat>,<lng>` and `radius_km`, and `q` for name or
address), `GET /:id`, `POST` (`name`, `address`, `latitude`, `longitude`;
or `name` and `address` alone), `PATCH` and `DELETE` (the maker only).

## Events

`GET /api/v1/map/events` returns upcoming Kalendar events you're allowed to
see that have a parseable OpenStreetMap `location_url`, or no `location_url`
and a Konnected Place (pinned at the Place, with its name). The event page's
location link goes to `/hub/map?event=<slug>`, which focuses that event.

## API

All under `/api/v1/map` (`config/routes/api.rb`): `presence` (index,
create, destroy), `presence/self`, `geocode`, `treks` (index, show,
create, destroy, publish, unpublish), `events`, `places` (index, show,
create, update, destroy).

## Open

- **The old location columns stay.** `events.location_name` /
  `location_url`, `kars.location_*` and `listings.location` are read first
  and still written by the Android app; they go once it stops. An event
  with both a pin of its own and a Place shows the pin.
- **No editing a Place in the app yet.** `PATCH` exists; the page only
  offers Delete.

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
