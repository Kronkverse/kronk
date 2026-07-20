# Albutts (`albutts`)

**Manifest:** `config/korners/albutts.yaml` · **Mount:** `/hub/albutts` · **Status:** stub (Round 1 + Round 2 discovery landed 2026-07-20; models not started)

## Purpose

Albutts is Kronk's **shared-album korner** — a space where multiple
people co-author a single album together, with **per-photo author
credit as first-class metadata**. Contributors are peers, not one
poster's silent guests. The album is a group artefact; the individual
photos remain attributable to the contributor who added them.

Distinct from "attach 4 photos to a toot": that's one poster
publishing four assets under their own name. Albutts is *many people
contributing to one shared container*, with attribution woven through.

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
+ presents it.

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

## Notifications

Two triggers fire (drilldown from Round 2):

- **You were added as a contributor** — when a user's contribution
  rights change (e.g., they joined a Krew that owns an album), they
  get a one-off notice.
- **An album you contribute to got new photos** — fellow contributors
  are notified when other contributors add to a shared album. Keeps
  co-authors in the loop.

Deliberately *not* included in the initial notification set:
album-owner-per-contribution (too noisy for busy albums), mate-
published-new-album (feed card already handles broadcast).

Aggregation, `default_push`, `interactive` flags — to be sharpened
when the notifications block is written into the manifest.

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
  creation (mirror of the Krew-spawn pattern): *"Spawn an album for
  this event?"* If checked, an album is created + linked to the event.
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
answers locked in that session. Model + UI work is still pending.

## Related

- `docs/korners/korner_standard.md` — L1/L5/L6/L7 requirements for a
  `soon`-stage korner (Albutts's current stage).
- `docs/korners/adding_a_korner.md` — build walkthrough (picks up when
  the manifest is fleshed enough for models to start).
- `docs/spaces/kalendar.md` — for the Event → Album spawn mechanic.
- `docs/spaces/groups.md` — for the Krew-scoped visibility parallel.
- `docs/spaces/booth.md` — for the media-hosting comparison (Booth
  hosts centrally; Albutts federates to contributor storage).
