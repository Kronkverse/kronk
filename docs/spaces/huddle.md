# Huddle (`huddle`)

**Manifest:** `config/korners/huddle.yaml` · **Mount:** `/hub/huddle`

Huddle is a live hangout: drop in, be around each other, chat, work side by
side. Not a meeting and not a livestream. Video, audio and screen share run on
the Jitsi server at `meet.talitamoss.info`, embedded in the page with the Jitsi
iframe API. This doc describes what is built as of 2026-10-05.

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
  `LiveBanner` polls the same room and shows a banner when someone is there.
- `HuddlePip` (`features/huddle_pip/`) keeps the Main Huddle running in a
  picture-in-picture window while you move around the app.

**2. Rooms.** Open, topical, made by anyone signed in (Coworking, Reading room,
and so on). Anyone can join; there's no membership or invite.

- **Create:** the Ж-menu "New Room" action (`/hub/huddle/new`) opens the
  create form in `features/live/rooms_list.tsx`: a name, an optional one-line
  description and an optional icon. `POST /api/v1/huddle/rooms` calls
  `HuddleRoom::CreateService`, which gives the Jitsi room a unique key (slug
  plus a random suffix, stored in `session_url`) so two rooms with the same
  name don't collide. It publishes `huddle.room.created`.
- **List:** `GET /api/v1/huddle/rooms` returns non-retired rooms, most
  recently active first (`REST::HuddleRoomSerializer`). Who created a room is
  deliberately not shown.
- **Join:** `/hub/huddle/room/:id` (`features/live/room.tsx`) is a lean lobby
  that embeds Jitsi on the room's key. No PiP.
- **Retire:** `Scheduler::HuddleRoomReaper` runs daily at 03:15 UTC and
  soft-retires rooms whose `last_active_at` is more than six months old
  (`HuddleSession#retire!` sets `retired_at` and publishes
  `huddle.room.retired`). The row stays so old links resolve. If people want
  the room back, they make a new one. The name isn't precious; the moment is.

**3. Krew Huddles.** The design is one Huddle per Krew, joinable only by its
members. **Not built.** `krew` is a valid scope value but no code creates or
reads one. A Krew can turn on "huddle" in its korner list (`KrewKorner`), but
that tile just links to `/hub/huddle`. See [Open](#open).

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
`Event.event_type`, and `events.huddle_url` still exists.

## Data

- `huddle_sessions`: `title`, `description`, `icon`, `scope`, `state`
  (`draft | scheduled | live | ended`), `session_url` (the Jitsi room key),
  optional schedule, `host_account_id` (the creator for Rooms),
  `last_active_at`, `retired_at`, optional `status_id`.
- `huddle_participants`: one row per join, with `joined_at` / `left_at`.
- `/huddle` redirects to `/hub/huddle` (`config/routes.rb`).

## Open

- **Krew Huddles.** Not built (see above). Undecided: what happens to a
  Krew's Huddle when the Krew is archived, and whether a Krew can remove one.
- **Activity tracking is not wired.** Nothing writes `huddle_participants`,
  calls `bump_activity!`, or calls `start!` / `end!`. So room occupancy in the
  list is always 0, `last_active_at` never moves after creation, and the reaper
  will retire a busy room six months after it was made. Joining a room needs to
  record activity.
- **`/api/v1/huddle_token` has a route but no controller.** Both lobbies fetch
  it for a Jitsi JWT and fall back to joining without one.
- **The Main Huddle row is unused.** The page hard-codes the Jitsi room. Either
  read the row or drop it.
- **Capacity.** The design says rooms cap at about 35 people (Jitsi's practical
  ceiling) with a plain "full right now" message, no overflow. Nothing enforces
  it.
- **Feed card and notifications.** The manifest marks `huddle_card` and the
  three notification types as `planned`. Session content is never meant to
  persist, so it's open whether a card should exist at all.
- **Room names.** Duplicates are allowed. Undecided whether to warn on create
  ("did you mean this room?").
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
