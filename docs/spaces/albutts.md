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

Each photo is backed by a `Status` (see `Albutts::PublishPhoto`).
Inside the lightbox its
reactions rail talks to the standard status endpoints instead of
albutts-specific ones:

- **Froth** — a favourite on the backing status. Toggle via
  `POST/DELETE /api/v1/statuses/:id/favourite`. Same idempotency as
  every other Mastodon favourite.
- **Replies** — thread through the backing status's standard
  `in_reply_to_id` chain. The lightbox links out to the status
  permalink for the full thread; from there, the standard compose /
  delete rules apply.

Both are gated by the backing status's visibility, which is derived
from the album's scope at contribute time (`Albutts::PublishPhoto`).
Anyone who can see the album can favourite + reply to any photo in
it, matching Albutts's open-audience-within-scope contract.

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

This doc is the output of running `docs/korners/adding_a_korner.md (Proposing a korner)`
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

---

## Scope picker (historical)

_Merged into this file on 2026-10-04 from `docs/kronk_scope_picker.md` (since deleted); its own status notes and dates are kept as written._

Status: HISTORICAL (2026-08-05, closed 2026-09-09). Design doc for a
primitive that no longer exists: `<ScopePicker>` was superseded by
`<ReachDropdown>` in the shell header, and the component, its story and
its stylesheet were removed once nothing rendered them. Kept because the
reasoning — two axes, additive krews, why contribution is Album-specific
— is what the current arrangement is built on.

> **Where we ended up (2026-09-09).** Tal — "given we have a standard
> composer, I reckon the scope picker becomes a normal part of the
> standard composer. The standard post composer has a drop down menu
> and I really like that, I think that's all that's needed."
>
> The canonical visibility picker for every composer is now
> **`<ReachDropdown>`** (`mastodon/components/reach_dropdown.tsx`)
> passed to `<ComposeShell headerAction={reachControl}>`. Same
> compact dropdown as the standard post composer, same vocabulary
> (Me / Mates / Orbit / Kronkverse), Krews as an additive submenu.
> Moments, Kalendar, Trek, and Albutts all use this pattern.
>
> **Contribution** (Album's "who can add photos") is Album-specific
> and lives inline in the Album composer body — not part of the
> universal composer primitive. Kuestions' `<KuestionScopePicker>`
> and Trek's map-composer picker are known variants still tracked
> for migration.
>
> The two-axes `<ScopePicker>` shipped in #1343 for Albutts, and was
> retired here as Album adopted the shell-header dropdown. Read
> this doc for the vocabulary argument and the two-question split,
> not for the component shape.

> **Premise partly superseded (2026-08-12).** This draft models krew as one
> value in a single-select visibility list.
> Since it was written, the platform decided and shipped the
> opposite: **krew is an orthogonal, additive axis**, never a `visibility`
> value — see [Feed & Reach §2.2](feed.md) and
> [`docs/decisions.md (2026-08-09, Krew is an orthogonal axis)`](../decisions.md). The
> two-axis split this doc argues for therefore _happened_, but by a different
> route, and the enum tables below (§ visibility options, § contribution
> options, the `krewIds?` shape, the `album_krews` sketch) no longer match the
> code. Read this for the vocabulary argument, not for the data model.

### Why this doc exists

Every korner has an ownership + access conversation buried
somewhere in its composer. Statuses have visibility (public /
mates / krew / self_only). Kommons proposals have a scope.
Kuestions has one. Albutts has one. Moments has one. They all
mean roughly the same thing but each is styled, worded, and
placed differently in its own composer, and each conflates
**who can see** with **who can act** in slightly different ways.

The result: no user learns the vocabulary once. They re-learn
per surface. That's a compounding tax on the aesthetic-alignment
work happening across Kronk.

This doc proposes a single primitive — a **Kronk Scope Picker** —
that codifies the vocabulary, splits the two axes cleanly, and
becomes the canonical way to ask "who is this for?" across every
korner. First user: Albutts (the concrete change that started
this thread). Later users: statuses, proposals, questions,
moments, whatever comes next.

Companion to `docs/design.md (Aesthetic system)` and the aesthetic
audit (2026-08-04). Sits in the same "shared primitive"
category as `KronkWordmark` and `.kronk-form__*`.

### The vocabulary

Two questions, always in this order, always in plain English:

**1. Who's this for?** — Answers the _visibility_ axis. Who can
see this thing exist at all.

**2. Who can add to it?** — Answers the _contribution_ axis. Of
the people who can see it, who can act on it (add photos,
comment, back a proposal, answer a question, etc.).

The visible label per option is designed to be readable by
someone who has never used Kronk. The stored enum value is the
technical name used in the DB + API. Both are listed below.

#### Axis 1 — Who's this for? (visibility)

| Enum value  | Label in UI       | What it means                                                              |
| ----------- | ----------------- | -------------------------------------------------------------------------- |
| `public`    | Everyone on Kronk | Any signed-in member can see it. Federates where the korner supports that. |
| `mates`     | My mates          | Mutual-follow (mates) of the owner.                                        |
| `orbit`     | My orbit          | Mates + mates-of-mates of the owner (one hop out).                         |
| `krew`      | A specific Krew   | Members of the picked Krew(s). Owner selects Krews inline.                 |
| `self_only` | Just me           | Owner only.                                                                |

Not every korner supports every scope — a Kommons proposal
doesn't need a `self_only` (nothing to propose to yourself),
statuses don't need `orbit` if they federate publicly, etc. Each
korner declares the subset it supports (see **API contract**).

#### Axis 2 — Who can add to it? (contribution)

| Enum value | Label in UI           | What it means                                                                         |
| ---------- | --------------------- | ------------------------------------------------------------------------------------- |
| `open`     | Anyone who can see it | Contribution follows visibility 1:1. Default for most existing korner behaviour.      |
| `closed`   | Only me               | Owner is the only contributor. Others (per visibility) can still view.                |
| `invited`  | Just people I add     | Owner picks specific accounts inline. Named roster.                                   |
| `krew`     | A specific Krew       | Contributors must be members of picked Krew(s). May reuse the visibility Krew picker. |
| `event`    | Anyone at [Event]     | Roster = RSVP list of a Kalendar event. Owner picks the event inline.                 |

The default when the owner doesn't touch this field is `open`
(current Albutts + everywhere-else behaviour). Migration
strategy per korner is that korner's call — Albutts is
migrating existing rows to `closed` explicitly (Tal, 2026-08-05)
because contribution-scoping was a bug the whole time.

### What the picker looks like

Not a single dropdown — a two-question conversation. Both
questions render in the composer as sibling blocks with a shared
visual treatment. Selecting an option that requires a sub-picker
(Krew, invited list, event) reveals that picker below, in place.

Rough layout:

```
┌─────────────────────────────────────────────────────────────┐
│  Who's this for?                                             │
│    [ Just me ] [ My mates ] [ My orbit ]  ← chips            │
│    [ A specific Krew ] [ Everyone on Kronk ]                 │
│                                                              │
│    (if 'A specific Krew' picked:)                            │
│    ┌ Pick a Krew ────────────────────────────────┐           │
│    │ ○ Wellington Surf                            │           │
│    │ ○ Book club                                  │           │
│    └──────────────────────────────────────────────┘          │
├─────────────────────────────────────────────────────────────┤
│  Who can add to it?                                          │
│    [ Anyone who can see it ] [ Only me ] [ People I add ]    │
│    [ A specific Krew ] [ Anyone at Event ]                   │
│                                                              │
│    (sub-pickers reveal inline as above)                      │
└─────────────────────────────────────────────────────────────┘
```

Chip selection: single-select per question. The picker
enforces sensible constraints — e.g. contribution `open` is
suppressed if visibility is `self_only` (nobody can see it,
so nobody can contribute); contribution `krew` picker
auto-populates from the visibility Krew if visibility is also
`krew`; etc. Constraints declared in one place per korner.

### Component API (React)

`app/javascript/mastodon/components/scope_picker.tsx`
(planned filename).

Approximate shape:

```typescript
interface ScopePickerProps {
  // Which visibility options this korner supports.
  visibilityOptions: VisibilityScope[];
  // Which contribution options this korner supports.
  contributionOptions: ContributionRoster[];

  // Current state. Controlled component.
  visibility: VisibilityScope;
  contribution: ContributionRoster;
  krewIds?: string[]; // when visibility or contribution is 'krew'
  invitedIds?: string[]; // when contribution is 'invited'
  eventId?: string | null; // when contribution is 'event'

  // State updates. One callback per axis; sub-picker changes
  // fold into the appropriate one.
  onVisibilityChange: (v: VisibilityScope, meta?: PickerMeta) => void;
  onContributionChange: (c: ContributionRoster, meta?: PickerMeta) => void;

  // Optional labels — a korner can rewrite the question text if
  // 'add to it' doesn't fit (e.g. Kommons: 'Who can back it?').
  visibilityQuestion?: string;
  contributionQuestion?: string;
}
```

CSS lives in `app/javascript/styles/kronk/_scope_picker.scss`
(planned). Chip styling reuses the same token palette as
`.kronk-form__button` variants; sub-picker styling reuses
`.kronk-form__*` primitives.

### API contract per korner

Each korner that adopts the picker declares its own supported
subsets + defaults. Album (the first user) declares:

```yaml
scope_axes:
  visibility:
    options: [public, mates, orbit, krew, self_only]
    default: mates
  contribution:
    options: [open, closed, invited, krew, event]
    default: open # (existing behaviour); migration overrides
```

The API accepts both `visibility` and `contribution` on the
album resource; the backend validates the pair, resolves any
sub-picker payload (krew_ids / invited_ids / event_id), and
returns 422 with a `scope_error` if the combination is invalid
for this korner.

### Backend model shape

Per-korner tables get two columns:

```
albums.visibility        integer  (existing enum, unchanged)
albums.contribution      integer  (new enum — open, closed, invited, krew, event)
```

Plus supporting join tables for the multi-account rosters:

```
album_contributors    (album_id, account_id)  # 'invited' roster
album_krews           (album_id, krew_id)     # already exists for visibility='krew'; now also usable for contribution='krew'
albums.event_id       (existing belongs_to)   # already there; now consulted for contribution='event'
```

`Album#contributable_by?(viewer)` — new logic:

```ruby
def contributable_by?(viewer)
  return false unless visible_to?(viewer)  # gate on visibility first
  return true if viewer.id == owner_id     # owner always adds

  case contribution
  when 'open'    then true                                # already visible → can add
  when 'closed'  then false                               # owner-only, and we've ruled out owner
  when 'invited' then album_contributors.exists?(account_id: viewer.id)
  when 'krew'    then album_krews.exists?(krew_id: viewer.krews.select(:id))
  when 'event'   then event&.attendees&.exists?(viewer.id)  # or however Kalendar exposes it
  end
end
```

### Migration strategy per korner

Each korner picks its own default when adding the `contribution`
column. Recorded here so it's traceable:

- **Albutts**: existing rows → `contribution: 'closed'`. Owner
  must actively open albums up. Aggressive default per Tal
  (2026-08-05) — the current "open" behaviour was surprising
  George when he was rejected uploading to Tal's mates-scoped
  album.
- **Statuses** (if migrated later): stay `open` — matches ~10
  years of Mastodon-family convention that anyone who can see
  a post can reply.
- **Kommons proposals** (if migrated later): TBD when we look
  at Kommons.

### Not in the first PR

Follow-ups after the initial doc + picker + Albutts wiring:

- **Invited-list UX**: owner-side flow to add/remove accounts
  from an album's contributor list. Autocomplete on account
  handles; probably reuses whatever the DM composer's account
  picker looks like.
- **Event-tied contribution**: needs a Kalendar event picker in
  the composer + a `Kalendar::Event#attendees` reader that maps
  RSVPs to accounts.
- **Roll-out to other korners**: statuses, proposals, questions,
  moments, etc. Each is its own PR — the picker is the shared
  primitive; the per-korner enum + migration is per-korner.
- **Deprecating status visibility**: down the line, if the
  scope picker is universally adopted, the status composer's
  bespoke visibility dropdown becomes redundant. That's a
  bigger conversation.

### Decisions (2026-08-05, Tal)

- **Sub-pickers inline.** The Krew list, invited-account
  autocomplete, and event picker all reveal inline below the
  chip they're triggered by. The "one continuous conversation"
  quality is worth the vertical space cost. If the composer
  gets crowded on mobile, that's a per-korner responsive
  concern, not a picker-model change.
- **Krew auto-mirrors between the two axes.** If visibility
  is `krew` and contribution is also `krew`, the contribution
  Krew list defaults to (and stays in sync with) the visibility
  Krew list. Owner picks Krews once; both axes read from that
  selection. If an owner ever wants split Krews (visibility =
  Krew-A, contribution = Krew-B), that's a follow-up when
  someone actually asks for it.
- **Event sets contribution only.** Album visibility and
  event membership are independent. Choosing "Anyone at Event"
  for contribution binds the album to a Kalendar event's RSVP
  list for the ADD roster; visibility stays whatever the owner
  picked separately. Rationale: an event might be public but
  its photo album mates-only, or vice versa. The album is not
  the event; it's a companion surface, and the two decisions
  are decoupled.

Doc is now the spec. Follow-up PR chain per the roadmap in
the section above:

1. `<ScopePicker />` component + `_scope_picker.scss` +
   Storybook story (no wiring, no visible change).
2. Album backend — `contribution` field, migration
   (existing → `closed` per Tal), `contributable_by?` split
   from `visible_to?`, controller sanitizer + API accepts
   both fields.
3. Albutts composer + edit UX wire in `<ScopePicker />`;
   API types + client-side actions carry the new fields.

Later PRs adopt the picker in other korners (statuses,
proposals, questions, moments, etc. — one per korner).
