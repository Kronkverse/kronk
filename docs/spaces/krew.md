# Krew

**Manifest:** `config/korners/krew.yaml` (slug `krew`) · **Mount:** `/hub/krew`
· **Model:** `Krew`

A Krew is a named group of people you can post to. It scopes an audience: you
post to the Mayhem Krew and Mayhem's members see it, in their own Home feed.
This doc describes how Krews work today. Why they are shaped this way is in
[`groups.md`](groups.md). Earlier designs are in git history (see
[History](#history)).

## Posting to a Krew

Krew is a **separate axis from reach**, not a rung on the reach ladder
(decisions.md, "Krew is an orthogonal axis"). A post has one reach tier and,
separately, any number of Krews. Its audience is the tier's audience plus the
members of those Krews. See [`feed.md`](feed.md) for the full audience rules.

- **Storage:** `statuses_krews` for posts. Some korners keep their own link:
  `album_krews` (Albutts) and `moments.krew_id` (Moments, one Krew). Kalendar
  events pass `krew_ids` to the event's backing post.
- **Composers** offer Krews through the shared reach dropdown
  (`components/reach_dropdown.tsx`, `krew_multi_select.tsx`,
  `korner_krew_picker.tsx`, `hooks/useAvailableKrews.ts`).
- **Fan-out:** `FanOutOnWriteService#deliver_to_krew_members!` pushes the post
  to members alongside whatever the tier reaches.
- **Reading:** `REST::StatusSerializer#krews` returns `{id, slug, name}` for
  each target. `components/status_krew_badge.tsx` shows one tappable chip per
  Krew in the post header, linking to the Krew page.
- `POST /api/v1/krews/:id/statuses` posts straight into one Krew (members only).

## Joining

`Krew#access` has four values (`Krew::ACCESS_LEVELS`):

| Access              | Listed in Discover | Who can join                                             |
| ------------------- | ------------------ | -------------------------------------------------------- |
| `open`              | yes                | anyone, one tap                                          |
| `approval`          | yes                | anyone who asks, once a member lets them in              |
| `requirement_gated` | yes                | anyone who meets every `KrewRequirement` (they're ANDed) |
| `invite_only`       | no                 | someone invited, or holding the invite link              |

- **Asking to join** (`approval`, shown as "Ask to join"). `POST :id/join`
  leaves a `KrewJoinRequest` instead of a membership and nudges every member
  (`krews.join.requested`). **Any member** can accept or decline, not only
  the seeder (decisions.md, 2026-10-13). Accepting makes the person a member
  and nudges them (`krews.join.accepted`); declining is silent. Either way
  the request row is deleted, and the asker can take it back themselves.
  Getting in another way (an invite, the link) clears a waiting request.
- **Inviting into an existing Krew.** Any member can invite from the Krew
  page ("Invite people"), and can pick anyone on Kronk.
  `POST :id/invites` sends each person the same pending request in the
  Krew's Nudges chat that Gather a Krew sends. It skips people already in
  and anyone who has blocked the inviter, and takes at most 40 at a time.
- **The invite link** (`/hub/krew/<slug>?k=<invite_token>`) joins directly,
  whatever the access. The Krew page passes `k` along with Join.

- **Requirements** (`KrewRequirement::KINDS`): `attending_event` (an RSVP of
  "going" to a Kalendar event), `located_in` (a declared region), and
  `vouched_by_member` (provisional; always unmet until Anthemos vouching
  exists). Checked in `Api::V1::KrewsController#requirements_satisfied?`.
- **Invite token:** created with any non-open Krew (and when an open Krew
  stops being open), rotated by `POST /api/v1/krews/:id/regenerate_invite`,
  which kills old links.
- **Inviting people at creation:** each chosen person gets a pending request in
  the Krew's Nudges chat (`Nudges::Conversation.invite_to_krew!`). Nobody is
  added without accepting.
- **Leaving** is free and immediate. The last seeder can't leave; they archive
  the Krew instead.
- `KrewMembership#source` records how someone joined: `direct`, `invite`, or
  `rsvp_auto` (nothing writes `rsvp_auto` yet; see [Open](#open)).

There is no member removal. Seeders can't kick anyone. Disruption is handled
with Kronk's account-level block and report.

## Seeders

The creator is the seeder (`seeded_by_account_id`, plus a `seeder` membership
row). Seeders can edit the name, description, image and access, add or remove
requirements and attached spaces, rotate the invite link, and archive the Krew
(`archived_at`; archived Krews drop out of Discover). The slug is fixed at
creation.

## The surfaces

All in `app/javascript/mastodon/features/krew/`.

- **`/hub/krew`** (`index.tsx`): the directory, with two views on the
  standard rotating title: **Yours** (your Krews, including invite-only ones,
  most recently active first) and **Discover** (listed Krews). Each card
  shows the member count. A Discover row carries the way in beside it:
  **Join** for an open Krew, **Ask to join** for an `approval` one, and
  "Asked to join" or "You're in" once that is so. A requirement-gated Krew
  has no button on the row.
- **`/hub/krew/composer`** (`krew_composer.tsx`): "Gather a Krew", the shared
  `<ComposeShell>` overlay on the directory. Name, description, access,
  spaces to attach, requirements, and people to invite. `/hub/krew/new` is an
  alias.
- **`/hub/krew/:id`** (`krew_detail.tsx`, accepts slug or id): image, name,
  description, then the way in for someone not in it (Join, Ask to join, or
  a note that it needs an invite). Members see the people asking to join,
  with "Let them in" and "Decline", and "Invite people" under the faces.
  Below: a grid of the Krew's attached spaces with "Add a space", a Chat
  tile, and a "What's happening" list of the latest 20 posts sent to the
  Krew.
  A Krew with Kalendar attached also shows members its **Events**: what
  is coming up for the Krew, and **New event for this Krew**
  (`krew_events.tsx`; see `docs/spaces/kalendar.md`, Events for a Krew).
- **`/hub/krew/:id/settings`** (`krew_settings.tsx`): identity, access,
  invite link, spaces, membership (Leave) and Archive.

**Chat.** Each Krew has one group conversation in Nudges
(`Nudges::Conversation` kind `krew`, opened via `GET /api/v1/krews/:id/chat`,
members only).

**Attached spaces.** `KrewKorner` rows record which korners a Krew has turned
on. Allowed: `booth huddle kalendar kommons map albutts kuestions`
(`KrewKorner::KORNERS`). Today a tile links to that korner's own Hub page; the
korner itself isn't scoped to the Krew.

**Search.** Krews are indexed (`searchable_as :krews, if: :discoverable?`) and
appear in `/api/v2/search` results.

## API

`/api/v1/krews` (`Api::V1::KrewsController`):

- `GET /krews`, with `scope=mine` (your Krews), `scope=all` (listed plus
  yours), or no scope (listed only).
- `GET`, `POST`, `PATCH`, `DELETE` (archive) on a Krew. Writes are seeder-only.
- Members: `GET :id/members`, `POST :id/join`, `POST :id/leave`, `GET :id/chat`.
- Asking to join (`Api::V1::Krews::JoinRequestsController`):
  `GET :id/join_requests`, `POST :id/join_requests/:request_id/accept` and
  `/decline` (members), `DELETE :id/join_request` (the asker).
- Inviting (`Api::V1::Krews::InvitesController`): `POST :id/invites` with
  `account_ids` (members).
- Spaces: `POST :id/attach`, `DELETE :id/attach/:korner`.
- Invite and gate: `POST :id/regenerate_invite`, `POST :id/requirements`,
  `DELETE :id/requirements/:requirement_id`.
- `GET`, `POST :id/statuses`.

`:id` is the numeric id or the slug. Slugs must start with a letter, so the
two can't collide.

## Open

- **Should invite-only Krews be listed?** They are hidden from Discover, so
  nobody can ask to join one. Listing them would show Krews whose makers
  chose hidden; "Ask to join" is the listed kind of closed Krew for now.
- **A big Krew and its requests.** Every member is nudged about every
  request. Fine at today's sizes; a large Krew may want that narrowed.
- **The Krew page and its members list are readable by anyone with the
  address**, invite-only Krews included (`show` and `members` do not check
  membership).
- **Search misses new Krews.** Indexing keys off the old `discoverable`
  column, but create and update now translate `discoverable` into `access` and
  never write the column. Krews created this way are probably never indexed
  (unverified against data). Index on `listed?` instead.
- **RSVP auto-join.** The decided design: RSVPing an event that belongs to a
  Krew adds you to the Krew, and you can leave the Krew without dropping the
  RSVP. The schema is there (`source: rsvp_auto`, `rsvp_event_id`); nothing
  creates those rows.
- **Krew-scoped korners.** Attaching a space only records it. Krew Huddles are
  reserved (`HuddleSession` scope `krew`) but no code creates them, and no
  other korner filters by Krew.
- **The Krew page shows posts.** The 2026-07-22 decision was "metadata, not a
  stream". The page now has a "What's happening" list. Keep it or remove it.
- **Requirement-gated vs "the directory is the gate".** The original design had
  only listed and unlisted Krews. `requirement_gated` was added later; confirm
  it stays.
- **Governance leftovers.** `governance_framework`, `governance_threshold`,
  `GOVERNANCE_FRAMEWORKS`, the multi-seeder `role` and the last-seeder guard
  are still in the model and API but unused by the UI. Drop them in a cleanup
  migration.
- **Immutable identity.** The original design said a Krew's name can't change
  once made. Seeders can rename today. Decide which is right.
- **Manifest settings** `notify_on_new_post` and `default_visibility` are
  declared in `krew.yaml`; nothing reads them.
- **Account deletion:** confirm what happens to Krew-targeted posts and
  memberships when a member's account is deleted.

## History

Rewritten 2026-10-05 to describe what is built. This file used to be the build
spec (UI decisions of 2026-07-22, built-vs-needed list, build order) and the
model was called `Group` until the Phase 2 rename. Earlier designs and notes:
`git show 231cca937a00bf7bdbee9db6f25b6cbc541a8565:docs/spaces/krew.md`
