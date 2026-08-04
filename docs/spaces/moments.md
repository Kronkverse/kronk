# Moments (`moments`)

**Manifest:** `config/korners/moments.yaml` · **Mount:** `/hub/moments` · **Status:** live — composer, Home strip, the Moments korner (active **"Now"** + permanent **"Log"**), deep-link viewer, and per-Moment visibility (the reach ladder + krew) that is **editable after posting**. **No feed card** — Moments deliberately never project into the timeline. Cross-korner attach flows and notifications are still to come; there is deliberately **no expiry reaper** (a Moment leaves the live surfaces after 24h but is kept forever in the Log — see § Expiry & the log).

## Purpose

Moments make space for the **ephemeral** — a single photo, a short
video (up to 60 seconds), or a photo paired with a short voice clip
— with an optional caption. The point is to **lower the bar to
sharing**: a Moment never enters the timeline (there is no feed card)
and stops demanding attention after a day, so it doesn't need to be
interesting enough to survive a feed.

A Moment is **live for 24 hours** — it sits in the top-of-Home strip
and the korner's **"Now"** section — then it leaves those live surfaces
and settles into the korner's permanent **Log**. So _"gone by morning"_
is about **prominence, not deletion**: after a day it's out of
everyone's way, but it's kept (the author can always find it, and it
stays visible to whoever its visibility allowed). `hub_teaser` still
sums up the feeling: _"Gone by morning."_

## What a Moment is (locked 2026-07-29 · reconciled with the shipped model 2026-07-30 · voice-clip pairing shipped 2026-08-04)

- **Content** — one of three shapes, with an optional caption:
  - one **photo**, or
  - one **video** (≤ 60 s), or
  - one **photo + voice clip** (≤ 60 s of audio, played over the
    still).

  No multi-image posts. No text-only Moments. No voice-only Moments
  (voice always sits under a still — the visual carries first, audio
  reinforces). Voice does not pair with video; video has its own
  audio track. The visual is the primary object; caption is
  subordinate to it and audio is subordinate to both.

- **Expiry & the log** — **fixed 24 hours** of live prominence from post
  time (not user-adjustable; the mechanic is the identity). At 24h a
  Moment leaves the strip and the korner's "Now" section but is **not
  deleted** — it is kept forever in the korner's **Log**, and its media
  is retained (Moment media is excluded from the unattached-media
  reaper). There is deliberately no expiry reaper.
- **Reach** — the full reach ladder + krew: `public` / `orbit` /
  `mates` (**default**) / `self_only` / `krew`. Enforced per-Moment
  against the viewer by a `visible_to` gate (the same reach-ladder
  scope Albums use), so the strip and the korner only ever show what
  your relationship + the Moment's own visibility permit. A Moment is
  **re-scopeable at any time** from the viewer (owner only).
- **Reactions** — **Froth + Reply**. Froth is a favourite that persists
  with the Moment (including once it has settled into the Log). Reply
  opens a Nudges thread with the poster; conversation lives in Nudges,
  not on the Moment.
- **Kategory** — **not taggable**. Curation runs against the
  ephemeral premise. A Moment is a passing thing.

## Where you see Moments

**Never in the feed** — a Moment does not project a timeline card (the
manifest declares no `feed_projection.card`, and a Moment has no backing
Status). Its surfaces are:

1. **Home strip** — a horizontal row of ring-avatars at the top of the
   Home feed showing the currently **active** Moments you're permitted
   to see. **Empty state**: a compose CTA ("Share a Moment"); the owner
   tile sits on the left. The full-screen viewer opens on tap and cycles
   through the stack. A photo+voice Moment is signalled with a **mic
   glyph badge** on the ring (bottom-right, accent bubble matching the
   `+` on the owner tile); the voice plays over the still via an
   inline waveform-driven `<VoicePlayer>` in the viewer.
2. **`/hub/moments` korner** — two sections over the same
   visibility-gated collection:
   - **Now** — active Moments (still inside the 24h window), each tile
     attributed to its author.
   - **Log** — the permanent archive: every Moment you can see that has
     since expired, kept for good.

   Tunable in / out via the standard korner tune-in gate.

Both surfaces read the same endpoint (`GET /api/v1/moments`,
`filter=active` | `filter=log`), gated per-viewer by each Moment's
visibility. Deep-links: `/hub/moments/<id>` opens a single Moment in the
viewer (and `show` 404s a Moment you aren't allowed to see).

## Composer

**Full expanding form** (not chip-based) — the compose surface has
sections rather than optional badges.

**Shipped:**

1. **Media pick** — upload a photo or video (≤ 60 s), or capture
   one live via the OS camera (`<input capture="environment">` — see
   PR #1112).
2. **Caption** — one line, optional.
3. **Visibility** — the reach ladder: Public / Orbit / Mates
   (**default**) / Only me / Krew. Choosing **Krew** reveals a
   single-select picker of your own krews (the shared
   `KornerKrewPicker`); Post stays disabled until a krew is chosen.
4. **Post** — button.

5. **Voice clip (photo Moments only)** — once a still photo has
   been chosen, a "Record voice" affordance appears under the media
   preview via the shared `<VoiceRecorder>` primitive
   (`components/media/`). Uses the `MediaRecorder` browser API to
   capture up to 60 s of audio; tap to start / tap to stop, with a
   live waveform strip + running timer. Preview surface shows the
   captured waveform + play/pause + delete. Suppressed when the
   picked media is a video (video carries its own audio track);
   enforced at the model level too via
   `voice_only_paired_with_a_still` validation. Format is whatever
   the browser produces — `audio/webm` (Chromium/Firefox) or
   `audio/mp4` (Safari); both round-trip through the standard
   MediaAttachment pipeline unchanged.

**Deferred — cross-korner attachments** (each a future collapsible
section; none shipped in v1):

- **Nudges** — reply-flow is always wired (automatic, not a section).
- **Kalendar** — attach to a live/upcoming event you're on.
- **Map** — attach a location (see § Open decisions on precision).
- **Klot** — tag your current Klot phase (semantic in § Open).
- **mARTketplace** — attach one of your listings (semantic in § Open).

**Entry points**:

- Ӂ (Kronk) menu → "New Moment" alongside New Post / New Krew.
- `/hub/moments` grid → the "+" tile (always leftmost when the viewer
  has posted no active Moment).
- Home strip → the empty-state CTA and the owner tile double as
  compose entry.

## Notifications (planned — not yet wired)

Three types to emit:

| type                    | subject_type | default_push | aggregation               |
| ----------------------- | ------------ | ------------ | ------------------------- |
| `moments.froth`         | `moment`     | off          | per Moment (N froths → 1) |
| `moments.reply_started` | `moment`     | on           | none                      |
| `moments.mention`       | `moment`     | on           | none                      |

No expiring-soon reminder. Froths are ambient; replies + mentions are
conversation-worthy.

## Cross-korner connections (planned)

The emits below are the intended design; only the Nudges reply-route is
wired today (the viewer routes to a Nudges thread with the poster — the
quoted-Moment opener is the follow-up). Moments will emit + listen across
five other korners:

**Emits:**

- `moments.published` — payload: `{ moment_id, account_id, expires_at }`.
  - Kommunity/Kosmos listens → briefly brightens the poster's chord for
    the Moment's active lifetime.
- `moments.reply_started` — payload: `{ moment_id, from_account_id }`.
  - Nudges listens → creates or reuses a Nudges conversation with the
    Moment as the quoted opener.
- `moments.attach.kalendar` / `.map` / `.klot` / `.martketplace` —
  emitted only when the poster attaches one of those (per-attach event
  so the touched korner can update its own surface if it wants to
  show the Moment inline).

**Listens:** none. Moments does not react to other korners' events;
it's a broadcast surface, not a reactive one.

## Data

- `moments` table (shipped) — the primary row. Fields: `id`,
  `account_id`, `media_attachment_id`, `caption`, `visibility`,
  `krew_id` (nullable), `status_id` (nullable — **legacy**; a Moment no
  longer creates a backing Status), `expires_at`, `created_at`,
  and (from the voice-pairing PR) `voice_media_attachment_id`
  (nullable — populated only for photo+voice Moments; enforced null
  when the primary `media_attachment_id` refers to a video).
  `visibility` is the reach-ladder enum: `public` (0) / `mates` (1) /
  `krew` (2) / `orbit` (3) / `self_only` (4), with a
  `krew_only_when_krew_visibility` validation keeping `krew_id`
  consistent with the scope.
- `moment_froths` (shipped) — one row per (moment_id, from_account_id).
  Persists with the Moment (kept, not reaped, since the Moment itself
  is kept).
- **Media retention** — a Moment owns its media directly with no backing
  Status, so the attachment is "unattached". `moments`' media is
  therefore **excluded from `Vacuum::MediaAttachmentsVacuum`** (the same
  exclusion BoothSet uses), so the Log's media survives indefinitely.
- `moment_views` (**not yet shipped**) — one row per (moment_id,
  viewer_account_id), to power read/unread state on the strip; see
  § Open decisions.
- Optional attach tables (**not yet shipped**, one per attach type — a
  nullable FK on the `moments` row is enough): `location_lat`,
  `location_lng`, `attached_event_id`, `attached_klot_phase`,
  `attached_listing_id`.

Storage: `spaces/moments/` in DO Spaces (media_prefix per manifest).

## Settings

- `notify_on_view` (bool, default false, user scope) — the existing
  manifest setting; retained. When on, viewers of the Moment receive
  a "you were seen" indicator on their own future Moments (mirrors
  Instagram's read-receipt symmetry).
- `notify_on_froth_push` (bool, default off, user scope) — matches the
  notification table above; poster can opt push on.
- `notify_on_reply_push` (bool, default on, user scope).
- `notify_on_mention_push` (bool, default on, user scope).
- `strip_on_home` (bool, default on, user scope) — turn off the Home
  strip if you don't want ephemera on your Home feed.

The `auto_expire_hours` setting shipped in the stub manifest is
**retired** — the expiry is fixed at 24h. Removed from the settings
block below.

## Nodes

- `moments.index` — `/hub/moments`, `lifecycle: building`, SPA.
- `moments.detail` — `/hub/moments/:id`, `lifecycle: building`, SPA.
- `settings.moments` — `/hub/moments/settings`, `lifecycle: building`,
  SPA.

## Open decisions (Round 3 candidates)

Each of these needs sharpening before the corresponding attach flow
ships. They don't block v1 (media Moment + basic reach + froth/reply),
which can land without any attach flow.

- **Klot attach semantic** — three plausible readings: (a) label the
  Moment with the poster's current Klot phase so viewers can associate
  ("this is what I'm sharing while I'm in follicular"); (b) share only
  to viewers currently in the same phase; (c) tag as reserved KlotShare
  content (only visible to accounts the poster has granted a KlotShare
  to). Pick before Klot-attach ships.
- **mARTketplace attach semantic** — is a Moment "attached to a listing"
  a promo (Moment appears on the listing page) or the reverse
  (listing badge appears on the Moment)? Or both?
- **Map location precision** — precise pin (raw lat/lon) or Klot-model
  coarsening (per-viewer accuracy scoped to their relationship)?
  Depends on the Map korner's visibility model.
- **Home-strip read-state** — the doc currently says "newest-first
  Mates row"; adding read/unread bright/dim is a further refinement
  that requires the `moment_views` table populated per viewer. Ship
  v1 without? Then add?
- **Video codec + max size** — h264 or h265 acceptable? What's the
  DO Spaces cap per Moment? Media pipeline work.
- **Voice-clip max length + waveform preview** — **closed
  2026-08-04**: 60 s cap; **waveform** (both live during recording
  and captured for playback) via the shared `<VoiceRecorder>` +
  `<VoicePlayer>` in `components/media/`, not a scrubber.
- **Photo+voice ring indicator** — **closed 2026-08-04**: **mic
  glyph** on an accent-coloured bubble in the ring's bottom-right
  corner (same slot as the owner tile's `+`).

## Related

- [`../korners/korner_standard.md`](../korners/korner_standard.md) — Standard §L1 identity, §L11 Frame adherence. (Moments declare **no feed card** — the §L4 feed-projection card is deliberately empty.)
- [`../kronk_korner_spec.md`](../kronk_korner_spec.md) — §New korners.
- [`../korners/adding_a_korner.md`](../korners/adding_a_korner.md) — the build walkthrough (picks up from the manifest skeleton this discovery produced).
- [`../korners/proposing_a_korner.md`](../korners/proposing_a_korner.md) — the discovery flow this doc came out of.
- [`../spaces/nudges.md`](nudges.md) — the reply-flow surface.
- [`../spaces/kalendar.md`](kalendar.md) — the attach-to-event source.
- [`../spaces/krew_build_spec.md`](krew_build_spec.md) — the Krew scoping primitive.
- [`../spaces/klot.md`](klot.md) — the Klot phase source for the tag attach.
- [`../spaces/martketplace.md`](martketplace.md) — the listing attach source (once that space doc exists).
- [`../spaces/map.md`](map.md) — the location attach source (once precision is settled).
