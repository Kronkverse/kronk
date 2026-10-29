# Huddle (`huddle`)

**Manifest:** `config/korners/huddle.yaml` · **Mount:** `/hub/huddle`

Huddle is a live hangout: drop in, be around each other, chat, work side by
side. Not a meeting and not a livestream. Video, audio and screen share run on
a Jitsi server, embedded in the page with the Jitsi iframe API. The Booth's
live sets use the same server, in rooms of their own (`docs/spaces/booth.md`,
Live sets). This doc describes what is built as of 2026-10-27.

## The Jitsi server

Kronk's own server takes people only with a pass, a token Kronk signs
(decisions.md, 2026-10-27, "Kronk's own Jitsi"). The server is configuration,
not code, read once in `config/initializers/1_kronk_jitsi.rb`:

| Variable                 | What it does                                                                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `JITSI_DOMAIN`           | The server's bare host (default `meet.talitamoss.info`, the old open one). Reaches the CSP, Kalendar's Huddle events and the web client (`jitsiDomain` in `initial_state.ts`). |
| `JITSI_JWT_SECRET`       | The shared HS256 secret. Blank: no tokens, and Kronk works on an open server as it always did (no Record either).                                                              |
| `JITSI_JWT_APP_ID`       | The token's `iss`, the server's app id. Default `kronk`.                                                                                                                       |
| `JITSI_ROOM_PREFIX`      | Put before every room name Kronk hands Jitsi (shadow sets `shadow-`), so two Kronks can share a server. Applied in passes, the head count and who-is-in; never stored.         |
| `JITSI_RECORDING_SECRET` | Signs the recorder's calls to Kronk (Recordings, below). Blank: those endpoints are off.                                                                                       |

Never put a value in the repo; they live in the environment.

One setting lives on the Jitsi server itself: `config.brandingDataUrl`
pointed at Kronk's `/api/v1/calls/branding`, which rewords Jitsi's own
sentences for a Booth live set and leaves every other call as Jitsi says it
(`docs/spaces/booth.md`, Live sets, The words).

- **Passes.** `POST /api/v1/calls/token` with `kind` (`huddle`, `kuddle` or
  `booth_live`) and `id` answers
  `{ domain, room, jwt, moderator, recording }`. `room` is the Jitsi name
  (prefix included), `jwt` is null without a secret. The token is HS256, `iss` the app id, `aud` `jitsi`,
  `sub` `meet.jitsi`, `room` that one room, `iat`, `nbf` (a minute back, for
  clock drift) and `exp` two hours on, and `context.user` with the member's
  `id`, `name`, `avatar`, `moderator` and `affiliation` (`owner` for a
  moderator), which the server's `mod_token_affiliation` reads. Who gets one,
  and who moderates, is `Kronk::CallTarget`: the Main Huddle, every
  signed-in member (staff moderate); an open Kuddle, anyone signed in (its
  maker and staff moderate; a retired one is a 404); a live set, whoever
  its reach allows while it is live (the host and staff moderate). Someone
  who can't see the call gets a 404.
- **One module.** `mastodon/jitsi.ts` checks the host, loads the server's
  script once, asks for a pass (`getCallPass`) and embeds the call
  (`createCall`) with one configuration: Jitsi's toolbar, pre-join screen,
  deep links, invites and watermarks off, the name from Kronk.
- **Kronk's controls.** `<CallControls>` (`components/call_controls.tsx`)
  sits under every call: mic, camera, share screen, raise hand, tile view,
  leave, and Record / Stop recording for a moderator when the pass says
  recording works. It sends the call's API commands and shows what the
  call's events report (mute, sharing, hand, tile view, recording, whether
  you moderate). While a call is recorded everyone in it sees "Recording"
  at the start of the bar. Leave is there before the call comes up, so a
  call that never loads can still be left. The Main Huddle and Kuddles
  also have **Sound input** (`inputPicker`): pick the microphone or sound
  card, with a level meter (`docs/spaces/booth.md`, Music sound, which
  also has a live set's own settings).

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

- The page asks for a pass into a fixed Jitsi room named `huddle` (with
  `JITSI_ROOM_PREFIX` before it). It does not read the `scope: main` row,
  which a migration seeds as a singleton
  (`AddRoomScopeToHuddleSessions`; `HuddleSession` validates there is only
  one).
- The lobby polls Kronk for who is in the room (`GET /api/v1/calls/presence`,
  which asks the Jitsi server; it answers only Kronk). The home feed's
  `LiveBanner` shows a banner when someone is there, from Kronk's own count
  (`GET /api/v1/huddle/count`, the minute-old figure below), not from Jitsi:
  Jitsi answers an empty room with a 404, which every browser logged as a
  failed load on every poll.
- **The call follows you.** Leaving the Huddle page mid-call doesn't end
  it: the call shrinks into a small floating window (`HuddlePip`,
  `features/huddle_pip/`), like a video player's picture-in-picture (Tal,
  2026-10-19). You still see the call and it still sees you, mic and camera
  on. The window has a top bar to drag it by (where you leave it is kept on
  the device), the people count, and Kronk's call controls in a compact
  form, with a way back to the Huddle. Their state (muted, hand up,
  recording) belongs to the call, so the window shows what the page
  showed. On a phone it is smaller and sits above the tab bar.

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
  (`features/live/room.tsx`) has no lobby: it asks for a pass on the room's
  key and embeds the call straight away, under a slim bar with the room's
  name and Follow, with Kronk's controls under the call (their leave is
  Unhuddle). Unhuddle goes back to `/hub/huddle`, and so does the Frame's
  `← Huddle` badge (the page draws no back chip of its own). Under the
  controls are the Kuddle's recordings, if it has any. A room
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

When a session ends, nothing survives: no transcript, feed card or "Alice was
here" trace. Huddles are the moment, not the artefact. Only the room's
identity lasts (Main forever, Rooms until the reaper).

**Recordings are the one exception** (Tal, 2026-10-27; decisions.md,
"Kronk's own Jitsi"). A call can be kept when whoever runs it decides to.
That stays true to the rule because a recording is never silent: only a
moderator (the Kuddle's maker, a live set's host, staff) can start one, and
everyone in the call sees "Recording" while it runs. Nothing about who was
there is kept with it. Without `JITSI_JWT_SECRET`, `JITSI_RECORDING_SECRET`
and S3 storage, nobody sees Record and nothing persists at all.

## Recordings

The server's recorder (Jibri) records a call to a file, and when it stops,
a finalize script on the Jitsi server hands the file to Kronk.

- **Who sees one.** A Kuddle's: anyone who can see the Kuddle. The Main
  Huddle's: every signed-in member. A live set's: its host (and staff),
  for them to publish as a set (`docs/spaces/booth.md`, Recording a live
  set). Who may delete: the Kuddle's maker, the set's host, staff; the
  Main Huddle's, staff. Deleting takes the file too. `CallRecordingPolicy`
  and `Kronk::CallTarget` hold the rules.
- **Where they show.** Under a Kuddle's call and in the Main Huddle's
  lobby (`<CallRecordings>`, `components/call_recordings.tsx`): each with
  its date, Video or Sound only, and length, Play (inline), Download and
  Delete for whoever may. Nothing shows when there are none.
- **Video and audio.** A recording can come as a video file, an audio
  file, or both (`media`; each of a pair points at the other, `pair_id`).
  A live set's audio file becomes a draft set for its host
  (`docs/spaces/booth.md`, Recording a live set). Elsewhere it is a
  recording like any other.
- **Storage.** A private object under `call_recordings/<random>/<filename>`
  (after `S3_KEY_PREFIX`) in the bucket Paperclip already uses
  (`Kronk::CallRecordingStorage`), uploaded straight there by the recorder.
  Never a public object: `GET /api/v1/calls/recordings?kind=&id=` lists the
  ready ones with signed URLs, `url` to play (three hours) and
  `download_url` to save (ten minutes);
  `DELETE /api/v1/calls/recordings/:id` deletes one. The CSP's
  `media-src` allows the bucket's own host. Without S3 (local development) recording is off.
- **The recorder's side** (`Api::V1::Calls::RecordingUploadsController`),
  the contract the finalize script follows. Every request is signed:
  `X-Kronk-Timestamp: <unix seconds>` and
  `X-Kronk-Signature: sha256=<hex HMAC-SHA256 of "<timestamp>.<raw body>">`
  with `JITSI_RECORDING_SECRET`, refused (401) if wrong or more than five
  minutes off. Bodies are JSON (`Content-Type: application/json`).

  The script runs these three steps **once per file**: for the video, then
  for the audio (either order works), with the same `room` both times.
  1. `POST /api/v1/calls/recordings/start` with
     `{ "room", "filename", "size", "media" }`, and optionally
     `"duration"` (whole seconds) and `"started_by"` (a Kronk account id,
     the moderator's pass's `context.user.id`):

     ```json
     {
       "room": "booth-3f9c…",
       "filename": "friday_2026-10-27.m4a",
       "size": 81234567,
       "media": "audio",
       "duration": 5400
     }
     ```

     - `room` is the Jitsi room name. Kronk takes `JITSI_ROOM_PREFIX` and
       any `@muc…` off it and finds the Main Huddle, a live set
       (`room_key`) or a Kuddle (`session_url`); anything else is a 404.
     - `filename` is plain (`[A-Za-z0-9][A-Za-z0-9._-]*`, up to 200
       characters) and its extension says what it is:

       | `media` | Extensions and the `Content-Type` Kronk asks for                                               |
       | ------- | ---------------------------------------------------------------------------------------------- |
       | `video` | `.mp4` `video/mp4`, `.webm` `video/webm`, `.mkv` `video/x-matroska`                            |
       | `audio` | `.m4a` `audio/mp4`, `.ogg` `audio/ogg`, `.opus` `audio/ogg` (Opus in Ogg), `.mp3` `audio/mpeg` |

     - `media` is `"video"` or `"audio"`. Left out, the extension decides
       (so an older script's `.mp4` is a video). A `media` the extension
       doesn't match, or any other value, is a 422.
     - `size` is bytes; over 4 GB is a 413.

     It answers 201
     `{ "id", "media", "pair_id", "upload_url", "upload_method": "PUT", "upload_headers": { "Content-Type": … }, "expires_in": 3600 }`,
     and the row is `pending`. `pair_id` is the other file of the same
     recording when Kronk found it: the newest unpaired file of the other
     medium for the same call, started within the last two hours (so on
     the second file's start, it's the first file's `id`; on the first,
     null).

  2. `PUT` the file to `upload_url` with exactly `upload_headers`, within
     `expires_in` seconds. This goes to storage, not to Kronk.
  3. `POST /api/v1/calls/recordings/<id>/complete` with `{}` or
     `{ "duration" }`. Kronk checks the object is there and marks the row
     `ready`: 200 `{ "id", "media", "status": "ready", "size" }`; 422 if
     nothing is uploaded yet (the script can PUT again and repeat); 413,
     and the file deleted, if it's over 4 GB. Completing a ready one again
     answers 200 and changes nothing.

  A live set's audio, once complete, is made into the host's draft set in
  the background; the script doesn't wait for it. If the script uploads
  only a video, the host gets the recording as before and uploads a set
  by hand. Copying Jibri's own audio into `.m4a` (`ffmpeg -i in.mp4 -vn
-c:a copy out.m4a`) adds no second loss; its quality is whatever
  Jibri's encoder was set to, and Kronk makes a set's audio MP3 like any
  upload.

- **Data.** `call_recordings`: `kind` (`huddle | kuddle | booth_live`),
  `huddle_session_id` or `booth_live_id`, `started_by_account_id`,
  `media` (`video | audio`, default `video`), `pair_id` (the other file of
  the same recording), `status` (`pending | ready`), `storage_key`,
  `filename`, `content_type`, `size`, `duration`, `completed_at`.

## Moderation — flat and distributed

The intended rule: every participant has the same powers (mute someone, remove
someone from the current session), with no host role, so moderation is never a
prize. No room locks or permanent bans; those would go through Krew governance.
Kronk code does not implement any of this. With passes, the server makes a
Kuddle's maker and staff (and a live set's host) moderators, which today
means they can record; Kronk's controls offer nothing else a moderator does.
The manifest's `maintainers: [moderator]` is korner-level upkeep, not an
in-session role.

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
- **Chat and reactions** were Jitsi toolbar buttons and went with the
  toolbar. Bringing them back means Kronk controls for them.
- **Recordings left behind.** A `pending` row whose upload never finished
  stays (nobody sees it). Deleting an account removes its Kuddles and live
  sets at the database, and their recording rows with them, but not the
  files. Both want a sweep.
- **Kalendar's Huddle events** still store a link straight to the Jitsi
  room (`events.huddle_url`), which a token-only server won't open.
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
