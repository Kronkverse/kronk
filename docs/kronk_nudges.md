# KRONK_NUDGES — build brief

Checked into the repo 2026-07-21 from Tal's upload
(`talitamoss.info/files/uploads/KRONK_NUDGES.md`). Visual companion:
`kronk-nudges-chat.html` prototype (also uploaded; not vendored here —
prototype fidelity carries in the SCSS + component tree).

**Amendments to the uploaded original**, applied during the pre-build
alignment pass:

- **Orb colour.** Brief mapped korners to planet colours
  (Sun/Mercury/Neptune/Jupiter/Pluto). 2.0 retired the planet metaphor
  platform-wide; Wachuneed replaced "Market" 2026-07-21. Decision:
  **orbs stay `--kronk-purple-bright`; source korner is conveyed by
  icon + label** ("Kommons", "Kalendar", "Wachuneed"). No per-korner
  colour axis reintroduced for Nudges. Consequently the preserved body
  below (the `korner` enum `sun|mercury|neptune|jupiter|pluto` and its
  "planet ramp" colours) is superseded: the real source-korner axis is
  **slug-based** (keyed off the manifest `emits:`/`listens:` bus), and
  every orb renders `--kronk-purple-bright` regardless of source.
- **Data model.** Greenfield tables per §Data model — the existing
  `NudgeMessage` (`belongs_to :notification`) stays put backing the
  retiring `/nudges/activity` machinery until Phase 14, at which
  point it's dropped.
- **Phase 1 scope.** Phase 1 ships **Mate (1:1) conversations only**.
  Krew (group) conversations follow in a second PR — Groups gain a
  chat surface then, not now.
- **`/nudges/activity`.** Retires in favour of the messenger surface
  at `/nudges`. Legacy route 301-redirects to `/nudges`.
- **Non-Mate nudges.** Filtered out entirely — strangers frothing
  your proposal do not appear in Nudges. You find out via their
  profile / activity when you visit. Aggressive privacy stance.
- **Milestone metric.** `Message` count in the Mate 1:1, both
  directions combined. A milestone fires when
  `messages.where(conversation: mate).count` hits the next
  threshold. NOT notification/nudge count.
- **Settings.** Brief specified 3 toggles; Kronk keeps four —
  `quiet_hours_start`, `quiet_hours_end`, `show_activity_in_chats`,
  **and `auto_read_on_open`** (retained per Tal 2026-07-21;
  brief-deviation intentional, opening a conversation still marks
  read by default).
- **Pillar icon.** Deferred — the manifest's `icon: partner_exchange`
  currently conflicts with Huddle (which also maps to
  `PartnerExchangeIcon` in `useKornerIcon`). Every enforced korner
  needs a unique icon per that hook's contract. Nudges keeps
  `ChatIcon` for now; a platform-wide icon audit is queued as a
  follow-up per Tal 2026-07-21.
- **Brief's remaining open decisions** taking defaults for Phase 1:
  passive-aggregates keep boosts + mentions inline, omit bare
  favourites (prototype-faithful); sidebar recency-only; in-body
  search name-only (private-by-construction).

Everything below is the uploaded original, verbatim.

---

## Visual source of truth

Visual source of truth: `kronk-nudges-chat.html` (self-contained prototype). Where this brief and the prototype disagree, the prototype wins on layout and interaction; this brief wins on data model and non-negotiables.

This design **supersedes** the activity-feed-as-central-inbox described in the earlier Nudges instructions. Nudges is now a Signal-shaped messenger: a conversation list on the left, an open conversation on the right. Notifications are no longer a separate feed — they render **inside the conversation they came from**, attached to the korner where the action happened. The `Nudges::Aggregator`, the manifest, quiet hours, the legacy view, and the pillar-promotion move all carry over unchanged in intent; only the primary surface changes.

---

## Session protocol

Recon before build. Open by `@`-referencing and mapping, in this order, before writing anything:

- the Nudges manifest (settings block, `emits:` / `listens:`, `enforced: false`)
- the notifications store (the unread source that feeds the dotbadge)
- `HubSwitcher` (currently 3-way) and the `Ӂ` menu (which currently carries the Nudges entry + badge)
- existing `/nudges/*` routes and controllers
- `Notification` model — `LEGACY_TYPES`, `PROPERTIES`
- `Nudges::Aggregator`

Sequencing is backend-first, as always: resolve the conversation/message/nudge models and their visibility scopes server-side before any shell or component work. New tables here mean this feature carries migrations and model specs — that is in scope for this brief, unlike frontend-only sessions.

Web client is the Mastodon-fork React/Redux frontend. `kronk-app` (Android) is a parallel target and is out of scope for this brief except where noted (voice parity).

---

## Concept

Two conversation kinds share one surface:

- **Mate** — a 1:1 private chat with another account. Text, images, video, voice. Relationship depth (sent/received counter, milestones) lives here.
- **Krew** — a group chat attached to a group. Same message primitives, plus membership and group-event system lines. No relationship counter; shows member count and the krew's home korner instead.

A **nudge** is a system event that renders inline in a conversation stream — not a message, not a bubble. It is anchored by an orb in the colour of the korner it came from, states what an actor did, and (if interactive) deep-links to the source object. Examples: a Mate frothing a proposal you seconded appears in that Mate's chat with a Jupiter/Kommons orb; a Mate RSVPing to your event appears with a Neptune/Kalendar orb; a Krew member joining appears in the Krew with a Neptune orb; a Krew event being updated appears with a Neptune orb; a Krew froth appears with a Jupiter orb.

The nudge wears the colour of **where the action happened**, never the colour of the conversation it lands in. Nudges are routed to the conversation through the manifest `emits:` / `listens:` bus; Nudges stores only the routed reference to the source object, never a copy of the underlying korner data.

Interactive nudges are answered in-context — a reply is simply the next message in that same conversation. Passive nudges (a boost, a favourite roll-up, an orbit) deep-link out and are not reply targets.

---

## Surfaces

**1 — Pillar entry.** `HubSwitcher` grows 3-way → 4-way; mobile bottom tab bar grows 3 → 4. Icon: `partner_exchange`. Tap deep-links to `/nudges`. The unread dotbadge migrates off the `Ӂ` menu's Nudges entry (which retires) and onto the pillar, sourced from the notifications store. Manifest gains `hub_visible: false` (grid filter reads this) **and** `pillar: true` (nav reads this) — both, so the two concerns never collapse into one overloaded field.

**2 — Messenger shell** at `/nudges`. One continuous surface split by a divider: sidebar (search + conversation list) on the left, open conversation on the right. `/nudges/:conversationId` deep-links straight to a conversation.

- Conversation list: Mates and Krews mixed in a single list, **sorted by most recent activity, newest first**. No All/Mates/Krews segmentation. No pinned or unread-first tier at this stage (recency only; the comparator is one function if that changes later).
- Each row: avatar (single for Mate, stacked pair for Krew), name, last-activity time, one-line preview, unread count. When the latest item was a nudge, the preview carries the source korner's dot so the _kind_ of waiting item is legible before opening.
- Search filters the list by conversation name. **Name-only** — see open decisions on in-body search.
- New-chat control (pencil) opens a contact picker of Mates.
- No presence, last-seen, or typing indicators anywhere. This is a non-negotiable, below.

**3 — Conversation stream.** Renders, in order, a mix of:

- text bubbles (out = self, in = other; Krew incoming bubbles show sender name + avatar, Mate bubbles do not)
- attachments inside bubbles: image and video as media tiles (video carries a play affordance + duration), voice as waveform + play + duration
- inline nudges (korner orb + actor + verb + source-space label + optional deep-link CTA + time)
- milestone pins (Mate only) at the depth thresholds
- Krew system lines (join, event-updated) rendered in the same inline-nudge form
- day separators

Post-share cards render a shared Status as a proper card, not a raw link. Reactions are capped at **3 distinct per message**, enforced server-side and reflected in the UI (the add affordance disables at the cap). Read receipts and a per-conversation unread count apply. Time-boxed conversations show an expiry countdown and clear on expiry.

**4 — Composer.** Text, plus attach (photo, video) and voice recording. Voice recording is a live capture state (running timer, moving level, send / cancel). **Gate: voice recording does not land until `kronk-app` parity is confirmed** — Android and web must not diverge on this.

**5 — Settings** at `/hub/nudges/settings`. Three toggles from the manifest, unchanged: `quiet_hours_start` (HH:MM 24h), `quiet_hours_end` (HH:MM 24h), `show_activity_in_chats` (bool — reaction/favourite summaries inline in threads). Per-korner, per-type push toggles live under each korner's own settings surface (per §K.3.2); Nudges consumes that taxonomy and does not own it.

**6 — Legacy compat** at `/nudges/legacy`. Pre-2.0 Mastodon notification-bell view, one release cycle. Types flagged `legacy: true` via `Notification::LEGACY_TYPES` + `Notification::PROPERTIES` flow here so no history is lost when the bell retires. Sunset banner + a "this view goes away in 2.1" note.

---

## Data model — required fields

**Conversation** — snowflake `id`; `kind` (`mate` | `krew`); `last_activity_at` (drives sidebar sort); per-viewer `unread_count`. Mate: the two account ids. Krew: `krew_id`, member account ids, `home_korner`.

**Message** — snowflake `id`; `conversation_id`; `author_account_id`; `body` (nullable when attachment-only); optional `attachment` { `type` (`image` | `video` | `voice`), object-storage ref (DO Spaces), `duration` for voice/video, poster ref for video }; `created_at`; read state (per-recipient in a Krew); `reactions` [{ `account_id`, `symbol` }] capped at 3 distinct; nullable `expires_at` for time-boxed threads.

**Nudge** — snowflake `id`; `conversation_id` (the Mate or Krew whose stream it appears in); `korner` (`sun` | `mercury` | `neptune` | `jupiter` | `pluto`); `actor_account_id`; `interaction` (`interactive` | `passive`); `verb` (`frothed`, `backed`, `joined`, `mention`, `boost`, `rsvp`, `event_updated`, `orbit`, …); `source_ref` (deep-link reference to the korner object — Kommons motion, Kalendar event, Murmur status, profile, Krew event); `cta_label` + `cta_route` (interactive only); `created_at`. Populated off the manifest `emits:` / `listens:` bus. Stores the reference only — never a copy of the source object.

**Relationship** (Mate only) — account pair; `sent_count`; `received_count`; milestone thresholds `250 / 500 / 1000 / 2000 / 4000 / 8000 / 10000`. Confirm whether the milestone metric is the **sum of both directions** or sent-only before wiring thresholds — it changes how often they fire.

**Korner → colour/space map** (fixed by domain): Sun → Orbit; Mercury → Murmur; Neptune → Kalendar/gathering; Jupiter → Kommons; Pluto → Market. Colours from the `2026-07-14` planet ramp.

**Manifest** — `enforced: false`; `hub_visible: false`; `pillar: true`; `icon: partner_exchange`; `emits:` / `listens:` blocks; settings block as in Surface 5.

---

## Non-negotiables

- **Private-by-construction.** No conversation content is ever projected to a feed.
- **No federation.** Nudges is local-only.
- **No presence signals.** No online/last-seen/typing indicators anywhere. Last-seen is an inference leak of the same class already closed by omitting `updated_at` from the Map location API; the same discipline applies here. Any future liveness cue must be consent-gated and per-conversation, never ambient.
- **Interactive-vs-passive split** is honoured on every nudge render: interactive → reply-able in-context; passive → deep-link only.
- **Quiet hours** hold delivery in-window; **per-type push toggles** (owned by each korner) are respected.
- **Reaction cap = 3** distinct per message, enforced server-side.
- **Deletion model.** Snowflake IDs, tombstone-and-410, IDs never reused. No permanent ledger over deletable actions.
- **Nudges routes references, never stores korner data.** The membrane/sovereignty boundary holds: Nudges is a router.
- **Voice recording is parity-gated** on `kronk-app`.

---

## Open decisions (surface to Tal, do not resolve unilaterally)

- **Non-Mate nudges.** A stranger frothing your proposal has no Mate conversation to land in. Either a nudge implies/opens a lightweight conversation, or these route to a separate surface. This model currently assumes a conversation exists.
- **Passive aggregates in a 1:1.** Whether bare favourites/boosts aggregate into a single periodic strip inside a Mate chat, or stay as individual passive lines. Prototype keeps boosts and mentions inline, omits bare favourites.
- **Krew nudge volume.** A busy governance Krew can bury messages under froth/abstain lines. Options: collapse consecutive same-motion nudges into one expandable line, or gate low-signal ones behind `show_activity_in_chats`. Prototype renders everything.
- **Sidebar tiers.** Recency-only today. Whether to add a pinned section or unread-first ordering.
- **In-body search.** Name-only today. Searching inside private message bodies is a privacy decision (does that index exist at all?), not just a feature.
- **Threads placement** — resolved: Threads is a lens inside Nudges, not a fifth pillar. Recorded here so it is not reopened.

---

## Done

Backend: migrations for the new models, model specs, and the Aggregator → conversation-stream wiring green. Frontend: `yarn lint` clean, `NODE_OPTIONS=--max-old-space-size=2048 npx tsc --noEmit` clean. Then `gh pr create`. Note this feature introduces migrations and specs, which expands the usual frontend-only done-check set.
