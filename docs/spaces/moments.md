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

The author can change a Moment's tier and krew at any time from the
viewer (`PATCH /api/v1/moments/:id`). Media and caption can't be edited.

## Where you see Moments

Never in the feed. The manifest declares no feed card.

1. **Home strip** (`features/moments/home_strip.tsx`): a row of ring
   avatars at the top of Home with the live Moments you're allowed to see.
   Your own tile sits on the left with a `+`; with nothing posted it opens
   the composer. Photo-plus-voice Moments get a mic badge. Rings dim once
   you've seen them. The strip hides if you've tuned out of Moments or
   turned off "Show the Moments strip at the top of my home feed" in feed
   settings
   (`web.moments_strip_on_home`).
2. **The korner** at `/hub/moments`: **Now** (live Moments, "Live for 24
   hours") and **Log** (your own expired Moments, "kept for you").
3. **Viewer** at `/hub/moments/:id`: full screen, steps through that
   author's live Moments, plays voice clips with a waveform, and lets the
   author change the reach. `show` returns 404 for a Moment you can't see.

All three read `GET /api/v1/moments` (`filter=log` for the Log, otherwise
live; `account_id` to narrow to one author), capped at 60.

Opening a Moment marks it seen through `Kronk::KornerSeen`, which drives
the dimmed rings and the Moments unread badge. The badge count comes from
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

- **Froth.** `moment_froths` stores one row per person, and
  `POST/DELETE /api/v1/moments/:id/froth` toggles it. Counts show on korner
  tiles. **The web app has no froth button that calls this** (see
  [Open](#open)).
- **The viewer's reactions bar** (`StatusEngagement`) only appears when a
  Moment has a backing Status. New Moments don't have one, so in practice
  the viewer shows no Froth or Reply.

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

- **Reactions don't reach the UI.** The froth endpoint has no caller, and
  the viewer's reactions bar needs a backing Status that new Moments don't
  get. `MomentsController#mint_backing_status!` exists but is never called.
  Decide whether Moments get a Status (for froth, reply and nudge) or a
  froth button of their own.
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
- **Leftovers.** The `status_id` column, `moment_views` in the manifest's
  `resources` (no such table), and the stale comments at the top of
  `moments.yaml`, `moment.rb` and `moments_controller.rb` that still
  describe a feed-projecting Moment.

## History

Rewritten 2026-10-05 to describe what is built. The previous version
included the 2026-07-29 discovery notes, a planned notification table,
retired settings and the original open questions. Earlier designs and
notes: `git show 231cca937:docs/spaces/moments.md`.
