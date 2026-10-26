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
  the foot of that form. Reach is shown but locked (see Open questions);
  the audience Krews can be changed, and the album's posts follow them. The
  cover can also be set from a photo: open one, tap the Ж menu's **Edit**
  (Add a caption / Edit caption on your own photo, Edit photo on someone
  else's) and then **Use as album cover**: the owner, or on a Krew album
  any member of the Krew. It
  was a moon of its own until Tal, 2026-10-17: "this should be available
  from within the 'edit' section". Both send
  `PUT /api/v1/albutts/albums/:id` with `cover_media_attachment_id`, which
  must be a photo in that album. Until one is chosen, or if the chosen photo
  is deleted, the first photo is used (`REST::AlbumSerializer#cover_url`).
- **Arranging a new album** (Tal, 2026-10-21). In the composer, before
  posting, each photo has ↑ and ↓ to move it and **Make it the cover**
  (`PickArrange`); the first is the cover unless another is picked. The
  photos are added to the album one at a time in that order, and the cover
  is set once they're in (it must be one of the album's photos). An album
  shows its newest additions first, each burst in the order it was added
  (`AlbumPhoto.newest_bursts_first`: one person's photos with under ten
  minutes between them), so the arranged order holds and later photos come
  above it. A saved draft keeps the order and
  the cover (`cover_media_id`).
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

The composer asks "Who can add photos". Nobody else can unless the owner
says so (Tal, 2026-10-19): **Just me** (`closed`) is chosen at first, and
**Anyone who can see it** (`open`) or **People I choose** (`invited`, with
the chosen people) are opt-in. An album made through the API without a
`contribution` is `closed` too. For a Just-me album the composer says only
you can add.

Below it, **Register as Krew album** lists your Krews as pills. Choosing
one makes the album that Krew's when it is created (as from the Krew's
page: every member adds and edits, its audience is the Krew or everyone,
and "Keep it mine" goes back). When editing a personal album the same
section registers it to a Krew, with a confirmation, since it can't be
undone (`POST …/give`). It replaced "Krews who can add" in the composer;
contributor Krews already set on an album are kept and still honoured.

The `contribution` enum also has `krew` and `event`. `closed` means
owner-only; it is also what albums created before 2026-08-05 were set to.
`krew` is still accepted from old clients: the album's audience krews then
double as contributors. `event` has no reader yet (see [Open](#open)).

When an add is refused, `PhotosController#create` returns a 403 with a
reason the composer shows (for example, "only open to X's Mates").

### Asking to add photos

Someone who can see an album but not add to it gets **Ask to add photos**
on its page (Kommons "Album Request to Add photos", 2026-10-17). The owner
gets a nudge, and the album page shows them who's asking, with **Let them
add** and **Decline**. Letting someone in puts them on the roster
(`album_contributors`, the same list as choosing people in the composer),
and they get a nudge back.

- `AlbumContributionRequest` (`album_contribution_requests`): one per
  person per album; asking again changes nothing.
- `/api/v1/albutts/albums/:album_id/contribution_requests`: `POST` asks,
  `GET` lists them (owner), `POST :id/accept` lets them in (owner),
  `DELETE :id` declines (owner) or takes your own back.
- Nudges: `albutts.contribution.requested` to the owner and
  `albutts.contribution.granted` to the asker, both directed (they need
  not be Mates), published by `Kronk::AlbumContributionRequests` and routed
  in `config/korners/nudges.yaml`.
- `REST::AlbumSerializer` adds `contribution_requested` for the viewer and
  `contribution_requests_count` for the owner, on the album page only.

## Krew albums

A **Krew album** belongs to a Krew, not to whoever made it (decisions.md,
2026-10-17). `albums.krew_id` names the Krew; `owner_id` is still the maker,
for credit.

- **On the page:** on a Krew's page with its Albutts tile open, the Ж
  menu's + is **New Krew album**, which opens the composer as
  `/hub/albutts/composer?krew=<id>`. The composer then asks only who sees
  it ("Only <Krew>" or, for a listed Krew, "Everyone on Kronk") and keeps
  no draft. The album page names the Krew ("<Krew>'s album"), and its Ж
  menu's Edit album, and the lightbox's cover choice, are open to every
  member. Delete shows only to a sole member. A personal album's edit form
  has **Register as Krew album**.
- **On the Albutts page:** it is listed like any album the viewer can see
  (All, Contributed, and Mine for its maker). Its card carries a chip with
  the Krew's name and icon (`krew_name`), so it reads as the Krew's. An
  album only linked to a Krew stays someone's own and gets no chip.

- **Who sees it** (`audience`): the Krew only (`self_only` plus the Krew) or
  everyone on Kronk (`public`), chosen when it's made. Everyone is only
  allowed for a Krew listed in Discover (`Album#krew_album_audience`).
- **Who adds:** the Krew's members, nobody else (`contributable_by?`). There
  is no asking: `contribution_requests#create` answers `join_the_krew`.
- **Who edits:** any member (`Album#managed_by?`): title, description,
  cover and audience. Its Krews and contribution are fixed.
- **Who deletes:** only someone who is the Krew's sole member
  (`Album#deletable_by?`), the same rule as archiving the Krew. Each person
  removes their own photos; nobody removes anyone else's.
- **Giving:** the owner of a personal album can give it to a Krew they're
  in (`POST /api/v1/albutts/albums/:id/give`, `krew_id`). One way. A public
  album stays public if the Krew is listed; anything else becomes the
  Krew's only. Krews it was already linked to keep seeing it.
- **Changing who sees it** moves the posts it already has
  (`Albutts::RescopeAlbum`): the card and every photo's post take the new
  reach, and when it narrows, the card leaves the home feeds of followers
  who can no longer see it.
- Made with `POST /api/v1/albutts/albums` plus `krew_id` and `audience`
  (`krew` or `everyone`); `REST::AlbumSerializer` adds `krew_id`,
  `audience`, `can_manage` and `can_delete`. Krew albums can't be linked to
  other Krews.

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
- **Album page** at `/hub/albutts/albums/<slug>`: the photo grid with
  per-photo credit, and a contribute composer for people allowed to add.
  The slug comes from the title and follows renames; old names and the
  number still open it, and a hidden album is a 404 (`Kronk::NamedLink`,
  decisions.md 2026-10-22).
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
- **Drafts** (Kommons "Album Draft Saving", 2026-10-17; the shared drafts of
  `design.md`, Drafts, since 2026-10-19: korner `albutts`, kind `album`). A
  new album saves as you go: its fields, the uploaded photos in order, and
  their captions. Closing loses nothing but photos still uploading, and the
  Drafts row holds still while any are. Opening the composer picks up the
  newest draft; the Drafts row switches between them, **Start another** leaves
  this one saved, and **Discard draft** deletes it. Creating the album deletes
  its draft. Not while editing an album or making one for a Krew.
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
screen, arrow keys or clicks to move, Escape to close. On a phone the
previous and next buttons float over the photo's edges, so the photo takes
the full width (Kommons "Fix photo view in gallery", 2026-10-21: beside it,
they left one photo smaller than the grid). `?photo=:id` on the album URL
opens it on that photo, which is how nudge links land.

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
  album.
- **On your profile** (Tal, 2026-10-21, mangobee's proposal "Tagging
  ability's in albuts"): the photos you're tagged in can be a shelf on your
  profile, **Tagged in photos**. You put it on, like any shelf (it's
  suggested under Make it yours once someone has tagged you), and you
  choose which show (`docs/spaces/profile.md`).

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

Two kinds of post reach the feed, both `source_korner: 'albutts'`:

- **The album's card**, once, when it is made. `Albutts::PublishAlbum`
  posts a companion `Status`, which renders as `StatusAlbuttsCard`
  (`albutts_card`): cover, title, photo and contributor counts,
  contributor avatars, and a link to the album.
- **"Added 20 photos" to it**, one post per burst (decisions.md,
  2026-10-19). A burst is the photos one person adds to one album with no
  gap of 10 minutes or more; its post goes out once it has been quiet for
  10 minutes (`Albutts::PublishPhotoBatch`, queued by every added photo as
  `Albutts::PublishPhotoBatchWorker`). The post is an `AlbumPhotoBatch`
  (`album_photos.batch_id` says which photos it covers) and renders as
  `StatusAlbuttsAddedCard`: up to four of the photos, the album's title
  and how many were added; the header says who. It takes the album's
  reach and Krews, follows them when they change (`Album#post_status_ids`,
  `Albutts::RescopeAlbum`), and goes when all its photos do. Photos the
  owner adds while making the album (its first 15 minutes) are on the
  card already, so they make no post. The bursts from before 2026-10-19
  were posted once, each dated when it happened, so they sit in feeds at
  that point rather than at the top (migration
  `PostAlbumPhotoBacklog`).

That keeps the feed calm when an event produces thirty photos in ten
minutes, while still saying the album grew.

Each photo is a post of its own (`post_type: album_photo`, made by
`Albutts::PublishPhoto`) only so it can carry a caption, froths and
replies. It is never fanned out, a caption edit included
(`UpdateStatusService`), and it stays off every list of posts: Home and
its Kronkverse width (the public timeline), hashtags, and its
contributor's profile (`Status.without_kronk_backing_posts`,
`AccountStatusesFilter`). Until 2026-10-19 the public timeline, hashtags
and profiles showed each one.

## Cross-korner connections

- **Event albums.** An event's album is Konnected to it: made from the
  Kalendar composer's "Konnect a korner" bar, or picked in the event's
  Konnected section. The "spawn an album" checkbox (`events.spawn_album`)
  and its factory were retired 2026-10-23 (decisions.md). Albums it spawned
  before then keep their `kind: spawn` row and are deleted with their event.
  RSVPs don't feed into an event's album.
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
- **Event album lifecycle.** After the event ends, does the album stay
  open, close after a grace period, or lock?
- **Changing a personal album's reach.** `Albutts::RescopeAlbum` now moves
  existing posts when a Krew album's audience changes, but the personal
  album update doesn't call it yet, so the edit form still locks reach
  there. (Audience Krews can change: the posts follow them through
  `Kronk::StatusKrews`.)
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
- **Krew album drafts.** A Krew album isn't saved as a draft while it's
  being made, so leaving the composer loses it (photos already uploaded
  stay unattached until the media cleanup).
- **A Krew album and its maker's account.** `albums.owner_id` cascades, so
  deleting the maker's account still deletes a Krew album with it.
- **A Krew album shown to everyone, after its Krew is hidden.** It stays
  public; only new choices are checked against Discover.

## History

Rewritten 2026-10-05 to describe what is built. The previous version
included the 2026-07-20 discovery notes, the four-slice build log, and the
historical Scope Picker design (two-axis `ScopePicker`, superseded by
`ReachDropdown` plus the contribution choice described above). Earlier
designs and notes: `git show 231cca937:docs/spaces/albutts.md`.
