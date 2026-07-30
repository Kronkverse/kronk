# The Booth (`booth`)

**Manifest:** `config/korners/booth.yaml` · **Mount:** `/hub/booth` · **Status:** 1.7 carry (rebuild in progress)

## Purpose

The Booth is Kronk's **audio-recording sharing space**. Users publish
long-form audio for others to listen to — the format is deliberately
broad:

- **Music** — original tracks, remixes, singles
- **DJ sets** — live mixes, continuous mixes
- **Poetry** — spoken word, recorded readings
- **Readings** — audiobook-style, essay-reads, monologues
- **Podcasts** — episodic spoken audio

**Voice messages are explicitly not Booth** — they live in **Nudges**
(as an audio message type in DMs) and can be attached to **Statuses**
(as a media attachment). The Booth is for audio meant to be listened
to as content, not conversational or ephemeral.

## Current shape (1.7.x)

- **`BoothSet`** model (`app/models/booth_set.rb`) — `title`,
  `artist_name`, `genres` (string array, default `[]`), `event_name`,
  `account_id` (uploader),
  `audio_attachment` + `cover_attachment` (both MediaAttachments),
  `status_id` (canonical, pre-2.0 `shared_status_id` dual-writes),
  optional `event_id`, `published`, `play_count`.
- Frontend at `app/javascript/mastodon/features/booth/` — includes a
  playback context, bottom PiP player, genre tag input, set page,
  and a Booth listing.
- Searchable via `Kronk::Search` (indexed as `booth_sets`).
- Feed projection: `booth_card` renders sets in Home feeds.
- Manifest at `config/korners/booth.yaml` declares
  `emits: [booth.set.frothed]` (a Favourite on the set's shared Status;
  Nudges routes it to the creator's Mate chat with the frother);
  `listens: []`.
- Audio + cover currently ride Mastodon's paperclip media
  attachments; not moved under `spaces/booth/` yet.

## Rebuild vision (2.0.0)

### Kind taxonomy replaces genre-only

Today a BoothSet has a `genres` field (music-oriented). 2.0 introduces
a **kind** (content-type) field to accommodate the expanded scope:

- `music`
- `dj_set`
- `poetry`
- `reading`
- `podcast`

`genre` remains a sub-field, primarily meaningful for `music` and
`dj_set` (electronic subgenres, etc.). Kind is required at upload;
genre is optional.

### BoothSeries — new primitive for podcasts + curated collections

2.0 adds a **`BoothSeries`** model for episodic content:

- A series has a name, description, cover art, author (Account), and
  a kind (typically `podcast`, but any kind supported).
- BoothSets can belong to a series (`booth_set.series_id`, nullable).
- Series have their own page (`/hub/booth/series/:id` or similar).
- Users can **tune into** a series (subscribe) — new episodes surface
  in their Home feed and (via Nudges emit?) push them a notification.
- A series can also be built retroactively — group existing sets into
  a series.

The default remains "each set is standalone"; series is opt-in when
publishing an episode.

### Discovery — multiple surfaces

- **`/hub/booth` listing** — chronological by default. Filter by
  **kind** (music / dj_set / poetry / reading / podcast) as the
  primary browse axis.
- **Feed projection (booth_card in Home)** — social discovery: when
  someone in your network publishes a set, it surfaces as a card in
  your Home feed.
- **Event-linked** — sets recorded at a Kalendar event surface for
  people who RSVP'd (or attended) that event. The Event page shows
  sets from that event; the user's Kalendar view can highlight sets
  from events they cared about.
- **User-listed** — each user's profile shows their Booth sets (via
  the sectioned-profile Booth section from Phase 11).
- **Universal search** — sets indexed in `Kronk::Search`; users find
  specific artists, titles, event names via `/hub/search`.

### Event linkage — two explicit paths

At upload, the user chooses:

- **Standalone** — set is not tied to an event; just published to the
  Booth.
- **Event-recorded** — set is attached to a Kalendar event (which
  might be past or upcoming). The set surfaces on the event page and
  in the event-linked discovery lens.

Explicit choice at creation; distinct UI treatment for each. The
existing `event_id` FK carries the linkage.

### Engagement signals

A Booth set carries the **standard Kronk engagement affordances**:

- **Play count** — total plays (existing `play_count` column).
- **Froths** — Kronk-native like/appreciate signal (see memory
  `reference_kronk_vocab_froth.md`; code stays `Favourite`).
- **Comments** — thread on the set page; same as replies to a Status.
- **Reposts** — share the set into your own audience.
- **Save / library / bookmark** — a user can save a set to their
  personal Booth library for later listening. Distinct from having
  played it.
- **Live listener count** — the set page shows _"N listening right
  now"_ as an ambient co-presence signal. Listings (`/hub/booth`,
  feed cards, series pages) do NOT show the live count — only play
  count aggregates. Keeps the live signal from feeling
  surveillance-y while preserving it as a moment-of-attention hint
  on the set itself.

The `status_id` linkage means Booth engagement piggybacks on the
Status model's existing froth/reply/repost mechanics.

### Storage migration (spec §5.5)

Move Booth audio + cover attachments under
**`spaces/booth/booth_sets/<id>/`** per spec §5.5 storage discipline.
Data migration + backfill task included in the 2.0 rebuild scope; no
architectural change (range-request streaming path already works),
just moving files to their canonical namespace.

### Aesthetic

Rebuild the Booth listing, set page, and bottom player in line with
current Kronk aesthetic tokens (post-planet-metaphor). Coordinating
on visual mockups with Claude web.

### Framework integration

The Booth manifest already declares `emits: [booth.set.frothed]`
(`listens: []`). An additional candidate emission for 2.0 is
`booth.set.published` (Home feed could react; Nudges could surface
"your mate just published a set"). Candidate listens:
`kalendar.event.created` (auto-suggest event-recording upload when a
Kalendar event you RSVP'd to just passed).

## Open decisions

- **Framework emits/listens** — confirm the exact event names and
  which korners subscribe. Candidates: `booth.set.published`,
  `booth.series.episode_added` (feed projection, Nudges push,
  series-tune-in fan-out).
- **Series tune-in mechanics** — is "tuning into" a series the same
  primitive as tuning into a korner (`korner_tune_ins`/`_tune_outs`),
  or a new table (`booth_series_subscriptions`)? Impacts notification
  fanout and profile rendering.
- **BoothSeries scope in 2.0** — ship series with full follow +
  notification loop, or ship as a lighter grouping affordance first
  (just visual clustering of sets on an author's Booth page)?
- **Kind taxonomy edges** — the 5-kind list covers the core; any
  others worth including at launch (e.g., `interview`, `live_stream`,
  `soundscape`)?

## Related drafts

- `../kronk_korner_spec.md` — the korner framework spec (manifest, feed projection §8, storage §5).
- `../rebuild/implementation_plan.md` — the rebuild plan (Booth phase, storage migration under `spaces/booth/`).
- Related korners: `kalendar.md` (event-linked sets), `nudges.md` (candidate listener for `booth.set.published`)
