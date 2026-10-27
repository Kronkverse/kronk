# Huddle (`huddle`)

**Manifest:** `config/korners/huddle.yaml` · **Mount:** `/hub/huddle`

Huddle is a live hangout: drop in, be around each other, chat, work side by
side. Not a meeting and not a livestream. Video, audio and screen share run on
a Jitsi server, embedded in the page with the Jitsi iframe API. The server is
configuration, not code: `JITSI_DOMAIN` (default `meet.talitamoss.info`) is
read once in `config/initializers/1_kronk_jitsi.rb` and reaches the CSP,
Kalendar's Huddle events and the web client (`jitsiDomain` in
`initial_state.ts`). The Booth's live sets use the same server, in rooms
of their own (`docs/spaces/booth.md`, Live sets). This doc describes what is built as of 2026-10-27.

**Kuddles.** A Room is called a **Kuddle** wherever people see it (Tal,
2026-10-27): the list, the composer ("New Kuddle"), the Konnect noun ("the
Ember Kuddle"), nudges. The code and the API still say room (`scope: room`,
`/api/v1/huddle/rooms`, `RoomComposer`). The page is `/hub/huddle/kuddle/:id`;
the old `/hub/huddle/room/:id` forwards there, on the server and in the app.

## Three categories of Huddle

Hangouts are either shared and open, or Krew-scoped. There are no free-form
private Huddles. `HuddleSession#scope` holds the category (`main | room |
krew`).

**1. The Main Huddle.** One room, always open, everyone welcome. It is joined,
never created. It sits at the top of `/hub/huddle` (`features/live/index.tsx`).

- The page joins a fixed Jitsi room named `huddle`. It does not read the
  `scope: main` row, which a migration seeds as a singleton
  (`AddRoomScopeToHuddleSessions`; `HuddleSession` validates there is only
  one).
- The lobby polls the Jitsi server for who is in the room. The home feed's
  `LiveBanner` shows a banner when someone is there, from Kronk's own count
  (`GET /api/v1/huddle/count`, the minute-old figure below), not from Jitsi:
  Jitsi answers an empty room with a 404, which every browser logged as a
  failed load on every poll.
- **The call follows you.** Leaving the Huddle page mid-call doesn't end
  it: the call shrinks into a small floating window (`HuddlePip`,
  `features/huddle_pip/`), like a video player's picture-in-picture (Tal,
  2026-10-19). You still see the call and it still sees you, mic and camera
  on. The window has a top bar to drag it by (where you leave it is kept on
  the device), the people count, and buttons to mute, turn the camera off,
  go back to the Huddle and leave. On a phone it is smaller and sits above
  the tab bar.

  How: Tomas's approach (#2118) keeps the Jitsi iframe in a container on
  `document.body` that no page owns (`huddle_pip/jitsi_session.ts`). That
  container is always drawn over a "slot": the call area on the Huddle page
  (`data-huddle-slot='docked'`) or the mini window's video area
  (`'floating'`). Moving between them only moves the container, so the call
  is never rebuilt. Coming back to the Huddle picks the same call up; a
  reload ends it. The browser's own picture-in-picture can't be used: the
  call is a frame from the Jitsi server, not a video element of ours.

**2. Rooms (Kuddles).** Open, topical, made by anyone signed in (Coworking,
Reading room, and so on). Anyone can join; there's no membership or invite.

- **Create:** the Ж-menu "New Kuddle" action opens the composer at
  `/hub/huddle/composer` (`features/live/room_composer.tsx`, in the shared
  `<ComposeShell>`, with drafts as `huddle`/`room`); the old `/hub/huddle/new`
  forwards there. A name, an optional one-line description, and optionally a
  Krew of yours to **Konnect** the Room to. Rooms have no icon (Kronk has no
  emoji): every tile wears the Huddle korner's icon (decisions.md,
  2026-10-22). `POST /api/v1/huddle/rooms` (`name`, `description`,
  `krew_id`) calls `HuddleRoom::CreateService`, which gives the Jitsi room a
  unique key (slug plus a random suffix, stored in `session_url`) so two rooms
  with the same name don't collide. It publishes `huddle.room.created`, and
  the creator goes straight into the new room, and follows it (below).
- **Konnected to a Krew:** with `krew_id` (a live Krew the creator is in;
  anything else is a 422 and no Room is made) the Room and a `link`
  attachment huddle → krew are made in one transaction, so the Room shows in
  the Krew page's spaces. It is a link only: the Room stays open to everyone,
  and members-only Krew Huddles (below) are still not built. The composer
  takes `?krew=<id>` (`/hub/huddle/composer?krew=<id>`) to start with that
  Krew picked, as the Kalendar and Albutts composers do; only Krews you're in
  are offered (`useAvailableKrews`), one at most.
- **List:** `GET /api/v1/huddle/rooms` returns non-retired rooms, most
  recently active first (`REST::HuddleRoomSerializer`). Who created a room is
  deliberately not shown.
- **Join:** tapping a room on `/hub/huddle` is the join. `/hub/huddle/kuddle/:id`
  (`features/live/room.tsx`) has no lobby: it embeds Jitsi on the room's key
  straight away, under a slim bar with the room's name, Follow and Unhuddle. Unhuddle,
  or hanging up inside Jitsi, goes back to `/hub/huddle`, and so does the
  Frame's `← Huddle` badge (the page draws no back chip of its own). A room
  call doesn't follow you yet; leaving the page ends it.
- **Retire:** `Scheduler::HuddleRoomReaper` runs daily at 03:15 UTC and
  soft-retires rooms whose `last_active_at` is more than six months old
  (`HuddleSession#retire!` sets `retired_at` and publishes
  `huddle.room.retired`). The row stays so old links resolve. If people want
  the room back, they make a new one. The name isn't precious; the moment is.

### Following a Kuddle

Following a Kuddle means a nudge when people gather in it (Kommons
"Notification for additional Huddles", 2026-10-27; `docs/decisions.md`).

- **Who follows.** Whoever made it (`HuddleRoom::CreateService`; a migration
  gave every open Kuddle's maker a follow), anyone who presses **Follow** on
  its card or page (`features/live/kuddle_follow.tsx`, a `KornerPill`), and
  every member of a Krew it is Konnected to. A Krew Kuddle is one its
  **maker** Konnected to a live Krew the maker is in; a link anyone else
  makes stays a link, so nobody can sign a whole Krew up for nudges.
  Krew members follow it by membership, not a row each: joining the Krew
  is enough, and leaving it ends it.
- **Unfollow is a choice, kept.** `huddle_follows` holds one row per
  person and Kuddle, `following: true` for Follow and `false` for Unfollow.
  The `false` row is how a Krew member stops, and it outlasts the Krew
  link (another of their Krews linking the same Kuddle doesn't sign them
  back up). Follow again turns it back. `Huddle::Follows` works all of
  this out.
- **API.** `POST /api/v1/huddle/rooms/:id/follow` and `/unfollow` (open
  rooms only; the Main Huddle can't be followed: everyone has it). The room
  shape carries `followed` and `followed_via_krew` for the viewer; the card
  shows Following either way.

**3. Krew Huddles.** The design is one Huddle per Krew, joinable only by its
members. **Not built.** `krew` is a valid scope value but no code creates or
reads one. A Krew can turn on "huddle" in its korner list (`KrewKorner`), but
that tile just links to `/hub/huddle`. See [Open](#open). A Kuddle Konnected to a Krew is
not one of these: it stays open to everyone, and the Krew's members follow
it (above).

## People are huddling (Fomo noto)

A nudge when the Main Huddle, or a Kuddle you follow, has as many people in
it as you choose (Kommons "Fomo noto", 2026-10-21; Kuddles 2026-10-27;
`docs/decisions.md`).

- **Counting.** `Scheduler::HuddleFomoScheduler` runs every minute and asks
  the Jitsi server how many are in the `huddle` room (`room-size`,
  `Kronk::HuddleCount`), and remembers it for the home `LiveBanner`. It gets
  a number, never who. Then the same for Kuddles: each open Kuddle with at
  least one follower, by its Jitsi room key (`session_url`; a key that is a
  whole URL, from old Kalendar rows, is skipped), most recently active first,
  at most 20 a run (`MAX_KUDDLES`). Kuddles nobody follows are not asked
  about.
- **Your number.** `fomo_threshold` on `/hub/huddle/settings` (manifest
  `settings:`), 1 by default, so anyone being there is enough. It counts
  for the Main Huddle and every Kuddle you follow. The rows **People are
  huddling** and **People gather in a Kuddle you follow** (on by default)
  above it have the usual In Nudges and Push switches, each its own.
- **Once per gathering.** Redis keeps the highest count already announced;
  a rise past your number nudges you, and nothing more happens while people
  come and go. Once the Huddle has been empty for ten minutes the next
  arrival starts a new gathering. Each new one replaces your last. Each
  Kuddle has its own count and keys (`huddle:fomo:kuddle:<id>:…`, gone a day
  after it stops being watched), and its nudge replaces only that Kuddle's
  last one.
- **What it says.** "People are huddling", from no one (`Huddle::FomoNotifier`
  makes the nudge with no actor), the Huddle's mark in place of an avatar,
  and under it how many are there **now** ("3 in the Huddle now", nothing
  once it has emptied). Join opens `/hub/huddle`. For a Kuddle: "People are
  in a Kuddle you follow", and under it "2 people are in the Ember Kuddle
  now" (or "The Ember Kuddle" once it has emptied), from the count the
  watch remembers; Join opens the Kuddle. Skipped for anyone tuned
  out of Huddle or with the row off; push follows the row's Push switch and
  quiet hours like any nudge.

## Nothing persists

When a session ends, nothing survives: no transcript, recording, feed card or
"Alice was here" trace. Huddles are the moment, not the artefact. Only the
room's identity lasts (Main forever, Rooms until the reaper).

## Moderation — flat and distributed

The intended rule: every participant has the same powers (mute someone, remove
someone from the current session), with no host role, so moderation is never a
prize. No room locks or permanent bans; those would go through Krew governance.
Kronk code does not implement any of this. In-session controls are whatever the
Jitsi server provides. The manifest's `maintainers: [moderator]` is korner-level
upkeep, not an in-session role.

## Kalendar

A Kalendar event can link to a Huddle through `korner_attachments` (`source:
kalendar`, `target: huddle`, `kind: link`). The old `events.huddle_session_id`
column was dropped (`DropEventsHuddleSessionId`, after a backfill migration).
`rake kronk:huddle:backfill` turns legacy `event_type: huddle` events into
`HuddleSession` rows with that link. The `huddle` value is still in
`Event.event_type`, and `events.huddle_url` still exists. The web no
longer makes Huddle-type events (its edit form lost the type toggle on
2026-10-23); the Android app still creates and edits them.

## Data

- `huddle_sessions`: `title`, `description`, `icon` (no longer written or
  sent; older rows may hold an emoji), `scope`, `state`
  (`draft | scheduled | live | ended`), `session_url` (the Jitsi room key),
  optional schedule, `host_account_id` (the creator for Rooms),
  `last_active_at`, `retired_at`, optional `status_id`.
- `huddle_participants`: one row per join, with `joined_at` / `left_at`.
- `huddle_follows`: `account_id`, `huddle_session_id` (unique together),
  `following` (true = Follow, false = Unfollow kept as a choice).
- `/huddle` redirects to `/hub/huddle` (`config/routes.rb`).

## Open

- **Krew Huddles.** Not built (see above). Undecided: what happens to a
  Krew's Huddle when the Krew is archived, and whether a Krew can remove one.
- **Activity tracking is half wired.** Opening a Kuddle calls
  `POST /api/v1/huddle/rooms/:id/join`, which moves `last_active_at` (so the
  list and the reaper see use). Nothing writes `huddle_participants` or calls
  `start!` / `end!`, so occupancy in the list is always 0.
- **No Jitsi JWT.** Huddle joins the Jitsi server without a token, so
  the Jitsi server does not know who is a Kronk member. A token endpoint
  existed briefly in March 2026 and was reverted; its route lingered, 500ing
  on every join, until 2026-10-11. Bringing tokens back means a controller
  that reads the secret from the environment, never from the code.
- **The Main Huddle row is unused.** The page hard-codes the Jitsi room. Either
  read the row or drop it.
- **Capacity.** The design says rooms cap at about 35 people (Jitsi's practical
  ceiling) with a plain "full right now" message, no overflow. Nothing enforces
  it.
- **People already in the Huddle get "People are huddling".** The server
  can't tell who is in the call (see Activity tracking above), so it can't
  leave them out. Recording joins would fix this too. The same goes for
  Kuddles: at the default of 1, someone alone in a Kuddle they follow is
  told about themselves.
- **Feed card and notifications.** The manifest marks `huddle_card` and the
  three notification types as `planned` ("People are huddling" is built, as a
  nudge outside them). Session content is never meant to
  persist, so it's open whether a card should exist at all.
- **Kuddle names.** Duplicates are allowed. Undecided whether to warn on create
  ("did you mean this Kuddle?").
- **More than 20 followed Kuddles.** Only the 20 most recently active are
  watched each minute. `last_active_at` moves when someone opens a Kuddle
  in Kronk, so busy ones stay in; a quiet Kuddle past the 20th that fills
  through a link straight to Jitsi isn't seen.
- **Deleting your own room.** Not possible. A simple rule would be: the creator
  can delete it until anyone has joined.
- **Event and Krew access.** Whether attending a Kalendar event should grant
  access to a Krew (and so its Huddle), and for how long. A Kalendar and Krews
  question.
- **Legacy cleanup.** Drop the `huddle` value from `Event.event_type` and the
  `events.huddle_url` column once the backfill has run everywhere.

## History

Rewritten 2026-10-05 to describe what is built. Earlier designs and notes
(the Phase 9 plan, the full data-model proposal, capacity and moderation
reasoning): `git show 231cca937:docs/spaces/huddle.md`.
