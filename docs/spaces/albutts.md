# Albutts (`albutts`)

**Manifest:** `config/korners/albutts.yaml` · **Mount:** `/hub/albutts` ·
**Enforced:** yes

Albutts is the shared-album korner. Several people add photos to one album,
and every photo keeps its contributor's credit. That's the difference from
"attach four photos to a post": there, one person publishes four pictures
under their own name. Here, the album belongs to the group and each photo
stays attributed to whoever added it.

This doc describes what is built as of 2026-10-05. Earlier designs are in
git history (see [History](#history)).

## What an album is

- **`Album`** (`app/models/album.rb`): title (up to 240 chars), optional
  description, owner, optional cover, a reach tier, a contribution setting,
  and a set of krews. The owner edits it from the Ж menu's **Edit album**
  moon on the album page, which opens the album composer filled in
  (`AlbumComposer` with `album`): title, description, who can add, and the
  cover, picked from a grid of the album's photos. **Delete album** is at
  the foot of that form. Reach and audience Krews are shown but locked (see
  Open questions). The cover can also be set from a photo: open one and tap
  the Ж menu's **Use as album cover**. Both send
  `PUT /api/v1/albutts/albums/:id` with `cover_media_attachment_id`, which
  must be a photo in that album. Until one is chosen, or if the chosen photo
  is deleted, the first photo is used (`REST::AlbumSerializer#cover_url`).
- **`AlbumPhoto`** (`app/models/album_photo.rb`): one contribution. It's a
  thin join between the album and a **`Status`** that holds the photo, the
  caption, froths and replies. `contributor_id` records who added it.
- **`AlbumKrew`**: the album's krews. `for_contribution` marks the ones
  whose members may also add photos.
- **`AlbumContributor`**: specific people who may add photos when the album
  isn't open to everyone who can see it.

### Photos are posts

Each photo is a real `Status`, minted by `Albutts::PublishPhoto` with
`post_type: 'album_photo'` and `source_korner: 'albutts'`. That gives
photos hashtag and mention parsing, edit history, alt text, froths and
reply threads with no Albutts-specific code.

`PostStatusService` skips distribution for `album_photo` posts, so photos
never land in anyone's home feed one by one. The album card is the only
thing the feed sees.

Media is uploaded to Kronk through the normal `POST /api/v2/media` path and
stored like any other post's media. (An early design had Albutts reference
media hosted in each contributor's own storage. That was never built.)

## Who can see an album

Albums use the standard reach ladder (see `docs/spaces/feed.md`):
**Just me**, **Mates**, **Orbit**, **Kronkverse** (`self_only`, `mates`,
`orbit`, `public`). Krews are a separate, additive axis: members of the
album's krews see it on top of whatever the tier allows. Both rules live in
the shared `Reachable` concern; `Album.visible_to(viewer)` and
`Album#visible_to?` are the gates.

The photo posts and the card post copy the album's tier and krews when
they're created.

## Who can add photos

Seeing an album and adding to it are separate questions.
`Album#contributable_by?` checks both:

1. The viewer must be able to see the album.
2. The owner can always add.
3. If `contribution` is `open`, anyone who can see it can add.
4. Otherwise the viewer must be on the roster: listed in
   `album_contributors`, **or** a member of a krew flagged
   `for_contribution`. The two lists add together.

A contributor krew is always also an audience krew, because you have to
see an album to add to it. The controller enforces that in `sync_krews!`.

The composer asks "Who can add photos" with two choices: **Anyone who can
see it** (`open`) or **Only people I choose** (sent as `invited`, with the
chosen krews and people). For a Just-me album the composer says only
you can add.

The `contribution` enum also has `closed`, `krew` and `event`. `closed`
means owner-only and is what albums created before 2026-08-05 were set to.
`krew` is still accepted from old clients: the album's audience krews then
double as contributors. `event` has no reader yet (see [Open](#open)).

When an add is refused, `PhotosController#create` returns a 403 with a
reason the composer shows (for example, "only open to X's Mates").

## Browsing and composing

- **Directory** at `/hub/albutts`, with a title rotator over four views
  (manifest `views:`): **All albums** (`/hub/albutts`), **My albums**
  (`/mine`), **Contributed** (`/contributed`) and **Mates'** (`/mates`).
  Each narrows `Album.visible_to(current_account)`; see
  `AlbumsController#narrow_by_scope`.
- **Loading.** The list of albums is sent without their photos (a cover
  and a count are all it shows). An album's page loads its photos' posts
  in a fixed handful of queries (`AlbumPhoto.for_display`), and its grid
  shows each photo's small rendition (`thumb_url`), fetched as the tile
  nears the screen. The original (`url`) loads in the lightbox, one photo
  at a time, and is what a download takes.
- **Album page** at `/hub/albutts/albums/:id`: the photo grid with
  per-photo credit, and a contribute composer for people allowed to add.
- **New album** at `/hub/albutts/composer` (`/hub/albutts/new` is an
  alias), opened from the Ж menu. It uses the shared `ComposeShell` with the
  standard `ReachDropdown` in the header (tiers plus a krew submenu), and
  the "Who can add photos" choice in the body. Photos start uploading as
  soon as they're added, four at a time; Create waits for them, then adds
  them to the new album. Uploads share the media throttle
  (`throttle_api_media`, raised for this to 300 per user per 30 minutes).
  If a big album still hits it, the composer pauses every upload until the
  window resets (`X-RateLimit-Reset`), says when it will carry on, and
  retries the same photo, up to six waits, instead of failing it. A photo
  that uploaded but couldn't be added is retried without uploading again.
- **Drafts** (Kommons "Album Draft Saving", 2026-10-17). A new album saves
  to the server as you go (`AlbumDraft`, `/api/v1/albutts/drafts`): its
  fields, the uploaded photos in order, and their captions. Navigating away
  loses nothing but photos still uploading. Opening the composer picks up
  the newest draft; the Drafts row switches between them, **Start another
  album** leaves this one saved and opens a blank one, and **Discard draft**
  deletes it. Creating the album deletes its draft. Up to 20 drafts per
  account. The nightly media cleanup keeps any upload a draft lists
  (`Vacuum::MediaAttachmentsVacuum::KEEPERS`).
- **Downloading.** The album page has **Download album** and **Select
  photos** buttons, beside Add photos, for anyone signed in who can see the
  album. They are buttons on the page and not Ж moons: the Ж menu is for
  making and editing. Select
  mode puts a tick on each photo and a bar at the bottom (select all,
  download, done). Either way the server builds a zip of the originals
  (`Albutts::AlbumArchive`, `GET /api/v1/albutts/albums/:id/download`, with
  `photo_ids` for a selection) named `001-<who added it>.jpg` in album order.
  The browser opens that address as a plain link, so it is reached with the
  web session and no access token. One download is capped at 1 GB
  (`MAX_BYTES`); the page adds up the sizes first and says to download in
  parts. A photo whose file cannot be read is left out of the zip.
- Code: `app/javascript/mastodon/features/albutts/`,
  `app/controllers/api/v1/albutts/`, routes under `namespace :albutts` in
  `config/routes/api.rb`.

## Reactions

Clicking a photo opens the lightbox (`album_lightbox_modal.tsx`): full
screen, arrow keys or clicks to move, Escape to close. `?photo=:id` on the
album URL opens it on that photo, which is how nudge links land.

The lightbox shows the standard `StatusEngagement` bar for the photo's
post, so froths and replies use the ordinary status endpoints. The photo's
contributor can edit the caption from the Ж menu's **Edit caption** (or
**Add a caption**) moon while the lightbox is open; the lightbox has no
inline Edit, and its reactions bar hides Edit
(`PATCH /api/v1/albutts/photos/:id`, which goes through
`UpdateStatusService`). Only the contributor: the caption is their post and
shows under their name. The contributor or the album owner can delete a
photo, which also deletes its post.

## Tagging people

An @name tags someone (Tal, 2026-10-13). There is no separate people field.

- **In a photo's caption:** the caption box suggests names as you type
  (`components/caption_textarea.tsx`), the name links to their profile
  (`caption_text.tsx`), and they are told "tagged you in an album".
  `Albutts::PublishPhoto#notify_tagged!` sends it: a photo's post is kept out
  of fan-out, which is what normally announces a mention, so until
  2026-10-13 nobody was told.
- **In the album's description:** the same box, the same link, and the same
  notice, sent once when a name first appears
  (`Api::V1::Albutts::AlbumsController#notify_tagged!`).
- Only someone who can open the album is told. The notice leads to the
  album. Nothing is added to the tagged person's profile.

## Notifications

- **New photo in an album you're part of** (`album_new_photo`). Adding a
  photo publishes `albutts.album.new_photo`. The subscriber in
  `config/initializers/nudges_event_bus.rb` sends a nudge to every earlier
  contributor and the owner, except the person who added it. The usual
  Mates gate applies per recipient, so non-Mates get nothing. Nudges
  within 15 minutes for the same album collapse into one (the manifest's
  `aggregation` window, read by `Nudges::Aggregator.window_for`).
- **Froths and replies on a photo** go through the standard status
  notifications, because photos are posts. There are no Albutts-specific
  types for them.
- **`contribution_rights_granted`** is declared `planned: true` and has no
  producer.

## Feed projection

One card per album, ever. `Albutts::PublishAlbum` runs when the album is
created and posts a companion `Status` with `source_korner: 'albutts'`,
which renders as `StatusAlbuttsCard` (`albutts_card`): cover, title, photo
and contributor counts, contributor avatars, and a link to the album.
Later photos never add cards. That keeps the feed calm when an event
produces thirty photos in ten minutes.

## Cross-korner connections

- **Kalendar spawn.** The event form has a "spawn an album" checkbox
  (`events.spawn_album`). When an event is created with it ticked, the
  factory in `config/initializers/attachment_factories/kalendar_albutts.rb`
  creates an album titled after the event and links the two with a
  `korner_attachments` row (`kind: spawn`, cascade on delete). The album is
  created **public** with `open` contribution. RSVPs don't feed into it.
- **Links from any korner.** The manifest accepts `link` attachments from
  any korner (`accepts: from: '*'`). The album owner's consent is checked
  by `KornerAttachmentPolicy`.
- **Krews** can see an album, and can be given rights to add to it, through
  `album_krews` as described above.
- **Profiles.** An album's card can be pinned to a profile shelf through
  the shelf post picker (`features/profile_shelves/`).

## Open

- **Event-based contribution.** `contribution: event` ("anyone at the
  event can add") has no attendee reader. Such albums are owner-only.
- **Spawned albums are always public.** The Kalendar factory ignores the
  event's own audience, so an invite-only event gets a public album with
  its title. Decide whether the album should copy the event's reach.
- **Event album lifecycle.** After the event ends, does the album stay
  open, close after a grace period, or lock?
- **Changing an album's reach.** The API accepts a new reach, but it doesn't
  re-scope the album's existing photo posts or its card, so narrowing it
  would leave the photos as visible as before. Until it does, the edit form
  locks reach and audience Krews.
- **`contribution_rights_granted` nudge.** Declared, never produced.
- **Video length.** Both composers accept video as well as photos, with no
  length cap beyond the normal media limits. Decide whether albums need
  one.
- **Dead columns.** `album_photos.media_attachment_id`, `external_url` and
  `caption` are left over from before photos became posts and are never
  written. Old rows without a `status_id` are hidden by the `with_status`
  scope.
- **Kategories.** An early design auto-tagged every album `Album`. Nothing
  does that.
- **Ownership.** No flow for transferring an album when the owner leaves.

## History

Rewritten 2026-10-05 to describe what is built. The previous version
included the 2026-07-20 discovery notes, the four-slice build log, and the
historical Scope Picker design (two-axis `ScopePicker`, superseded by
`ReachDropdown` plus the contribution choice described above). Earlier
designs and notes: `git show 231cca937:docs/spaces/albutts.md`.
