# The Booth (`booth`)

**Manifest:** `config/korners/booth.yaml` · **Mount:** `/hub/booth` ·
**Enforced:** yes

The Booth is where people share recorded audio meant to be listened to:
DJ sets and mixes first, and also tracks, spoken word, readings and
podcasts. Voice messages are not Booth. They belong in Nudges or as media
on a post.

This doc describes what is built as of 2026-10-05. Earlier designs are in
git history (see [History](#history)).

## What a set is

**`BoothSet`** (`app/models/booth_set.rb`):

- `title` and `artist_name` (required, up to 200 chars each),
  `description`, `genres` (up to 10 free tags), and free-text `event_name`
  / `event_date`.
- `audio_attachment` and `cover_attachment`: ordinary `MediaAttachment`s
  uploaded through the normal media API. Deleting either is blocked while
  a set uses it (FK `on_delete: :restrict`), and both are excluded from
  `Vacuum::MediaAttachmentsVacuum`.
- `cover_offset_y` for framing the cover, `duration_seconds`,
  `play_count`, `published` (default true).
- `status_id`: the post that represents the set in the feed, if it has
  been shared (see below).

Sets are indexed for search (`searchable_as :booth_sets`).

## Who can see a set

Booth has no reach ladder. `visibility_scopes` is empty, and every
published set is visible to every signed-in member. Unpublished sets are
visible only to their owner. Signed-out visitors can't see Booth at all:
`BoothController` requires sign-in, so the server-rendered set page and
its link previews stay private too.

The owner (or a moderator with `manage_reports`) can edit or delete a set.

## Browsing and listening

- **`/hub/booth`** has a title rotator over two views (manifest `views:`):
  **Musik**, the newest 40 published sets, and **Artists**, a roster built
  from the sets' `artist_name`, with `/hub/booth/artists/<name>` for one
  artist's sets. These are artist names typed on the set, not accounts.
- **Set page** at `/hub/booth/sets/:id` (`booth_set_page.tsx`), with a
  "Share player link" for the embeddable player at
  `/booth/sets/:id/embed` (framable anywhere, but still sign-in only).
  Old `/booth/...` URLs redirect to `/hub/booth/...`.
- **Playback** runs through a shared context (`booth_playback_context.tsx`)
  that keeps playing across views, with a bottom dock (`booth_dock.tsx`):
  cover, title, back 15s / play / forward 15s, and a seekable waveform.
  There is no queue. Starting a set calls
  `POST /api/v1/booth_sets/:id/play`, which bumps `play_count`.
- **Upload** at `/hub/booth/composer` (`/hub/booth/new` is an alias),
  opened from the Ж menu ("Upload a set"). It uses the shared
  `ComposeShell` and shows progress through audio, cover, then save.

Code: `app/javascript/mastodon/features/booth/`,
`app/controllers/api/v1/booth_sets_controller.rb`,
`app/controllers/booth_controller.rb`.

## Feed projection and reactions

A set doesn't enter the feed when uploaded. The owner chooses **Share to
feed** (`POST /api/v1/booth_sets/:id/share`, with an optional comment).
That posts a `Status` with the set's title, artist and link, stamps it
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
- **Share audience.** The share endpoint uses the `visibility` param or
  the user's `default_privacy`, falling back to `public`. The web share
  form sends no visibility, and `default_privacy` can still hold the
  retired `unlisted`/`private` values. Give the share form a reach picker.
- **Reach for sets themselves.** Every published set is visible to every
  member. Decide whether sets should follow the reach ladder like other
  korners.
- **Engagement ideas not built:** a personal library or saved sets, and a
  live "N listening now" count on the set page.
- **Events.** Event-linked discovery (sets showing for people who RSVP'd)
  isn't built beyond the attachment link.
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
