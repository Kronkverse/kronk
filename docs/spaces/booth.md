# The Booth (`booth`)

**Manifest:** `config/korners/booth.yaml` · **Mount:** `/hub/booth` ·
**Enforced:** yes

The Booth is where people share recorded audio meant to be listened to:
DJ sets and mixes first, and also tracks, spoken word, readings and
podcasts. Voice messages are not Booth. They belong in Nudges or as media
on a post.

This doc describes what is built as of 2026-10-27. Earlier designs are in
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
- `tracks`: an album's or EP's own tracks, each its own audio file (see
  [Albums](#albums)). Every other kind has none.

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
    Booth never ranks for anyone. How the Booth works (upload, get heard,
    credit who played, go live, save) is in About this space, the Ж
    bubble's i, from the manifest's `about:`; the page carries no banner
    (decisions.md, 2026-10-26). The empty state links to the composer,
    because a musician on their first visit hasn't found the Ж yet.
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
  There is no queue beyond Play next and an album's own tracks
  ([Albums](#albums)). Starting a set calls
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

`booth_sets.kind` is one of `mix`, `live_recording`, `track`, `podcast`,
`spoken_word`, `album` or `ep` (`BoothSet::KINDS`), chosen on the upload
and edit forms ("What kind is it?") and shown on cards and the set page.
Sets from before kinds existed are mixes. `album` and `ep`
(`ALBUM_KINDS`) are made of tracks instead of one recording: the forms
offer them only in album mode, and an album can't be edited into a mix or
back.

## Albums

Added 2026-10-27 (Cassidy's Kommons proposal "Albums to live in Musik?",
117292076963057258). A musician can put out an album or EP: several
tracks, each its own audio file, in order, under one title, cover, credits
and notes. It is a `BoothSet` with kind `album` or `ep`, so it lives in
Musik, My sets, Artists, saves, shoutouts and the feed like any set. Not
to be confused with Albutts' photo albums.

- **`BoothSetTrack`** (`booth_set_tracks`): `booth_set`, `position`,
  `title` (up to 200 characters), `audio_attachment` (an ordinary
  `MediaAttachment`, uploaded through the media API) and
  `duration_seconds`. An album has 2 to 30 tracks
  (`ALBUM_TRACKS_MIN` / `ALBUM_TRACKS_MAX`) and no `audio_attachment` of
  its own; any other kind has no tracks. Its `duration_seconds` is the sum
  of its tracks' when every length is known. A track's length comes from
  the browser reading the file before upload (from a `blob:` URL, which
  the Content-Security-Policy's `media-src` allows for this), or else from
  media processing.
- **Protected like a set's audio.** Deleting a track's audio is refused
  while the album uses it (FK `on_delete: :restrict`),
  `booth_set_tracks.audio_attachment_id` is a `MediaAttachmentsVacuum`
  keeper, and deleting the set (or the account) removes its tracks.
- **API.** Create and update take `tracks`, the running order: an array of
  `{ id, title }` for a track the album has, or
  `{ audio_id, title, duration_seconds }` for a new upload. It replaces the
  tracks, removing any left out; absent leaves them alone. The serializer returns `tracks`
  (`id`, `title`, `duration_seconds`, `audio_url`), empty for other kinds,
  and `audio_url` is the first track's, so anything that plays one file
  (the embeddable player) plays that. The feed summary carries `kind` and
  `track_count`.
- **Uploading.** The composer asks "What are you uploading?": **One
  recording** or **Album or EP**. Album mode swaps the file picker for a
  track editor (`components/album_tracks_field.tsx`): pick several files at
  once, each named after its file (a leading "03 - " goes), rename, move
  up or down, remove, add more. Files upload one after another
  ("Uploading track 2 of 9"). The timed track list is hidden for albums.
  The edit form has the same editor for the album's tracks.
- **Listening.** The set page lists the tracks under the player
  (`components/album_tracks.tsx`); each plays from its start (`playTrack`
  in the playback context). When a track ends the player starts the next
  one whatever Play next says, and after the last it carries on to the
  next set if Play next is on. The dock names the track ("Track 2 of 9")
  and what's up next. The set page's player and the dock run over the
  current track.
- **Cards** show "Album · 9 tracks"; the feed card is badged ALBUM or EP
  with its track count.
- **Kept at the album level:** plays (one per album started, not per
  track), saves and the Kind filter. Shoutouts on an album aren't pinned
  to a moment, since its time runs per track.
- **Not built:** the embeddable player plays only the first track; track
  names aren't searchable; there is no per-track artist (a compilation).

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

- **From a live set.** A set made from a live set's recording starts with
  the host's Now playing as its track list, each track at the time it was
  marked (see [Recording a live set](#recording-a-live-set)).
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
  leave a ghost "live now". Nothing of the performance is stored unless
  the host records it (below).
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
  they press **Go live** there, in its own panel at the top of the
  room (not among the header's small actions). **Later** schedules it, and can tell the
  feed at once. Tell my feed is on by default with a reach picker.
- **The room** (`/hub/booth/live/:id`, `components/live_room.tsx`, on
  `<KornerDetail>`). Everyone joins with a pass for the set
  (`POST /api/v1/calls/token`, `kind: booth_live`; `docs/spaces/huddle.md`,
  The Jitsi server): whoever the set's reach allows, while it is live, and
  the host from when it's planned. The host's pass makes them the room's
  moderator. Jitsi's toolbar is hidden and Kronk's controls sit under the
  room (`<CallControls>`), in [a set's words](#the-words), not a call's. The host joins with Jitsi's pre-join screen (the
  one Jitsi screen kept, to pick their mixer or interface), camera off,
  and with [Music sound](#music-sound) on. Their controls are mic, camera,
  share screen, Music sound, Sound input, hand, tile view, leave ("Step
  out of the room": the set stays live, and **Back into the room** brings
  them back) and Record. Listeners tap **Listen in** (browsers only play sound after a
  tap) and join [to listen only](#music-sound), with raise hand, tile view
  and leave in their controls. The page polls the set every 20 seconds,
  so Listen in appears when the host goes live, and asks who's in the room
  every 15 seconds, as Huddle's lobby does ("N in the room"), through
  Kronk (`GET /api/v1/calls/presence`): the Jitsi server answers that only
  to Kronk. While it's live, [the crowd is on
  screen](#the-crowd-on-screen). **End set** asks first; the ended page
  takes the host to [their set](#recording-a-live-set).
- **Remind me.** On a scheduled set someone else is playing, Remind me
  (`booth_live_reminders`, `POST` / `DELETE /api/v1/booth_lives/:id/remind`)
  asks for a Nudge. When the host goes live, `Booth::LiveNotifier` sends
  them the same "{who} is live in the Booth now" nudge as everyone else,
  even if they tuned out of the Booth or turned that row off: they asked.
- **Where it shows.** A **Live** view between Musik and Artists (manifest
  `views:`), with Live now and Coming up (`components/live_view.tsx`), and
  a **Live now** strip at the top of Musik while anything is live.
- **Telling people** is the host's choice, as for any post (decisions.md,
  2026-10-26). Tell my feed and its reach in Go live set the set's own
  `visibility` (Reachable: Everyone, Mates, Orbit), and the banner, the Live
  view, the Live now strip, the set's page and the nudge all reach those
  people and no one else. With Tell my feed off it is Just me: only people
  who tapped Remind me are told. Sets from before the choice reach everyone.
  - **The home feed.** While a set is live, a banner sits at the top of
    the home feed of everyone in its reach, above the posts, in the same `LiveBanner`
    as the Huddle's: "Rosa is live in the Booth: Friday Warm-up · Listen
    in" (one banner per set; three or more become one). It reads
    `GET /api/v1/booth_lives/now` every 30 seconds, which lists only sets
    in the viewer's reach and is empty for anyone tuned out of the Booth.
  - **A nudge.** Going live queues `Booth::LiveNotifyWorker`, and
    `Booth::LiveNotifier` nudges everyone in the set's reach who is tuned in
    to the Booth, the host aside: "{who} is live in the Booth now", Listen in opening the room.
    It is skipped for anyone tuned out of the Booth or with the row
    (`booth.went_live`, Nudges::MuteCatalogue) off; push follows the row's
    Push switch and quiet hours. Whether to hear about live sets at all is
    each person's: that row, or tuning out of the Booth. Ending the set
    takes those nudges back.
  - **The host's own feed.** Tell my feed posts at the reach they pick,
    as before.

### Music sound

A live set's call is set up for music (decisions.md, 2026-10-27, "Booth
live: music sound, the crowd on screen, recorded into a set"). It is all
in `mastodon/jitsi.ts`, given to Jitsi as `configOverwrite` for
`booth_live` calls only; the Huddle and Kuddles are untouched. Keys a
Jitsi server doesn't know are ignored.

- **Sound, both ways.** Stereo Opus at 510 kbps, Opus's ceiling:
  `audioQuality: { stereo: true, opusMaxAverageBitrate: 510000,
enableOpusDtx: false }`, and the older top-level `stereo` and
  `opusMaxAverageBitrate` for servers that read those. Listeners get it
  too, because stereo is agreed per connection.
- **Music sound** (the host's music note button, on by default). On, the browser's
  voice processing is off: `disableAP`, `disableAEC` (echo cancelling),
  `disableNS` (noise suppression), `disableAGC` (gain control),
  `disableHPF` (high-pass filter), and `enableNoisyMicDetection: false`.
  Off, they're back on, for a talk segment. The switch sends
  `overwriteConfig` and then picks the same input again
  (`setAudioInputDevice`), because the browser applies processing when an
  input is opened. The bitrate and stereo stay, which does a voice no
  harm.
- **Sound input** (the host's tune button; the Huddle and Kuddles have it
  too, `<CallControls inputPicker>`). Lists the computer's inputs through
  the call (`getAvailableDevices`) and switches between them
  (`setAudioInputDevice`), with a level meter and a "Too loud" warning
  near full scale. The External API doesn't report the local level, so
  the meter opens the same input on Kronk's page (`getUserMedia`,
  processing off) and reads it with an `AnalyserNode`, only while the
  panel is open; the browser asks once for the microphone on Kronk's page
  too. Device ids differ between Kronk's page and the call's (browsers key
  them by origin), so it finds the input by its label.
- **Listen-only listeners.** A listener opens no microphone or camera
  (`disableInitialGUM`, and `startWithAudioMuted` / `startWithVideoMuted`),
  has no keyboard shortcuts (`disableShortcuts`), no tile of their own
  (`disableSelfView`), no menu on others' video (`remoteVideoMenu`), no
  audio levels worked out (`disableAudioLevels`), and no mic, camera or
  screen in their controls. They receive video from at most three people
  (`channelLastN: 3`; listeners send nothing, so that is the host and
  whoever plays with them), and their stage pins whoever moderates
  (`pinParticipant`, found through `getRoomsInfo` and
  `participantRoleChanged`), which asks the bridge for the host's video at
  its best. Each listener costs the bridge one stream out, not one per
  person in the room.
- **The equipment** (the get-ready panel says it too): the mixer's or
  audio interface's USB out into the laptop, Chrome, that device picked
  as the microphone (pre-join screen or Sound input), Music sound on, and
  headphones, so the room doesn't play back into the mic.

### The words

A live set is a set, not a meeting (Kommons proposal "Live Booth",
117522383027218146, 2026-10-29). Jitsi talks of meetings and calls, so
everything a member sees in the room is reworded, in three places.

- **Kronk's controls.** `<CallControls>` takes the page's own words
  (`leaveLabel`, `label`, `recordingHint`) and a door for leave in place of
  the hang-up handset (`leaveIcon='logout'`). The Booth's: "Set controls",
  "Leave the set" (a listener), "Step out of the room. The set stays live"
  (the host), "This set is being recorded". The Huddle and Kuddles keep
  "Call controls", "Unhuddle" and the handset.
- **Jitsi's settings** (`liveSetConfig` in `mastodon/jitsi.ts`, live sets
  only). The pre-join screen names the set (`callDisplayName`), not the
  room's key ("Shadow Booth 3f9a…"), and has no "Join without audio" or
  phone dial-in (`prejoinConfig.hideExtraJoinButtons`). Jitsi's "Other
  participants may be recording this call" and "Record this meeting" are
  off (`recordings.showPrejoinWarning`, `recordings.suggestRecording`):
  the get-ready panel and Kronk's controls say it.
- **Jitsi's own sentences** ("Join meeting", "You are the only one in the
  meeting", "Rosa joined the meeting", "This meeting is being recorded")
  live in Jitsi's page and no embed setting changes them. Jitsi's dynamic
  branding does: Kronk serves them at `GET /api/v1/calls/branding`
  (`Api::V1::Calls::BrandingsController`, open, copy only), and the Jitsi
  server's `config.js` points at it with
  `config.brandingDataUrl = 'https://<kronk>/api/v1/calls/branding'`.
  Jitsi then asks with `?conferenceFqn=<room>` before every call; a live
  set's room (`booth-` and 20 hex digits, after any prefix) gets
  `{ labels: { en, enGB } }`, laid over Jitsi's English, and any other
  room `{}`, Jitsi's defaults. The words are `kronk_jitsi.booth_live` in
  `config/locales/kronk/overrides.yml`, keyed as Jitsi's `lang/main.json`:

  | Jitsi key                                            | Jitsi says                                           | The Booth says                            |
  | ---------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------- |
  | `prejoin.joinMeeting` (title and button)             | Join meeting                                         | Into the booth                            |
  | `prejoin.premeeting`                                 | Pre meeting                                          | Before the set                            |
  | `prejoin.recordingWarning`                           | Other participants may be recording this call        | This set may be recorded                  |
  | `lonelyMeetingExperience.youAreAlone`                | You are the only one in the meeting                  | Nobody's listening yet                    |
  | `notify.connected*Member(s)`                         | {name} joined the meeting                            | {name} is listening                       |
  | `notify.left*Member(s)`                              | {name} left the meeting                              | {name} left                               |
  | `notify.suggestRecordingTitle`                       | Record this meeting                                  | Record this set                           |
  | `recording.expandedOn`, `videoStatus.recording`      | The meeting is (currently) being recorded            | This set is being recorded                |
  | `recording.pending`                                  | Preparing to record the meeting…                     | Getting ready to record the set…          |
  | `dialog.sessTerminatedReason`                        | The meeting has been terminated                      | The set has ended                         |
  | `dialog.kickTitle`, `kickSystemTitle`                | … kicked you out of the meeting                      | … took you out of the set                 |
  | `participantsPane.headings.participantsList`         | Meeting participants ({count})                       | In the room ({count})                     |
  | `startupoverlay.genericTitle`                        | The meeting needs to use your microphone and camera. | The set needs your microphone and camera. |
  | `toolbar.hangup`, `leaveConference`, `endConference` | Leave meeting, End meeting for all                   | Leave the set, End the set for everyone   |

  Until the server has `brandingDataUrl`, Jitsi's own sentences stay as
  they are; everything else above works without it. "Tune in" isn't used:
  it means tuning in to a space.

### The crowd on screen

While a set is live, listeners' shoutouts, reactions and track requests,
and the host's Now playing, show over the call for everyone watching, and
go into the call, so the recording has them too
(`features/booth/crowd.ts`, `components/live_crowd.tsx`).

- **`BoothLiveMoment`** (`booth_live_moments`): `booth_live`, `account`,
  `kind` (`shoutout`, `reaction`, `request`, `track`), `body` (up to 200
  characters; for a reaction one of `froth`, `applause`, `rewind`),
  `artist` and `title` (a track), and `at_seconds`, how far into the set it
  came (from `started_at`, set by the server). Its own table rather than
  set shoutouts: a live set has no set yet, and three of the four kinds
  aren't shoutouts. Nothing is copied to the set afterwards except the
  tracks, because the set may reach more people than the live set did.
- **API** (`Api::V1::BoothLiveMomentsController`, members only).
  `GET /api/v1/booth_lives/:id/moments?since_id=` lists them oldest first
  (up to 100 after `since_id`; without it, the latest 50).
  `POST /api/v1/booth_lives/:id/moments` with `kind` and `body` (a track's
  `body` is "Artist - Title", read like a track list line) answers the
  moment; 422 if the set isn't live, 429 for a second one from the same
  person within two seconds (`THROTTLE`). `DELETE
/api/v1/booth_live_moments/:id` for its author, the host or a steward.
  All of it follows the set's reach (`BoothLive#visible_to?`): outside it
  the set isn't there (404). Only the host can post a `track` (403).
- **Live updates.** Kronk's streaming server carries per-person timelines,
  not a channel per live set with a reach check, so the room polls every
  four seconds with `since_id` while you're in it. The first answer is
  what was there already and isn't shown again.
- **On screen.** Each new moment shows over the call for six seconds, the
  newest five at most, in an `aria-live="polite"` list: the name and the
  words, "Request: …", "Now playing: …", or the reaction (Froth, Applause,
  Rewind!). It fades in and out, and just appears and goes for anyone
  with `prefers-reduced-motion`. Clicks pass through to the call.
- **Sending.** Under the room a listener has one line ("Say something to
  Rosa, or name a track to request") with **Shout out** and **Request**,
  and Froth, Applause and Rewind!. The host has **Now playing (Artist -
  Title)** and **Mark as playing**; the line "Now playing: …" shows to
  everyone above the call.
- **Into the call.** The host's page sends each new moment, once, into the
  call as a text message to everyone (External API
  `executeCommand('sendEndpointTextMessage', '', text)`; an empty
  recipient broadcasts), and sends the current track again when
  recording starts. One sender, so each message arrives once whoever
  posted it. A listener's page sends nothing into the call.

**The message** (`CrowdMessage`, version 1). `text` is a JSON object, no
other keys, all always present:

```json
{
  "kronk": 1,
  "type": "shoutout",
  "name": "Rosa",
  "text": "This tune!",
  "at": 754
}
```

| Key     | Type    | What it is                                                                                                                                                                     |
| ------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `kronk` | number  | The version, `1`. Ignore any other.                                                                                                                                            |
| `type`  | string  | `shoutout`, `reaction`, `request` or `track`. Ignore one you don't know (a later type may be added in 1).                                                                      |
| `name`  | string  | The sender's display name (the host's for a `track`). Plain text.                                                                                                              |
| `text`  | string  | A shoutout's or request's words (up to 200 characters); a reaction's key, `froth`, `applause` or `rewind`; a track as `Artist – Title` (en dash), or just `Title`. Plain text. |
| `at`    | integer | Whole seconds since the set went live.                                                                                                                                         |

For the script on the Jitsi server's page that draws them in the call:

- In the Jitsi page it arrives as the conference event
  `ENDPOINT_MESSAGE_RECEIVED` (`JitsiMeetJS.events.conference`), with
  `(participant, payload)` where `payload` is
  `{ "name": "endpoint-text-message", "text": "<the JSON above>" }`. A
  page embedding the call through the External API gets the same as
  `endpointTextMessageReceived`, `{ senderInfo: { id, jid }, eventData:
{ name, text } }`.
- Parse `text`, and drop anything that isn't JSON or isn't `kronk: 1`.
  Draw `name` and `text` as text, never as HTML: they are what members
  typed.
- A `track` replaces what's playing (the same track may come twice, at
  recording start); the other types pop up and fade, as Kronk's overlay
  does (six seconds, five at most).
- Draw only on the recorder's page (Jibri joins with `iAmRecorder`), not
  for people: they see Kronk's own overlay over the call, and would see it
  twice.
- Messages sent before the recorder joined aren't seen; that is why the
  host's page repeats Now playing when recording starts.

### Recording a live set

With Kronk's Jitsi server set up for it (`JITSI_JWT_SECRET`,
`JITSI_RECORDING_SECRET` and S3 storage; `docs/spaces/huddle.md`,
Recordings), the host can press **Record** under the room. Everyone in it
sees "Recording" while it runs, and the get-ready panel says so
beforehand. When the recording stops, the server's finalize script
uploads it to private objects in Kronk's storage, as a video and as an
audio file (`media`, paired; `docs/spaces/huddle.md` has the contract).

- **It is the host's** (Tal, 2026-10-27). Only the host (and staff) can
  see a live set's recording, because it's theirs to publish as a set.
  Listeners never get it.
- **The audio becomes a draft set.** When a live set's audio file is
  complete, `Booth::LiveRecordingSetWorker` (the `pull` queue) runs
  `Booth::LiveRecordingSet`: it downloads the file to a temporary folder
  and attaches it as a `MediaAttachment`, the way an upload is, then
  makes an unpublished `BoothSet` for the host: kind `live_recording`,
  the live set's title, description and genres, its start as
  `event_date`, its Now playing as the track list, the host as the
  artist. A live set has no cover or co-hosts, so the set has none. It is
  made once (`booth_lives.booth_set_id`), and the host is nudged "Your
  live set is ready to publish" (`booth.set_ready`, Publish opening the
  set).
- **Why download and attach.** A set's audio must be a `MediaAttachment`
  (`booth_sets.audio_attachment_id`), and a `MediaAttachment`'s file goes
  through Paperclip, which transcodes audio to MP3 (VBR quality 2, about
  190 kbps, like every uploaded set), reads its length and stores it
  under the media path. Copying the object inside storage would skip all
  three, so a job downloads it instead, out of the request.
- **After the set**, the ended page tells the host "Your set is ready to
  publish", with **Publish your set** (the draft's page, whose banner has
  **Publish**, then Share to feed as for an upload) and **Download
  video**. While the audio is being made into the set it says so; a
  recording with no audio file (an older finalize script) still offers
  **Download the recording** and **Upload the recording**. The recordings
  themselves are listed under it, video and sound only, to play, download
  or delete. Deleting a recording, or the live set, deletes its file; the
  set keeps its own copy of the audio.
- Without recording set up, the get-ready panel still says Kronk doesn't
  record the room, and the host records on their own set-up as before.

## Feed projection and reactions

Every member can find a published set in the Booth. Feeds are separate:
a set reaches one through **Share to feed**
(`POST /api/v1/booth_sets/:id/share`, with an optional comment and a
`visibility` from the reach ladder). The composer does this as it uploads
unless the musician unticks it; otherwise the set page offers it once,
as a banner, and keeps a Share to feed action for the owner. The
endpoint takes only `public`, `orbit`, `mates` or `self_only`; anything
else falls back to the user's default if that is a reach tier, and to
`public` if not (a pre-2.0 `unlisted` can still sit there). That posts a `Status` whose text is the musician's comment, or the set's title
when there is none (no generated line, no link), stamps it
`source_korner: 'booth'`, and points the set's `status_id` at it. The post
renders as `StatusBoothCard` (`booth_card`), which carries the artist and
opens the set. Sharing again points the set at the newest post; older
shares stay in timelines as plain text.

A live set's Tell my feed (`POST /api/v1/booth_lives/:id/share`) posts the
same way: the host's words or the set's title, linked through
`booth_lives.status_id`. It renders as `StatusBoothLiveCard`: LIVE SET,
the title, Live now / Starts … / Ended, and its genres, opening the room.
The card follows the set's own reach (`booth_live`, served only to people
it reaches, never with the room key).

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
- **Live sets: who can talk.** Listeners open no microphone and have no
  mic in their controls. The server still lets any participant send
  audio; only Jitsi's own moderation (muting everyone but the host, or
  visitors, below) would stop it, and Kronk's controls don't offer that
  yet.
- **Big audiences.** The get-ready panel still says a room plays best to
  about 35 people; listen-only listeners should carry more, up to about
  100, which wants measuring on the server before the panel says so. Past
  that, Jitsi's visitors mode (listeners on separate, receive-only
  servers) is the way, and isn't set up or built.
- **Co-hosts and a cover for live sets.** A live set has one host and no
  cover, so the set made from it has neither; both would carry over if
  added.
- **Live shoutouts on the set.** A live set's shoutouts aren't copied to
  the set made from it, because the set may reach more people than the
  live set did. Asking each person, or copying only for sets for
  everyone, would be the way.
- **Music sound, checked on the server.** Turning Music sound off and on
  mid-set relies on Jitsi reopening the same input when it's picked
  again; on a server that doesn't, the change applies at the next input
  change.
- **Live sets: reach and Kalendar.** Every member can see and join a live
  set, as with recorded sets. A Kalendar event can't link to a live set
  yet: `korner_attachments` resolves a slug to one model (the manifest's
  primary resource, `booth_sets`), so a `booth` target is always a
  recorded set. Linking live sets means teaching the attachment primitive
  a second Booth record type, a change to the shared system in its own
  PR; an `event_id` column on `booth_lives` would go against
  `docs/decisions.md` (2026-08-14).
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
