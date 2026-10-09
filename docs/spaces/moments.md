# Moments (`moments`)

**Manifest:** `config/korners/moments.yaml` · **Mount:** `/hub/moments` ·
**Enforced:** yes

Moments are for the passing things: a photo, a short video or a voice
clip, live for a day. The point is to lower the bar to sharing. A Moment
never enters the feed and stops asking for attention after 24 hours, so it
doesn't have to be good enough to survive a timeline. `hub_teaser`: _"Gone
by morning."_

This doc describes what is built as of 2026-10-05. Earlier designs are in
git history (see [History](#history)).

## What a Moment is

A Moment (`app/models/moment.rb`) is its own row with **no backing
`Status`**. It is one of:

- a **photo**, optionally with a **voice clip** played over it;
- a **video** (it has its own sound, so it never gets a voice clip; the
  `voice_only_paired_with_a_still` validation enforces this);
- a **voice clip** on its own.

Plus an optional caption (up to 500 chars). Still photos can carry **text
overlays** (`text_overlays` JSONB, up to 12, shape-checked by the model),
and people can be **tagged** on a photo, which sends them a `media_tag`
notification (`MomentsController#notify_media_tags!`).

Moments aren't Kategory-tagged and don't federate.

### Expiry and the Log

Every Moment gets `expires_at` = post time + 24 hours
(`Moment::DEFAULT_LIFETIME`). It can't be changed; the fixed day is the
point.

After 24 hours a Moment leaves the live surfaces and becomes **private to
its author**: `Moment.visible_to` and `#visible_to?` only show expired
Moments to the person who posted them. Nothing is deleted. There is no
expiry reaper, and Moment media (photo and voice) is excluded from
`Vacuum::MediaAttachmentsVacuum` so it isn't cleaned up as unattached.

### Reach

The composer offers **Mates** (default) and **Orbit**, plus at most one
**krew** as an additive audience (`krew_id`; krew members see the Moment
on top of the tier). Visibility is enforced by the shared `Reachable`
concern while the Moment is live.

- **Kronkverse** (`public`) was removed on 2026-09-13: Kronk-wide plus gone
  by morning is an odd mix. The controller turns an incoming `public` into
  `mates` so old clients don't fail.
- **Just me** (`self_only`) isn't offered: an audience of one is a journal
  entry, not a Moment. It stays in the enum for old rows.
- `krew` is no longer a visibility value. A legacy `visibility=krew` is
  mapped to `self_only` with the krew kept, so the audience doesn't change.

The author can change a Moment's tier, krew and caption at any time from
the viewer (`PATCH /api/v1/moments/:id`). Media and text overlays can't be
edited.

**Editing the caption.** Edit in the reactions bar's menu opens a caption
editor in the viewer (it doesn't open the post composer). Anything else
that offers Edit on a Moment calls the same entry point,
`editMomentCaption(id)` in `features/moments/caption_edit.ts`. Saving goes
through the Moment, which copies the caption onto its backing Status and
stamps it edited. Editing the backing Status directly
(`PUT /api/v1/statuses/:id`) is refused (`StatusPolicy#update?`), so the
caption and the reactions thread never disagree.

## Where you see Moments

Never in the feed. The manifest declares no feed card.

1. **Home strip** (`features/moments/home_strip.tsx`): a row of ring
   avatars at the top of Home with the live Moments you're allowed to see.
   Your own tile sits on the left with a `+`; with nothing posted it opens
   the composer. **One ring per person**, however many Moments they have
   live: it opens their oldest unseen Moment and the viewer walks the rest
   of their stack. Photo-plus-voice Moments get a mic badge. A ring dims
   once you've seen all of that person's Moments. The strip hides if you've
   tuned out of Moments or
   turned off "Show the Moments strip at the top of my home feed" in feed
   settings
   (`web.moments_strip_on_home`).
2. **The korner** at `/hub/moments`: **Now** (live Moments, "Live for 24
   hours") and **Log** (your own expired Moments, "kept for you"). On Now,
   Moments you've already seen are dimmed.
3. **Viewer** at `/hub/moments/:id`: full screen, steps through that
   author's live Moments, plays voice clips with a waveform, and lets the
   author change the reach. At the end of one person's Moments it rolls on
   to the next person in the strip's order, at their oldest unseen Moment
   (a URL replace, so Back still closes the viewer); after the last person
   it stays put. Three ways to move, all the same steps: tapping the left or
   right third of the photo, the Left/Right arrow keys, and visible arrow
   buttons on the photo's edges (shown only when there is somewhere to go:
   back within this person's Moments, forward to their next one or the next
   person). The strip and viewer share one grouping
   (`features/moments/people.ts`). `show` returns 404 for a Moment you can't
   see.

All three read `GET /api/v1/moments` (`filter=log` for the Log, otherwise
live; `account_id` to narrow to one author), capped at 60.

Opening a Moment marks it seen through `Kronk::KornerSeen`, which drives
the dimmed rings and tiles and the Moments unread badge. The badge count comes from
`Kronk::KornerContentStreams::MomentStream`.

## Composer

`features/moments/composer.tsx`, opened at `/hub/moments/composer` from the
Ж menu ("Share a Moment"), the strip, or the korner.

- Start from **Camera** (`capture='environment'`), **Upload**, or
  **Voice** (the shared `VoiceRecorder`, up to 60 seconds).
- Add more with the `+` on the filmstrip. **Each tile posts as its own
  Moment**, all sharing one caption, tier and krew.
- On a still photo: a voice clip, text overlays ("Aa"), and tagging
  people.
- Reach is the shared `ReachDropdown` limited to Mates and Orbit, with a
  single-select krew submenu.

## Reactions

Moments get the same reactions bar as every other space: Reply, Froth and
Nudge through `StatusEngagement` in the viewer (Tal, 2026-10-08).

- **The backing Status.** `MomentsController#create` mints one
  (`mint_backing_status!`) with `post_type: moment`, the caption as text,
  the Moment's reach tier as visibility and `source_korner: moments`. It
  is only a reactions target, never a post:
  - `Status#kronk_feed_suppressed?` keeps it out of fan-out, the home read
    path and `populate_home` regen (shared with album photos and kuestion
    answers).
  - `AccountStatusesFilter` keeps it off every profile and media tab, the
    author's own included.
  - Search doesn't index it (`searchable_as :statuses, if:`).
  - `StatusPolicy#show?` defers to `Moment#visible_to?`, so it is visible
    exactly when the Moment is: reach and krew while active, the author
    alone after 24 hours. No sweep is needed at expiry.
- **No media on the Status.** The Moment owns its photo and voice clip
  (unattached, excluded from the media vacuum). Attaching them would let
  deleting the Status destroy them, Log copy included.
- **No krew rows on the Status.** Krew access comes from the policy
  deferring to the Moment; a `statuses_krews` row would also announce it as
  a krew post.
- **Audience changes** (`PUT /moments/:id`) update the Status's visibility
  (`Moment#sync_backing_status_audience!`). **Deleting the Moment** removes
  the Status (`RemovalWorker`).
- **Froth counts.** The serializer's `froth_count` and `frothed_by_viewer`
  read the Status's favourites. Moments without a Status (made before
  2026-10-08, or a failed mint) fall back to `moment_froths`; the viewer
  hides the bar for them. They age out within 24 hours, so there is no
  backfill. `POST/DELETE /api/v1/moments/:id/froth` stays for older app
  builds but nothing in the web app calls it.

## Data

- `moments`: `account_id`, `media_attachment_id` (nullable),
  `voice_media_attachment_id` (nullable), `caption`, `visibility`
  (`public` 0, `mates` 1, `orbit` 3, `self_only` 4; 2 is the retired
  `krew`), `krew_id`, `text_overlays`, `expires_at`, and a legacy
  `status_id`.
- `moment_froths`: one row per (Moment, account).
- Media goes through the normal `MediaAttachment` upload. The manifest's
  `media_prefix: spaces/moments/` isn't used.

## Open

- **Reply to a Moment.** The plan was that Reply opens a Nudges thread with
  the poster, with the Moment quoted. Not built.
- **Notifications.** `moments.froth`, `moments.reply_started` and
  `moments.mention` are declared `planned: true` with no producer.
- **Declared events.** The manifest's `emits` (`moments.published`,
  `moments.reply_started`, `moments.froth`, the `moments.attach.*` set) are
  never published.
- **Attachments.** Attaching a Moment to a Kalendar event, a Map location,
  a Klot phase or a Wachuneed listing is still undesigned in detail
  (precision for Map, meaning for Klot and Wachuneed).
- **Unread badge vs. krews.** `MomentStream` counts live Moments from
  people you follow (`public`) and from Mates (`mates`, `orbit`). It
  ignores krew audiences and Orbit beyond your Mates, so its count can
  differ from what the strip shows.
- **Video length.** Nothing caps a video Moment at 60 seconds; only voice
  clips are capped.
- **Settings page.** `settings.moments` is a `soon` node with no settings.
- **Leftovers.** `moment_views` in the manifest's
  `resources` (no such table), and the stale comments at the top of
  `moments.yaml`, `moment.rb` and `moments_controller.rb` that still
  describe a feed-projecting Moment.

## History

Rewritten 2026-10-05 to describe what is built. The previous version
included the 2026-07-29 discovery notes, a planned notification table,
retired settings and the original open questions. Earlier designs and
notes: `git show 231cca937:docs/spaces/moments.md`.
