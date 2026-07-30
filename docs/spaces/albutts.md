# Albutts (`albutts`)

**Manifest:** `config/korners/albutts.yaml` · **Mount:** `/hub/albutts` · **Status:** shipped-2.0 (2026-07-29 — enforced; four-slice build landed as alpha.315 → alpha.320)

## Purpose

Albutts is Kronk's **shared-album korner** — a space where multiple
people co-author a single album together, with **per-photo author
credit as first-class metadata**. Contributors are peers, not one
poster's silent guests. The album is a group artefact; the individual
photos remain attributable to the contributor who added them.

Distinct from "attach 4 photos to a toot": that's one poster
publishing four assets under their own name. Albutts is _many people
contributing to one shared container_, with attribution woven through.

## Content model

**Primary content unit:** the **album** (a multi-photo container) is
addressable as an entity. Individual photos are addressable sub-units
of it. Both surfaces exist:

- An album has an identity: title, description, cover, owner,
  visibility scope, and a set of contributor accounts.
- A contribution is one photo (or one short video — see storage
  below) added by one contributor, with their credit + optional
  caption.

## Storage — federated to contributors

**Albutts does not host media centrally.** Each contributor's photos
(and videos) live in their own storage — the album is a metadata
container that references contributor-hosted files. This aligns with
the Anthemos pod philosophy: data lives with the user, Kronk routes

- presents it.

Consequence: revocation is one-sided. If a contributor deletes or
un-shares their media, the album's rendering of that photo goes dark;
no cleanup script needed on Kronk's side.

Videos are supported alongside photos (contribution type carries a
`media_kind` — no fixed length cap at this stage; a Round 3 could
sharpen).

## Visibility scopes

Standard Kronk visibility set:

- **Public** — anyone can view, listed in the Albutts directory,
  indexed in Kronk::Search.
- **Mates** — visible only to the owner's mates (the platform-wide
  primitive replacing followers).
- **Krew-scoped** — visible only to members of one or more specific
  Krews.

The **contributor set follows visibility**: whoever can view the
album can also contribute — no separate contributor invitation flow.
Open-roster within scope.

## Composer

Two compose surfaces:

- **Create-an-album** — an in-Albutts composer for title, description,
  cover, visibility scope. Sets the album's identity.
- **Contribute-a-photo** — an in-album composer for uploading + adding
  credit + optional caption. Available to anyone within the album's
  visibility scope.

## Lightbox + per-photo reactions

Clicking a photo tile in an album detail opens the **album lightbox** —
a full-screen overlay showing the current photo, with arrow-key /
click navigation left/right through the album and `Escape` to close.
Deep links land on a photo via `?photo=:id` on the album URL (used by
Nudges CTAs for photo comments/froths).

Inside the lightbox, each photo has its own reactions rail:

- **Froth** — one-per-viewer heart on a specific photo. Toggle
  via `POST/DELETE /api/v1/albutts/photos/:photo_id/froth`. Idempotent
  (DB unique index catches double-clicks).
- **Comments** — one level of threading (`parent_id` on
  `album_photo_comments`). GET/POST/DELETE
  `/api/v1/albutts/photos/:photo_id/comments`. Only the comment author
  or the album owner can delete a comment.

Both reactions are gated by album visibility: if you can view the
album you can Froth and comment on any photo inside it, matching
Albutts's open-audience-within-scope contract.

## Notifications

Four triggers fire:

- **You were added as a contributor** — when a user's contribution
  rights change (e.g., they joined a Krew that owns an album), they
  get a one-off notice.
- **An album you contribute to got new photos** — fellow contributors
  are notified when other contributors add to a shared album. Keeps
  co-authors in the loop.
- **Your photo was frothed** — the photo's contributor is nudged
  when another viewer Froths their photo in the lightbox. Aggregates
  per photo over 15m so a burst of Froths reads as one line.
- **Someone commented on your photo** — the contributor is nudged
  on a root comment; on a reply, the parent comment's author is
  nudged instead (deduped against the contributor). Interactive:
  the CTA opens the lightbox at the commented photo via
  `?photo=:id` on the album detail URL.

Aggregation, `default_push`, `interactive` flags declared in
`config/korners/albutts.yaml` under `notifications.types`.

## Feed projection

**New-album card only** (per Round 2). The `albutts_card` renders in
Home feeds when a mate creates a new album. Subsequent contributions
to that album do not spawn new feed cards — the album is one card
per lifetime, not per-photo. Keeps the feed calm even for
high-contribution events.

Card content: cover photo, album title, contributor avatars,
contribution count.

## Kategories

**Every album is auto-tagged with `Album`** (a Kategory-level type
tag reserved for auto-typing per-content-kind). Users can additionally
tag albums with any curated Kategory alongside the auto tag. Browsing
a Kategory shows albums as one of the result types.

Novel pattern: automatic type-based tagging alongside user-authored
tagging. May inform how other typed content (Booth sets, Kuestions)
handle the same idea.

## Cross-korner connections

- **Kalendar → Albutts.** Event creator opts in via checkbox at event
  creation (mirror of the Krew-spawn pattern): _"Spawn an album for
  this event?"_ If checked, an album is created + linked to the event.
  Attendees who RSVP get contribution rights to the album.
- **Krew → Albutts.** A Krew can own an album — visibility set to
  Krew-scoped. Krew members are the album's contributors + viewers.
- **Profile → Albutts.** Albums a user contributes to surface on
  their sectioned profile (per Phase 11 profile rebuild). Credit
  becomes socially visible.
- **Feed → Albutts.** New-album card projection (see above).

## Open decisions

- **Notification `default_push` + aggregation** — deferred to when the
  notifications block is written. Contribution-burst events (e.g., a
  party with 30 photos in 10 min) suggest aggregation with a short
  window + key by album_id.
- **Video length cap** — how long can a contributed video be? 30s? 5
  min? Unbounded (contributor's storage cost)? Round 3 candidate.
- **What "type" tag category `Album` belongs to** — is it a reserved
  auto-tag namespace parallel to user Kategories, or does it live in
  the same taxonomy graph?
- **Album ownership vs contribution rights** — if the album's owner
  leaves the Krew that owns the album, what happens to their
  ownership? Ownership transfer flow?
- **Event → Album lifecycle** — after the event ends, does the album
  stay open indefinitely for late-arriving contributions, close after
  a grace period, or lock when the event closes?

## Discovery-flow provenance

This doc is the output of running `docs/korners/proposing_a_korner.md`
on Albutts as a fresh new-korner suggestion (Tal, 2026-07-20). Round
1 covered the 9 canonical topics; Round 2 drilldowns settled composer
shape, notification triggers, feed-card behaviour, and the
Kalendar-spawn mechanic. Content committed to this doc reflects
answers locked in that session.

## Build history

Four-slice implementation (2026-07-29):

- **Slice 1 (alpha.315, #873)** — Backend: `Album`, `AlbumPhoto`,
  `AlbumKrew` models + migration; visibility scope (`public` /
  `mates` / `krew`); `Api::V1::Albutts::AlbumsController` +
  `PhotosController`; `AlbumSerializer` + `AlbumSummarySerializer`
  - `AlbumPhotoSerializer`; routes under `namespace :albutts`.
- **Slice 2 (alpha.318, #878)** — Frontend: retired `AlbuttsStub`;
  built directory grid + album detail + create-album composer +
  contribute-a-photo composer (uploads via `POST /api/v1/media` then
  references the returned `media_id`). Feed card
  `StatusAlbuttsCard` + registration in `korner_cards.tsx` +
  `Albutts::PublishAlbum` (Album → Status projection).
- **Slice 3 (alpha.319, #882)** — Notifications: fan-out subscriber
  in `nudges_event_bus.rb` delivers a Mate-gated nudge per fellow
  contributor when a photo lands. Kalendar spawn: `events.spawn_album`
  boolean + composer checkbox + `albutts_event_bus.rb` subscriber
  that creates a companion Album on `kalendar.event.created`.
- **Slice 4 (alpha.320, this PR)** — Manifest `enforced: true`; docs
  sync; boot validator gates L1-L11 for albutts.

## Follow-ups (out of scope for the initial build)

- **Aggregation window** — the manifest declares
  `album_new_photo` should aggregate `window: 15m, key: album_id`.
  The Nudges router doesn't yet enforce that; a contribution burst
  currently produces one nudge per photo per contributor. Router
  patch is pending.
- **`contribution_rights_granted` producer** — the second declared
  notification type. Fires when contribution rights change (e.g., a
  krew member joins a krew that owns an album). Wire the producer
  when Krew-scoped albums are exercised end-to-end.
- **External-URL contribution flow** — `album_photos.external_url`
  is schema-ready; the composer only exercises the media-attachment
  path. Wire the URL path when Anthemos-pod-hosted media lands.
- **Video length cap** (spec §Open decisions).
- **Ownership transfer flow** when an album owner leaves a krew that
  owns the album (spec §Open decisions).
- **Event → Album lifecycle** after the event ends: stay open,
  grace-period close, or lock (spec §Open decisions).

## Related

- `docs/korners/korner_standard.md` — L1/L5/L6/L7 requirements for a
  `soon`-stage korner (Albutts's current stage).
- `docs/korners/adding_a_korner.md` — build walkthrough (picks up when
  the manifest is fleshed enough for models to start).
- `docs/spaces/kalendar.md` — for the Event → Album spawn mechanic.
- `docs/spaces/groups.md` — for the Krew-scoped visibility parallel.
- `docs/spaces/booth.md` — for the media-hosting comparison (Booth
  hosts centrally; Albutts federates to contributor storage).
