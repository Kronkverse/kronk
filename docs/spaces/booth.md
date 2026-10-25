# The Booth (`booth`)

**Manifest:** `config/korners/booth.yaml` · **Mount:** `/hub/booth` ·
**Enforced:** yes

The Booth is where people share recorded audio meant to be listened to:
DJ sets and mixes first, and also tracks, spoken word, readings and
podcasts. Voice messages are not Booth. They belong in Nudges or as media
on a post.

This doc describes what is built as of 2026-10-13. Earlier designs are in
git history (see [History](#history)).

## What a set is

**`BoothSet`** (`app/models/booth_set.rb`):

- `title` (required, up to 200 chars), `description`, `genres` (up to 10
  free tags), and free-text `event_name` / `event_date`.
- **Who made it** (Tal, 2026-10-12): the Booth is for music made by people
  on Kronk, so the artist is whoever uploaded the set. Nobody types an
  artist name. The uploader can add up to ten others they made it with
  (`booth_set_artists`, `BoothSet#credits`): a Kronk account, tagged, or a
  plain name for someone who is not on Kronk. A tagged account shows as
  **unverified** until that person confirms it; they are told in Nudges
  (`booth.set.tagged`) and can confirm or take themselves off on the set
  page (`POST …/confirm_credit`, `DELETE …/credit`).
- `artist_name` is the credit line built from those ("Ash, Maddog & Lena
  K"), which is what cards and players show. The API no longer accepts it;
  it takes `collaborators`, an array of `{ account_id }` or `{ name }` that
  replaces the credits. A set from before 2026-10-12 keeps the line its
  uploader typed until they next save its artists.
- `audio_attachment` and `cover_attachment`: ordinary `MediaAttachment`s
  uploaded through the normal media API. Deleting either is blocked while
  a set uses it (FK `on_delete: :restrict`), and both are excluded from
  `Vacuum::MediaAttachmentsVacuum`.
- `cover_offset_y` for framing the cover, `duration_seconds`,
  `play_count`, `published` (default true).
- `status_id`: the post that represents the set in the feed, if it has
  been shared (see below).
- `tracklist`: an optional ordered track list (see [Track list](#track-list)).

Sets are indexed for search (`searchable_as :booth_sets`).

## Who can see a set

Booth has no reach ladder. `visibility_scopes` is empty, and every
published set is visible to every signed-in member. Unpublished sets are
visible only to their owner. Signed-out visitors can't see Booth at all:
`BoothController` requires sign-in, so the server-rendered set page and
its link previews stay private too.

The owner (or a moderator with `manage_reports`) can edit or delete a set.
On a set's own page the owner edits from the Ж menu's **Edit set** moon,
which opens the same form as the grid card's menu.

## Browsing and listening

- **`/hub/booth`** sits on `<KornerShell>` with a title rotator over four
  views (manifest `views:`): Musik, Live (see [Live sets](#live-sets)), My
  sets and Artists.
  - **Musik**: published sets, 40 at a time with **Load more sets**. A
    search box matches title, credit line and genres (`q`). Under it, **Sort**, **Kind** and **Genre** sit on one
    row of pills, closed to start; each names its choice ("Sort: Newest",
    "Kind: Podcast") and opens its chips in one panel under the row, one at a
    time. The chips filter
    to one **kind** (`kind`, see [Kinds](#kinds)) and to one of the most
    used genres (`genre`). **Sort** is the listener's choice of Newest
    (pages by `max_id`), Fewest listens or Longest (page by `offset`); the
    Booth never ranks for anyone. A first-visit **How the Booth works** strip (upload,
    get heard, credit who played) sits on top until dismissed; that is
    kept per browser in `localStorage` (`kronk.booth.intro_dismissed`).
    It and the empty state link to the composer, because a musician on
    their first visit hasn't found the Ж yet.
  - **My sets** (`/hub/booth/mine`): a musician's own corner. Counts
    (sets, plays, live sets coming, saved), their sets with drafts
    included (`mine=true`), the live sets they've planned, and the sets
    they've saved (`saved=true`).
  - **Artists**: a roster of people: everyone who uploaded one of the
    newest 40 sets or is credited on one, with `/hub/booth/artists/@<acct>`
    for one person's sets (or `/hub/booth/artists/<name>` for a credited
    name that is not an account). A line typed on a set from before
    credits existed is not an artist.
- **Set page** at `/hub/booth/sets/:id` (`booth_set_page.tsx`), on
  `<KornerDetail>`: cover, title, credit line, a facts line (kind, genres,
  event, length, plays), then **Share to feed** (owner), **Save** and
  **Copy player link**, the player, who played, the notes and the track list. The player
  link is the embeddable player at `/booth/sets/:id/embed` (framable
  anywhere, but still sign-in only). Edit is the Ж menu's. The old set
  URLs `/booth/sets/:id` and `/booth/sets/:id/embed` are still served
  directly (`config/routes.rb`, `booth#show` / `booth#embed`) and open the
  same page and player. The feed card links to `/hub/booth/sets/:id`.
  Every other `/booth/...` URL 301s to `/hub/booth/...`.
- **Playback** runs through a shared context (`booth_playback_context.tsx`)
  that keeps playing across views, with a bottom dock (`booth_dock.tsx`):
  cover, title, back 15s / play / forward 15s, and a seekable waveform.
  There is no queue. Starting a set calls
  `POST /api/v1/booth_sets/:id/play`, which bumps `play_count`.
- **Upload** at `/hub/booth/composer` (`/hub/booth/new` is an alias),
  opened from the Ж menu ("Upload a set"). It uses the shared
  `ComposeShell`, in the order a musician needs it: the audio file first
  (its name fills an empty title), then title, cover and genre, with
  credits, event, description and track list folded under **More
  details**. **Also post it to my feed** is on by default, with a reach
  picker; see [Feed projection](#feed-projection-and-reactions). Progress
  runs through audio, cover, save, then the feed post, and the new set
  opens on its own page. Edit and Share to feed use the same shell.

Code: `app/javascript/mastodon/features/booth/`,
`app/controllers/api/v1/booth_sets_controller.rb`,
`app/controllers/booth_controller.rb`.

## First listens and private plays

The Booth lifts new voices instead of ranking popular ones (design brief,
2026-10-15).

- **First listens.** A shelf at the top of Musik for published sets from
  the last 30 days with fewer than ten listens, newest first, never your
  own (`first_listens=true`; `FIRST_LISTENS_WINDOW`,
  `FIRST_LISTENS_MAX_PLAYS` in the controller). It shows four with a
  "First listens" badge; **See all** turns the grid into the full list.
- **Plays are the artist's.** The serializer sends `play_count` only to
  the set's owner or a steward. Cards, set pages and the Artists roster
  show no play counts to anyone else; the roster sorts by set count, then
  name. My sets still shows an artist their own plays. There is no
  popularity sort: the listener's **Fewest listens** sort (`fewest`)
  orders by plays on the server, quietest first, without showing the
  numbers, so digging for new voices is one tap away.

## Kinds

`booth_sets.kind` is one of `mix`, `live_recording`, `track`, `podcast`
or `spoken_word` (`BoothSet::KINDS`), chosen on the upload and edit forms
("What kind is it?") and shown on cards and the set page. Sets from
before kinds existed are mixes.

## Saving and Play next

- **Save** (the ♡ on a card, Save on a set page) keeps a set in My sets.
  `booth_set_saves` holds one row per member and set; `POST` / `DELETE
/api/v1/booth_sets/:id/save`. The serializer's `saved` is the viewer's
  own; the index looks the page's saves up in one query (`saved_ids`).
  Nobody else, the artist included, sees who saved what.
- **Play next.** Pressing play on a card queues the grid it's in. When a
  set ends, the player starts the next one if **Play next** (in the dock,
  on by default, kept per browser as `kronk.booth.play_next`) is on, and
  the dock shows what's up next.

## Shoutouts

A listener's note on a set, optionally pinned to the moment they were
hearing (`at_seconds`), like SoundCloud's timed comments. They're how the
Booth tells an artist what landed, which a play count can't (the design
brief behind this: lift new voices, feedback over metrics).

- **`BoothShoutout`** (`booth_shoutouts`): `account`, `booth_set`, `body`
  (up to 500 characters) and `at_seconds` (within the set's length when
  it's known).
- **API** (`Api::V1::BoothShoutoutsController`, members only):
  `GET` / `POST /api/v1/booth_sets/:id/shoutouts` (newest first, up to 200) and `DELETE /api/v1/booth_shoutouts/:id`. Anyone who can see the
  set can read and post; the author, the set's owner or a steward can
  remove one (`can_remove`).
- **On the set page** (`components/shoutouts.tsx`): a one-line composer
  ("Shout out …"). While the set is playing, "at 12:34" pins it to the
  current moment (on by default). Each shoutout shows its time as a chip
  that plays from there, and pinned ones are avatar pins on the player's
  progress bar (`AudioPlayer` `markers`).
- **Nudge.** Posting publishes `booth.set.shouted` to the set's owner,
  unless it's their own set, routed by Nudges as a directed nudge ("{who}
  gave your set a shoutout", View set).

## Track list

Added 2026-10-09 (Kommons proposal 116651831854514343). `booth_sets.tracklist`
is a jsonb array of `{ start_seconds, artist, title }`. `start_seconds` and
`artist` are optional; `title` is required.

- **Entering it.** Both the upload form and the owner's edit form have one
  textarea, one track per line: `12:34 Artist - Title`, `1:02:03 Artist –
Title`, `[4:00] Title` or just `Title`. The API takes that text as
  `tracklist_text`, and `BoothSet#tracklist_text=` parses it. The separator
  between artist and title is a dash with a space either side, so a hyphen
  inside a name survives. Sending an empty `tracklist_text` clears the list.
- **Limits.** Up to 200 tracks (`BoothSet::TRACKLIST_MAX`), 200 characters
  each for artist and title, start times from 0 to 24 hours.
- **The set page** shows the list under the player (`components/tracklist.tsx`).
  A timestamp starts the set from that point (`playFrom` in the playback
  context, which waits for the audio's metadata when the set isn't loaded
  yet). While the set plays, the track it's in is highlighted. Untimed
  tracks are never highlighted.
- **The serializer** returns both `tracklist` (structured) and
  `tracklist_text` (for the edit form).
- Track names aren't in the search index yet.

## Live sets

Musicians can play to members in real time: DJ sets, gigs, online
concerts. Built 2026-10-13 on the Jitsi server Huddle already uses
(`JITSI_DOMAIN`, see `docs/spaces/huddle.md`), so it needs no new
infrastructure. A dedicated stream server (Owncast, Icecast) would carry
more listeners at higher quality, but needs hosting and OBS-style
software for every artist; it stays an option if rooms outgrow Jitsi.

- **`BoothLive`** (`app/models/booth_live.rb`, table `booth_lives`):
  `title`, `description`, `genres`, `starts_at`, `started_at`,
  `ended_at`, `room_key` (the Jitsi room, `booth-` plus random hex) and
  `status_id` (the latest feed post about it). The state is derived:
  **scheduled** until the host goes live, **live** until they end it,
  then **ended**. A set nobody ended counts as ended 12 hours after it
  started, and one that never started drops off the list 6 hours after
  its start time (`STALE_AFTER`, `MISSED_AFTER`), so a closed tab can't
  leave a ghost "live now". Nothing of the performance is stored.
- **API** (`Api::V1::BoothLivesController`, members only because the
  room key is the way in): `index` (live, then upcoming soonest first),
  `show`, `create` (no `starts_at` means now), `update`, `destroy` (not
  while live), `start`, `finish` and `share` (a plain post linking to the
  room at a reach-ladder `visibility`: "Live now…" once live, "Playing
  live in the Booth soon…" before). The room page shows the start time
  in each reader's own time zone, so the post doesn't print one.
- **Going live.** The Ж menu's **Upload or go live** opens the composer,
  which switches between Upload a set and **Go live**
  (`/hub/booth/composer/live`, `components/live_composer.tsx`). **Now**
  opens the room with the host's get-ready panel (input, screen-share
  audio, headphones, recording, room size); the set is only live once
  they press **Go live** there. **Later** schedules it, and can tell the
  feed at once. Tell my feed is on by default with a reach picker.
- **The room** (`/hub/booth/live/:id`, `components/live_room.tsx`, on
  `<KornerDetail>`). The host joins with Jitsi's pre-join screen (to pick
  their mixer or interface), camera off, and audio processing off: no
  echo cancelling, noise suppression, gain control or high-pass filter,
  and stereo Opus at 510 kbps, so music isn't treated as speech.
  Listeners tap **Listen in** (browsers only play sound after a tap) and
  join muted with a cut-down toolbar: chat, raise hand, reactions, tile
  view, full screen and leave. The page polls the set every 20 seconds,
  so Listen in appears when the host goes live, and asks the Jitsi
  server who's in the room every 15 seconds, as Huddle's lobby does
  ("N in the room"). **End set** asks first; the ended page offers the
  host **Upload the recording**.
- **Remind me.** On a scheduled set someone else is playing, Remind me
  (`booth_live_reminders`, `POST` / `DELETE /api/v1/booth_lives/:id/remind`)
  asks for a Nudge. When the host goes live, `Booth::LiveNotifier` sends
  them the same "{who} is live in the Booth now" nudge as everyone else,
  even if they tuned out of the Booth or turned that row off: they asked.
- **Where it shows.** A **Live** view between Musik and Artists (manifest
  `views:`), with Live now and Coming up (`components/live_view.tsx`), and
  a **Live now** strip at the top of Musik while anything is live.
- **Telling people**, the way Huddle does (Fomo noto, `docs/spaces/huddle.md`):
  - **The home feed.** While a set is live, a banner sits at the top of
    every member's home feed, above the posts, in the same `LiveBanner`
    as the Huddle's: "Rosa is live in the Booth: Friday Warm-up · Listen
    in" (one banner per set; three or more become one). It reads
    `GET /api/v1/booth_lives/now` every 30 seconds, which is empty for
    anyone tuned out of the Booth.
  - **A nudge.** Going live queues `Booth::LiveNotifyWorker`, and
    `Booth::LiveNotifier` nudges everyone tuned in to the Booth, the host
    aside: "{who} is live in the Booth now", Listen in opening the room.
    It is skipped for anyone tuned out of the Booth or with the row
    (`booth.went_live`, Nudges::MuteCatalogue) off; push follows the row's
    Push switch and quiet hours. Ending the set takes those nudges back.
  - **The host's own feed.** Tell my feed posts at the reach they pick,
    as before.

## Feed projection and reactions

Every member can find a published set in the Booth. Feeds are separate:
a set reaches one through **Share to feed**
(`POST /api/v1/booth_sets/:id/share`, with an optional comment and a
`visibility` from the reach ladder). The composer does this as it uploads
unless the musician unticks it; otherwise the set page offers it once,
as a banner, and keeps a Share to feed action for the owner. The
endpoint takes only `public`, `orbit`, `mates` or `self_only`; anything
else falls back to the user's default if that is a reach tier, and to
`public` if not (a pre-2.0 `unlisted` can still sit there). That posts a `Status` with the set's title, artist and link, stamps it
`source_korner: 'booth'`, and points the set's `status_id` at it. The post
renders as `StatusBoothCard` (`booth_card`). Sharing again points the set
at the newest post; older shares stay in timelines as plain text.

Froths and replies on that post are ordinary status actions. A
froth publishes `booth.set.frothed` (`Favourite#publish_korner_froth`),
and Nudges routes it to the set owner's chat with the person who frothed,
subject to the Mates gate.

## Cross-korner connections

- **Links from any korner.** The manifest accepts `link` attachments from
  any korner (`accepts: from: '*'`), with owner consent checked by
  `KornerAttachmentPolicy`. That is how a Kalendar event links to the set
  recorded there. The old `booth_sets.event_id` column was dropped on
  2026-08-15; `event_name` and `event_date` remain as free text.
- **Profiles.** A set's card can be pinned to a profile shelf
  (`features/profile_shelves/`, render `booth_card`).

## Open

- **Series.** A `BoothSeries` for podcasts and collections, with tune-in,
  was designed and never built. Undecided: whether tuning into a series
  reuses korner tune-in or gets its own table.
- **Reach for sets themselves.** Every published set is visible to every
  member. Decide whether sets should follow the reach ladder like other
  korners.
- **Engagement ideas not built:** a "N listening now" count on a recorded
  set's page.
- **Support the artist.** A link a musician adds (Ko-fi, Bandcamp,
  PayPal.me or bank details as text), shown on their sets and live rooms,
  with Kronk handling no money. Proposed in Kommons; My sets is where the
  musician would set it.
- **Live sets: who can talk.** Listeners join muted with no mic button,
  but without Jitsi tokens (see `docs/spaces/huddle.md`, Open) the Jitsi
  server can't stop anyone unmuting. Tokens would make the host the only
  one with a mic.
- **Live sets: reach and Kalendar.** Every member can see and join a live
  set, as with recorded sets. A Kalendar event can't link to a live set
  yet: `korner_attachments` resolves a slug to one model (the manifest's
  primary resource, `booth_sets`), so a `booth` target is always a
  recorded set. Linking live sets means teaching the attachment primitive
  a second Booth record type, a change to the shared system in its own
  PR; an `event_id` column on `booth_lives` would go against
  `docs/decisions.md` (2026-08-14).
- **Live sets: telling everyone.** The banner and the "is live" nudge
  reach every member tuned in to the Booth by default, following Huddle's
  Fomo noto (agreed in Kommons for the Huddle). Whether the Booth should
  do the same by default, or only for Mates, or only after a Booth
  Kommons proposal, is for the community to confirm.
- **Events.** Event-linked discovery (sets showing for people who RSVP'd)
  isn't built beyond the attachment link, and the set page doesn't show
  the Kalendar event that links to it: `<AttachmentSection>` reads only a
  record's outgoing links.
- **Artists beyond the newest page.** The roster is built from the newest
  40 sets, so an artist whose sets are all older doesn't appear.
- **Storage path.** Audio and cover sit in the normal media storage, not
  under `spaces/booth/`. The manifest says moving them is scheduling, not
  architecture.
- **`shared_status_id`.** The pre-2.0 column is still dual-written with
  `status_id` and should be dropped.
- **Declared events.** `booth.set.published` and listening for Kalendar
  events were proposed, not built.

## History

Rewritten 2026-10-05 to describe what is built. The previous version
described the 1.7 shape and a 2.0 rebuild vision (kinds, series,
discovery lenses, engagement signals, storage move). Earlier designs and
notes: `git show 231cca937:docs/spaces/booth.md`.
