# Rebuild decisions

Append-only. Newest first. One entry per decision, dated, with the reasoning
and what it supersedes.

**Why this file exists.** Until 2026-07-19, rebuild decisions were kept
deliberately _outside_ the repo, in the maintainer's working notes. That
produced a failure worth remembering: a settings IA was "locked" on 07-12 in
a note; a different settings IA was written into `docs/spaces/settings.md`
on 07-15; and on 07-18 the node registry was built from the repo doc — the
only one its author could see — matching neither. A decision nobody working
in the repo can see is not a decision; it is a trap for the next person.

**Precedence when sources disagree: code > repo docs > anything outside the
repo.** Repo docs are not automatically right — several describe the intended
end state in the present tense and read as fact. Verify against code.

---

## 2026-10-30 — The Android app is the website

Tal asked for an Android app that keeps up with the site without a second
codebase: "functionality is growing rapidly and it's going to be a huge load
to carry both the main code AND the app for every update". The Mastodon-based
app rebuilt Events and Huddle natively, crashed on 2.0's reach ladder and has
been answered with "Kronk has moved to the web" since (`Kronk::LegacyAppGate`);
the September native rewrite (kronk-app #66–70) had the same shape.

**Decision:** the app is a Trusted Web Activity (`Kronkverse/kronk-app`,
rebuilt from Bubblewrap): an APK that opens Kronk full-screen in the phone's
browser engine. Every deploy is in the app at once, with no app work. Push,
sharing in, camera and files are the site's own web features. Not iframes
per korner, because the shell would then own navigation and every new korner
would need app work; not a WebView shell, because web push doesn't work in one.

- **Two apps.** `info.kronk.app` opens kronk.info and is signed with the
  existing release key; `info.kronk.app.shadow` opens shadow.kronk.info with
  its own key, for testing. Both keys are in `public/.well-known/assetlinks.json`,
  which is what makes the app full-screen (without a match, the browser
  shows its address bar).
- **The site knows it's the app** from the launch URL
  (`/?source=app&app=<versionCode>`, `utils/android_app.ts`). There it offers
  the app's update instead of "add to home screen".
- **The app has its own version**, year.month (`2026.11`, code 20261100),
  not Kronk's: 3.0 is Kronk-native federation (Tal). The code stays above the
  legacy app's 21401 so that app's updater, which reads
  `kronk.info/version.json`, offers the new one and it installs over it.
- **Android 7.0 (API 24) and up**, the TWA library's floor (Tal: fine).
- On a phone whose default browser can't run a TWA, it opens as a browser
  tab with the address bar showing, which keeps push.

## 2026-10-30 — Emergences live inside Krews

Tal's proposals "More interconnectedness with krew space", "Access of a FTD
space" and "Coalesce": FreeTheDream and Krew felt like a vague duplication.
If you join a Krew you should be in its projects, and a project made for a
Krew should be only as open as the Krew. Tal: one Krew can have several, and
FreeTheDream can come off the Hub.

**Decision:** an emergence lives in a Krew (`krew_id`, required for a new
one), and a Krew holds any number. The Krew's people are each emergence's
people; joining is the Krew's way in, and leaving is leaving the Krew. Who
sees an emergence follows the Krew: anyone signed in when the Krew is
listed, only its members when it's invite only. The Krew page shows them as
Konnected tiles (the link is made with the emergence and can't be taken
off), and New emergence is started there. FreeTheDream leaves the Hub and
the rail (`hub_visible: false`, a new manifest field) but keeps its pages.
Mycelium is hidden until it has a clearer home. An event linked to the Krew
is the Krew's, no longer also its one emergence's.

**Supersedes** 2026-10-15 (seeding an emergence makes its own Krew, named
after it, joining set per emergence). docs/spaces/freethedream.md, The Krew.

## 2026-10-30 — First Nations Country is always on the map

@mangobee: First Nations Country should be the full-time view of Australia on
the map, not a feature you switch on.

**Decision:** the Country shapes are always drawn on the map, with no switch,
and the stored on/off choice (`kronk.map.country_layer`) is gone. "Find a
Country", the boundaries note and tapping a Country stay. Zoomed in a little,
a line at the bottom names the Country under the middle of the map. This
supersedes the switch from 2026-10-23.

## 2026-10-30 — First Nations Country names are an open list

@mangobee: Country names and sectors are still being found, so every name
people give should join the list, and the list should stay open; the matter is
taken seriously.

**Decision:** names live in `map_country_names` beside Kronk's own list. Every
name typed on a profile (born on or living on) joins it at once, and anyone can
add another name to a Country from its card on the map, which ties it to that
shape. Each name records who added it. Only stewards (admins and moderators;
@mangobee and Tal) take a name off, and a name taken off stays off rather than
coming back when typed again. Kronk's own list and the names on the map's
shapes are not editable from the app.

## 2026-10-29 — Tag only your Mates in photos and Moments

Tal: photo and Moments tagging should be Mates only, like @mentions now
are (the earlier entry today, "Tag only your Mates").

**Decision:** every Tag people picker (a post's photo, tagging in a photo
you can see, a Moment) suggests only your Mates, through the same Mates
search as @mentions, and `POST /api/v1/media/:id/tags` refuses anyone but
yourself or a Mate with a 422. Albutts tags with @names, so a caption or
album description nudges only Mates who can open the album. Tags made
before stay. Booth's artist credits are not tags and are unchanged.

---

## 2026-10-29 — Kuddles outlive their maker's account

Tal, on purging an account also deleting the Kuddles it had started and
their recordings: "Kuddles aren't owned by anyone, the live sets are".

**Decision:** a Kuddle stays when the account that made it is purged.
`huddle_sessions.host_account_id` is now nullable and its foreign key
`ON DELETE SET NULL` (it was `CASCADE`), so the Kuddle and its recordings
are kept with no maker. A Kuddle with no maker is looked after by anyone
signed in (Konnecting it, taking off what others Konnected) and moderated
by everyone in it, as the syntropic rule and Huddle's flat moderation
(`docs/spaces/huddle.md`) ask. Live sets are owned: a purged host's live
sets, and so their recordings, still go with the account.

---

## 2026-10-29 — Rows may scroll sideways on a phone; the page doesn't

Tal, asked whether Wachuneed's Offered, Desired and Shops rows could scroll
sideways: "the kommunity disover space has a horizontal scroll designed
specifically for phones, and portals recent work just created a horizontal
scroll. This should definitely be a thing on phones."

**Decision:** a row of tiles inside a page may scroll sideways on a phone,
with the next tile peeking in, as Kommunity Discover and Musik's rows do.
Build it with the shared row (`<SpaceGrid layout='row'>`), not a hand-rolled
one. The page itself still scrolls only up and down: Stage shapes keep
`overflow-x: hidden`, wide content wraps, and there is no swiping between
whole panes. This narrows the 2026-08-13 rule ("only vertical scroll"),
which had been read as banning every sideways row. FreeTheDream keeps the
grid it moved to on 2026-10-22; Tal chose that over bringing its rows back.

---

## 2026-10-29 — Recordings can't be deleted

Kommons "Recordings" (Tal): "Also it appears anyone can delete? Maybe once
recorded, they live forever?" Until now the Kuddle's maker, a live set's
host and staff could delete a call's recording, file and all.

**Decision (Tal):** once recorded, a recording is kept. Nobody deletes one
through the app: the Delete button and `DELETE /api/v1/calls/recordings/:id`
are gone (staff included), and a live set that has a recording can't be
deleted, since that would take its recordings. There was no admin or
`tootctl` path to keep. Supersedes "The Kuddle's maker, the host or staff
can delete one, file and all" in 2026-10-27, "Kronk's own Jitsi".

The proposal's other two asks (a running count beside "Recording", and a
video and its sound file listed as one recording) landed in #2426.

---

## 2026-10-29 — Only on a Mate's profile

Kommons "Posting to mates profile". Tal: "the 'me' option isn't so it's
invisible, it's so it doesn't appear on feed. So posting to a Mate's timeline
means it appears to you and your Mate, but not the general timeline, but if
someone views the Mate's timeline, they'd see it."

**Decision:** "Just me" keeps meaning only you, everywhere. On a Mate's
profile the composer's narrowest rung is **Only on <name>'s profile** instead.
It is stored as `self_only` with `profile_account_id` set (no new
visibility): it enters no home feed, stream or search and cannot be boosted,
and the profile shows it to anyone who can see that profile, and to the
author. The owner is still nudged. Comments under it follow it. It carries no
Krews or added people, since those would put it in feeds. Supersedes the
rule (2026-10-12) that a post on a profile cannot be Just me.

## 2026-10-29 — Tag only your Mates

Tal: "users should only be able to tag their mates." Kronk holds to "No
reach without consent": a mention reached anyone, since @-suggestions listed
every member (Mates first) and a typed handle told whoever it named.

**Decision:** every @-suggestion (the composer, comment boxes, album
captions) lists your Mates only, searched on the server
(`GET /api/v1/nudges/mates?q=`). The "mentioned you" nudge goes only to Mates
of the author who can open the post (`Kronk::MentionNudges`), for new posts
too: since #2386 a new post's mentions nudged no one at all. A non-Mate's
handle typed by hand stays a mention link and still gets the engine's legacy
`mention` notification, which shows only in the legacy archive and doesn't
push. Taking it out means changing Mastodon's `ProcessMentionsService` and
its specs, and is left open.

## 2026-10-29 — Composer options are kit pills

Kommons "Composers are too busy" (Tal, 2026-10-21, from Albutts): the drafts
area at the top was too busy, and the options at the bottom were poorly
designed. The drafts half was already done by "Drafts are quiet"
(2026-10-22): one quiet line under the body, only when a draft came back.

**Decision:** the options a composer offers are the kit's `<KornerPill>`s,
the chosen one lit (`active`), as Booth's and Maps' composers already do;
small actions inside a composer (Keep it mine, Retry) are `<KornerPill>`s
too. The album composer's bespoke chips (who can add photos, who sees a Krew
album) and ghost buttons moved over, and `<ComposeShell>`'s footer reads
only tokens (`--accent`, `--dur-fast`, `--elevation-menu`). Nothing was
removed: which options a composer should drop is still open.

---

## 2026-10-29 — Shop sections become Kollections, shown as rows

Kommons "Kollections" (Tal, https://kronk.info/hub/kommons/p/117522474156930637):
a shop should group its products into Kollections (a line of tinctures, a
line of creams), each a row of item cards that scrolls sideways, one under
another.

**Decision:** Kollections are the shop sections that already existed
(`listing_shop_sections`: named, ordered, removable, a listing in one or in
none), renamed for members. No new table: building a second grouping
beside sections would give a shop two ways to say the same thing. The shop
page draws each Kollection as a `<SpaceGrid layout='row'>` (the shared row,
under the 2026-10-29 phone rule that a row of tiles may scroll sideways
while the page scrolls only down), with "Everything else" last; a shop with
no Kollections keeps the grid. The owner fills them from the shop page
(Arrange Kollections, Add an item at the end of each row, Add a Kollection)
as well as from Shop details. Code and the API keep `section`.

Not yet: a new item made from a row's Add an item tile does not land in
that row's Kollection by itself; the shop item composer would need to take
the Kollection, and that composer is being reworked for Goods & Services.

---

## 2026-10-29 — No Konnect row in the proposal composer

Kommons "'Konnect' Button" (Tal): "The proposal composer probably doesn't
need a 'konnect' button." Writing a proposal is saying what should change;
what it relates to is added after, on the proposal's page.

**Decision:** the proposal composer passes `konnect={null}`, so it draws no
Konnect row, and its drafts no longer keep Konnections. Proposals still take
Konnections: the proposal page's Konnected section is unchanged, and a
proposal made from a record's Konnect picker (New proposal) is still
Konnected to that record. An exception to "One composer, one Konnect"
(2026-10-23) and Korner Standard L14, for this composer only.

## 2026-10-29 — The proposal composer opens over the page you are on

Starting a proposal from anywhere (the Ж menu's Propose a change, the Hub's
Propose a Korner tile, a space's settings) sent you to Kommons and opened the
composer there; cancelling went back by navigating again (Kommons "Proposer
Composer", Tal: "it just opens the composer for a proposal over the top of
whatever page you're currently on").

**Decision:** every way into the proposal composer from inside the app opens
it over the current page, through the modal root (`useOpenProposer`, the
`PROPOSER` modal), with the scope as a prop. The address doesn't change and
Cancel or Back leaves you where you were. After opening one, inside Kommons
you land on the proposal; elsewhere you stay and are told it's open, as
before (2026-10-12). The `/hub/kommons/composer` route stays for links and
the Konnect picker's New proposal; `state.returnTo`, which carried the way
back, is gone. Detail: `docs/spaces/kommons.md`.

## 2026-10-27 — The composer title is a text box

The title at the top of every composer (`<ComposeTitle>`) was drawn as a
heading: the display serif on a bare underline, no box. People read it as a
heading and not as somewhere to type (Kommons "Title doesnt look like a
text box", Tal).

**Decision (Tal):** the title is boxed like every other field in the kit
(same border, radius, surface and focus ring as `<ComposeInput>`) and keeps
the display serif at its larger size, so it still reads as the record's
name. Supersedes "the display serif, no box" in Korner Standard L13
(2026-10-23, One composer, one Konnect).

## 2026-10-27 — Booth live: music sound, the crowd on screen, recorded into a set

The Booth's live sets ran on a voice call: the browser cleaned the music
up as if it were speech, listeners joined as full participants, the crowd
had no way to be heard, and a recording had to be downloaded and uploaded
again to become a set (`docs/spaces/booth.md`, Live sets).

**Decision (Tal):**

- **Music sound.** A live set's call is stereo Opus at 510 kbps both ways,
  and the host's browser does no voice processing (`disableAP` and the
  four single switches). **Music sound** under the room turns processing
  back on for talking. Only `booth_live` calls; the Huddle is a
  conversation and stays one. **Sound input** (pick the USB sound card,
  see its level) is under every Kronk call, because a Kuddle has
  musicians in it too.
- **Listeners listen.** They open no microphone or camera, have no
  shortcuts or controls to be heard, receive video from at most three
  people, and pin the host. The bridge then sends each listener one
  stream, which is what lets a room grow.
- **The crowd on screen.** Shoutouts, reactions (Froth, Applause,
  Rewind!) and track requests, and the host's Now playing, are rows of
  their own (`booth_live_moments`), inside the set's reach and only while
  it's live. Kronk draws them over the call for everyone, and the host's
  page sends each into the call as a small versioned JSON message
  (`{ kronk: 1, type, name, text, at }`, documented in booth.md), so a
  script on the Jitsi server's page draws them for the recorder. The room
  polls every four seconds: the streaming server has no per-set channel
  with a reach check, and adding one is more than this needs.
- **The host's page is the one sender into the call.** Each moment then
  arrives once, whoever sent it and wherever they were.
- **Recorded into a set.** The recorder uploads a video and an audio file
  of each recording (`media`, paired). A live set's audio becomes an
  unpublished `live_recording` set for the host, with the live set's
  title, words, genres and Now playing as its track list, and the host is
  nudged to publish it. A set's audio is a `MediaAttachment`, so a job
  downloads the file and attaches it like an upload (Paperclip's MP3
  transcode, length and media path), rather than copying the object in
  storage, which would skip all three.

**Not attempted:** Jitsi's visitors mode for audiences past about 100;
co-hosts and a cover for live sets; copying a live set's shoutouts onto
the set (the set may reach more people than the live set did); the
overlay script itself, which lives on the Jitsi server and is Tal's.

**Why:** the Booth is for music made by people on Kronk, and a live set
is where a musician meets the crowd. Sound that sounds like the set, a
crowd that can be seen and heard on screen and in the recording, and a
recording that becomes the set without a download and an upload, make
going live worth doing.

---

## 2026-10-27 — Booth albums are sets made of tracks

Cassidy's Kommons proposal "Albums to live in Musik?"
([#117292076963057258](https://kronk.info/hub/kommons/p/117292076963057258),
on `booth.index`) asked for music albums to live in the Booth. Albutts'
albums are photo albums, which is where the confusion came from. Tal: "if
we can ensure that someone in the Booth can upload an album, then we can
close this proposal."

Before this, a set was one audio file with an optional timed track list.
One long file with timestamps is a mix, not an album: listeners can't
skip cleanly between songs and the musician has to stitch their files
together first.

**Decision:** an album or EP is a `BoothSet` of kind `album` or `ep`
whose audio is an ordered list of tracks, each its own uploaded file
(`booth_set_tracks`), in place of the single file. Every other kind is
unchanged. See `docs/spaces/booth.md`, Albums.

- **A kind of set, not a new record.** An album shares everything a set
  has (title, cover, credits, notes, genres, saves, shoutouts, plays, the
  feed card, Konnect, Musik and My sets), so a separate `BoothAlbum`
  would have repeated all of it. Two kinds rather than one `album` with
  a flag, because musicians say "EP" and the filter can tell them apart.
- **Tracks are their own table**, not a jsonb list like the timed track
  list: each one holds an upload, and uploads need a real foreign key to
  be protected from deletion (`on_delete: :restrict`, as for set audio,
  2026-09-04) and the media vacuum.
- **Plays count per album**, not per track: the number is the artist's
  sense of who listened, and moving between tracks isn't a new listen.
- **An album plays straight through** regardless of Play next, which is
  about moving on to another set.
- **No converting** between an album and one recording on the edit form:
  it changes what the files are, and is better done as a new upload.

---

## 2026-10-27 — Brands live in Wachuneed, listed by backing

Tahlia's Kommons proposal "Reccomened brands space"
(https://kronk.info/hub/kommons/p/117432251243226073): "We all have many
friends doing really cool shit, let's collate them all here together and
support our wider Kommunity", in categories such as clothing or art.

**Decision (Tal):** a **Brands** section inside Wachuneed, not a new
korner: brands whose mission members have looked into and respect.

- **Anyone proposes, members decide.** Any member proposes a brand (name,
  website, why we back them, an optional category and picture). It joins
  the list once three members back it, the proposer counted
  (`WachuneedBrand::BACKERS_TO_LIST`); until then it waits under
  Proposed. No steward approves a brand: backing is the gate, spread among
  the people who use the list (Err syntropic, 2026-10-19). The threshold is
  a constant so it can move without a migration.
- **Undo after the fact.** The proposer edits or takes down their own;
  staff who handle reports can remove any. No report flow of its own.
- **No ranking.** Listed brands go A to Z, Proposed newest first, never by
  backing count: the count is shown, not used to order.
- **Not a listing.** A brand sells nothing through Kronk, has no reach
  (every signed-in member sees it), no feed card and no Konnections. Its
  own tables (`wachuneed_brands`, `wachuneed_brand_backings`) rather than a
  third listing `kind`, which would have dragged price, reach, photos and
  requests along with it.
- **Told once.** The proposer is nudged the first time their brand is
  listed, not each time it crosses back over three.

Detail: `docs/spaces/wachuneed.md`, Brands.

---

## 2026-10-27 — The Krew page lists the Krew's posts again

Kommons "Krew space feed"
(https://kronk.info/hub/kommons/p/117503771043856693), Tal: "The feed in a
krew page should show posts and content specific to the krew in a
scrollable fashion."

**Decision:** members see the Krew's posts on the Krew page, last, below
the chat: the standard feed card in the standard timeline, newest first,
loading more as they scroll (`GET /api/v1/krews/:id/statuses`, now with
`max_id` paging and a `Link: rel=next` header). Someone outside the Krew
sees nothing new. What's happening stays on top as the short summary; the
list is where you go on to read.

**Supersedes:** the part of 2026-10-18 (What's happening on top) that took
the list of the Krew's posts off the page. That list was the first tile,
open on arrival, and made the page clunky; this one sits at the foot of the
page and opens nothing on arrival. See `docs/spaces/krew.md`, The surfaces.

---

---

## 2026-10-27 — The Map's badge counts Mates' pin moves

Kommons "Notifications on location updates"
(https://kronk.info/hub/kommons/p/117482796448402351): when a Mate adds their
location or moves it, show it on the Map's korner card.

**Decision:** the Map's unread badge counts a Mate placing or moving their pin
since you last opened the Map, on top of its trek posts. Only pins you could
see on the map count. A pin is one row per person, overwritten in place, so it
has no new id to count by: it counts by `placed_at` against the time inside the
baseline id (ids are time-based), and opening the Map advances the baseline to
now. It is the first badge counted by time rather than by id; an adapter whose
updates aren't one relation answers `#unread_count` itself
(`Kronk::KornerSeen.counts_for`). No nudge and no push.

---

## 2026-10-27 — Kronk's own Jitsi: passes, Kronk controls, recordings

Kronk's calls (the Main Huddle, Kuddles, the Booth's live sets) move from
an open Jitsi server anyone could walk into to Kronk's own, which lets
people in only with a token (JWT) Kronk signs. With the server knowing who
is who, Kronk can draw its own controls and keep recordings.

**Decision (Tal):**

- **A pass per call.** `POST /api/v1/calls/token` (`kind`: `huddle`,
  `kuddle` or `booth_live`, and `id`) gives the room's Jitsi name and an
  HS256 token good for two hours, for whoever may join: every signed-in
  member for the Main Huddle (tuning out of Huddle quiets its feed and
  nudges, not the room), anyone signed in for an open Kuddle (a retired one
  is a 404), and whoever a live set's reach allows while it is live (its
  host from when it's planned). The Kuddle's maker, the set's host and
  staff (`manage_reports`) get a moderator's token; the Main Huddle has no
  maker, so only staff. `Kronk::CallTarget` holds these rules.
- **Configuration, not code.** `JITSI_JWT_SECRET` (blank: no tokens, the old
  open server), `JITSI_JWT_APP_ID`, `JITSI_ROOM_PREFIX` (shadow sets
  `shadow-`, so shadow and production can share one server without
  meeting; put on every room name Kronk hands Jitsi, never stored) and
  `JITSI_RECORDING_SECRET`, all in `config/initializers/1_kronk_jitsi.rb`.
  Secrets stay in the environment.
- **Kronk draws the controls.** Jitsi's toolbar, pre-join screen, deep
  links, invites and watermarks are off (`mastodon/jitsi.ts`, one config
  for every call). Kronk's bar under the call (`<CallControls>`) has mic,
  camera, screen, raise hand, tile view and leave, and Record / Stop
  recording for a moderator, everywhere a call is drawn, the mini window
  included. Its state comes from the call's events. A Booth listener's bar
  has no mic, camera or screen. The Booth's host keeps Jitsi's pre-join
  screen, the one place to pick a mixer or audio interface.
- **Recordings are the one thing a call leaves.** Huddles were "the moment,
  not the artefact" (`docs/spaces/huddle.md`, Nothing persists); a
  recording is now the one exception, by Tal's choice: a call can be kept
  when whoever runs it decides to. It stays in the spirit of the rule
  because it is never silent: only a moderator can start one, and
  everyone in the call sees "Recording" while it runs. Nothing else (who
  was there, chat, a feed card) is kept. Who sees
  it follows the call: a Kuddle's, anyone who can see the Kuddle; the Main
  Huddle's, every signed-in member; a live set's goes to its host alone,
  to publish as a set. The Kuddle's maker, the host or staff can delete
  one, file and all.
- **Files never pass through Kronk and are never public.** The server's
  recorder (Jibri) asks Kronk for a signed upload URL (HMAC with
  `JITSI_RECORDING_SECRET`), PUTs the file to a private object in Kronk's
  own bucket, and tells Kronk it's done. People play and download through
  signed URLs that expire.

**Not attempted:** chat and reactions in a call (they were Jitsi toolbar
buttons, and are gone with it); the Booth's upload taking a stored
recording directly (the host downloads it and uploads it); a sweep for
objects left behind when an account's deletion takes a Kuddle or a live
set at the database.

**Why:** an open room name was the whole lock, so a Booth listener could
unmute and anyone with a link could join. Signing passes puts Kronk's
rules (who's in, who moderates) on the server itself, and drawing the
controls ourselves makes a call look and behave like the rest of Kronk.

---

## 2026-10-27 — Rooms are Kuddles, and you can follow one

Kommons "Notification for additional Huddles"
(https://kronk.info/hub/kommons/p/117487031129520906): only the Main
Huddle sent "People are huddling"; the other rooms sent nothing.

**Decision (Tal):**

- **A Room is a Kuddle** in everything people see (list, composer,
  Konnect noun, nudges, the share card). Code, tables and the API keep
  saying room. The page moves to `/hub/huddle/kuddle/:id`; the old
  `/hub/huddle/room/:id` forwards.
- **Follow / Unfollow a Kuddle.** Its maker follows it. A Kuddle its
  maker Konnected to a Krew they are in is followed by every member of
  that Krew, worked out from membership, not stored per person. Unfollow
  is stored (`huddle_follows.following = false`) on any Kuddle: that is
  how a Krew member stops, and it holds if the Kuddle is later linked to
  another of their Krews. Only the maker's link makes a Krew Kuddle, the
  same rule as every link that shares (2026-10-27, "Konnect shares only
  what its owner chose"), so nobody can sign a Krew up for nudges.
  "Follow" is used for Kuddles on purpose; korners are still tuned into.
- **A nudge for each Kuddle you follow**, by the Main Huddle's rules: the
  same once-a-minute watch asks the Jitsi server how many are in each
  open Kuddle with a follower (by its room key; at most 20 a run, most
  recently active first), the same number setting, once per gathering,
  tune-out, Push and quiet hours. It has its own row, on by default, so
  the Main Huddle's and the Kuddles' can be turned off apart. It says
  "People are in a Kuddle you follow", with the Kuddle named under it.
- **Not attempted:** leaving out someone who is alone in the Kuddle. The
  server gets a count, not who, so the rule is count at or above your
  number, as for the Main Huddle. The Jitsi embed and server are
  untouched; a separate Jitsi overhaul is planned.

**Why:** the people who use a Kuddle are the ones who want to hear when
it fills, and a Krew's Kuddle belongs to its members already. Computing
Krew follows from membership means nothing to backfill or tidy when
people join or leave.

---

## 2026-10-27 — The Map shows only your events

Kommons "Events on Map"
(https://kronk.info/hub/kommons/p/117483841086601552): the Map pinned every
upcoming event you were allowed to see, so it filled with other people's
events.

**Decision (Tal):** the Map's events are only your own: the ones you host,
plus the ones you're going to or interested in. Every other event stays
findable in Kalendar. An event's reach still applies: an answered event you
may no longer see has no pin. One exception keeps the event page working: its
location link opens `/hub/map?event=<slug>`, and that one event is pinned
while you may see it, answered or not.

**Supersedes:** the Map pinning every visible upcoming event (docs/spaces/map.md, Events).

---

---

## 2026-10-27 — Push can be just a ping

mangobee's Kommons proposal "Changing our Notification for web/app"
(https://kronk.info/hub/kommons/p/116684543811893646, approved by Tal):
"ping users that there is a notification awaiting them on Kronk ... gather
all notifications under one bundle", so people come to them at their own
pace.

**Decision:** push has a second way to read, chosen on
`/settings/notifications` under **How push tells you**: **Each one** (what
it did before, and still the default) or **Just a ping**. A ping is one
notification, "Something new on Kronk", with no names, words or picture,
always under the same tag so it replaces the last one, and it opens Nudges.
It is a per-person setting (`nudges.push_style`), not per device. It changes
only what a push says: the per-row Push switches and quiet hours still decide
whether one is sent. Legacy notifications that still push are sent as the
same ping, so the choice holds for everything that reaches the phone
(`docs/spaces/nudges.md`, Push).

---

---

## 2026-10-27 — Search finds Kronk's own members

Tal: "the search picks up users from different servers". Federation is
closed (limited mode, empty allowlist), but about 200 accounts from other
servers are still in the database from before, and search (the top bar,
Mate search, @-suggestions) offered them as if they were people here.

- **Search shows members only.** People: local accounts, never the
  instance actor (`Kronk::Search::PolicyFilter#filter_accounts`,
  `Api::V1::Accounts::SearchController`). Posts: members' own
  (`filter_statuses`). The upstream `AccountSearchService` is left as it
  is, so its specs and upstream merges keep working; the filter sits where
  Kronk's responses are made.
- **The instance actor's posts can't break search any more.** Two stray
  posts from May 2026 belong to it; its username is a host name, which the
  post routes refuse, so any search that matched them (pasting a kronk.info
  link into the composer did) answered 500.

---

## 2026-10-27 — Kronikles get a Series

Kommons proposal "Kronikles"
([#117504092528767330](https://kronk.info/hub/kommons/p/117504092528767330)):
"would be nice to have different types of story ie> chapters. Be great to
be able to link chapters together".

**Decision (Tal):** a **Series** record. A writer makes a Series (title,
optional description and cover) and puts their own Kronikles in it as
ordered chapters. Readers of a chapter see its Series, "Chapter N of M"
and Previous / Next; the Series has its own page with its contents
(`docs/spaces/kronikles.md`, Series).

- **A Series is seen only as far as its chapters are.** It has no audience
  of its own: each Kronikle keeps its reach and Krews, a reader sees and
  counts only the chapters they can see, and a Series with none they can
  see is a 404. A Series-level audience would either widen chapters past
  what their writer chose for each (no reach without consent) or have to
  be kept in step with them. Its writer always sees it, so an empty one
  can be filled.
- **One Series per Kronikle, the writer's own.** No shared or multi-author
  Series: Kronikles is single-author (its space doc), and putting your
  writing in someone else's Series is a reach question this doesn't need.
- **Deleting a Series keeps its Kronikles.** The Series is a way of
  reading them, not where they live.
- **One entry in the directory, not a Series face.** The directory's faces
  are one axis (All / Mine / Mates': whose writing); a Series tab would put
  a second axis on that rotator. A Series sits where its newest visible
  chapter would, so the list stays newest first with no ranking.
- **Not Konnectable on its own.** It's a secondary resource in the
  manifest: Konnect and previews check a record's audience, and a Series
  has none to check. Konnect a chapter. If people ask for it, give it an
  audience rule in `Kronk::KornerRecords` first.
- Positions are a plain `series_position` integer, rewritten whole on
  reorder (a writer's Series is small), as Art's featured pieces are.

---

---

## 2026-10-26 — Maps fall back without WebGL; feed cards can't crash the app

Kommons "error report on login"
(https://kronk.info/hub/kommons/p/117504037032494231): on a device without
WebGL, an event card's map preview on Home threw "Failed to initialize
WebGL", and nothing between it and the app-level error boundary caught it,
so the whole app showed the error page.

**Decision:** a map without WebGL says so instead of throwing. Every MapLibre
map checks `supportsWebGL()` and catches a failed construction; the pin
preview becomes a plain box with the place's name, full maps show an
`<EmptyState>`, and the pin picker keeps its search working
(`docs/spaces/map.md`, Without WebGL). Separately, every korner card in the
feed renders inside `<SilentErrorBoundary>`: one bad card disappears from its
post, the rest of the page stays. Silent rather than an error card because a
post's text still carries it, and a broken card has nothing useful to show.

---

## 2026-10-26 — Kommunity: Discover first, an Everyone list, Orb last

Tal's Kommons proposal "Landing Page"
([#117483791865274639](https://kronk.info/hub/kommons/p/117483791865274639),
on `kommunity.index`): "Kommunity landing page should be the 'Discover'
page, the Orb should be last. Also having a straight up list should be a
middle page, with a full list of 'Visible' Users (if they choose to be
visible)".

**Decision:** Kommunity's views are **Discover** (the landing view, bare
`/hub/kommunity`), **Everyone** (new, `/hub/kommunity/everyone`,
`GET /api/v1/kommunity/everyone`) and **Orb**, in that order. Supersedes
Orb as the landing view.

- **Everyone lists only people who chose to be visible to you**:
  findability `everyone`, or `orbit` when you are in their Orbit
  (`Account.kommunity_discoverable_to`, the test Discover already uses).
  `nobody` is never listed, even for their Mates or Krew: being someone's
  Mate doesn't override their choice. Blocks and mutes, either way, take
  someone off.
- **Visible Mates are in.** That is what separates it from Discover, which
  stays a place for meeting someone new.
- **Alphabetical**, by display name then username, with a name-or-handle
  search. Not by activity: a directory ordered by anything else is ranking
  the community for you. So it pages by offset rather than an id cursor.
- **Named Everyone**, not Kronkers, which is already a Discover layer.

---

## 2026-10-27 — Konnect shares only what its owner chose

An audit of Konnect found links reaching further than their makers
meant: a Mate could Konnect their own public record to someone's
Mates-only Place (their home, say) and open it to everyone; a Place's
maker could move other people's events by editing a Place they had used;
a Krew member's link to someone else's event linked it to the Krew's
emergence in its maker's name, and taking that link off took the event
out of the Krew; and the picker and the link API handed back records
their asker couldn't open.

**Decision:**

- **A Place is seen through its maker's links only.** It is seen by its
  maker and by whoever can see something its maker Konnected it to. A
  link someone else makes Konnects their record to it but never widens
  who sees it. A suspended or deleted maker's Places are seen by nobody,
  and deleting an account deletes its Places. Refines "A Place is seen by
  whoever can see something Konnected to it" (2026-10-23, Map Places).
- **A record's location is only its owner's own Place.** Besides being
  linked by the record's owner (2026-10-23), the Place must be theirs.
  Someone else's Place Konnected to it shows in the Konnected section
  but isn't where the record is, so nobody else's edit moves it, and the
  record never hands its audience an address they can't see.
- **Only the owner's link shares, and only taking that off unshares.** A
  link someone else makes between a Krew (or emergence) and a record
  stays a link: it doesn't add the emergence, and removing it leaves the
  owner's links and the Krew's place in the audience alone. Removing an
  owner's link still takes an event off its Krew and emergence together
  (2026-10-22).
- **Two records are Konnected once.** A link the other way round to one
  that exists is refused (422, "Already Konnected").
- **A link you can't see is not found.** Changing one needs you to look
  after one of its ends (404 if you can't see it, 403 if you can), and
  the picker offers only records you could open: a model's SQL
  visibility scope only narrows the search (Event's settles only
  invite-only), and each record is then checked as opening it would be.

## 2026-10-27 — Konnect only: leftovers removed

When Konnect became the one way to link records (2.1.4), the older ways of
doing the same job stayed beside it, so several pages offered two controls
for one thing. They are gone:

- **Krew composer:** no Korners section to tick. Konnecting or making an
  album or an event in its Konnect row already turns that space on
  (2026-10-25), so it stops sending `korner_attachments`. Access is four
  radio cards in plain words, the same as Krew settings (Open, Ask to join,
  Invite-only, Has requirements; no "invite link", no "Requirement-gated").
  "Vouched by a member" can't be set from it, as in settings, and a
  requirement row left unfinished stops the Krew being made instead of
  being dropped without a word.
- **Krew page, Albums and Events:** no "Link one of your albums/events" or
  Unlink of their own. Konnect and Diskonnect on the page do it.
- **FreeTheDream:** the event card's "Or link one of your events" and its
  own composer are gone. Make the event opens Kalendar's composer with
  `?konnect=freethedream:<id>`.
- **Event edit:** the Kalendar composer edits too, over the page, with the
  page's Konnected section left as it is. The old `CreateEventForm` and the
  unrouted Events page are deleted. An older event's own typed address
  shows there with Remove, the only location control.
- **Where it is, once.** An event, kar or listing with a Konnected Place
  shows where it is as the Place's card, not also as a line (or, for an
  event, a map) of its own. That holds for an event that also has an older
  address: the Place wins on its page. The serializers send `place_id` for
  it.
- **Kommons:** the new-Korner intro no longer mentions `config/korners/`.

**Why:** two ways to do one thing make people wonder which is right, and
whether they do the same. Konnect is the one way (2026-10-23, One
composer, one Konnect), so what it does is not repeated elsewhere.

**Supersedes:** the Krew page's own Link and Unlink (2026-10-17, Kommons
"Link Existing Albums (and more)"), Korners in Gather a Krew, the
FreeTheDream event linker, and "An event with its own typed address keeps
its map" (2026-10-26, Konnected records show themselves) when it also has a
Place.

## 2026-10-26 — A korner's post is your words and its card

Tal: going live posted "a generated text as a post 'Live now in the
Booth:...' which is a little out of spec for kronk in general, It also
shows a text link to the live space, but this is unnecessary given the
little card in the post links to the space anyway."

**Decision:** a post a korner makes for a record is the person's own words,
or the record's title if they wrote none, as albums, art, kronikles and
listings already post. The record's card shows what it is and links to it,
so the text never carries generated copy or the record's URL. The Booth
was the exception twice. A live set's Tell my feed now posts that way and
gets its own feed card (StatusBoothLiveCard): it says Live now, when it
starts, or that it has ended, and opens the room. Sharing a set does the
same with its existing card, dropping "title — artist" and the link. The
card that appeared before was the general link preview for the URL.

## 2026-10-26 — First Nations Country as shapes, not a picture

**Decision:** the Map's First Nations Country layer is drawn from shapes
traced off @mangobee's map (`first-nations-countries.geojson`), not the
picture laid over Australia. Each Country can be tapped for a card, found by
name, and opened from a profile's "On <name> Country".

**Why:** a picture can't say which Country a point is on, blurs past state
level, and its names can't be fixed without redrawing it (the limit noted on
2026-10-23). Shapes stay sharp at every zoom and carry their names as data.
Kommons "Interactive Map Build" (@mangobee) chose this, Option 2, over keeping
the picture with invisible shapes on top; community-edited borders and the
people on a Country are later steps.

**Supersedes:** the picture layer (`first-nations-country.webp`) of
2026-10-23.

## 2026-10-26 — Who is told a set is live is the host's choice

The Booth's live sets told everyone tuned in to the Booth, like Huddle's
Fomo noto, and #2339 left that for Tal to confirm. Tal: "Like all posts,
this should be a choice when posting. And also notifications should be a
choice from people."

**Decision:** a live set has a reach (`booth_lives.visibility`, the reach
ladder through Reachable). It is the reach the host gives Tell my feed in Go
live, and Just me when Tell my feed is off. The home feed banner, the Live
view, the Live now strip, the set's page and the "is live" nudge reach
those people only. Anyone who tapped Remind me is still told. The people
told keep their choice: the Booth's "Someone goes live" notification row
and tuning out of the Booth, both already there. Sets from before keep
reaching everyone, which is what they did. The rest of #2339 is left for
its author to refine (Tal: "minimise adjustments").

## 2026-10-26 — A space explains itself in About this space

Tal: "the booth has an info banner, it should be in the info part of the
floating kronk bubble."

**Decision:** About this space (the Ж bubble's i, `<SpaceInfoDialog>`, from
the manifest's `about:`) is the one place a space says what it is and how it
works. No space puts a first-visit banner or a "how it works" strip on its
own page. The Booth's "How the Booth works" strip is gone, and its points
(upload, get heard, credit, go live, save) are in `booth.yaml`'s
`about.how`. It was the only one. An empty state that links to the composer
is not an explainer, so it stays.

## 2026-10-26 — A record is named with what it is

Tal, testing on shadow with an Ember Krew, an Ember event, an Ember
emergence and an Ember album: a pop-up said (paraphrased) "Ember is
connected to Ember". "If an event is happening and has an adjacent krew
and other spaces, all wanting the same name, we need to find a better way
to indicate which space is being referred to."

**Decision:** wherever Kronk names a record, it says what the record is:
"the Ember event", "the Ember Krew", "the Ember album". Each korner that
takes links declares its word (`konnect.noun`), and `korners doctor`
requires it. The server sends each record's own word, so a FreeTheDream
gang says gang, not emergence. Konnected cards, tiles and the composer's
Konnect row show the word under the title. Same as, pop-ups, notes and
button labels say it in full (`hooks/useRecordName.ts`).

Getting around stays in the Konnected section (Tal chose this over a strip
under every title or a shared hub page): its cards (2026-10-26, below)
are how you move between the records of one situation.

## 2026-10-26 — Konnected records show themselves

Tal, on shadow: "when they're konnected, instead of just a tile under
'Konnect' they should expand out into the preview of it. For instance, in
an event, the map used to be visible on the event page, also the albums
was the same … once they're konnected, let's actually show them in a
comprehensive way. we can leave the art space for now."

**Decision:** in every Konnected section, a record with something to show
is a card above the tiles, not a tile. A Place shows its map and address,
an album up to four photos and how many, an event its date, time and
where, and a Booth set, film, kar or listing its picture. A kronikle shows
its opening lines. The card keeps the tile's audience marker, Same as and
Diskonnect. The server sends what each card draws with the attachment
(`Kronk::KonnectedPreview`), so a page makes no extra requests. Krews,
proposals, Huddle rooms, Kuestions and art pieces stay tiles for now, as
does an album with no photos.

An event whose location comes from its Konnected Place no longer draws a
second map under its details: the Place's card is the map. An event with
its own typed address keeps its map.

## 2026-10-26 — Every Krew shows how it lets people in

Kommons proposal "Krews Type"
(https://kronk.info/hub/kommons/p/117482707167518494): "There should be a
icon which shows if krews are open/closed etc. Maybe also there should be a
button for 'Join/apply' etc for visible krews, or a 'Member' if you're
already a part of the krew."

**Decision:** every Krew row (Yours and Discover) and the Krew page carry a
small muted icon beside the name for its access: open (`lock_open`), asks
to join (`person_add`), has requirements (`list_alt`), invite-only
(`lock`), each with its name as the label. On Discover the row's way in is
Join, Ask to join, or "See what's needed" (to the Krew page, where the
requirements are) for a requirement-gated Krew; a Krew you're in says
"Member" (was "You're in"), and one you've asked to join says "Asked to
join". Yours has no action column: everything there is yours. The Krew
page now lists a requirement-gated Krew's requirements to someone not in
it ("To join:"), so "See what's needed" lands on the answer.

**Why:** the only marker was a ⚿ glyph for invite-only, and invite-only
Krews aren't listed in Discover, so in practice no row said how to get in
until you opened it, and a requirement-gated row showed nothing at all. An
icon from the shared material set, not a glyph, keeps it in family.

**Supersedes:** the ⚿ invite-only glyph, "You're in", and the
requirement-gated row with no action.

## 2026-10-26 — The Mates list is for Mates

Tal: "mates list visible to their mates only." The list had been off since
2026-10-18 (Profile: one page) until it was settled who may see whose Mates.

**Decision:** `/@:acct/mates` is back, shown to the person themselves and to
their Mates. Everyone else, signed out included, gets an empty list from
`GET /api/v1/accounts/:id/mates` and no link on the Mates count; the count
stays visible to everyone who sees the profile. `hide_collections` still
hides the list from everyone but the owner, Mates included, and a profile
the viewer may not see hides it too.

**Why:** who someone's Mates are is close to who they are; their Mates are
already inside that circle, a stranger isn't. The count says how connected
someone is without saying with whom. Detail: `docs/spaces/profile.md` (The
Mates list).

**Supersedes:** 2026-10-18 (the list off), and the older rule that anyone
who could see the profile could see the list.

## 2026-10-25 — No Unmate in lists

Kommons proposal
[#117481297515130656](https://kronk.info/hub/kommons/p/117481297515130656):
"Definitely dont need an unmate button in pages like this" — a Mates list,
where every row carried an Unmate button.

**Decision:** once you are Mates, the relationship button shows nothing.
`FollowButton` (every account row: Mates lists, froth and boost lists,
hover cards, suggestions) and the profile peek card's `MateIconButton`
render nothing for an established Mate. Unmate is only on the per-person
settings screen, `/@:acct/settings`. Mate?, Mating… (withdraw) and Accept
are unchanged.

**Why:** ending a Mateship is a deliberate act about one person. A
destructive button beside every name in a list invites mis-taps and reads
as if the list were for pruning. The profile block already hid it for
Mates; this makes every other surface agree. Detail:
`docs/spaces/profile.md` (The profile block, Per-person settings).

**Supersedes:** the Unmate state of `FollowButton` and the peek card's
check-mark Unmate button.

## 2026-10-25 — Konnect is the one way into a Krew's spaces

Tal, checking Konnect on shadow: "I'm seeing 'Add a space' and 'Konnect'
in the krew space? isnt that still a double up?", and New album from one
Krew showed another Krew's name, and a Huddle could be linked from a Krew
but not made.

**Decision:**

- **No Add a space on the Krew page.** Konnecting or making an album or an
  event already turns that space on (`AlbumLinks`, `EventLinks`), so the
  tile only added an empty space. The page has its spaces' tiles, what it
  is Konnected to, then Konnect. Krew settings still turns spaces on and
  off. Supersedes "Add a space is the last tile" (2026-10-18) and Add a
  space beside Konnect (2026-10-22).
- **Every composer that Konnects is offered as New ….** Booth, Cinema,
  Huddle, Kommons, Krew, Kronikles and Kuestions read `?konnect=` since
  "Konnect in every composer" but their manifests never said
  `make: true`, so the picker couldn't make one. They do now. Booth's says
  Upload a set (Go live has no Konnect yet); Kommons goes straight to its
  composer, past the page picker that would drop the `?konnect=`.
- **A record looked up by id is that record.** The Konnect tile names its
  source by asking the candidates search for one id; the Krew and event
  visibility scopes were merged in and replaced the id condition, so the
  tile named the newest Krew or event the viewer could see. They are id
  subqueries now (`Kronk::KornerRecords.findable`).

## 2026-10-25 — Konnections carry audience: Same as

Tal: an album, a film or anything Konnected to an event should be able to
have the audience "Same as <that event>", and keep it as the event changes.

**Decision:** a record has two relationships, kept apart. **Belonging** is
who can see it, its audience: Everyone, a reach tier, or Krews (an event
made within Growers is seen by Growers alone). **Konnections** are pointers
between records. A Konnection may also carry audience: one end **follows**
the other's.

- **Following copies, then follows.** The follower takes the leader's
  audience at once, and again whenever it changes: the event opens to
  everyone, or adds a Krew, and the album does too. Chains follow down (an
  album following an event, a film following the album), never round in a
  circle. A record follows one leader at most.
- **Switching back is always open.** Taking the flag off or Diskonnecting
  stops the follow and the record keeps the audience it has; its owner
  changing its audience by hand stops it too.
- **What can be followed:** an audience of Everyone, or of Krews alone.
  Mates and Orbit are relative to the leader's owner, so nobody else's
  record can have them, and neither can an invite-only event or one for its
  maker alone: the API refuses those (422), and the composer doesn't offer
  them. A leader that later narrows to one of them holds its followers to
  their owners until it opens again: a copy never widens.
- **A follower carries what it can, and setting it is honest.** A Krew
  audience reaches a korner that has Krews (all of them now, below), and
  only Krews its owner is in. Setting a follow is refused unless the follower can carry the
  whole audience, so "Same as" never says more than it does; a later change
  it can't carry in full narrows it instead.
- **Every korner with an audience can be for a Krew** (Tal: "they should all
  have the screens"). Films, kars, kronikles, art pieces and listings get
  Krews on top of their reach, as albums have: a member sees the record
  whatever its tier, its feed post carries the Krews, the composer's reach
  control sets them (`krew_ids`, as albums send), and each Krew is a
  Konnection to it, both ways, as with albums ("its Krew is a Konnection to
  the Krew", 2026-10-23). They live in one table, `record_krews` (korner
  slug, record id, Krew), not five: the five rules are the same, and a new
  korner joins without a migration. Albums keep `album_krews` (it also says
  who may contribute) and Moments their single `krew_id`.
- **Events lead, never follow:** an event's audience is its post's, set
  when it is posted. **Booth sets** are always public: they can be
  Konnected, but never follow and are never followed. Moments take no
  Konnections, so neither.
- Anyone who can see a record can Konnect to it, as before. Only whoever
  looks after the follower sets or clears its follow.
- **Seen, and the default when it fits** (Tal: "really visible and
  intuitive"). A composer opened from a record it can follow starts on
  "Same as <that record>", and the person can always pick their own
  audience instead. Every Konnected tile says who sees its record, and a
  record's owner is told, in one line, when people who see a Konnected
  record can't open theirs. docs/design.md, Konnect, has the screens.

How: `Kronk::Audience` (one adapter per korner),
`metadata.audience_follows` on the link row; docs/korners/adding_a_korner.md
(Korner attachments §2.7).

## 2026-10-23 — Location fields become Konnect → Map

The last step of "Map Places: location is a Konnection" (below): Konnect can
now make a Place from the picker, so the composers' location fields go.

**Decision:** no composer has a location field. Where a thing is, is the
Place it is Konnected to.

- **Konnect → Map → New place.** In a composer the Konnect picker makes the
  Place right there (a name, an address if wanted, a pin on the map) and
  picks it; the record links to it when it posts. The person never leaves
  their composer. On a record's page, **New place** opens Map's Place
  composer with `?konnect=`, like any other space's **New …**.
- **Reads fall back to the Konnected Place.** An event's `location_name`
  and `location_url`, a kar's `location`, a listing's `location`, and the
  Map's event pins read the record's own old fields first and its Place
  when they are empty (`Kronk::RecordPlace`). Own fields still win, so
  older records keep what they said and the Android app, which still
  writes them, keeps working. Editing in the app sends no location, so it
  never clears or overwrites them.
- **Only the owner's link says where it is.** A Place's maker can link it
  to anything they can see; that Konnects the two but doesn't move someone
  else's record. A link counts as the location when the record's owner
  made it.

The old columns stay until the app stops writing them.

## 2026-10-23 — One composer, one Konnect

Tal, after an audit of every composer: "look at the entirety of the site …
as the network it is, not on a case by case basis … I want composers to be
standardised, I want the konnect button to be standardised. This is so people
don't have to go looking for it, they know how to use it across different
pages and spaces and korners." The audit found 20 composers with 14 field
styles (labels at 12 to 13px in three weights, titles from 18px bold sans to
22px serif), a location field in four of them, a Krew field in three, and
Konnect in some and not others; and 10 of 13 detail pages placing their own
Konnected section.

**Decision:** the platform owns how things are made and Konnected; a korner
brings only its own fields.

- One composer: `<ComposeShell>` plus the field kit
  (`components/compose_fields.tsx`), in a fixed order (Korner Standard L13).
  ESLint holds every composer to the kit; the ones older than the rule are on
  a burn-down list.
- One Konnect: the Konnect row in every composer, drawn by the shell, and the
  Konnected section in `<KornerDetail>`'s `attached` slot on every record's
  page (L14).
- Location and Krews stop being fields. Where something is, is a Konnection
  to a Map Place (2026-10-23, Map Places); its Krew is a Konnection to the
  Krew. Reach stays in the header.

Built in steps: the kit and the rule first (Cinema and Kronikles moved as
the first two), then the shell's Konnect row, then the rest of the composers,
then pages, then location and Krew fields.

## 2026-10-23 — Any creation Konnects to any other; manifests list their Konnections

Tal: "it should be possible to link any creation on kronk to other
creations. We're building the framework to facilitate this. Maybe each
korner manifest should list its konnections and how they work?" and "all
composers should have the 'Konnect' option (at least most)".

**Decision:**

- **A manifest lists its Konnections** in an optional `konnect:` block:
  `make: true` when its composer can make a new one Konnected to something,
  and `effects:`, one `with: <korner>` / `does: <sentence>` per space where
  a Konnection does more than link (the pairs `Kronk::AttachmentEffects`
  acts on). `korners doctor` holds the block to the code both ways: an
  effect with no handler fails, and so does a handler no manifest lists. The
  manifest stays the true list.
- **Konnect can make something new, from anywhere.** Once a space is picked,
  the Konnect picker offers **New …** (its `compose.label`) for any korner
  that says `make: true`. It opens that composer with
  `?konnect=<source slug>:<source id>`, and what it makes is Konnected to
  the source. This replaces the Krew-only "New … for this Krew" of the day
  before (#2305, which used `?krew=` and a hard-coded list); `?krew=<id>`
  still reads as `krew:<id>`, so a Krew still gets a Krew album or Krew event.
- **Composers Konnect.** `<ComposeShell konnect={useKonnect(…)}>` draws a
  Konnect row at the foot of the body: what the new thing will be Konnected
  to, as space tiles, and a Konnect tile that picks more without saving
  (the record doesn't exist yet). The links are made once the create
  succeeds; one that fails doesn't fail the create. First in: Albutts, Art,
  FreeTheDream, Karporn and Wachuneed's new listing. Kalendar reads
  `?konnect=` but keeps its own attach bar for now; Huddle follows its Room
  composer.

## 2026-10-23 — Map Places: location is a Konnection

Tal: "for maps, lets fold in konnecting location to it. So instead of a
separate 'Location' option, fold that into konnecting via map." Places are
exact, with addresses, and any creation on Kronk can Konnect to any other.

**Decision:** Map gets a linkable record, the **Place** (`MapPlace`,
`map_places`): an exact spot with a name and an address. A location is a
Konnection to a Place, not a field on each space's record. Map's primary
resource is now `map_places`, and Map takes and makes links like every
other korner.

- **A Place is seen by whoever can see something Konnected to it, and its
  maker** (Tal agreed: "a pin anyone who can see the thing it's Konnected
  to can see"). It has no audience of its own, so a Mates-only party's
  Place is seen by its Mates, and a Place with nothing Konnected by its
  maker alone. One you can't see is a 404, like any other record.
- **Presence stays out.** Where people are right now is still not
  something to link (2026-10-21): presence and treks are never Map's
  primary resource, so they never resolve as a Konnection's end.
- **Its maker looks after it** (edit, delete, what it links out to);
  anyone who can see it Konnects their own things to it.
- **Every existing pin moved over**, each Place inheriting its record's
  audience through the link. Places are shared only within one owner's
  records, never across owners.
- The composers' Location fields go in a later step, once Konnect can make
  a new Place from the picker (done: "Location fields become Konnect →
  Map", above).

**Supersedes:** Map's opt-out ("Presence is where people are right now…")
in "Attaching works from every korner, both ways" (2026-10-21).

## 2026-10-23 — First Nations Country on the Map

A Kommons proposal from @mangobee ("Introduce First nation country display")
asked for the Countries of Aboriginal and Torres Strait Islander peoples to be
shown over Australia on the Map, for education, with the AIATSIS map as the
reference point for the idea. @mangobee raised it with Tal, who agreed.

**Decision:** a **First Nations Country** switch on the Map lays a picture of
Country over Australia (`features/map_v2/country_layer.tsx`). The picture is
@mangobee's own map, shown with their permission and credited to them, with a
note that the boundaries are approximate and that Country, its names and its
borders are held by its peoples. It is a picture, not data: re-projected into
web mercator, fetched only when switched on, faded out past state-level zoom
where it would blur, and off until a viewer turns it on (the choice is
remembered per browser).

**Why a picture:** it needs no outside service and nothing stored from one.
Native Land Digital's API was looked at for the outlines; its terms allow a
live point lookup but not storing or redistributing its data without
permission, so a drawn layer from it would wait on that. A picture can't say
which Country a point is on; telling your Mates the Country your pin is on is
the proposal's next step, typed in to start with.

## 2026-10-22 — Setup after signup

A Kommons proposal ("Signup Setup", Tal) asked for more after the thresholds
and the profile picture: choose a colour palette, default privacy, and a
handful of people to follow. Tal: light mode should be offered there.

**Decision:** a fresh signup lands on `/setup`, five steps in the SPA: how
Kronk looks (Dark, Light or Match my device, and the shade), a line about
you, who sees your posts by default (the reach ladder), a few suggested
people to mate, and turning on notifications for this device. Tal picked
the last two additions from a list (text size, Krews to join and pinned
spaces were the others, left for later).
Each choice saves as it is made, through the same endpoints as Settings, and
every step can be skipped. Existing members aren't sent there; Settings has
the same choices. The walkthrough starts on Home after.

2026-10-25: one page, not five steps (Tal: "they should all be on one page
… a single 'Continue' button so people can select and integrate with what
they want to, and just leave the rest for later"). No Back, Next or Skip.

## 2026-10-22 — Konnect can make something new

From a Krew, Konnect finds something that exists or makes something new
(Tal: "from the krew page you can create spaces for the krew to utilise").
Once a space is picked in the Konnect picker, a Krew whose space has a
composer that takes a Krew (Albutts, Kalendar, Huddle) also gets **New … for
this Krew** above the search. It opens that composer, the same one the Ж
menu opens, with `?krew=<id>`, and what it makes is Konnected to the Krew.
No second composer is built for the picker.

## 2026-10-22 — Huddle rooms: the standard composer, no emoji

Tal: "the huddle composer needs to be proper, it doesn't currently follow
the standardisation of composers, and also shouldn't have emoji choices, we
have a strict 'no emoji' rule for kronk. Also the emojis on the current
huddle tiles shouldn't exist." And: "the composer for creating a huddle
should have a way to connect it to a krew."

- **New Room is a composer like every other**: `<ComposeShell korner='huddle'>`
  at `/hub/huddle/composer` (the manifest's `compose.route`; the old
  `/hub/huddle/new` forwards there), with drafts (`huddle`/`room`). The
  inline form in the Rooms list is gone.
- **No icon.** The emoji field is gone from the composer and the API
  (`icon` is ignored on create and no longer sent); every Room tile wears
  the Huddle korner's icon. The `huddle_sessions.icon` column stays, unread.
- **Konnect to a Krew** (optional, one): the Room is linked to the Krew
  (a `link` attachment huddle → krew, made in the same request as the Room),
  so it shows on the Krew's page. It is a link, not a gate: the Room stays
  open to everyone. Members-only Krew Huddles are still not built.
  `?krew=<id>` on the composer route picks the Krew to start with, the same
  contract as the Kalendar and Albutts composers.

## 2026-10-23 — Event edits Konnect albums and Huddles

Tal: "it should be possible to link any creation on kronk to other
creations", and approved cleaning up the event edit form. That form still
had its own ways to reach another space: a "spawn an album" checkbox
(`events.spawn_album`, Kalendar's `spawn → albutts` manifest entry) and an
Event/Huddle type toggle. The Konnected section already sits under the form,
and the new-event composer makes albums and Huddle Rooms through "Konnect a
korner".

**Decision:** the edit form drops both. An event's album, or the Huddle Room
it happens in, is Konnected like anything else. The form stops sending
`event_type`, so an existing Huddle event stays one; the server still takes
`event_type` because the Android app sends it. The API stops accepting
`spawn_album`, and Kalendar's spawn entry, Albutts' matching `accepts`, and the
spawn factory go. No korner spawns now; `Kronk::AttachmentSource` keeps the
mechanism and still deletes albums spawned before today with their event.

## 2026-10-22 — Diskonnect, not Unkonnect

Tal: "diskonnect is probably better". The × on a Konnected tile reads
**Diskonnect**. Supersedes "Unkonnect" in "Attaching is Konnect, in space
tiles" below.

## 2026-10-22 — Attaching is Konnect, in space tiles

Tal on shadow: the Krew page doubled up an **Attached** block and its
**Spaces**, the Attached heading was out of proportion with the rest of the
page, and "the 'Attach' term … should be replaced with 'Konnect' wording
(konnected etc). The Attached wording and plumbing is part of a bigger
plumbing network … (font and aesthetic included). I really like that the
current 'Spaces' section has the icon tiles."

**Decision:**

- On screen an attachment is a **Konnection**: Konnect (the action),
  Konnected (the block's heading), Unkonnect (the ×). The code keeps
  `attachment` (`korner_attachments`, `AttachmentSection`), as froth keeps
  `favourite`. The compose-time "Konnect a korner" bar already used it.
- The Konnected block, its picker and the Krew page share one look, the
  Krew page's icon tiles, lifted into `_space_tiles.scss` (`.space-tile`),
  and one section heading (`.korner-section-heading`). FreeTheDream's,
  Booth's and Kalendar's section labels moved to the same heading.
- A page has one section of tiles, not two. The Krew page's Spaces holds its
  Albutts and Kalendar tiles, then the rest of what it's Konnected to, then
  Add a space (a tray of the spaces a Krew can turn on) and Konnect, which
  opens the picker straight away. Pages leave out what they already show (`exclude`): an album its
  Krew, an emergence its Krew and its event.

Supersedes the "Attached" naming and the mini-hub tile style (2026-08-31).

## 2026-10-22 — Pages are reached by name

Albums, events and emergences had counting numbers in their links
(`/hub/albutts/albums/4`). Tal asked whether that was the best way. It told
anyone how many there were, let them walk the list, and a hidden album
answered "not allowed", which confirmed it existed. Events already had a
name, fixed when made.

**Decision:** each has a slug from its title, counting up for the same title
in that space (`beach-day`, `beach-day-2`), with no random part (Tal chose
names alone over names plus a date or a code). A rename takes a new slug and
the old one keeps working (`link_redirects`); an old slug is never given to
another record. Numbers still open the page, and the app puts the name in the
address bar (`useNamedLink`). Something the viewer can't see answers not
found, the same as something that doesn't exist. `Kronk::NamedLink` does all
of it; Krews keep their fixed slug. Wachuneed listings and FreeTheDream
items joined on the same day. Moments still use numbers: they have no title
to name them by.

## 2026-10-22 — One way to link to a Krew

Part of standardising attaching (Kommons proposal "Attach Function"). A
Krew kept its own records of what was linked to it, apart from the
attachments table, and only some ways of linking wrote both: the Krew's
"Link one of your events" made no attachment, so neither Attached block
showed it; an album attached with Attach never reached the Krew's Albums
tile; a link made from the Krew or emergence end (krew → kalendar) never
made the event a Krew event; and the Krew page offered two link buttons for
the same thing.

**Decision:** the korner attachment is the link, and a Krew's audience
follows from it. `Kronk::AttachmentEffects` holds what a link does for the
few pairs where it does something (kalendar ↔ krew, kalendar ↔
freethedream, albutts ↔ krew), keyed by the unordered pair so either end
can make it. Every way in goes through it: Attach from either end, the
Krew's Link and Unlink buttons, and the Krews picked in a composer, which
keep an attachment beside each (`AlbumKrew` callbacks,
`EventLinks.posted`). A migration adds the attachments missing for
existing Krew events and albums.

- The audience widens only when the record's owner links it and is in the
  Krew, as before; a link anyone else makes stays a link.
- **A Krew album is linked to its own Krew** and that link can't be taken
  off (422): it is the Krew's, and its audience is decided by its Krew.
- **One place on the page**: the Krew's tiles keep their lists and Link
  buttons (they offer only your own events and albums, which is what can
  join the audience), and the Attached block below leaves out what the open
  tile shows. Simpler than sending the tiles through the generic picker,
  which would offer anyone's records and then not list them in the tile.

## 2026-10-22 — Links join two korners, and only records you can see

Step 1 of standardising attaching (Kommons proposal "Attach Function"). An
audit found the server looser than the picker: it let a record link to
another in its own korner (album → album), which the picker never offers,
and it checked only that you look after the source, so a guessed id linked
your record to a private one and the reply handed back its title.

**Decision:** a link always joins two korners; the model refuses a link
whose source and target korner are the same. A korner relates its own
records itself (a gang inside an emergence, a set in a series), so a
same-korner link would be a second, weaker way to say the same thing. No
spawn rule is same-korner and spawns are untouched. Linking also needs the
target to be visible to you, and a target you can't see answers 404, the
same as one that doesn't exist, so nothing is learnt from guessing.

The opt-out rule (2026-10-21) also had a gap: a korner whose primary
resource names no model passed the check without saying anything. That now
counts as missing; In Flow and Nudges say `no_attachments:`, since neither
holds records anyone would link. Huddle's Room page shows the Attached
block, managed by the Room's host.

## 2026-10-22 — Drafts are quiet

A Kommons proposal ("Draft tab in composer") said the drafts part of the
composer sat at the top and was overly complicated: a Drafts label,
Saving…/Saved, a chip per draft, Start another and Discard draft, above the
body of every composer, on every post. Tal: move it to the bottom, make it
simpler; it doesn't need to show that there is a draft, only that one came
back after closing with something half written.

**Decision:** saving stays automatic and says nothing. A fresh composer shows
nothing about drafts. Only when a composer opens on a draft from before does
one line appear under the body, by the submit: **Picked up where you left
off · Start fresh · Discard**. Start fresh keeps that draft and blanks the
box; Discard deletes it (asking first). With more than one draft the line
adds **Other drafts (N)**, which opens the list to switch to; it is hidden
until asked for. Supersedes the Drafts row of 2026-10-19; nothing about how
drafts are kept changes.

With it: the post composer opened to post to a Krew ("Post to <Krew>") took
the newest feed draft and its reach. It now keeps that Krew's drafts
(context `krew:<id>`), so each Krew has its own and a feed draft never lands
on a Krew post.

**Half an hour (later the same day):** reopening a composer to find last
week's draft in it isn't clean. A draft comes back into the composer only if
it was closed less than half an hour ago. Older, the composer opens empty
and the line at the bottom is just **Drafts (N)**, to pick one up; nothing is
deleted.

## 2026-10-22 — FreeTheDream's rows reflow instead of swiping

An emergence's page had two rows you scrolled sideways on a phone: Get
involved (scroll-snap cards, 2026-10-15) and the Krew. That breaks the
standing rule that phone views scroll vertically only (2026-08-13).

**Decision:** both are tiles that reflow into a grid, two or so across on
a phone. Supersedes "Get involved is a row of cards you swipe sideways"
(2026-10-15). The emergence list moved onto `<SpaceGrid>` / `<SpaceCard>`
at the same time, showing the linked event's image when an emergence has
no cover, as its page already did.

## 2026-10-22 — Anyone in a Krew unlinks its events

Kommons "Link events", "Add a space", "Add more spaces", "No edit button
for Krews" and "Krew Images don't show in Krew page". The Krew's own
Unlink on an event still required the event's maker, though 2026-10-21
says either end can take a link off, and for a Krew that's anyone in it.

**Decision:** any member of the Krew can unlink an event from it (and so
from its emergence, `Kronk::EventLinks`); the maker still can too.
Linking stays the maker's. Alongside, without changing what was decided:
the link picker starts with your events coming up and offers past ones on
asking; a space added from the Krew page opens with its link list ready;
when Albutts and Kalendar are both in, Add a space gives way to a line
saying more spaces join as they're built for Krews (the 2026-10-18 rule
stands); the Ж menu gets **Edit Krew**; and archiving stays with the last
member (Tal), with a line in Settings saying so. See `docs/spaces/krew.md`.

## 2026-10-22 — An event linked to an emergence is linked to its Krew

Tal tried to attach an event to an emergence inside a Krew and couldn't find
a way. There were three ways to link an event (the event's Attach, the
emergence's "link one of your events", the Krew's "Link one of your
events") and they didn't meet: the emergence read a korner attachment, the
Krew read its events' post audience, so a link made on one never showed on
the other. A gang couldn't hold an event at all.

**Decision:** an emergence and its Krew are one group, so an event linked to
either is linked to both, and unlinking from either takes it off both
(`Kronk::EventLinks`). The Krew becomes an audience on the event's post only
when the event's maker links it and is in the Krew, as the Krew's own Link
button already required; an invite-only event stays for its invitees. A
gang can link its own event. Attaching is also offered while editing an
event, the attach section reads **Attached** (it said "Amongst Krew"), and
the picker waits for a space to be chosen instead of opening on Huddle.

## 2026-10-22 — Kommunity's badge counts new members

Nobody heard when someone joined Kronk; the only sign-up notice was
Mastodon's, for moderators (Kommons, "Kommunity": "How do we know when new
people sign up?"). Tal wanted it to show on the space's icon.

**Decision:** Kommunity's unread badge counts members who joined since you
last opened it, among those you could find there (their own findability
decides). It uses the shared badge, so opening Kommunity clears it. No nudge
and no push.

## 2026-10-21 — The app opens on the feed

The welcome page (`/welcome`: a salutation and three doors, Post, Feed and
Invite, decided 2026-08-31) stood between opening the app and the feed once
every session. Tal asked for it to go, so the app goes straight to the feed.

**Decision:** the welcome page, its manifest and its styles are removed. `/`
lands signed-in phone-width users on `/home`, and `/welcome` redirects there
(on the server, and in the app for a cached shell), so old links still work.
Posting is still in the Ж menu. Invite lives in `/me` and nowhere else
(Tal), so the deck sidebar's Invite button went too.

## 2026-10-21 — Fomo noto: "People are huddling", and nudges from no one

Kommons "Fomo noto" (Tal): a push when people are in the Huddle, at a number
each person chooses. Decided with Tal: the **Main Huddle only**; **on by
default at 1** (anyone there at all), changed or turned off on
`/hub/huddle/settings`; **once per gathering**, quiet again only after the
Huddle has been empty for ten minutes, so people dropping in and out don't
re-fire it; and people already in the call get it too for now, since the
server can't tell who they are.

The server learns the count the way the home banner does, from the Jitsi
server's `room-size`, once a minute (`Scheduler::HuddleFomoScheduler`). That
gives a number, never who, so the nudge says **"People are huddling"**, with
no one in it. To carry it, a nudge's actor became optional
(`nudges_events.actor_account_id` nullable): a nudge with no actor shows the
space's own mark where the avatar goes. Use it only for something no person
did; anything a person did still names them.

Supersedes the Huddle manifest's two unread settings
(`auto_join_notifications`, `notify_when_someone_joins_my_huddle`), removed.

## 2026-10-21 — Attaching works from every korner, both ways

Tal's Kommons proposal "Attach Function" asked for attaching to reach every
space it can, built once to a standard. The primitive (one
`korner_attachments` table, decided 2026-08-14) was already there, but only
Kalendar could attach: twelve korners took links and none could make one,
and links to Kommons, Krew, Kuestions and Huddle were invisible to everyone,
because those models had no rule for who sees or owns them.

**Decision:** every korner whose records can be linked can link out too,
and each link shows at both ends. Tal chose to do this before attaching from
a post in the composer, which changes what a post is and comes after.

- **One place says who sees a record, who looks after it, and where its
  page is**: `Kronk::KornerRecords`, used by attachments and link previews
  alike. A model answers for itself where it can (`visible_to?`, `owner_id`
  or `account_id`); the few that can't have their rule there, matching their
  own API. Unanswered falls closed.
- **Whoever looks after a record decides what it links to**, and either end
  can take a link off. For a proposal that's its proposer or whoever claimed
  it; for a Krew, **anyone in it**, not only its seeder (err syntropic).
- **A search finds less than a link opens**: an invite-only Krew opens for
  anyone with its link but turns up in the picker only for its members.
- **Each korner's primary resource names its page** (`path:` in the
  manifest), so a link goes to the album page and not to a 404.
- **Deleting either end removes the link.**
- **Opt out, not opt in** (Tal): every korner with records takes part,
  including ones not built yet. A korner that shouldn't says why in its
  manifest (`no_attachments: <why>`); `korners doctor` and a spec fail one
  that does neither, naming what to add, and the korner template comes
  wired. Moments (gone in a day), Klot (private logs), Map (where people
  are) and Rose (a gift) opt out.

**Supersedes:** "Kalendar is the only source" in the attachments spec.

## 2026-10-19 — Mycelium: what people have, meeting what emergences need

Tal asked for FreeTheDream's synergistic audit to be rebuilt from the
ground up under a better name, chose **Mycelium** (the network that moves
what some have to where others are growing), and decided: it is its own
view in FreeTheDream that connects into each emergence; what you list is
private until you share it into an emergence you're in; **sharing is
offering**, so On offer is what people have shared from their Mycelium and
the old one-off offers moved into their owners' Mycelium; the six
categories stay; needs and Actualise items get a category picked as
they're added; and they meet what people have three ways, suggestions
when sharing, From my Mycelium on a row, and a nudge on a match, with the
nudge counting only what's been shared there. Each thing is a name, an
amount, a category and a note, nothing more. The emergence-wide gaps and
spares page comes later. It is Mycelium in the code too (Tal: "Mycelium in
code too"): `Asset` and `Share` and the hidden audit page are gone.
Detail: `docs/spaces/freethedream.md` (Mycelium).

## 2026-10-19 — Nudges push to phones; the member chooses what

Kommons proposals "Set up notifications for homescreen apps" (@Tomas) and
"Changing our Notification for web/app" (@mangobee). Tal decided: members
choose what reaches their phone, row by row, beside the existing "show in
Nudges" switch, so the notification settings are built out rather than a
fixed list pushed. Everything delivered is pushed until turned off. A push
says who, in that space's words ("Mango nudged you", "Ash tagged you in an
album photo"), not one bundled ping, and a message never shows what it
says. Quiet hours, built but unread until now, hold push back; they are
off until a member sets them. Where a
legacy notification and its nudge would both push, only the nudge does.
Detail: `docs/spaces/nudges.md` (Self-delivering delivery).

## 2026-10-19 — Hidden posts stay, hidden by default; badges count updates

**Decided by Tal**, after the Albutts tile showed 99+ for a few albums and
Kalendar showed 7 for events that had mostly already happened.

**Hidden posts stay.** An album photo, a Moment and a Kuestions answer each
ride a post nobody sees as a post (`Status::KRONK_BACKING_POST_TYPES`). That
post is what gives them froths, replies, Nudges, reporting and moderation
without rebuilding any of it (2026-10-08, Moments). Replacing it with a
Kronk-native reactions layer would rebuild all of that and enlarge every
upstream merge, so we keep it.

**But hidden is the default, not something each surface remembers.** Today
every place that lists or counts posts has to skip them by hand. About ten
do; the rest have drifted:

- Hub badges count them (one photo is one "update", hence 99+).
- An account's post count includes them: 100 photos add 100 posts.
- The profile list keeps its own copy of the list (photos and Moments, not
  answers), and nothing says whether leaving answers out is deliberate.
- Nothing on the search path checks for them; only Moments get a
  visibility check of their own.

So: one definition of a hidden post, used by every surface that lists or
counts posts unless it asks for them by name (a photo's own replies, the
korner that owns them). A spec fails when a new surface reads posts without
saying which it wants. A surface that does show a hidden type (answers on a
profile, if that is wanted) says so in code and in its space doc.

**Badges count updates, not posts.** An update is something a member would
call news: "Ash added 20 photos to Mayhem 2026", "a new event", "an event
you're going to changed", not each photo or each edit. Each korner says what
its updates are, in its content-stream adapter (`Kronk::KornerContentStreams`)
and its manifest, and whether one is still worth counting (an event that has
already happened is not). Badges read updates, and so will the "since you
were last here" view a korner shows when you open it. A new member's
badges start from when they joined, not from everything ever posted.

**Supersedes** "a korner's unread count is its new feed-visible posts"
(`docs/spaces/hub.md`, Tiles). Detail: `docs/spaces/hub.md` (Updates).

---

## 2026-10-19 — Links to things on Kronk preview as the viewer sees them

Tal asked for previews of internal links, for every korner and everywhere
they're shared (posts, Nudges messages, FreeTheDream Talk). Until now a
Kronk link in a post was previewed by the server fetching its own page
anonymously and reading its preview tags: only Kalendar and Booth set
them, so most links got the generic Kronk card, and nothing members-only
could preview at all. Now the web recognises a `/hub/<slug>/…` link and
asks `GET /api/v1/link_previews`, which finds the record the way korner
attachments do (`KornerRegistry.model_for`, plus a short list of pages
holding something else) and checks `visible_to?` as the viewer. A korner
whose pages follow `/hub/<slug>/[<word>/]<id>` previews with nothing
added. Anyone who can't see the thing, and a link to a korner itself, get
the korner's own card. The card is a `<StandardCard>`. The server-side
card fetch for `/hub` links is left in place for the Android app.

---

## 2026-10-19 — A rose notifies, on by default

Tal's Kommons proposal "Notifications for Rose" asked for a notification
when a rose arrives, and Tal chose **on by default**, switched off in Rose
settings. This supersedes "you can turn on notifications for it, but no
nudge" (opt-in, never a Nudge). That rule existed because the only delivery
path then was a chat, and a rose must never be a message. Notifications
have since left the chats for their own face of Nudges, so the alert can
arrive without reaching the messenger. It still never enters a chat, and
the 3am sweep deletes the notification with the rose, so nothing outlives
the day. Detail: `docs/spaces/rose.md` (Settings).

## 2026-10-19 — Err towards syntropic solutions

Asked whether a FreeTheDream emergence's join requests should be answered
by its owner alone or by anyone already in it, Tal asked which was more
syntropic, chose anyone in, and asked for a standing note: when a design
faces that choice, lean towards the syntropic one, especially as more
developers get involved. Syntropic here means order that grows from the
parts working together rather than passing through one point of control:
the people doing the work decide, a new member can let in the next, and
nothing stalls when one person is busy or gone. A single gate is for where
harm needs one, and a way to undo after the fact is preferred to approving
everything beforehand. Written into `CLAUDE.md` (Principles, "Err
syntropic") so every contributor and session reads it.

## 2026-10-19 — Wachuneed requests: ask, then the seller accepts or declines

Tal chose "Orders and requests" for the shop front: choosing a kind and
extras sends the seller a request they can Accept or Decline. Built on the
`ListingOffer` model that already existed, with no endpoint or UI until now.
A request keeps what was chosen and the total as asked; accepting reserves a
one-off and leaves an ongoing item up. Kronk still takes no payment or
order beyond that: the agreement is the accept, and the rest is the chat.
The three Nudges are directed, because a buyer is anyone who can see the
listing, not only a Mate. Supersedes "Requests with Accept and Decline are
left for later" (Options, 2026-10-12). Detail: `docs/spaces/wachuneed.md`
(Requests).

## 2026-10-19 — Photos added to an album make one post per burst

**Decided by Tal**, after Ash's photos reached Home one by one (Kommons
proposals "Photos added to album on feed" and "Albutts Photos enter feed as
individual posts"): photos added to an album should be "a post of 'XX added
27 new photos to album' instead", and the photos added before should be
shown that way too.

So each burst of photos one person adds to an album makes one post, sent to
whoever can see the album, once it has been quiet for 10 minutes. The
earlier bursts were posted once, dated when they happened. Each photo keeps
its own post (for its caption, froths and replies), which never reaches a
feed. This replaces "one card per album, ever" (2026-07-29). See
`docs/spaces/albutts.md`, Feed projection.

---

---

## 2026-10-19 — Whoever can see a Wachuneed item or shop can message about it

**Decided by Tal**: "Anyone who can see the items, can message. If a shop is
only visible to mates, or even if an item within a shop is only visible to
mates, thats who can message., full control to seller". Listings and shops
each get a reach on the ladder (Me / Mates / Orbit / Kronkverse), set by
the seller with the same control as a post's reach. Each is its own: an
item's reach decides who sees it everywhere and who can message about it;
the shop's decides the shop page and messaging the seller from it, and is
where a new shop item starts. Everything already listed stays visible to
everyone, so messaging opens to whoever could already see it.

**Supersedes** 2026-10-17 (Who can message you about a listing is the
poster's choice) and the shop's "Anyone on Kronk" setting of 2026-10-12:
who can message is no longer set apart from who can see. See
`docs/spaces/wachuneed.md`, Who can see it.

## 2026-10-19 — Nobody else adds to an album unless its owner says so

**Decided by Tal**: "we need to make it standard that nobody else can add
photos, with it being opt-in for the others adding photos", and "Krews who
can add" becomes "Register as Krew album". So a new album is **Just me**
(`closed`) until its owner picks Anyone who can see it or People I choose,
the API makes `closed` when it isn't told, and a Krew's say over an album
is by registering it as that Krew's album rather than by a contributor-Krew
list. See `docs/spaces/albutts.md`, Who can add photos.

---

## 2026-10-19 — Every 2.x release is "Rose"

**Decided by Tal**, cutting 2.1.0: "We're keeping the name rose for all 2.0
versions." A release name now belongs to a major. Minors keep it as patches
do, so 2.1.0 ships as `2.1.0 "Rose"` and `RELEASE_NAME` in
`lib/kronk/version.rb` stays until 3.0. This replaces the rule that minors
earn a new name (CLAUDE.md, Versioning).

---

## 2026-10-19 — Every composer saves drafts, on the server, as many as you like

**Decided by Tal.** Every composer on Kronk saves what is being written as it
goes, so closing it, a refresh or another device never loses work. Drafts are
kept on the server (they follow you between devices), every composer can hold
several with a switcher, and a draft stays until it is posted or discarded.
A place listing all your drafts comes later.

Why: closing the event composer by accident lost a whole event (2026-10-19).
Drafts existed three ways: the post composer's one server draft, albums' own
server drafts, and a per-device hook four composers used; a dozen composers
had none, and nothing asked before closing.

What follows from it: one `drafts` table for every composer (korner, kind,
optional context, params, uploads by id) and one API, `/api/v1/drafts`; the
album and post drafts are rows of it, and their own endpoints are gone. One
client hook (`useDraft`) and the compose shell do the rest the same
everywhere: closing keeps the draft, Discard asks first. The per-device hook
(`useComposerDraft`) is left to Nudges' message boxes. See `design.md`,
Drafts.

---

## 2026-10-18 — The Krew page: What's happening on top, then the spaces

**Decided by Tal**, on trying the page built earlier the same day: "this is
clunky". It changes three things in the entry below:

- **What's happening is not a tile.** It sits above the spaces as a few
  short lines of what was last done in the Krew ("Tomas added 37 photos to
  the Mayhem 2026 album") and how much of its chat you haven't read. The
  list of the Krew's posts goes. Nothing is open on arrival, and a tile
  closes on a second tap.
- **Add a space is the last tile.**
- **The chat on the page**: a section below the spaces where members read
  and send messages in the Krew's chat, without going to Nudges. The Chat
  tile goes.

See `docs/spaces/krew.md`, The surfaces.

## 2026-10-18 — The Krew page: every space opens in place

**Decided by Tal**, after Krew albums showed up as a section of their own
under the spaces grid. The page was growing a section per space (Events,
Albums), with its own "New Krew album" button, while the tiles above went
somewhere else. Built on 2026-10-18:

- **A tile opens its space in place**, below the grid, one at a time:
  Albutts shows the Krew's albums, Kalendar its events. Not a page of its
  own, not views on the title.
- **The + moon follows the open space.** With Albutts open it makes a Krew
  album in the normal album composer; with Kalendar open, an event for the
  Krew. No "New Krew album" button on the page. "Link one of yours" stays
  inside the open space.
- **What's happening is a tile too, and the one open on arrival.** This
  keeps the Krew's post list, so the 2026-07-22 "metadata, not a stream"
  gives way. (Reversed the same day, see above.)
- **Only spaces with a Krew part are offered.** "Add a space" lists
  Albutts and Kalendar for now; Map, Huddle, Booth, Kommons and Kuestions
  join one at a time as each learns which Krew its things belong to. A Krew
  that already added one keeps the row, but no tile shows until then.
- **The faces stay at the top**, under the name, with a badge when people
  are asking to join. Tapping them opens People in place: everyone in the
  Krew, Invite people, and the requests.
- Chat stays a tile that opens the Krew's chat in Nudges. (Reversed the
  same day: the chat is on the page, see above.)

See `docs/spaces/krew.md`, The surfaces and Open.

## 2026-10-17 — Who can message you about a listing is the poster's choice

**Decided by Tal**: who can message a poster "should be a choice of
visibility for the poster, like everything else on kronk". Each Wachuneed
listing carries its own choice on the reach ladder's words: **Mates**,
**Orbit** (Mates and their Mates, the same ring as a post's Orbit,
`Account#orbit_of?`) or **Anyone on Kronk**. A listing with no choice
follows the seller's shop (`mates` or `anyone`), else Mates, so nothing
already listed changes. The choice opens one door: a non-Mate can open the
chat and send the first message only from that listing, and the message
carries the listing's link. It is not general messaging. The shop's
"Anyone on Kronk" still opens the seller to everyone, as before.

Extends 2026-10-12 (the seller decides per shop) from the shop to each
listing. See `docs/spaces/wachuneed.md`, Enquiries.

## 2026-10-17 — No Invite, only Share

**Decided by Tal**: "there should be no invite anywhere, only share." The Ж
menu's Invite moon (pick a Mate, they get a Nudge to come and look) is
removed, along with `POST /api/v1/space_invites`. FreeTheDream's own
"Invite to have a look" button went the same day (#2185). To point someone
at a page, Share it.

Supersedes the Invite half of the Kommons proposal "Share and Invite"
(built 2026-10-13) and "Invite means 'have a look'" in 2026-10-13 "A
FreeTheDream project is one page". Not affected: the
`/me` invite to join Kronk, and inviting people into a Krew, which is
membership rather than a look.

## 2026-10-17 — Who sees and changes a Krew album

**Decided by Tal**, following the entry below. Krews have no public or
private, so "whether the Krew is public decides who sees it" needed a rule:

- **Chosen when it's made:** only the Krew, or everyone on Kronk. Everyone
  is only offered for a Krew listed in Discover, so a hidden Krew's albums
  never go public.
- **Only members add photos**, even when everyone can see it. People outside
  can join the Krew to add.
- **Any member can change who sees it later**, like everything else in a
  Krew. Its existing photos move with it.

Supersedes "whether the Krew is public decides who sees it" below.

## 2026-10-17 — Nobody owns a Krew; a Krew can own an album

**Decided by Tal**, after a member got "not allowed" adding Albutts to a
Krew they hadn't started. "In theory, nobody should 'own' a krew." This
carries the 2026-10-13 entry (any member lets people in) to the rest of
the Krew. Built on 2026-10-17 (#2199).

- **Any member can do what only the seeder could:** add or remove spaces;
  change the name, photo, description, who can join and requirements;
  rotate the invite link. The seeder is just who started it.
- **Archiving is the one exception.** Nobody can archive a Krew unless
  they're its only member. When the last member leaves, the Krew archives
  itself. This replaces the last-seeder guard.
- **Two kinds of album.**
  - A **personal album** is yours: you choose who sees it and who adds,
    and you can edit or delete it. It can still be open to anyone who can
    see it (Tal kept that).
  - A **Krew album** belongs to the Krew. Any member can add photos, set
    the cover or fix the title. Nobody can delete the album alone; each
    person can remove their own photos. Whether the Krew is public decides
    who sees it. If the person who made it leaves, the album stays and
    their photos stay credited to them.
- **Linking shares, giving hands over.** Linking a personal album to a
  Krew shows it there and it stays yours. You can also give it to a Krew
  you're in, which makes it a Krew album. That only goes one way.

Unwanted photos in a Krew album are handled like any disruption in a Krew:
block and report, no removing other people. Supersedes the seeder powers
that `docs/spaces/krew.md` used to describe.

---

## 2026-10-15 — FreeTheDream gang pages: fractals, who's in it, one-tap bring

**Decided by Tal**, the same day as the entry below. A gang's page is an
overview at a lower level: who's in the gang first, then the detail (what
gear is needed, what's been gathered and by whom, what's being
actualised). A gang is made of **fractals**, "pieces of the pie that make
up the kitchen element as a whole" (Cooking, Cleaning, Storage,
Logistics), each with its own page. So one level comes back under gangs,
and stops there: a fractal holds nothing. Supersedes "gangs one level
deep" below.

**Bringing is about who, not how many.** "If someone can bring one they
can just tap ... If that person brings two, that's extra and great and no
need to specify that." One tap brings, the row names who's bringing, and
a thing counts as gathered once anyone is bringing it. A comment on what
you're bringing comes later. _Refined 2026-10-17 (Tal): a need with an
amount ("20 plates, someone can bring 8") asks how many you're bringing;
the amount is rough, not a goal, and a thing is sorted once about that
many are coming. Sorted things sit at the bottom of Thing Bringing._

## 2026-10-15 — FreeTheDream: emergences, gangs, Thing Bringing, Actualise, and a Krew

**Decided by Tal.** "The nucleus is around the people creating something,
not the thing itself." So the words name the people and what they do: a
project is an **emergence**, and people **seed** one; working groups are
**gangs**, and you **coalesce** one; Gear & supplies is **Thing Bringing**
("Gear and supplies needed"); Jobs is **Actualise** ("Bring an idea to
life"); Dreamers is the emergence's **Krew**. Copy only: code, tables and
the API keep `project`.

- **No Ideas.** Someone with an idea becomes its actualiser by adding it
  to Actualise, and others jump on board to organise it. Actualise is
  **open-ended** (no headcount); the adder is on it automatically.
  Untaken ideas became Actualise items with their owner on them; "take it
  on" is gone.
- **A Krew per emergence, two-way.** Everyone involved is in the Krew made
  with the emergence. Joining or leaving either joins or leaves the other,
  so the Krew's chat and posting reach exactly the people in it. Tal chose
  two-way over "the emergence drives the Krew".
- **Gangs one level deep.** "Underneath that it shouldn't be necessary":
  no gangs inside gangs. Supersedes the 2026-10-12 "parts nest to any
  depth" and the 2026-10-13 one-step section setup (sections inside).
- **Phone first.** Get involved is a row of cards you swipe sideways.
- **On offer** stays, and is to tie into the synergistic audit later.

## 2026-10-15 — A FreeTheDream project's landing page points at the work instead of holding it

Tal: the landing page shouldn't show Still needed, Gear & supplies, Jobs,
Ideas or On offer. "These are all good ideas but these should be displayed
as buttons instead so people can navigate to those pages on their own." So
the landing page is what's yours, the working groups, one **Get involved**
card per list (each its own page, `/p/:id/<list>`), **Dreamers** (everyone,
whoever did something most recently first) and a live **Activity**. The
sorted bar and the "By" date are gone from it, and **working groups are not
led by anyone**: no owner shows on a tile or a section's page.

Last active counts doing things (updates, comments, joining), never looking
at pages: ranking people by when they were last seen would be watching
them, which Kronk doesn't do. Section pages keep their lists in full; they
are where the work is done. Supersedes the "Still needed and the lists on
the page" part of the entry below.

## 2026-10-13 — A FreeTheDream project is one page

**Decided by Tal**, after a day with the page split in two: "i actually
dont reckon we need the second kontribute space. We can probably just do it
all from the one page." The Overview / Kontribute split (two entries below)
is undone. A project's page leads with what's yours, then the working
groups and the work, with the event, people, updates and talk beside it.
`/p/:id/kontribute` redirects to `/p/:id`. **Supersedes** "A FreeTheDream
project opens on its Overview; the work is in Kontribute" and the
Overview half of the dashboard entry below; the five areas stand.

## 2026-10-13 — A FreeTheDream project's Overview is a dashboard, and the mechanism has five areas

**Decided by Tal.** "This is turning into a dashboard for a project, meaning
that a user should be able to see everything that is relevant to them,
working groups they're involved in, unseen messages from different spaces,
equipment list, requests." So the Overview leads with what's the viewer's:
new talk, their working groups, the jobs they've taken and what they're
bringing, and what's still needed in their groups. The four fact tiles from
earlier the same day are gone ("a little over the top"): what it's about
sits under the title with when and where on one quiet line, and the creator
and people count leave the header.

To keep track of what the space holds, everything in it is filed under one
of five areas: Spaces, People, Work, Talk and Links
(`docs/spaces/freethedream.md`, "The five areas"). The dashboard reads the
five; it keeps nothing of its own except when you last looked at a space's
talk (`freethedream_reads`).

---

## 2026-10-13 — A page inside a korner is built from the kit, and lint checks the title

**Agreed with Tal**, after two spaces in a week were built off-spec and then
redone: FreeTheDream's pages (#2101, moved onto the kit in #2114) and
Wachuneed's shop page (#2104, #2110; rebuilt in #2117). Tal's words: "things
are being built out of kronk spec then having to be adjusted."

What was found:

- The firm rules covered a korner's front page (`<KornerShell>`, no own
  header). The pieces for the pages inside it were listed as an index to
  grep, and no line said a detail page must be `<KornerDetail>`. Only
  Kalendar's event page used it.
- Nothing checked it. The doctor reads only the file mounted at
  `/hub/<slug>`, warns, and does not block. Every check passed on the
  off-spec PRs.
- The Standard leaves primitive use to "a reviewer", and a Claude-written
  PR queued on green has none. Tal seeing it on shadow was the review.
- Three of Wachuneed's four stylesheets were off the stylelint list.

What changes:

- The guide, the design doc and the Standard now say it as a rule: a detail
  page is `<KornerDetail>`, a list is `<SpaceGrid>`, and the reading is done
  before the first line of UI.
- ESLint fails `lint` on a feature page that draws its own `<h1>` or
  page-title heading. The 28 files that already did are listed as
  `kitBurnDown` in `eslint.config.mjs`, to come off as they are moved.
- A korner's further partials (`_<slug>_*.scss`) are governed, and the
  doctor looks for them.

Not covered: hand-rolled buttons, cards and empty states still pass every
check. That stays with whoever writes the page.

## 2026-10-13 — Any member lets people into a Krew, and any member invites

**Decided by Tal**, building the Kommons proposal "Join/ Invite users to
krews button". Three things:

- **A Krew can be "Ask to join"** (`access: approval`). It is listed in
  Discover, anyone can ask, and **any member can let them in**, not only
  the person who made the Krew. Why: "this opens up an equal right for any
  member in the krew."
- **Any member can invite people into a Krew that already exists.** Before
  this, inviting was possible only while creating it.
- **An inviter can pick anyone on Kronk**, not only their Mates. The invite
  is still a request in the invited person's Nudges that they accept or
  decline, so nobody is added without choosing. Someone who has blocked the
  inviter is skipped.

A request that is accepted or declined is deleted; nothing is kept about who
was turned away. Invite-only Krews stay hidden from Discover: the people who
made them chose that. Detail: `docs/spaces/krew.md` (Joining).

---

## 2026-10-13 — A FreeTheDream project opens on its Overview; the work is in Kontribute

**Decided by Tal.** A project's landing page is an overview of the project in
general: its cover photo, what it's about, the Kalendar event it happens at
(date, place, map pin, RSVPs) and its people. The working groups, what's
still needed, the lists, Updates and Talk move to a second view,
**Kontribute**. Two links under the title switch between them.

- **The event lives in Kalendar.** An in-person project links a Kalendar
  event (a korner attachment from the event) rather than holding its own date
  and place, so the details live in one place and the event shows on the Map
  and in Kalendar like any other. FreeTheDream's `starts_on` and `location`
  (added earlier the same day) are no longer read.
- **Invite means "have a look".** "Invite to have a look" sits inside the
  project, not on its card, and sends a Nudge linking to the Overview. The
  person decides for themselves whether to get involved; an invite is not a
  membership.

Why: what's needed shouldn't be the first thing on the main screen; someone
arriving should see what the project is first. Supersedes the "sections
first" project page of the same day for top-level projects (a section's page
is unchanged). Detail: `docs/spaces/freethedream.md` (The page).

---

## 2026-10-13 — FreeTheDream talk is threads that resolve, not messaging

**Decided by Tal.** Discussion in FreeTheDream is a thread per project,
section and item, with replies nested under each thread, and anyone in the
project can mark a thread resolved so it folds away. There is no chat
channel for a project. What's needed lives in the lists and what's changed
in Updates, so Talk only carries what's still being worked out.

Why: "people get overwhelmed by the sheer volume of messages, and thus don't
engage, allowing messages to stack up which becomes even more of a barrier
to entry, when there's 300+ messages and no idea what's happening or what's
been missed. This system is designed to take weight away from the need of
messaging." Detail: `docs/spaces/freethedream.md` (Talk).

---

## 2026-10-12 — FreeTheDream is a self-organising system for running projects

**Decided by Tal.** FreeTheDream is where people start projects and organise
the work on them from the bottom up, modelled on an in-person mini doof and
Syntropic World's synergistic audit. A project holds parts, nested to any
depth; inside it, anyone who has joined adds ideas, needs, jobs and offers
and owns what they add, with no veto from above. Items can be shared across
parts and parts can depend on each other. Each person keeps a private
inventory (Skills, Things, Space, Time, Money, Connections) and shares chosen
items into the projects they're in; a project's audit sets its needs against
what's been shared. Money is just another need, pledged here and paid
elsewhere. The creator chooses open or by-request joining. Kronk builds the
mechanism as a native korner; Kashka leads the map and aesthetics, which read
the same API. Detail: `docs/spaces/freethedream.md`. **Supersedes** the
prototype's framing as a map of projects to follow or help run (2026-10-10
keeps standing: nobody approves what goes on).

Why: collaboration should be contributor-driven, bottom up, and the same
mechanism has to carry a doof, an album release, a communal property, a
not-for-profit and a warehouse fit-out. The prototype showed projects but
gave people no way to organise the work inside one.

---

## 2026-10-12 — Kommons opens on the proposal list

**Decided by Tal.** `/hub/kommons` lands on Open, the list of proposals. The
Directory (the tree) moves to the last face, `/hub/kommons/directory`.
**Supersedes** 2026-08-10, which put the Directory first: it was the way to
start a proposal, and "Propose a change" in the Ж menu does that from
anywhere now, so the tree read as clunky in front of what people came for.

## 2026-10-12 — Tuning out does not hide a korner from navigation

**Decided by Tal.** Tuning is about the feed only. A korner you are tuned out
of stays in the sidebar and on the Hub, exactly as before.

The sidebar used to list only the korners you were tuned in to. That went
unnoticed while tuning out was something a person chose; when 2.0.8 tuned
every account out of Kommons (the entry below), Kommons left everyone's
sidebar at once. `features/ui/components/korner_sidebar.tsx` no longer looks
at tuning.

## 2026-10-11 — Kommons is opt-in by tuning, and tuning filters the feed

**Decided by Tal.** The tune toggle is the one lever for whether a korner
reaches your feed. Kommons starts tuned out for everyone, so proposals reach
only the feeds of people who tune in. **Supersedes** 2026-10-09 ("Kommons
proposals are opt-in in the feed"), which added a separate Feed settings
switch instead: Tal had asked for Kommons to be tuned out, and two levers
that look unrelated (a tune toggle showing "on" while proposals stayed
hidden) was the confusion that surfaced it.

The tune-in gate (`Kronk::TuneInGate`) had been built but never switched on,
so every tune toggle saved and did nothing. `tune_in_enforced` is now on in
production, for every korner: anyone who had tuned out of a korner sees its
cards leave their feed. Kommons is opt-in through
`feed_projection.tuned_in_by_default: false` for new accounts and a
migration for existing ones; anyone who had turned on the 2026-10-09 switch
stays tuned in, and the switch is removed. Details in `docs/spaces/feed.md` (How korners reach the
feed).

---

## 2026-10-11 — Delete lives inside the edit form

**Decided by Tal.** Whatever a member can edit, they delete from the same
place: the **Delete** action sits at the foot of the edit form the Ж menu's
Edit moon opens, behind a confirm. There is no inline Delete button on a
detail page and no separate Delete moon. This extends "Edit lives in the Ж
menu" (2026-10-09): one way in to change a thing, including removing it.

Prompted by Albutts, where an album had no edit screen at all, and by Art,
Kronikles, Cinema and Karporn, whose detail pages carried an inline Delete
and no Edit. Each gains an owner-only Edit moon that opens its own create
composer, filled in.

---

## 2026-10-11 — Search shows people first

Tal, from the Kommons proposal "Search Results Suck". Search stays one mixed
list in date order (2026-09-14), with two changes:

- **People are a strip of cards above the list**, each with the Mate button
  from the profile card. In the list a person was dated by when they joined,
  so anyone who had been here a while sat below every recent comment that
  mentioned them.
- **A post or comment that matches only through an @mention sits below
  everything else.** It is still shown.

Considered and not taken: grouping the list by kind, and filter chips. Code:
`features/kronk_search` (`people_strip.tsx`, `text.ts`).

---

## 2026-10-10 — Notifications get their own face in Nudges

**Decided by Tal**, after requests for a plain notifications space. Nudges
keeps its pillar and gains two faces on the barrel: **Notifications**, where
you land, and **Messages**, a swipe across. Activity lines ("Ana frothed your
post") **leave the chats** and live only on the Notifications face. A chat is
messages, plus the lines that are about the chat itself (a Krew join, a
message milestone). The pinned "Kronk" row goes; its system notices move to
the Notifications face.

This supersedes the part of the Nudges design that put notices _inside_ the
conversation with the person who did the thing ("a messenger, not a bell").
What that design cost: a notification had no recipient of its own, only a
chat, so a stranger frothing your post opened a two-way chat with them to
hold the line, and nothing could list your notifications in one place.

How it turns: a sideways swipe on touch. Without touch, the Notifications
face turns from its title (the standard rotator) and the Messages face from a
button at the head of the chat strip. The Messages face keeps no header row,
so the conversation keeps the height Tal gave it on 2026-09-14.

The faces are labelled **Notifications** and **Messages**. That is the word
people asked for, so the language table now reserves only "bell".

Built in two PRs: the event gained a recipient and a seen time with an API
to list them (#2040); then the two faces, with the router no longer filing
events in chats and the chat list no longer showing a Mate chat nobody has
written in. Detail: `docs/spaces/nudges.md` (Nudges spec) § Notifications
list and § Surfaces.

---

## 2026-10-09 — Open tabs load a new deploy by themselves

**Decided by Tal.** An open tab or the phone app reloads into a new deploy on
its own, at a safe moment, instead of running the code it loaded until it is
closed. The trigger was 2.0.5: the proposal page checked `actioned`, open
sessions still ran 2.0.4's chunk checking `delivered`, and proposers saw no
Close button. The service worker wasn't the cause (it caches only locales,
fonts and images, and `/` is `no-store`); long-lived sessions were, because
old hashed chunks stay on the server after a deploy.

How: `Kronk::Build` (a digest of the Vite manifest) is rendered into the
page and served at `/api/v1/kronk_build` with `no-store`; the client compares
on visibility, focus and a 5-minute poll, and treats a chunk that fails to
load as a new build. It never reloads mid-typing, with unsaved text, or
during an upload or recording (`holdReload()`), and never twice for one build.

---

## 2026-10-09 — Kommons proposals are opt-in in the feed

**Decided by Tal.** New proposals no longer show in anyone's feed unless they
turn on **Show Kommons proposals in my feed** (Feed settings, default off).
The Kommons board is where proposals live while the dev ↔ Kommons flow is
still being worked out; a card per proposal in every feed was more than the
space can carry right now. Reversible: flip the default in `UserSettings`
(`kronk.feed_show_proposals`).

Proposals still post their feed Status, because it is also the proposal's
discussion thread, so the proposal page, replies, profiles, search and Nudges
are unchanged. The filter is on the read side (`Kronk::FeedProposals`, Home
at any reach and Kommunity), plus the client for live streamed posts.
Details in `docs/spaces/feed.md` (What the feed shows).

---

## 2026-10-08 — Moments get the standard reactions bar through a hidden Status

**Decided by Tal.** A Moment takes the same Reply · Froth · Nudge bar as every
other space, riding a backing Status, rather than a froth button of its own.
**Supersedes** the open question left in `docs/spaces/moments.md` after #1963,
which wrote `mint_backing_status!` but never called it.

The Status is a reactions target only: `post_type: moment` keeps it out of
feeds, profiles and search, and `StatusPolicy` makes it exactly as visible as
the Moment, so the 24-hour collapse to the author needs no sweep. It carries
no media, unlike #1963's draft: the Moment owns its media (#969), and a
Status that held it would destroy it on deletion. Details in
`docs/spaces/moments.md` (Reactions).

---

## 2026-10-10 — FreeTheDream is open: no approval, creators choose their helpers

**Decided by Tal.** Nobody approves what goes on FreeTheDream's map. Anyone
adds a project and it is on the map straight away, run by whoever added it.
The creator chooses, per project, whether anyone can join in running it or
they accept helpers. Founding projects get no special list; their people add
them like anyone else. **Supersedes** the prototype's admin review (#1988,
#2010) and the steward-admins in #2043.

Why: "I don't think it's syntropic to have someone in control of what can be
proposed." Some projects want to be open to all, others want their creator to
choose who joins, so that's the creator's call rather than the map's.

What follows from it: there are no admins and no map-wide documents. Each
person's own document carries everything they write, and the server filters
what each viewer receives (a request to help is between the asker and the
creator unless the project is open). Taking down harmful or spam projects is
deferred.

---

## 2026-10-07 — Emails are dark-first, laid out as the void

**Decided by Tal.** Transactional email takes the same dark-first surface as
every other Kronk page, and drops Mastodon's layout rather than recolouring it.
**Supersedes** #1953's light card under a dark header.

The light card was chosen so client dark-mode inversion couldn't mangle it, but
it kept Mastodon's shape (header band, overlapping white card, grey footer),
and its header never rendered: premailer folded `background-color` and the
cover-glow gradients into one `background:` shorthand with the colour first,
which is invalid, so every client dropped it and the white title sat on white.

Now: Kosmos void ground, the seal (Ж inside the three threshold rings, a
flattened PNG in `public/emails/` with its halo baked in, so no CSS gradient is
needed), serif title, one `--surface-primary` panel, a full-width accent pill,
and the wordmark signing off. `color-scheme: dark` is declared. Values are the
dark tokens baked to literals in `styles/entrypoints/mailer.scss`, since email
has no custom properties.

---

## 2026-10-04 — Kronk is its own platform; Mastodon is the engine underneath

**Decided by Tal.** With 2.0.0 shipped, Kronk is no longer "a Mastodon fork with
custom features". The docs now say so, and three working rules change with it.
The full statement is the "What Kronk is" section of `CLAUDE.md`.

1. **Kronk-first, still taking upstream.** Kronk's surface and product logic —
   web client, spaces, korners, copy, design system — are ours to change or
   replace outright. Mastodon's backend and core stay the engine, and we keep
   merging upstream for security and framework updates (the Rails 8.1 move,
   `upstream-merge.md`). The old blanket rule "don't modify upstream files
   unnecessarily" narrows to the engine only.
2. **Federation is closed and is no longer a design constraint.** This goes one
   step past the 2026-09-16 entry, which said AP compatibility did not apply to
   2.0 work: the "don't break federation" code rule is retired outright. The
   ActivityPub code stays in place, switched off, because deleting it would
   enlarge every upstream merge while it does nothing.
3. **Build toward Kronk 3.0: other communities running their own Kronk.**
   Federation returns as a Kronk-native system (Mates, consent and reach, not
   Mastodon's open follow graph), designed fresh. Until then, new code must not
   hardcode the instance — no `kronk.info`, no community content in components.
   About a dozen files hardcode the domain today; that is debt, not precedent.

**Supersedes:** the "Don't break federation" and "Don't modify upstream files
unnecessarily" code rules in `CLAUDE.md` and `CONTRIBUTING.md`.

**And: fewer docs.** Claude does most of the building alongside developers, so
`CLAUDE.md` — which it loads automatically — is the single guide: identity,
principles, language, aesthetic rules, the korner recipe and the workflow.
`CONTRIBUTING.md` is a short front door to it. Don't add standalone docs;
extend `CLAUDE.md`, the space's own doc, or the korner standard.

---

## 2026-08-28 — Per-post audience: scope + krews + people; public is unrestrictable

**Decision (Tal).** Post audience is **three composable layers**, not a single
mode: **scope** (the reach ladder) + **krews** (named reusable groups) +
**people** (ad-hoc individuals added/removed per post). An author can see who can
see any of their posts and add or remove specific people — but **only on the
gated scopes** (`mates`/`orbit`/`self_only`). A **`public` post cannot be
restricted**: public means everyone on Kronk.

**Why the public exclusion is a correctness rule.** A public post can't truly be
hidden (logged-out view, boosts, links), so "remove from public" would be a
privacy lie, and "who can see it" would be unenumerable. Restricting the feature
to read-gated scopes makes **every use real, enforced access control**, and every
audience **bounded/knowable**. `self_only` + add-people then cleanly rebuilds
"post to specific people" (what `direct`/`limited` did) on an enforceable base.

**Consequence for the visibility retirement (Phase 2b).** The per-recipient
read-grant + fan-out this feature reuses — `StatusPolicy#mention_exists?`,
`FanOutOnWriteService#deliver_to_mentioned_followers!`, `ProcessMentionsService`
— must be **kept and generalized**, NOT purged. Phase 2b removes the retired
_enum values_ + their _selection_ only; the recipient machinery stays. #1427
(data fold) is unaffected.

**Status.** Direction ratified; design in `docs/spaces/feed.md (Per-post audience)`
(build order: readout → add → additive edit → remove-with-feed-reconciliation).
Not yet implemented.

---

## 2026-08-28 — Retire the Mastodon visibilities; the reach ladder is the only audience vocabulary

**Decision (Tal).** The Mastodon follower-model visibilities —
`unlisted`, `private`, `direct`, `limited` — are **retired** from Kronk. The
Kronk **reach ladder** (`public` = Kronkverse, `mates`, `orbit`, `self_only`)
becomes the _only_ way to choose who sees a post. This ratifies the "Path B"
work that until now lived only in PR descriptions (#1423 / #1427) and was never
recorded here.

**Why now.** Those four visibilities encode _follower-graph + federation_
semantics (unlisted = off public timelines but link-shareable; private =
followers-only; direct/limited = addressed audiences). Kronk is unfederated
through 2.0.0 and **federation is not a live constraint** (Tal, 2026-08), so the
only reason to keep them — cross-instance compatibility — doesn't apply. The
reach ladder already covers every audience Kronk actually has, natively. Keeping
both was a half-migrated state: the reach ladder shipped _alongside_ the old
values (the enum still declares all of them) rather than replacing them.

**Supersedes** the current tip's `Status::Visibility.selectable_visibilities`,
which kept `unlisted` + `private` selectable (`visibilities.keys - %w(direct
limited)`). All four go.

**Canonical fold mapping** (Tal's mapping, matches the compose reducer's
`REACH_MAP` + the #1427 migration):

| Retired    | Folds to    |
| ---------- | ----------- |
| `unlisted` | `self_only` |
| `private`  | `mates`     |
| `direct`   | `mates`     |
| `limited`  | `mates`     |

Not reversible: three sources collapse onto `mates` with no discriminator to
un-collapse them.

**Phased plan** (each phase lands only after the one before it):

1. **Phase 1B — composer (#1423).** The composer stops _offering_ the four
   retired values; `selectable_visibilities` returns the reach ladder only. The
   enum still _declares_ them so legacy rows stay valid. _(Rebased + green.)_
2. **Phase 2a — data fold (#1427).** One migration rewrites existing
   `statuses.visibility` + `users.settings` default*privacy per the mapping
   above, so no live row still carries a retired value. Must land **after** 1B
   (so nothing new is created mid-fold) and its migration timestamp must be
   current, not the stale 2026-08-13 one. *(Rebased + green.)\_
3. **Phase 2b — narrow + purge (follow-up).** Once 2a has run on shadow, drop
   the retired names from the Ruby enum and delete the now-dead
   federation-shaped logic they fed (e.g. `distributable_visibility`,
   `list_eligible_visibility`, `not_direct_visibility`, direct-message plumbing)
   plus the ~120 remaining `unlisted`/`private`/`direct`/`limited` references
   across `app/`. This is the large slice; it cannot start until 2a's fold is
   live, or it would orphan rows on values the enum no longer knows.

**Non-negotiable ordering:** 1B → 2a (after fold deploys) → 2b. Skipping ahead
either lets users create values that are about to vanish, or removes enum values
while rows still hold them.

---

## 2026-08-16 — The bio stays visible on a gated profile

**Decision (Tal).** On a gated profile, the visible identity is **name +
avatar + bio** — not name + avatar alone. The bio (`account.note`) is the
public self-description a stranger reads to decide whether to become Mates, so
gating it would make the "Mate?" prompt ask people to commit blind. Everything
else stays gated: told-cards, drawn shelves, structured fields, mates/post
counts, and the post timeline.

**Consequences.**

- **Supersedes** the "everything except name + avatar" framing in the gated-view
  work below, and **retires the follow-up** that entry flagged (blanking
  `note` in `REST::AccountSerializer`). Because the bio is meant to be seen,
  there is nothing to blank server-side and no per-timeline reach-check cost —
  the JSON already carries `note`, which is now correct rather than a leak.
- Frontend only: the gated view renders `AccountBio` (shelved `/@user` and the
  classic `/@user/posts` header); the counts/fields blocks stay behind the gate.

---

## 2026-08-16 — Profile privacy is a per-account reach scope, defaulting to Kronkverse

**Decision (Tal).** The "opt out later" privacy control promised by the
present-by-default decision below is the **reach ladder applied to the whole
profile** — not a new privacy vocabulary. A member picks who can see their
profile from the same rungs every other reach control uses, defaulting to the
widest (Kronkverse), and can narrow it.

**What this means in code.**

- **New `accounts.profile_visibility`** (integer enum, default `0` = `public`).
  Values reuse the `ProfileVisibility` ladder integers (`public:0, mates:1,
orbit:3, self_only:4`) so the number line stays uniform across models.
  `Account#profile_visible_to?(viewer)` mirrors `ProfileVisibility#visible_to?`
  resolved against `self`: `public` = any signed-in local member, `mates` =
  mutual follows, `orbit` = + mates-of-mates, `self_only` = owner only.
- **Enforcement** is at the profile-content controllers
  (`Api::V1::Accounts::Profile::CardsController`,
  `…::SectionsController` index + statuses): a viewer who fails
  `profile_visible_to?` gets **no** cards/shelves, over and above each card's
  own per-card reach. **Name + avatar stay visible regardless** — a private
  profile is still a face in the Kommunity (present-by-default holds).
- **The control** rides the existing `/api/v1/settings/privacy` endpoint (new
  `profile_visibility` enum field) and renders in the Privacy screen with the
  canonical `ReachDropdown` (Me / Mates / Orbit / Kronkverse), not the generic
  enum widget — a raw "Public" label would misread as fediverse-public.
- **Orthogonal to `discoverable` / `kommunity_discoverability`.** Those govern
  whether you're _found_ (Directory / search / Kommunity list); this governs
  whether a viewer who reaches the profile can _see its content_. A member can
  be discoverable but profile-private (findable face, private shelves).

**Scope of this cut (follow-ups).** The gate covers profile cards + drawn
shelves (the rebuild's profile content). The bio (`note`) and the account's
post timeline are **not** gated by `profile_visibility` yet — they carry their
own reach/visibility and gating them touches the account serializer + the
per-status reach chain. A "this profile is limited" affordance on the SPA
(exposing `profile_visibility` in the account serializer) is also deferred.

**Fulfils** the "Still to do" note in the present-by-default decision below.

---

## 2026-08-19 — The unconfirmed-account purge is disabled (it deleted a live member)

**Decision (Tal).** No account may be deleted for being unconfirmed. Upstream
`Scheduler::UserCleanupScheduler` hard-deletes unconfirmed users >7 days old via
`Account.where(...).delete_all` (no callbacks, no `DeleteAccountService`, no
sidekiq jobs, no moderation log — hence zero trace). That assumes email
confirmation is mandatory. It is not in Kronk, so an unconfirmed account is a
real member — and on 2026-08-18 06:11 this sweep silently deleted **@ladatal**
(an unconfirmed signup), unrecoverably.

**What this means in code.** `clean_unconfirmed_accounts!` is removed from
`Scheduler::UserCleanupScheduler#perform`; it now only runs the discarded-status
cleanup. The existing unconfirmed accounts were confirmed by hand to take them
off the clock. Complements the activate-on-signup change above (which stops
accounts becoming unconfirmed in the first place) — together they guarantee no
member is ever auto-purged for confirmation state.

---

## 2026-08-19 — Signups are activated immediately; email confirmation is a separate optional step

**Decision (Tal).** Now that email confirmation is voluntary, it must not be the
**activation** gate either. Before this, a real signup stayed `confirmed_at =
NULL` (the confirmation mail is optional / undeliverable on shadow), which meant
`prepare_new_user!` — feed bootstrap, welcome, approval routing — **never ran**,
leaving the account half-provisioned and reading as `confirmed? == false`
everywhere. Observed on shadow: recent web signups (`itsa_mango`, `tomasbusby`,
`snowtal`) were all unconfirmed and un-bootstrapped, while bridge accounts
(`tootctl create --confirmed`) were fine.

**What this means in code.** `User#auto_confirm_signup!` (`after_create_commit`,
guarded by `sign_up_ip.present? && !confirmed?`) calls the existing
`mark_email_as_confirmed!` on a genuine registration, so the account is confirmed
at signup and the normal confirmation flow (including approval routing — pending
accounts stay pending) runs. `sign_up_ip` is the real-registration marker (web +
app both set it); bridge / tootctl / fabricated users have none and arrive
confirmed anyway, so they're untouched. **"Confirmed" now means "activated";
"verified email" is a separate, optional concern.**

**Builds on** the voluntary-email decision below — that removed the confirmation
_gates_; this removes the confirmation _activation dependency_.

---

## 2026-08-16 — Everyone is present in Kronk by default; discoverability is opt-out, not opt-in

**Decision (Tal).** Every member should be **present in Kronk** by default —
name + profile picture visible in the Kommunity, findable in the Directory and
Kronk search — and then choose for themselves how private their profile is. The
signup-time "Make my profile discoverable" opt-in is retired. "Present" stops at
Kronk: new accounts are **discoverable but not indexable** — "present in Kronk,
not Google."

**What this means in code.**

- **New local accounts default to `discoverable = true`.** Set in a
  `User#default_account_discoverability` `before_create` (covers both the web
  registration and the app `AppSignUpService` paths; internal/service actors
  have no `User`, so they are untouched). `indexable` keeps its schema default
  of `false`, so external search engines stay out.
- **The onboarding profile step no longer manages `discoverable`/`indexable`.**
  The "Make my profile discoverable" `Toggle` (and its `recommended` /
  `onboarding.profile.discoverable*` strings) were removed from
  `features/onboarding/profile.tsx`; the server owns the default.
- **Kommunity presence was already universal** — `kommunity_discoverability`
  defaults to `everyone` and is independent of the Mastodon `discoverable` flag,
  so the Kommunity list did not depend on this change.

**Still to do (not this change).** Surface privacy as a real per-profile setting
so a member can opt out of the Directory / search after the fact. Until then,
opting out is possible only through the existing account settings.

**Supersedes** the onboarding discoverability opt-in. Builds on the voluntary-email
decision below (both make presence the default and privacy a member's own choice).

---

## 2026-08-16 — Email confirmation is voluntary and never gates visibility or interaction

**Decision (Tal).** Email in Kronk is for **password recovery + communication**,
at the **user's discretion** — it is **not** an anti-spam/anti-bot lever, and it
**never affects how a member interacts with the platform or whether others can
see them**. Anti-spam rides on **approval + invite/trusted onboarding**, not on a
confirmed inbox.

**What this means in code.** `confirmed_at` must not appear in any _visibility_
or _interaction_ gate. `User#functional_or_moved?` already dropped it for access;
the remaining stale gates are being removed as they surface:

- `AccountOwnedConcern` + `Api::V1::AccountsController` — profile page / account
  API (#1521).
- `Account.kommunity_discoverable_to` + the Kommunity orb (#1538).
- `Account.without_unapproved` (→ `User.approved`) + `Account::Search` raw SQL
  (this change) — search + directory.

The gates that **stay**: `approved` (admin gate), not `suspended`/`silenced`/
`disabled`/`memorial`/`moved`, and — on _discovery_ surfaces specifically
(Kommunity) — `current_sign_in_at` present, which hides registered-but-never-
active default-avatar rows. That last is about "has actually used the account,"
not about email.

**Legitimate `confirmed_at` uses that remain:** the confirmation flow itself,
password recovery, announcement/notification recipients, and feed vacuum. Those
are not visibility gates.

**Guidance for the next person:** do not re-introduce a `confirmed_at` /
`User.confirmed` check to decide whether an account shows up or can act. If you
need "a real, visible member," that's approved + active — not confirmed email.

---

## 2026-08-14 — Profile editing consolidated into Arrange mode; `/@:acct/edit` composer retired

**Decision.** There is one profile-editing surface: **Arrange mode on the
shelved profile** (`/@:acct/shelves`, owner-only). The standalone
`/@:acct/edit` composer (`features/profile_compose/`) is retired.

**Why.** We had two editors. The shelved profile's Arrange mode edited
cards/shelves but had **no** identity editing; the `/@:acct/edit` composer was
reachable by nothing but its own route (orphaned) yet had grown a duplicate
identity editor (display name, bio, avatar, header, fields). Arrange is
already the owner's edit entry point, so identity editing belongs there.

**What shipped.**

- **PR A** — identity editor folded into Arrange (`profile_shelves/components/
identity_editor.tsx`), rendered above `ArrangeStage`. Saves via a direct
  partial `update_credentials` (not the `updateAccount` action, which
  force-writes `discoverable`/`indexable` and would clobber privacy).
- **PR B** — retired the composer: deleted `features/profile_compose/` +
  `_kcompose.scss`, removed the SPA route + async component, and made
  `/@:acct/edit` a `<Redirect>` to `/@:acct/shelves`. The settings-nav
  "Profile" row now points at `/@:acct/shelves`.

**Node graph.** `profile.edit` is **kept** (relabelled "Profile editor",
`lifecycle: live`, url still `/@:user/edit` — which now resolves to the
redirect). Kept rather than deleted so its inbound refs stay valid with zero
cascade: the `settings.profile` `settings_for` link and two
`kommons_tracker.yaml` items (`privacy-to-profile`, `profile-composer-complete`)
still point at a real node.

**Landmine noted.** The `profile_composer` feature flag is **not** the
composer — it gates the `profile_cards` API endpoints that Arrange depends on.
It stays enabled; only its comment was corrected. Renaming it was deliberately
avoided (churn).

**Follow-up (PR C).** Onboarding's profile step (`onboarding/profile.tsx`) is
still a separate identity editor (it has extras: a discoverability toggle +
next-flow navigation). Dedupe it onto a shared component later.

---

## 2026-08-14 — Cross-korner connections: one `korner_attachments` table + manifest-declared consent

Kronk already has three cross-korner connections (Kalendar Event → Albutts
Album via `album.event_id` + a bespoke subscriber; Kalendar Event → Booth
Set via `booth_set.event_id`; Kalendar Event → Huddle Session via
`event.huddle_session_id` + `huddle` listening for `kalendar.event.created`).
Every pair is a new column, a new subscriber, a new UI. That doesn't scale
to the next five pairs (Kommons → Kalendar for a "voting deadline event,"
Booth → Martketplace for "buy the DJ's release," Nudges → any-korner for
reminders, …).

**Decision:** ship one generic primitive — `korner_attachments`, a join
table keyed by manifest slug + record id — and let every future cross-
korner connection be a **config change (manifest fields) + a UI wiring**,
not a schema migration.

Shape:

- **`korner_attachments`** — `(source_slug, source_id, target_slug, target_id,
kind, metadata, created_by, created_at)`. `kind` is one of `spawn` (auto-
  created by a source trigger, cascade-delete), `link` (user-added,
  independent lifecycle), `reference` (passive mention). Not Rails
  polymorphic — slug strings are the primary keys of the manifest, which is
  already the registry.
- **`attaches:` / `accepts:` manifest fields** — every korner declares what
  it may attach to + what it accepts from. `bin/tootctl korners doctor`
  enforces bidirectional consent. Matches how `emits:` / `listens:`
  already work.
- **Shared React primitives** — `useAttachments`, `<AttachmentSection>`,
  `<AttachmentPicker>` (new rows on `docs/design.md (Platform primitives)`
  at Phase 2). New korners get the UX for free.
- **Migration path:** 5 phases (§5 of the spec doc), starting with the
  schema and API (no UI), then primitives plus one adopter, then backfill
  of the existing bespoke pairs. FK columns stay as a passive mirror for
  one release cycle after the join is authoritative — makes rollback cheap.

**Motivation:** Tal 2026-08-14 — "How can we ensure this is open ended for
other korners to connect into at a later date? I want to create the
plumbing, then the standard fittings for building korners moving forward
which can be used and reused."

**Full spec:** [`docs/korners/adding_a_korner.md (Korner attachments)`](korners/adding_a_korner.md).

**Supersedes:** the intent behind the bespoke `album.event_id` +
`booth_set.event_id` + `event.spawn_album` + `albutts_event_bus.rb`
pattern. Those stay in place until Phase 3 backfills them into the join.

## 2026-08-14 — Account & Security: the "connected apps" / capability surface is coming-soon

Context: scoping the Account & Security settings rebuild. Phase 1 shipped the
native landing + signed-in devices + recent sign-ins (#1482). While scoping the
rest of "Group A" — the _authorised apps_ surface (see and revoke what has a
token to act on your account) — we hit the real question: **Kronk has no
third-party app ecosystem yet**, so that surface is near-empty today. Its first
genuine entry would be a **pod client**, and the designated first one is **YOU**
(`docs/spaces/you.md`) via the **Anthemos membrane** — the consent layer of
recipient-scoped, revocable capability grants.

**Decision (Tal): park it as coming-soon, don't build it now.** The user-facing
"connected apps" / capability consent+revoke surface is the same thing the
membrane needs, and the membrane is deferred (blocked on Anthemos). Building an
empty grant-management screen before there is anything to grant is effort for a
dormant capability — same reasoning that deferred aliases (federation) earlier.

What this means concretely:

- **Not built now:** a "Connected apps" surface, log-in-with-Kronk for YOU, and
  projecting YOU signals onto the Kronk profile (the "✓ Anthemos" chip in
  `docs/prototypes/kronk-profile-redesign.html`). These stay in
  `docs/spaces/you.md` § Deferred.
- **When it lands:** the consent/revoke UI is an Account & Security surface (it
  belongs next to signed-in devices), and YOU is its first real entry — so the
  settings thread and the membrane thread meet there. The doc's
  "secure only once / provisional until Anthemos-verified" pattern is the licence
  to ship a provisional slice first.
- **Account & Security continues** with the surfaces that serve _live_ needs —
  Data export/import next — not the app/capability surfaces that wait on
  Anthemos.

Supersedes nothing; records a deferral so it is not rediscovered.

## 2026-09-16 — `unlisted` → `self_only` at cutover: confirmed

The migration maps every `unlisted` post to `self_only`, which takes **87
existing posts** out of public view and leaves them visible only to their
author. `cutover.md` has carried this as an open question for weeks
("probably right, currently undiscussed").

**Tal, 2026-09-16: keep it.** It is the intended shape of the reach ladder —
"quiet public" is not a tier Kronk 2.0 has, and the honest mapping for a post
whose author chose not to broadcast it is the narrowest one rather than the
widest.

Worth being clear about what it costs, so nobody discovers it later:

- **It is not reversible by re-running anything.** The old value is gone once
  the migration writes; getting those 87 posts back to a public tier means
  restoring the pre-cutover dump or editing them by hand.
- **The authors are not told.** Nothing notifies someone that a post of theirs
  narrowed. If that matters it wants a line in the announcement, not code.
- **`direct` also maps to `self_only`** (161 posts) — that half was never in
  question, since a DM has no audience in a world where messages live in
  Nudges.

Counted at the 2026-09-13 rehearsal: 161 `direct` + 87 `unlisted` = 248 posts
to `self_only`, and 26 `private` to `mates`.

## 2026-09-16 — Federation is CLOSED for 2.0, and that is settled

**Do not re-derive this. Do not re-check it before each piece of work.** It is
decided, it is in force on production today, and it was verified on this date:

```
limited_federation_mode = true      (Rails.configuration.x.mastodon)
DomainAllow             = 0         allowlist federation with an empty allowlist
Relay.enabled           = 0
/api/v2/instance        limited_federation: true
```

Limited federation mode means the instance federates **only** with allowlisted
domains. Zero allowlisted means nothing goes out and nothing comes in.

### The residue is not a connection

Production's database still holds 207 remote accounts across 140 domains, 36
follows out to remote accounts and 14 follows in from them. **These are
historical rows, not live relationships** — the lockdown already severed them.
They are what a federated past leaves behind, and they will sit there harmlessly
unless someone decides to clean them up.

This matters because those numbers look alarming in a query and have twice been
raised as a risk to the domain move. They are not. **Changing `LOCAL_DOMAIN`
cannot break a federation relationship that is already not federating.**

### What follows from it

- The **domain move has no federation cost.** Renaming every local handle from
  `@user@mastodon.kronk.info` to `@user@kronk.info` cannot reach anybody
  outside, because nobody outside is being reached.
- **No AP-compatibility argument applies to 2.0 work.** "Would this break
  federation?" is not a live constraint on the rebuild; the code rules against
  breaking federation protect a capability that is currently switched off and
  deliberately so.
- The switch is **reversible** — it is env, not code — so none of this is a
  one-way door. Re-opening federation is a decision someone makes later, with
  its own checks. Until then it is closed, and closed is the assumption.

## 2026-09-16 — What `mastodon.kronk.info` does after the move

`kronk.info` becomes the instance; `mastodon.kronk.info` keeps answering
**forever** (existing posts, bookmarks, emails and anything pasted elsewhere
still point at it). What it answers with is not one blanket redirect, because
two different clients ask it two different questions.

### Browsers get a path-preserving 301

`https://mastodon.kronk.info/@someone/123` → `https://kronk.info/@someone/123`
(`return 301 https://kronk.info$request_uri`, not the `/home` redirect the
`kronk.info` vhost carries today). Two consequences to expect rather than
discover:

- **Everyone is signed out.** Session cookies are scoped to the old host, so
  the new domain starts logged out — sign-in, then the thresholds ceremony.
- **The old origin has a registered service worker.** It can keep serving the
  cached SPA shell to people who never hard-reload, so some will not see the
  redirect for a while. If that matters on the day, serve a self-unregistering
  service worker at the old origin rather than waiting for caches to expire.

### The Android app must NOT be redirected

This is the part a blanket redirect breaks. Every `MastodonAPIRequest` is built
against the `domain` stored on its `AccountSession`, so every existing install
has `mastodon.kronk.info` baked into its saved session and will keep calling it.

Under a 301, OkHttp follows the redirect for `GET` — but for `POST` it follows
by **converting the request to a GET and dropping the body** (standard 301/302
behaviour). Reads would appear to work while posting, frothing and following
silently failed. That is the worst possible failure shape: an app that looks
alive and quietly does nothing.

So the old host must keep **proxying** the API rather than redirecting it:

- `/api/`, `/oauth/`, `/auth/`, `/.well-known/` → proxy to the app, unchanged.
- everything else → 301 to `kronk.info`.
- Set `ALTERNATE_DOMAINS=mastodon.kronk.info` so Rails' host authorization
  (`config/initializers/1_hosts.rb`) accepts requests still arriving with the
  old `Host` header.

The app's deep links already register **both** hosts in `AndroidManifest.xml`,
so links keep opening the app either way. What no server config can fix is the
stored session domain — that needs an app release that rewrites it, or each
person re-adding their account. Until one of those happens, the proxy is what
keeps phones working.

**Web push is separate and unavoidable.** 205 subscriptions are bound to the old
origin and stop delivering; each browser re-subscribes on the new domain. Nobody
loses anything permanently.

### The configs exist, staged on the droplet

Written and syntax-tested 2026-09-16, **not installed** — they go live only when
someone with root copies them in. `kronk:/home/claude/cutover/` holds
`kronk.info`, `mastodon.kronk.info`, a shared `00-mastodon-shared.conf`, a proxy
snippet, and a README with install order, rollback and post-checks.

Three things that came out of writing them, all of which would have been
discovered on the day otherwise:

1. **The apex is not empty.** `/var/www/kronk.info` serves ~105 MB — the APK
   download at `/kronk.apk`, per-branch builds under `/dev/`, the `/app` landing
   page, `/branding` and `/events`. Pointing the hostname at Mastodon without
   care would have 404'd the app download. The new vhost matches those paths
   ahead of the app so they keep serving from disk; checked against
   `config/routes.rb` — Kronk has no top-level route by any of those names, so
   nothing is shadowed.
2. **The upstreams live inside the old vhost.** `backend`, `streaming`, the
   `connection_upgrade` map and the cache zone are all declared in
   `sites-available/mastodon`, and nginx permits one definition each. Whichever
   vhost kept them would silently become load-bearing for the other, so they
   move to `conf.d/` and are owned by neither. Shadow is unaffected — it
   declares its own `staging_*` pair.
3. **`ALTERNATE_DOMAINS` must be set before the nginx reload**, not after.
   Without it Rails host authorization rejects every request still arriving with
   the old `Host` header, which is every phone out there.

## 2026-08-13 — No stacked PRs: every branch starts from the integration tip

Tal's call, from watching it fail twice in one session. The contributor rule now
lives in `CLAUDE.md` §1; this entry records the reasoning so it is not
rediscovered.

**A stacked PR cannot survive its parent merging.** Branch B off open PR A, and
when A lands the merge queue squashes it. B still carries A's _original_
commits, so the rebase collides, and B is **ejected from the queue**: still open,
still green, simply not merging, with no notification. It has to be rebased by
hand, once per parent, every round.

**What it cost.** A four-deep stack (#1415 → #1417 → #1418 → #1420 → #1426, plus
the icon work on top) was ejected **twice**. Each round needed the whole tail
re-rebased, re-pushed, re-linted and re-queued, and each round the PRs _looked_
queued in the meantime. The ejections were only noticed because someone went to
queue the next PR and found the queue empty with the earlier ones still open.
Rebasing was safe every time — git dropped the already-landed commits and every
file came back byte-identical to the version that had passed lint — but "safe"
still meant three manual interventions that independent branches would not have
needed at all.

**The trade being made.** Stacking buys a tidier review diff: each PR shows only
its own change. Independent branches sometimes show overlapping context and
occasionally need a conflict resolved at merge time. That is a much smaller cost
than serialised merges that eject themselves silently — especially with a
lint-only gate, where an ejected PR gives off no signal at all.

**Decisions.**

1. **Base every branch on `origin/rebuild/2.0.0`.** Accept duplication in review.
2. **If work cannot compile without earlier work, it is one PR.** Split by
   reviewable unit, not commit tidiness.
3. **Stacking is a documented exception**, declared in the PR body, and whoever
   stacks owns the re-rebasing.
4. **"Queued" is not "landed."** Re-check state after any parent merges. This
   applies to agents especially: reporting a PR as done on the strength of having
   queued it was wrong twice today.

---

## 2026-08-13 — Stage layer publishes three archetype classes (`.stage-fill`, `.stage-column`, `.stage-grid`)

Every korner mounts into the same Stage rectangle, but until now each
one wrote its own outer flex/scroll/max-width wrapper — `.kalendar-shell`,
`.kuestions-shell`, `.hub-page__board`, `.booth-native`, `.albutts-*-grid`
etc. — with subtly different padding, subtly different overflow rules,
and subtly different responsive behaviour. Kalendar shipping its own
`.kalendar-shell` on 2026-08-13 (the FeedDrum-in-Stage sizing fix) was the
tipping point: it was the third or fourth "shell" class that did the
same job as an earlier one.

`_kronk_stage.scss` now publishes three shared archetypes. A korner's
Stage-child picks one, or writes its own if none fit:

- **`.stage-fill`** — full-bleed: fills the Stage rectangle, no side
  padding, no max-width. For canvases and rotators (Kalendar Spiral,
  the Kalendar rotator itself, Map, Kommunity orb, Inflow veil).
- **`.stage-column`** — capped reading column, centred, `max-width: 38.75rem`
  (matches Mastodon's classic reading width), vertical scroll only.
  For list-shape faces (Kalendar list, Kommons proposals, Kuestions
  panels, Krew list, Mate list).
- **`.stage-grid`** — capped-width responsive tile grid,
  `minmax(min(140px, 100%), 1fr)` (the `min(…)` clamp lets tiles
  shrink below their nominal 140px on narrow phone Stages instead of
  forcing a horizontal scrollbar). For tile landings (Hub, Albutts,
  Booth gallery).

**Vertical-scroll only.** Both scrolling archetypes (`.stage-column`
and `.stage-grid`) declare `overflow-x: hidden` explicitly. Per the
CSS spec, `overflow-y: auto` with default `overflow-x: visible` gets
promoted to `overflow-x: auto` in Chromium — so setting `hidden`
explicitly is what actually keeps them vertical-only on phone. Kronk
phone views never side-scroll (Tal, 2026-08-13: "the thing i very
specifically do not want is the half/view, side scroll of the phone
screen, only vertical scroll").

**Migration is opt-in, not forced.** This decision introduces the
classes and converts Kalendar (both faces) as the reference adopter.
Shipped korners that already have working shells (Kuestions, Hub,
Albutts, Booth, Krew, Kommons) keep them. Follow-up sweeps convert
one at a time so per-korner idiosyncrasies (Kuestions' star-field
backdrop, Hub's tile-icon chrome, Booth's size-variant gallery) get
audited on their own PR rather than in a single sprawling refactor.

New korners land on an archetype by default. If the manifest reviewer
sees a fresh `-shell` class doing what an archetype already does, that
is the reason to say "use `.stage-fill` / `.stage-column` / `.stage-grid`
instead" during intake.

**Supersedes:** the Kalendar `.kalendar-shell` (already retired here).

## 2026-08-12 — Notifications: own-content first, federation and moderation deferred

Three calls that scope the retirement of the legacy `Notification` store. The
sweep behind them is `docs/spaces/nudges.md (Retiring legacy notifications)`.

**Federation is deferred.** Kronk will not federate for a while, so notification
work plans as **local-only**. This resolves the contradiction the sweep found:
`kronk_nudges.md` § Non-negotiables says "No federation. Nudges is local-only",
while the store being retired carries federated activity (a remote account
favouriting or following you, via the ActivityPub handlers). With federation
deferred those paths are **dormant, not broken** — so they are left in place
rather than removed. They live in upstream files, cost nothing while dormant, and
leaving them keeps re-federation cheap. Revisit when federation is real.

**Moderation is deferred.** Community moderation covers the near future, so no
system/moderation channel is built now. `moderation_warning`,
`severed_relationships`, `admin.*`, `annual_report` and
`email_confirmation_reminder` keep reading the legacy store, and `/nudges/legacy`
plus the Kronk system pane stay for them. Consequence to hold: **the store is
not dropped**, and "retire the legacy system" means _stop writing what we have
replaced_, not _delete the table_. Dropping it is the last few percent of value
and the largest share of the risk.

**The goal: notify a user when anything happens with their content** — replies,
reactions, nudges, mate requests, and so on.

### Why this unblocks the work

The sweep concluded nothing could start before **multi-recipient fan-out**. That
was correct for the spec's full relevance engine and wrong for this goal.
"Something happened to _my_ content" has exactly one recipient — the owner — and
is Tier-1 **directed** in the spec's terms, which the manifest path has delivered
since #1367 plumbed `directed:` through. Fan-out is only required for the
_discovery_ tiers (Tier-2 "someone I follow did a thing", Tier-3 "something
happened in a korner I tuned into"), and those are a separate feature.

So the remaining work is **additive publishers plus manifest entries** on
machinery that already exists: five `status.*` events (`frothed`, `replied`,
`mentioned`, `reblogged`, `quoted`), none of which is published today —
`Favourite` publishes only korner-scoped froths and has no plain-status branch.
No new delivery architecture, and two phases can start immediately.

Supersedes the "nothing can start before fan-out" framing in the first draft of
the plan, and narrows the "retires with the bell" scope in
`docs/spaces/nudges.md (Nudges spec)` § _Self-delivering delivery_ to the types we have
actually replaced.

---

## 2026-08-12 — Checks must be trustworthy before we add more

From a doc-vs-code audit that turned into six bug fixes. The individual fixes
are in #1357, #1361, #1367, #1369, #1372, #1381, #1392; this entry records the
pattern behind them, because fixing them one at a time will not stop the next
one.

### The pattern

Every problem found was **a second copy of the truth that nothing compared back
to the original**:

- Normative docs describing an audience model the code had already replaced
  (`kronk_feed_and_reach.md` §2 still said a post reaches a tier _or_ a krew,
  after krew became additive — and `Status::Visibility` cites that section as
  its spec).
- `db/schema.rb` disagreeing with its own migrations in **both** directions:
  missing three columns one migration adds, and still carrying an
  `album_photos` constraint another migration drops. A DB built from it crashed
  on every unread count and rejected every album-photo insert.
- The korner doctor's L1 icon check grepping for the korner **slug** in a map
  keyed by Material Symbols **name** — so it failed for all 13 non-core
  enforced korners regardless of whether the icon was wired, and could never
  have caught the cross-wiring §3 credits it with.
- The `file_input_aesthetic` guard matching the literal `<input type="file">`
  inside a **prose comment** documenting the upload flow — failing on its own
  documentation while the real input was correctly hidden.
- Manifest `notifications.types` validated against the `Notification` store
  that `kronk_nudges.md` § _Self-delivering delivery_ already retired, so L10
  actively points korner authors at the dying mechanism.

### Why it stayed invisible: red is the normal colour

`test` had 43 distinct failures. `Historical data migration test` failed on
**every PR**. The doctor renders red. When everything is red, no single red
carries information — so a real regression is indistinguishable from the
background. That is how a broken from-scratch database build survived weeks,
and why 13 bogus icon failures went unremarked.

This compounds: because the suite is untrustworthy, only `lint` can gate
(2026-08-02); because only `lint` gates, the suite drifts further. That trade
was right for a shadow-only branch, but this is where the bill arrives.

### Decisions

1. **Get CI to zero, then gate it.** Clear the remaining spec failures (#1369
   and #1372 took 7 of 43; the largest remaining cluster is 8 in
   `registrations_controller_spec`), shard the rspec suite so it is fast enough
   to gate, then make `test` required. Sharding was already named as the
   durable answer in the 2026-08-02 entry; until this lands, nothing else here
   really sticks.
2. **Every guard ships with a proof it can fail.** A new check must come with a
   known-bad input that makes it go red. Both the icon check and the file-input
   guard die at birth under this rule, and it costs almost nothing. Applies to
   `korners doctor` checks, repo-scanning tests, and stylelint governance
   entries alike — a green run on a file whose rules never matched is worse
   than no check, because it reports safety it never established.
3. **Reconcile generated artefacts in CI.** Add a job that rebuilds
   `db/schema.rb` from the migration history and fails on a diff. That one job
   catches both of today's schema bugs mechanically, forever. It is only
   possible now that #1372 makes the history replayable.
4. **Prefer generating over restating.** Hand-maintained tables of what the
   code already knows — the doctor's layer coverage in `korner_standard.md` §3,
   the wired-event inventory in `nudges_bus_state.md`, korner lists — are
   accurate the day they are typed and rot from then on. Where a fact is
   derivable, emit it from the code (a task, or the doctor's own output) rather
   than transcribing it.
5. **Every hand-written factual claim carries the command that checks it.**
   The `> **Current state (date)**` callouts already date claims; the addition
   is to name the one-liner that re-verifies them, so staleness is cheap to
   detect instead of requiring an audit to discover.
6. **Drift-prone docs ask the reader to fix them, on the spot.** A short
   `> **Freshness**` block at the top of each such doc gives the date it was
   last checked, the command that re-checks it, and an instruction: if the
   command disagrees with the doc, **correct the doc in your current PR**.
   Rationale over the alternatives — a scheduled sweep produces a report nobody
   owns, and a passive "verify against code" note (already in this file's
   header) is advice without an owner or a moment. Correction-at-point-of-read
   has both: whoever is reading is already in a PR with the context loaded, and
   it self-prioritises by traffic, since a doc nobody reads harms nobody until
   it is read. The block must stay **short and copy-pasteable** — a wall of
   preamble gets skipped, which is the failure mode to design against. Prefer
   naming a command CI already runs, so the check itself stays exercised
   (decision 2 applies to these commands too: a rotted verification command is
   the same bug one level up).

   Applies to normative/derived docs. **Not** to closed records
   (`krew_axis_migration.md`) or dated snapshots (`remaining_work_*.md`), which
   are meant to describe a past moment and are not stale for doing so.

### Non-goals

This is not a call for more checks. The point is the opposite: an untrustworthy
check is a liability, so the existing ones get fixed and gated before new ones
are added.

---

## 2026-08-12 — Compose surfaces standardise on `<ComposeShell>`

Every korner's "create a new thing" surface is a shared `<ComposeShell>`
overlay opened via the Ж bubble at a canonical `/hub/<slug>/composer` URL.
Piloted with Albutts (PR #1213, 2026-08-07) and Moments; extended today to
Map's trek composer (was a full-page `/hub/map/logger` form inside Map's
Stage — presenting complaint: "opens uncentered"). The remaining korners
still on bespoke surfaces (Krew, Kuestions, Kommons, Booth, plus the TBDs
Kalendar / Martketplace / Huddle) migrate PR-by-PR against this shape.

### The shell owns

- **Portal mount to `document.body`.** Every composer floats over the app,
  above the Stage's own scroll, always centred, dim backdrop behind.
- **Canonical URL `/hub/<slug>/composer`.** URL is the source of truth for
  open/closed — the FAB is a `<Link>`, the back button closes, refresh
  keeps the composer open. Each korner's manifest points its
  `compose.route` here.
- **Chrome slots.** Korner icon (from `useKornerIcon(slug)`) + label +
  optional subtitle in the header; optional `switcher` chip pair for
  multi-composer korners (Albutts: Album/Contribute; Maps eventually
  Post/Place); optional `headerAction` slot that reach controls slot into
  (Moments + trek composer both put `<ReachDropdown>` here).
- **Cancel + primary submit footer.** Body owns `canSubmit` +
  `submitting`; the shell disables the CTA and swaps `submitLabel` for
  `submittingLabel` mid-flight. Escape + backdrop-click both cancel
  (disabled while submitting so an in-flight create can't be
  double-cancelled).
- **Success unmounts.** The body's `onCreated` hands control back to the
  parent, which navigates to the new thing (Albutts → album detail; trek
  composer → My treks). No inline "saved!" banner inside the shell.

### What NOT to do

- No bespoke modals (`<Modal>`, `dispatch(openModal(...))`, or hand-rolled
  overlays) for korner create actions. Compose = shell.
- No full-page compose surfaces mounted as one of a korner's `views:`.
  Compose is not a browse face — it's an overlay on top of one.
- No local `ComposeFab`. The Ж bubble in the site chrome is the only entry
  point; it reads `compose.route` from the manifest. Albutts dropped its
  local FAB in PR #1358 (2026-08-09) after the Ж shipped.
- No compose-inline reach control in the body when the shell's
  `headerAction` will do. Reach is chrome.

### The Ж bubble is the only entry point

Each korner's manifest declares:

```yaml
compose:
  label: 'Log a trek' # what the Ж bubble tooltip / a11y label says
  route: '/hub/map/composer' # canonical shell URL
```

Legacy pre-shell URLs (Albutts: `/new`; Map: `/logger`) resolve to the same
overlay so bookmarks + in-flight tabs don't 404 during the migration.
Retire the aliases once the analytics say nobody hits them.

### Migration order

1. **Map / trek composer** — done today, this decision.
2. **Krew, Kuestions** — cheap wins. Single composer each, simple form,
   already URL-addressable.
3. **Kommons, Booth** — larger surfaces. Booth has two composers
   (upload / share), a good second reference for the `switcher` slot.
4. **Kalendar / Martketplace / Huddle** — declare `compose.route` in the
   manifest but no shell-shaped composer yet. Do first-implementation
   against this decision rather than shipping a bespoke one.

Non-korner composers (Nudges messenger, profile shelves' Tell composer,
Kommons tree's create-node composer) are out of scope — they're inline
panels inside larger surfaces, not "create a new thing at a korner URL"
actions.

### Enforcement

`bin/tootctl korners doctor` scans every `*composer*.tsx` under
`features/**/` and warns when a file misses the shell (no
`ComposeShell` import, direct `createPortal`, `openModal` dispatch,
or a local `<ComposeFab>` render). Warning-level so a WIP composer
can land — promote to `issues` once the standard is proven stable
and any legit exceptions are documented.

---

## 2026-08-09 — Cross-site standardisation decisions

From a site-wide standardisation audit (six read-only sweeps: composers,
space chrome, audience/reach, media/uploads, post interactions, cross-cutting
idioms). Four calls made by Tal; the remainder are ranked opportunities, not
decisions.

### Reach: the widest tier is "Kronkverse" everywhere

The widest reach/visibility tier shows **Kronkverse** on every picker and the
feed switcher. It was labelled three ways: `Kronk` (ReachDropdown, the feed
scope switcher, the Kuestions dial) and `Everyone on Kronk` (ScopePicker);
`KornerVisibilityPicker` already said Kronkverse. Display copy only — the
internal values (`public` / `kommunity` scope keys, the `kronk` ring-mark
glyph) are unchanged. The bespoke pickers (Kuestions' `VisibilityDial`,
profile shelves' `ReachPicker`, the map/event `<select>`s) fold onto the
shared `ReachDropdown` in follow-ups; that is the one standard visibility
selector.

### Krew is an orthogonal axis, not a visibility value

Per the reach spec, a krew is a group you post _into_, independent of the
distance ladder — "mates **and** krew X" must be expressible. Today every
model (`Status`, `Moment`, `Album`) encodes krew as a mutually-exclusive enum
value (picking krew discards the tier), and the krew integer slot disagrees
across models (`Status` krew=5, `Moment`/`Album` krew=2). Decision: krew
becomes a **separate field** (reach tier + krew id(s)) — a schema/enum
migration across the three models plus the picker rework, which also fixes
the integer mismatch. Supersedes the implicit "krew is one slot in the
ladder" the code assumed.

### Moments are Home-strip-only; they do not project to the feed

Moments live in the Home strip, not as feed cards. The `Moment` model /
`MomentsController` docstrings asserting "every Moment projects to a Status
for feed presence" are wrong — nothing populates `status_id`, and `moment` is
not a registered korner card. Fix: correct the docstrings and drop the dead
`belongs_to :status`. (Separately, Moments froth moves off the bespoke
`MomentFroth`/star model onto the shared `Favourite`/heart — the last korner
still on a private froth model after Albutts moved on 2026-07-31.)

### mARTketplace listings do project to the feed

Listings should appear as feed cards. The wiring exists (`Listing belongs_to
:status`, `Status has_one :listing`, a `KORNER_CARDS` entry) but
`listings_controller` never calls `PostStatusService` or stamps
`source_korner`, so the link is never populated and listings are silently
absent from the feed. Fix: wire the projection (through the shared
`FeedProjectable` concern when it lands).

### Open (from this audit)

- What `vouched` (the `ProfileCard` / `ProfileSection` visibility tier, which
  has no equivalent in the mates graph) maps onto — to be decided during the
  reach-unification pass.

---

## 2026-08-04 — Launch card retired (no producer, no in-feed announcement)

The manifest's `launch:` block (§8.7 of `kronk_korner_spec.md`) was the
"one-time in-feed announcement when a korner opens" mechanism —
`blurb` + `cta` per korner, projected into every user's feed once at
open time. Field is parsed; ~10 korners declare their copy; no
producer was ever built.

Retired on Tal's call — no producer, no announcement. The `launch:`
field stays parsed as-is (vestigial rather than an active concept)
because ripping it out of ~10 manifests is churn for no user-facing
gain; a subsequent cleanup can drop the field when the spec is next
revised.

Consequence for Phase 14: no "welcome our new korners" flow.
Discovery of new korners routes through the normal channels — Hub
tile lighting up, Kronk menu, `/kronk/about`, word-of-mouth. The
implication that the launch card was necessary for Phase 14 (in
`remaining_work_2026-08-04.md` — "needed for the Phase 14
announcement flow") is retracted in the same edit.

---

## 2026-08-04 — `tsc --noEmit` removed from the pre-commit hook

The pre-commit hook (`lint-staged`) bundled the cheap changed-file auto-fixers
(`prettier --write`, `eslint --fix`, `rubocop -a`, `stylelint --fix`) with a
**project-wide `tsc -p tsconfig.json --noEmit`**. TS can't be scoped to changed
files, so that ran over the whole codebase on every `.tsx` commit — ~2 GB, slow,
OOM-prone on portal. The predictable consequence: contributors committed with
`--no-verify` to escape it, which skips the _entire_ hook — including
`prettier --write`. Unformatted code then reached PRs and failed the `lint`
merge gate (prettier "Check formatting"), so those PRs couldn't enter the queue
and parked/staled. This was the actual cause of the 2026-08-03 "slow queue"
(≈10 parked profile-shelves PRs), not queue congestion.

Removed the `tsc` line from `lint-staged.config.js`. The hook is now fast enough
that there's no reason to bypass it, so the formatters always run. **Nothing is
lost:** CI runs the identical `yarn typecheck` (`tsc --noEmit`) in
`.github/workflows/lint-js.yml`, and contributors can run it locally before
pushing. Supersedes the CLAUDE.md "pre-commit runs tsc" guidance (updated in the
same PR); continues the queue-hygiene thread from the 2026-08-02 lint-only
decision below.

## 2026-08-02 — Merge queue gates down to `lint` only

`rebuild/2.0.0`'s merge queue required two checks — `lint` and
`test (.ruby-version)`. The Ruby suite ran ~15 min and _was_ the entire queue
latency; a PR sat ~15–20 min even though `lint` (which catches most breakage
cheaply) finished in ~2. Dropped `test` from the required checks on ruleset
20013211 and set the batch wait 5→0, so **only `lint` gates** and merges land
in ~2 min. `test` still runs on every PR (visibility) and on push to
`main`/`stable-*`; it just no longer runs in the merge group (`test-ruby.yml`
lost its `merge_group:` trigger) or blocks the merge.

Trade accepted: the queue no longer re-verifies the _combined_ result of
stacked PRs against the suite — a pair that each pass alone but break together
can land, caught on the next PR's run. Acceptable because `rebuild/2.0.0` feeds
shadow, not production. The durable "fast _and_ fully-gated" answer is to shard
the rspec suite (~15→~4 min) and re-add it as a gate; until then, **read your
PR's `test` result yourself — a green queue is not a green suite.** Contributor
guidance is in `CLAUDE.md` (§"CI gates" + §3, incl. the "Enable auto-merge"
parking trap). Prior ruleset config was backed up before the change.

Supersedes the "two required gates" framing from the 2026-08-01 CI work.

## 2026-07-20 — Korner conformance gates (L1 / L10) + event bus

Decisions taken while building the conformance gates from
`implementation_plan.md` Phases 1.7 / 5.7 / 9.5 (PRs #387–#393). All verified on
a real Postgres + Redis env before merge.

### D2 — Klot's `klot_phase_viewer` is a sanctioned exception, not migrated now

Klot's bespoke visibility scope points at a shared authorization layer (§7) that
does not exist yet. Rather than build §7 to satisfy one scope, `klot_phase_viewer`
stays enforced by its existing ownership check + `KlotShare` allowlist and is
documented as a **sanctioned exception** in `korner_standard.md`. It migrates onto
the shared layer when §7 lands. (Klot's manifest _shape_ was still migrated to the
nested `security:` block — #392.)

### D3 — Nudges and Groups are accepted structural exceptions

Named in `korner_standard.md` so they stop reading as drift: **Nudges** is a
`core:` space (own mount `/nudges`, no Hub tile, not tune-out-able) that carries a
manifest only because a manifest is how anything is declared; **Groups** opts out
of feed projection by design (`render_target: web`, no `status_association`), so
its L3/L4 gates are N/A, not failures.

### §5.7 — a manifest declares only notification types that actually fire

The L10 gate (#388) requires every declared `notifications.types[].name` to be a
registered `Notification` type. Rather than register dead types to satisfy it, the
rule is: **declare only what has a working producer.** Built `proposal_challenged`

- `task_assigned` (real hooks exist); removed the declarations whose trigger
  surfaces don't exist yet — kommons `proposal_backed`/`proposal_comment`, kuestions
  `question_answered`/`answer_frothed`, wachuneed's four `listing_*` — each with a
  manifest comment on when it returns (#393). They come back _with their producers_.

### §9.5 — event-bus wiring is deferred

The bus (`Kronk::KornerEvents`) has publishers but no runtime subscribers and no
handler-naming convention. The entire system has **one** cross-korner listen
(huddle ← `kalendar.event.created`; the names align, so it is not an orphan), its
handler is unbuilt _feature_ work, and huddle is `enforced: false`. Building a
generic wiring framework + convention for a single non-enforced consumer is
premature. Deferred until a second real listener or a concrete need exists; the
`listens:`/`emits:` text check in `korners doctor` remains adequate until then.

### Process — a reverted feature must restore its migrations too

The 2026-04-27 "Kommons" revert deleted 8 migrations; when Kommons was re-added
only `create_tasks` came back, leaving `proposals` (and others) in `schema.rb`
with no creating migration — the from-scratch migration replay was red for weeks.
Recovered verbatim from the pre-revert commit (#390). Lesson: when reverting then
re-landing a feature, the migration set travels with it; the replay job is the
check that catches a half-restore.

## 2026-07-19 — The space model

### A space is the general thing; a korner is one kind of space

"Space" has no strict definition and does not need one: it is any top-level
surface of Kronk. "Korner" is precise — a pluggable, manifest-declared space
that can be added or removed.

**Feed, Profile, Nudges and Hub are spaces that are not korners.** They have
no collective name beyond "spaces"; naming them as a category was considered
and rejected as unnecessary vocabulary.

### The top-level spaces are Feed, Profile, Nudges, Hub

Matching what shipped in `hub_switcher.tsx` — Me / Home / Nudges, with Hub on
the korner rail.

**Consequence, applied.** `Kronk::NodeRegistry::BUCKETS` is now
`feed|profile|hub|nudges|settings|kronk` — `nudges` is accepted, and the
`settings` and `kronk` namespaces became buckets too. `build_node` still
returns `nil` for an unknown bucket, but no longer silently: it logs
`Kronk::NodeRegistry: dropped <source> node '<id>' — <reason>` naming the
offending value, so a bad bucket is visible even though the node never enters
the registry (the doctor's L6 checks read the registry, so they can only see
nodes that survive validation).

### The Skeleton is plumbing, not only a map

A Skeleton node is not merely a page. Each node carries what it is _wired to_
— its settings, its notifications, its projections — and other subsystems
read the Skeleton to find out: Nudges reads it to know what can notify,
settings reads it to know what can be configured, feed rendering reads it to
know what projects.

This is why registry drift matters more than bookkeeping. A manifest that
declares five notification types while the code registers one is not untidy;
it is a registry lying to its consumers. (`config/korners/kommons.yaml`
declares `proposal_backed`, `proposal_challenged`, `proposal_comment`,
`task_assigned`, `proposal_status_changed`; `app/models/notification.rb`
registers only the last. The doctor does not currently check this.)

### One mechanism: every space gets a manifest

Supersedes the split between `config/korners/*.yaml` (korners) and
`config/kronk_nodes.yaml` (everything else).

Core spaces — feed, profile, nudges, hub — get manifests like any korner,
flagged non-removable. `config/kronk_nodes.yaml` becomes core manifests.

**Blocked as written.** `config/korners/reserved_slugs.yaml` reserves `feed`,
`hub`, `home` and `settings`, and `docs/korners/korner_standard.md` §L1 fails
any manifest whose slug is reserved — so `feed.yaml` and `hub.yaml` cannot
exist under the current rule. Resolving this needs the reserved-slug check to
distinguish _core_ manifests from korner manifests, rather than forbidding the
slug outright. Noted here rather than quietly worked around, because the
reservation exists for a good reason: it stops a korner claiming a platform
route.

Corroboration that the direction is right: `reserved_slugs.yaml` already
anticipates it — _"Once the Nudges cutover completes (task #30) and the
manifest is retired, `nudges` moves back into this list as a reserved platform
stem."_ The repo was already planning for Nudges to stop being a korner and
become a platform space.

**Reasoning:** if every node must declare what it is wired to, core spaces
need the same declaration surface korners already have, because they have the
same things. Feed has settings (`/home/settings`). Nudges has notification
preferences. Under two mechanisms the core cannot declare what a korner can,
so core wiring lives scattered in code where nothing can read it.

That privileged core is what produced the settings mess: settings had no
honest home, so it was filed under the `profile` bucket in the registry while
`docs/spaces/settings.md` claimed it was a `hub` sub-tree.

### Settings: a hub _and_ contextual entry, converging

Both reachable, both opening the same canonical area — a central hub that
indexes everything, and entry from within each space and korner.

This was never actually in dispute: the 07-12 workshop note (§3) and the
07-15 in-repo IA both said it. Only the section cut differed.

**Mastodon's classic settings pages are to be retired entirely.** That
requires every existing setting to be inventoried and given a home first —
2FA, sessions, authorised apps, migration, delete-account and data
import/export do not belong to any one space and still need somewhere to
live. Retiring before that inventory is complete would silently drop
capabilities users rely on.

### Settings section cut: Privacy → Profile, Notifications → Nudges (2026-07-20)

Resolves the "section cut" open item, confirming `docs/spaces/settings.md`
(07-15). **Privacy is not a standalone page** — it folds into Profile ("Me"),
with its incoming blocks/mutes/filters facet living on Feed. **Notifications has
no standalone section** — notification preferences fold into **Nudges** (IA §3,
"Notifications ≡ Nudges"). The registry still carries `settings.privacy` and
`settings.notifications` as `lifecycle: live` nodes; re-homing them is
implementation follow-up — notifications with the Nudges work, privacy with the
Profile/settings work.

---

### Upstream Mastodon pages: search unified, lists cut, discovery to be rebuilt (2026-07-23)

Audit of the ~29 leftover Mastodon page-components during the Frame migration
(`docs/design.md (Frame)`). Decisions:

- **Search** — KronkSearch (`/hub/search`) is canonical. The Kronk menu now opens it;
  Mastodon's `/search` + `features/search` are retired.
- **Lists** — cut. Mastodon lists (`features/lists`, `list_timeline`, the deck
  `LIST` column, the list nav panel) are removed; Feed scope
  (Friends / FoF / ₭ommunity) is the only reading filter.
- **DMs** — `/conversations` redirects to Nudges (the messenger is the DM home).
- **Dead code** — `community_timeline`, `public_timeline` (superseded by Firehose)
  and the unrouted `notifications_v2/index` page are removed.
- **Discovery — split, one half done (2026-08-05).**
  - **`/directory`** (profile listing) — **retired.** The Kronk-native
    `/hub/kommunity/discover` (#1149) replaces it: opt-in per-account
    visibility (everyone / orbit / nobody), activity-ordered, tap-through
    to shelved profiles where Groove + Nudge live. The SPA `/directory`
    now 301-redirects to Kommunity Discover; the `features/directory`
    bundle + its action / api / reducer entries are deleted. The
    `/api/v1/directory` REST endpoint stays intact for federation-facing
    external consumers (third-party clients, ActivityPub actors); only
    the Kronk-side UI usage is gone.
  - **`/explore`** (trends — statuses, tags, links) — **still open.** No
    Kronk-native replacement yet. The retirement is scoped to when a
    replacement exists; until then, `/explore` remains as a placeholder.

---

### Two earlier "blocked/consequence" notes are now resolved in code (2026-07-23)

Both landed while their prior notes above still read as open:

- **`NodeRegistry::BUCKETS` (from "The top-level spaces are Feed, Profile,
  Nudges, Hub", 07-19) is caught up.** `app/lib/kronk/node_registry.rb:46` now
  reads `BUCKETS = %w(feed profile hub nudges settings kronk)` — a `bucket:
nudges` (or `settings`/`kronk`) node is no longer silently dropped. The "not
  yet applied" consequence is applied; the standard's four-bucket §L6 and the
  code agree.
- **Core-space manifests exist (from "One mechanism: every space gets a
  manifest", 07-19) — the reserved-slug block is gone.**
  `config/korners/{feed,hub,profile,settings}.yaml` are all present, and the
  doctor distinguishes core from korner via `manifest.core?`
  (`config/initializers/kronk_korner_registry.rb#core?`; the reserved-slug and
  conformance gates in `lib/mastodon/cli/korners.rb` skip on `next if
manifest.core?`). A reserved slug no longer forbids its own core manifest.

---

## Open

- Where account-level settings (security, sessions, account lifecycle,
  import/export) live under the subset model.
- Whether `settings.*` nodes survive at all once each space declares its own
  settings, or whether `/settings` becomes purely a view over the Skeleton.
