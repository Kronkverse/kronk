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
  `hooks/useAvailableKrews.ts`).
- **Fan-out:** `FanOutOnWriteService#deliver_to_krew_members!` pushes the post
  to members alongside whatever the tier reaches.
- **Reading:** `REST::StatusSerializer#krews` returns `{id, slug, name}` for
  each target. `components/status_krew_badge.tsx` shows one tappable chip per
  Krew in the post header, linking to the Krew page.
- `POST /api/v1/krews/:id/statuses` posts straight into one Krew (members only).

### Linking

An album or event made earlier, or outside the Krew, can be linked to it
afterwards (Kommons "Link Existing Albums (and more)", 2026-10-17). On the
Krew page, a member's **Link one of your albums** and **Link one of your
events** list their own that aren't in the Krew yet; **Unlink** takes one
back out. Past events count.

- Albums: `POST/DELETE /api/v1/albutts/albums/:album_id/krews` adds the
  Krew to `album_krews`. Events: `POST/DELETE /api/v1/events/:event_id/krews`
  adds it to the event's post. Owner only, and only a Krew they're in.
  Invite-only events can't be linked; they stay for their invitees.
- **Posts follow.** A Krew on a post is set when the post is made, so
  `Kronk::StatusKrews` adds the Krew to the posts the album already has
  (the album post and each photo's), or the event's, and takes it off on
  unlink. Changing an album's Krews in its edit form does the same.
- The Krew page lists its albums (`GET /api/v1/albutts/albums?krew_id=`)
  when Albutts is one of its spaces, and its events, coming up and
  **Earlier** (`GET /api/v1/events?krew_id=&filter=past`), when Kalendar is.
- **An emergence's Krew shares its events** (`Kronk::EventLinks`). Linking
  an event to the Krew links it to the Krew's FreeTheDream emergence too,
  and an event attached to the emergence (or one of its gangs) by its maker
  is added to the Krew's audience. Unlinking from either takes it off both.

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
- **Leaving** is free and immediate. When the last member leaves, the Krew
  archives itself (`Krew#leave!`, from the Krew or its chat).
- `KrewMembership#source` records how someone joined: `direct`, `invite`, or
  `rsvp_auto` (nothing writes `rsvp_auto` yet; see [Open](#open)).

There is no member removal. Nobody can kick anyone. Disruption is handled
with Kronk's account-level block and report.

## Nobody owns a Krew

Any member can edit the name, description, image and access, add or remove
requirements and attached spaces, and see and rotate the invite link
(decisions.md, 2026-10-17). Only someone who is a Krew's **only member** can
archive it (`Krew#sole_member?`; `archived_at`, and archived Krews drop out of
Discover). The slug is fixed at creation.

The creator is still recorded as the seeder (`seeded_by_account_id`, plus a
`seeder` membership row), but it no longer gives them anything extra.

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
  a note that it needs an invite). Under the name are **the faces**: a few
  of the people in it, how many, and for members a badge when people are
  asking to join. Tapping them opens **People** below the grid (tapping
  again closes it): for members, the people asking to join with "Let them
  in" and "Decline", and "Invite people"; for everyone, the list of who is
  in it. The rest is for members (decisions.md, 2026-10-18):
  - **What's happening**: a few short lines, each a link. First how many
    messages in the Krew chat you haven't read (when any), which takes you
    down to the chat, then the last
    three things done in the Krew, newest first: someone added photos to
    one of its albums (one line per person, album and day: "Tomas added 37
    photos to Mayhem 2026"), added an event for it, posted to it, or
    joined. `GET /api/v1/krews/:id/activity` (`Kronk::KrewActivity`) reads
    them from the records themselves; nothing is stored for it, and only
    what you could open is listed.
  - **Spaces**: a tile for each attached space with a Krew part, which
    **opens it in place** below the grid, one at a time; tapping it again
    closes it. Nothing is open on arrival. **Albutts** shows the Krew's
    albums (`krew_albums.tsx`), **Kalendar** what is coming up for the
    Krew and what's been (`krew_events.tsx`). Last, **Add a space** offers
    the spaces not attached yet.
  - **Chat**: the Krew's chat from Nudges, read and written on the page
    (`krew_chat.tsx`, the messenger's `ConversationView` without its
    header), with "Open in Nudges" beside the heading. It is marked read
    once it has been on screen, not when the page opens.

  The Ж menu's **+** makes something for the Krew in the open space, with
  the normal composer: **Post to <Krew>** (the post composer with the Krew
  chosen) when no space is open, **New Krew album** (see
  `docs/spaces/albutts.md`, Krew albums) or **New event for this Krew**
  (see `docs/spaces/kalendar.md`, Events for a Krew). There is no "New"
  button on the page.
  Any member sets the Krew's **photo** from the square beside its name (the
  camera on its corner), when gathering the Krew, or in its settings
  (`krew_photo_field.tsx`).

- **`/hub/krew/:id/settings`** (`krew_settings.tsx`): identity, access,
  invite link, spaces, membership (Leave) and Archive.

**Chat.** Each Krew has one group conversation in Nudges
(`Nudges::Conversation` kind `krew`, members only). The Krew page gets its
id from `GET /api/v1/krews/:id/activity`; `GET /api/v1/krews/:id/chat`
returns the same id.

**Attached spaces.** `KrewKorner` rows record which korners a Krew has turned
on. The server allows `booth huddle kalendar kommons map albutts kuestions`
(`KrewKorner::KORNERS`), but only the spaces that can show a Krew's own
things are offered or get a tile: Albutts and Kalendar (`KREW_PAGE_SPACES`
in `api/krew.ts`). A Krew that turned on another space keeps the row; it
shows only in Settings, where it can be removed, until that space gets a
Krew part.

**FreeTheDream emergences.** Each FreeTheDream emergence has a Krew
(`Krew#freethedream_project`, `freethedream_projects.krew_id`) holding the
same people: joining or leaving the Krew joins or leaves the emergence, and
the other way round (`KrewMembership#join_emergence` / `#leave_emergence`).
See `docs/spaces/freethedream.md`, "The Krew".

**Search.** Krews are indexed (`searchable_as :krews, if: :discoverable?`) and
appear in `/api/v2/search` results.

## API

`/api/v1/krews` (`Api::V1::KrewsController`):

- `GET /krews`, with `scope=mine` (your Krews), `scope=all` (listed plus
  yours), or no scope (listed only).
- `GET`, `POST`, `PATCH`, `DELETE` (archive) on a Krew. Any member can
  `PATCH`; `DELETE` needs a sole member.
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

- **People lists 40.** `GET :id/members` returns the first 40, so a bigger
  Krew's People list stops there with no way to see the rest.
- **The page for someone outside the Krew** is its name, description,
  faces and the way in. What's happening and the spaces are for members,
  even when a Krew album or post is shown to everyone.
- **No list of a Krew's posts.** What's happening names the latest post,
  and each post opens on its own, but older posts sent to the Krew have no
  list on the page (`GET :id/statuses` still serves one).
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
- **Krew-scoped korners.** Only Albutts and Kalendar know which Krew their
  things belong to. Krew Huddles are reserved (`HuddleSession` scope
  `krew`) but no code creates them; Map, Booth, Kommons and Kuestions have
  nothing yet. Each joins `KREW_PAGE_SPACES` when it does.
- **Requirement-gated vs "the directory is the gate".** The original design had
  only listed and unlisted Krews. `requirement_gated` was added later; confirm
  it stays.
- **Governance leftovers.** `governance_framework`, `governance_threshold`,
  `GOVERNANCE_FRAMEWORKS` and the `seeder` role are still in the model and
  API but grant nothing. Drop them in a cleanup
  migration.
- **Manifest settings** `notify_on_new_post` and `default_visibility` are
  declared in `krew.yaml`; nothing reads them.
- **Account deletion:** confirm what happens to Krew-targeted posts and
  memberships when a member's account is deleted.

## History

Rewritten 2026-10-05 to describe what is built. This file used to be the build
spec (UI decisions of 2026-07-22, built-vs-needed list, build order) and the
model was called `Group` until the Phase 2 rename. Earlier designs and notes:
`git show 231cca937a00bf7bdbee9db6f25b6cbc541a8565:docs/spaces/krew.md`
