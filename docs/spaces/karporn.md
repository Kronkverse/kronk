# Karporn (`karporn`)

**Manifest:** `config/korners/karporn.yaml` · **Mount:** `/hub/karporn` · **Status:** open (PR #1809, 2026-09-11) — model + composer + viewer + feed card built to the same shape as Art. Awaits merge queue.

## Purpose

Karporn is a house for **photos of cars**. Same Albutts / Art shape (single-author + photos-per-post) with vehicle-specific metadata (year, make, model) and an optional map-location tag. The point is a simple, focused surface for the "look at this thing I saw / owned / drove" moment — a status post is the wrong shape (the year/make/model wants to be structured; the location wants to be pinnable).

Deliberately narrow: this korner is for photos of cars, not car reviews, not classified sales, not motorsport livestreams. Those are different shapes.

## What a Kar is

- **Title** — required, up to 240 chars. Free-form so the author can pick the framing ("Pinstripe on a '68 Camaro", "Sunday morning at Goodwood").
- **Description** — optional, up to 4000 chars. Plain text.
- **Year** — required integer. Validated `1885..(Time.current.year + 2)` (Benz Patent-Motorwagen was 1885; +2 gives headroom for MY-tagged concept cars posted before the model year turns over).
- **Make** — required string, up to 120 chars. Free-form.
- **Model** — required string, up to 120 chars. Free-form.
- **Photos** — zero or more, ordered by `position`; first photo becomes the cover unless overridden. Same shape as `ArtPiecePhoto` — captions on the row, no per-photo Status backing.
- **Location** — optional. Three fields:
  - `location_lat` (decimal 9,6) — nullable
  - `location_lng` (decimal 9,6) — nullable
  - `location_label` (string 240) — nullable, human-readable ("Nürburgring", "Route 66 outside Kingman")

  Lat/lng have to arrive together; a bare lat or lng without its pair is rejected by the model's `location_coords_are_paired` validator. The label can stand alone (just a place name, no pin).

- **Visibility** — `public / orbit / mates / self_only`. No krew scoping.

## Location UX

The composer's location block is deliberately minimal in v1:

- A free-text **label** input ("Where was it?").
- A **Use my current location** button that calls `navigator.geolocation.getCurrentPosition` and stores the returned lat/lng (rounded to 6 decimal places — DB `decimal(9,6)` precision). Once captured, the coords are shown ("Coordinates captured — 51.5074, -0.1278") with a clear button.

No map picker in v1. A proper picker belongs to the Map korner and comes later. The label is what shows on the feed card; the coordinates power the "Open in Map" link on the viewer.

## Where you see Karporn

- **`/hub/karporn` directory** — a grid of kar cards (cover + title + "year make model" + photo count · optional location label). Rotator faces: **All / Mine / Mates'**.
- **`/hub/karporn/:id` viewer** — title + meta row (`year make model` · photo count · visibility) + optional location chip with an "Open in Map" link when coords are set + owner attribution + cover + photo grid + description + owner-only delete.
- **Home feed** — one card per kar lifetime. `StatusKarpornCard` renders cover + title + `year make model` + photo count + optional location label.

## Composer

`KarComposer`, opened via the Ж bubble → **Post a car**, or by navigating to `/hub/karporn/composer`. Field order (top to bottom):

1. **Title** (input).
2. **Description** (textarea).
3. **Year / Make / Model** — a three-column meta row: year (`<input type="number">` with min/max/step), make, model. Year defaults to `new Date().getFullYear()`.
4. **Location** — `<fieldset>` with the label input + the geolocation button (or captured coordinates + clear button).
5. **Add photos** — file picker (multiple, `image/*`), thumbnails with per-tile remove.
6. **Reach** — `<ReachDropdown>` in the compose-shell header slot.

On submit: `POST /api/v1/karporn/kars`, then serial `POST /api/v1/media` → `POST /api/v1/karporn/kars/:id/photos` per photo. Same first-photo-is-cover ordering as Art.

## Feed projection

- `Karporn::PublishKar` mints one Status per kar on create, stamped `source_korner='karporn'`.
- Registered via `korner_cards.tsx` as `{ slug: 'karporn', assocField: 'kar' }`.
- `StatusSerializer` has_one `:kar` with a `kar_visible_to_viewer?` gate.
- The summary serializer only carries `location_label` (not coords) — the feed card doesn't need to plot a pin. The full `{ lat, lng, label }` shape is on the detail response.

## Data

- `kars` — `title / description / year (int) / make / model / location_lat (decimal) / location_lng (decimal) / location_label / owner_id / cover_media_attachment_id / visibility / status_id / timestamps`. Indexed on `(make, model)` for future filtering ("show me every Alfa Romeo").
- `kar_photos` — `kar_id / media_attachment_id / caption / position / timestamps`.
- `Status.has_one :kar`; `Account.has_many :owned_kars`.

## Nodes

- `karporn.index` — `/hub/karporn`, `lifecycle: live`, SPA.

## Cross-korner connections

- `accepts: [{ from: '*', kind: link }]`. No inbound spawns.
- The location chip on the viewer links to `/hub/map?lat=<lat>&lng=<lng>`. Whether the Map korner honours that query today or not (rendering a pin at those coords) is a Map-side follow-up; the outgoing link is stable.

## Open decisions

- **Make / model autocomplete** — free-text today, so "Porsche" and "porsche" and "porsche " are three different filters if we ever add filtering. If make/model filtering becomes real, either normalise on write or seed a curated list.
- **Proper map picker** — the "Use my current location" button is the smallest useful thing. A real picker (drop a pin on a map, drag to adjust, reverse-geocode the label) belongs to the Map korner and can share a primitive across korners that want a location — see Wachuneed listings and Moments attach flows.
- **Cross-post to Albutts** — a Karporn post is also a photo album at its core. Should there be a "post this to Albutts too" affordance? Probably not — Albutts is multi-contributor; Karporn is single-author. Cross-linking via `korner_attachments` is the cheap answer.

## Related

- [`../korners/korner_standard.md`](../korners/korner_standard.md).
- [`../korners/adding_a_korner.md`](../korners/adding_a_korner.md).
- [`art.md`](art.md) — the shape Karporn cribs from.
- [`map.md`](map.md) — the eventual owner of location picking.
