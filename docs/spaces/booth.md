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

- **`/hub/booth`** sits on `<KornerShell>` with a title rotator over two
  views (manifest `views:`):
  - **Musik**: published sets, newest first, 40 at a time with **Load
    more sets** (`max_id`). A search box matches title, credit line and
    genres (`q`), and chips for the most used genres filter to one exact
    tag (`genre`). A first-visit **How the Booth works** strip (upload,
    get heard, credit who played) sits on top until dismissed; that is
    kept per browser in `localStorage` (`kronk.booth.intro_dismissed`).
    It and the empty state link to the composer, because a musician on
    their first visit hasn't found the Ж yet.
  - **Artists**: a roster of people: everyone who uploaded one of the
    newest 40 sets or is credited on one, with `/hub/booth/artists/@<acct>`
    for one person's sets (or `/hub/booth/artists/<name>` for a credited
    name that is not an account). A line typed on a set from before
    credits existed is not an artist.
- **Set page** at `/hub/booth/sets/:id` (`booth_set_page.tsx`), on
  `<KornerDetail>`: cover, title, credit line, a facts line (genres,
  event, length, plays), then **Share to feed** (owner) and **Copy player
  link**, the player, who played, the notes and the track list. The player
  link is the embeddable player at `/booth/sets/:id/embed` (framable
  anywhere, but still sign-in only). Edit is the Ж menu's. The old set
  URLs `/booth/sets/:id` and `/booth/sets/:id/embed` are still served
  directly (`config/routes.rb`, `booth#show` / `booth#embed`) and open the
  same page and player; the feed card still links to `/booth/sets/:id`.
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

- **Kinds.** Booth is meant to cover tracks, DJ sets, poetry, readings and
  podcasts, but sets have no `kind` field. Only `genres`.
- **Series.** A `BoothSeries` for podcasts and collections, with tune-in,
  was designed and never built. Undecided: whether tuning into a series
  reuses korner tune-in or gets its own table.
- **Reach for sets themselves.** Every published set is visible to every
  member. Decide whether sets should follow the reach ladder like other
  korners.
- **Engagement ideas not built:** a personal library or saved sets, and a
  live "N listening now" count on the set page.
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
