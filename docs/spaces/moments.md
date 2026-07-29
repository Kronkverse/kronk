# Moments (`moments`)

**Manifest:** `config/korners/moments.yaml` · **Mount:** `/hub/moments` · **Status:** live — grid + composer + feed card (alpha.315) + Home strip (alpha.321) + deep-link viewer (alpha.327). Attach flows, notifications, and expiry reaper still to come.

## Purpose

Moments make space for the **ephemeral** — a single photo or short
video (up to 60 seconds) with an optional caption, gone by morning.
The point is to **lower the bar to sharing**: a Moment doesn't need
to be interesting enough to survive the timeline, because it isn't
going to. Twenty-four hours in, it's gone.

`hub_teaser` sums it up: _"Gone by morning."_

## What a Moment is (locked 2026-07-29)

- **Content** — one photo, or one video (≤ 60 s), with an optional
  caption. No multi-image posts. No text-only Moments. The visual is
  the primary object; caption is subordinate.
- **Expiry** — **fixed 24 hours** from post time. Not user-adjustable,
  not per-Moment overridable. The mechanic is the identity.
- **Default reach** — **Mates only**. Poster may switch to a specific
  Krew, or Public. No "Close Mates" subset primitive.
- **Reactions** — **Froth + Reply**. Froth is an ephemeral favourite
  (disappears with the Moment). Reply opens a Nudges thread with the
  Moment quoted; conversation lives in Nudges, not on the Moment.
- **Kategory** — **not taggable**. Curation runs against the
  ephemeral premise. A Moment is a passing thing.

## Where you see Moments

Two surfaces on the same data source:

1. **`/hub/moments` grid** — the Moments korner. Everyone's currently
   active Moments (subject to visibility). Tunable in / out via the
   standard korner tune-in gate.
2. **Home strip** — a horizontal row of ring-avatars at the top of
   Home feed, newest-first among your Mates. **Empty state**: a
   compose CTA ("Share a Moment"). Owner tile on the left. Full-screen
   viewer opens on tap and cycles through active Moments.

Deep-links: `/hub/moments/<id>` opens a single Moment in the viewer.

## Composer

**Full expanding form** (not chip-based) — the compose surface has
sections rather than optional badges. Landing v1:

1. **Media pick** — camera-capture or upload. Photo or video (≤ 60 s).
2. **Caption** — one line, optional.
3. **Visibility** — Mates (default) / a specific Krew / Public.
4. **Optional attachments** (each collapsible section):
   - **Nudges** — automatic, not a section: reply-flow always wired.
   - **Kalendar** — attach to a live/upcoming event you're on.
   - **Map** — attach a location (see § Open decisions on precision).
   - **Klot** — tag your current Klot phase (semantic in § Open).
   - **mARTketplace** — attach one of your listings (semantic in § Open).
5. **Post** — button.

**Entry points**:

- Ӂ (Kronk) menu → "New Moment" alongside New Post / New Krew.
- `/hub/moments` grid → the "+" tile (always leftmost when the viewer
  has posted no active Moment).
- Home strip → the empty-state CTA and the owner tile double as
  compose entry.

## Notifications

Three types emitted:

| type                    | subject_type | default_push | aggregation               |
| ----------------------- | ------------ | ------------ | ------------------------- |
| `moments.froth`         | `moment`     | off          | per Moment (N froths → 1) |
| `moments.reply_started` | `moment`     | on           | none                      |
| `moments.mention`       | `moment`     | on           | none                      |

No expiring-soon reminder. Froths are ambient; replies + mentions are
conversation-worthy.

## Cross-korner connections

Moments emits + listens across five other korners:

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

## Data (planned)

- `moments` table — the primary row. Fields: `id`, `account_id`,
  `media_attachment_id`, `caption`, `visibility`, `krew_id` (nullable),
  `expires_at`, `created_at`. `visibility` is a small enum: `mates`,
  `krew`, `public`.
- `moment_views` table — one row per (moment_id, viewer_account_id).
  Powers the read/unread state on the Home strip.
- `moment_froths` — one row per (moment_id, from_account_id). Ephemeral
  with the Moment.
- Optional attach tables (one per attach type — nullable-FK on the
  `moments` row is enough for v1): `location_lat`, `location_lng`,
  `attached_event_id`, `attached_klot_phase`, `attached_listing_id`.

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

## Related

- [`../korners/korner_standard.md`](../korners/korner_standard.md) — Standard §L1 identity, §L4 feed projection, §L11 Frame adherence.
- [`../kronk_korner_spec.md`](../kronk_korner_spec.md) — §New korners; §8 feed projection.
- [`../korners/adding_a_korner.md`](../korners/adding_a_korner.md) — the build walkthrough (picks up from the manifest skeleton this discovery produced).
- [`../korners/proposing_a_korner.md`](../korners/proposing_a_korner.md) — the discovery flow this doc came out of.
- [`../spaces/nudges.md`](nudges.md) — the reply-flow surface.
- [`../spaces/kalendar.md`](kalendar.md) — the attach-to-event source.
- [`../spaces/krew_build_spec.md`](krew_build_spec.md) — the Krew scoping primitive.
- [`../spaces/klot.md`](klot.md) — the Klot phase source for the tag attach.
- [`../spaces/martketplace.md`](martketplace.md) — the listing attach source (once that space doc exists).
- [`../spaces/map.md`](map.md) — the location attach source (once precision is settled).
