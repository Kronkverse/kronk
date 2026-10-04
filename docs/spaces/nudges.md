# Nudges (`nudges`)

**Manifest:** `config/korners/nudges.yaml` (`core: true`, `enforced: true`) ·
**Mount:** `/nudges` (top-level — there is no `/hub/nudges` route) ·
**Status:** top-level pillar shipped; unified messenger shipped; bell retired.

Nudges is a **core space and a top-level navigation pillar**, not a korner
reached from the Hub grid. It sits in the primary switcher alongside **Me** and
**Home** (`app/javascript/mastodon/features/ui/components/hub_switcher.tsx`),
mounts at `/nudges` (routes `/nudges` and `/nudges/:conversationId(\d+)`; the
old `/nudges/activity` now redirects to `/nudges`), and carries the unread
badge. The earlier "pillar move" question (PR #331) is settled: the manifest is
`core: true`, `enforced: true`, and it's in the switcher.

## Purpose

The unified **activity surface** — Kronk's replacement for the notifications
bell, presenting activity directed at you in a chat-like form rather than a
passive notification list. Membership vocabulary is _tune in / tune out_.

## Rebuild status (2.0.0)

Core Phase 5 has landed:

- Activity feed + switcher pillar: **shipped**.
- Unified Nudges UI (5.1/5.2): **shipped** — `/nudges` renders the
  Signal-shaped messenger at
  `app/javascript/mastodon/features/nudges_messenger/` (registered as
  `Nudges()` in `features/ui/util/async-components.js`; routed in
  `features/ui/index.jsx`).
- Bell removal (5.5): **shipped** — the notifications bell is gone from the
  nav, and `/notifications`, `/conversations`, `/timelines/direct` and
  `/nudges/activity` all `Redirect` to `/nudges` (`features/ui/index.jsx`).
  The legacy account-scoped view is archived at `/nudges/legacy`.
- **Residual:** the `notifications_v2` directory cleanup.
- **Notification preferences → Nudges (planned, not done).** Per
  [`docs/spaces/settings.md`](settings.md) §3 and
  `../decisions.md`, notification prefs (`notification_emails.*`,
  `software_updates`, push, per-activity toggles) are _intended_ to fold in
  here — but a standalone Notifications settings page is **still live** at
  `/settings/notifications` (`settings.notifications`, `lifecycle: live` in
  `config/kronk_nodes.yaml`; `NotificationsSettings` route in
  `features/ui/index.jsx`). Folding it into Nudges is open work.

## Related

- [`docs/korners/adding_a_korner.md (Framework spec (v0.5))`](../korners/adding_a_korner.md) — framework spec.
- [`docs/spaces/settings.md`](settings.md) §3 — Notifications ≡ Nudges.

---

## Nudges spec

_Merged into this file on 2026-10-04 from `docs/spaces/nudges.md (Nudges spec)`; its own status notes and dates are kept as written._

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
- **Pillar icon.** The manifest's `icon: raven`
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

### Visual source of truth

Visual source of truth: `kronk-nudges-chat.html` (self-contained prototype). Where this brief and the prototype disagree, the prototype wins on layout and interaction; this brief wins on data model and non-negotiables.

This design **supersedes** the activity-feed-as-central-inbox described in the earlier Nudges instructions. Nudges is now a Signal-shaped messenger: a conversation list on the left, an open conversation on the right. Notifications are no longer a separate feed — they render **inside the conversation they came from**, attached to the korner where the action happened. The `Nudges::Aggregator`, the manifest, quiet hours, the legacy view, and the pillar-promotion move all carry over unchanged in intent; only the primary surface changes.

---

### Session protocol

Recon before build. Open by `@`-referencing and mapping, in this order, before writing anything:

- the Nudges manifest (settings block, `emits:` / `listens:`, `enforced: false`)
- the notifications store (the unread source that feeds the dotbadge)
- `HubSwitcher` (currently 3-way) and the `Ж` menu (which currently carries the Nudges entry + badge)
- existing `/nudges/*` routes and controllers
- `Notification` model — `LEGACY_TYPES`, `PROPERTIES`
- `Nudges::Aggregator`

Sequencing is backend-first, as always: resolve the conversation/message/nudge models and their visibility scopes server-side before any shell or component work. New tables here mean this feature carries migrations and model specs — that is in scope for this brief, unlike frontend-only sessions.

Web client is the Mastodon-fork React/Redux frontend. `kronk-app` (Android) is a parallel target and is out of scope for this brief except where noted (voice parity).

---

### Concept

Two conversation kinds share one surface:

- **Mate** — a 1:1 private chat with another account. Text, images, video, voice. Relationship depth (sent/received counter, milestones) lives here.
- **Krew** — a group chat attached to a group. Same message primitives, plus membership and group-event system lines. No relationship counter; shows member count and the krew's home korner instead.

A **nudge** is a system event that renders inline in a conversation stream — not a message, not a bubble. It is anchored by an orb in the colour of the korner it came from, states what an actor did, and (if interactive) deep-links to the source object. Examples: a Mate frothing a proposal you seconded appears in that Mate's chat with a Jupiter/Kommons orb; a Mate RSVPing to your event appears with a Neptune/Kalendar orb; a Krew member joining appears in the Krew with a Neptune orb; a Krew event being updated appears with a Neptune orb; a Krew froth appears with a Jupiter orb.

The nudge wears the colour of **where the action happened**, never the colour of the conversation it lands in. Nudges are routed to the conversation through the manifest `emits:` / `listens:` bus; Nudges stores only the routed reference to the source object, never a copy of the underlying korner data.

Interactive nudges are answered in-context — a reply is simply the next message in that same conversation. Passive nudges (a boost, a favourite roll-up, an orbit) deep-link out and are not reply targets.

---

### Relevance engine — who gets a nudge

Every nudge is produced by **one rule**, applied once per korner event by the router — superseding the old per-event hand-wired Mate-gate bypasses (`groups.member.joined`, `mates.request.*`, etc.). A nudge fires to user **U** for an event (actor **A** did **X** to object **O** in korner **K**) if **any** of three tiers holds, then dialed by U's per-type preference:

1. **Directed at U** — O is U's, or X targets U (reply / mention, a reaction on U's content, an RSVP to U's event, an offer on U's listing, an answer to U's question, a task assigned to U, a mate request / accept). **Fires always — no Mate, follow, or tune-in test.** This corrects today's router, which drops directed nudges when the actor is not a Mate — the bug behind "a mate request from a not-yet-Mate produced no nudge for the recipient." The Mate gate must never apply to directed events.
2. **Someone U chose** — A is an account U **follows (Groove) or Mates**, and X is a surfaced type (posted / frothed / backed / rsvp'd / joined). The "a person I picked did a thing" signal; one-way follows count, not only Mates.
3. **Somewhere U tuned in** — U has **tuned into korner K** (`korner_tune_outs` absence = tuned in, default-on) **or is watching object O** (derived: U authored / backed / RSVP'd / is a member — there is no explicit "watch" toggle), and X is notable for that object/korner.

**Tier-3 loudness is per-korner.** Each korner declares in its manifest the default surfacing for tuned-in-but-uninvolved members, per activity type — a governance korner (Kommons) can be chattier than a high-traffic one. Default is **on-but-quiet**: it lands in Nudges but does not push. U can override per korner / per type.

#### Storage — mostly derived, one small new record

Relevance is **computed from data we already keep**, not a separate who-gets-what table:

- **Follow / Mate** — derived from the follow graph (Mate = mutual). → Tier 2.
- **Tune-in** — `korner_tune_outs` (one row per account + korner-slug; absence = tuned in; **slug-scoped**, never per-object). → Tier 3 korner half.
- **Object-watching** — **derived** from involvement rows (authorship / backing / RSVP / membership). No explicit watch. The only new per-object state is an **opt-out** ("mute this thread / object").
- **Per-user tuning** — one small **preference + mute record**: per-korner / per-type overrides of the manifest defaults, plus per-thread mutes. This is the single genuinely new per-user store; the per-korner _default_ lives in the manifest, not per user.

---

### Surfaces

**1 — Pillar entry.** `HubSwitcher` grows 3-way → 4-way; mobile bottom tab bar grows 3 → 4. Icon: resolved from the manifest's `icon.material` (`raven`) via `kornerIcon('nudges')` — never hardcoded, so changing the manifest changes every Nudge affordance at once. Tap deep-links to `/nudges`. The unread dotbadge migrates off the `Ж` menu's Nudges entry (which retires) and onto the pillar, **sourced from the nudges data itself** (see _Self-delivering delivery_ below) — **not** the Mastodon notifications store the earlier draft pointed it at. Manifest gains `hub_visible: false` (grid filter reads this) **and** `pillar: true` (nav reads this) — both, so the two concerns never collapse into one overloaded field.

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

### Data model — required fields

**Conversation** — snowflake `id`; `kind` (`mate` | `krew`); `last_activity_at` (drives sidebar sort); per-viewer `unread_count` — **counts messages _and_ unseen nudge events** (see _Self-delivering delivery_), not messages alone. Mate: the two account ids. Krew: `krew_id`, member account ids, `home_korner`.

**Message** — snowflake `id`; `conversation_id`; `author_account_id`; `body` (nullable when attachment-only); optional `attachment` { `type` (`image` | `video` | `voice`), object-storage ref (DO Spaces), `duration` for voice/video, poster ref for video }; `created_at`; read state (per-recipient in a Krew); `reactions` [{ `account_id`, `symbol` }] capped at 3 distinct; nullable `expires_at` for time-boxed threads.

**Nudge** — snowflake `id`; `conversation_id` (the Mate or Krew whose stream it appears in); `korner` (`sun` | `mercury` | `neptune` | `jupiter` | `pluto`); `actor_account_id`; `interaction` (`interactive` | `passive`); `verb` (`frothed`, `backed`, `joined`, `mention`, `boost`, `rsvp`, `event_updated`, `orbit`, …); `source_ref` (deep-link reference to the korner object — Kommons motion, Kalendar event, Murmur status, profile, Krew event); `cta_label` + `cta_route` (interactive only); `created_at`. Populated off the manifest `emits:` / `listens:` bus. Stores the reference only — never a copy of the source object.

**Relationship** (Mate only) — account pair; `sent_count`; `received_count`; milestone thresholds `250 / 500 / 1000 / 2000 / 4000 / 8000 / 10000`. Confirm whether the milestone metric is the **sum of both directions** or sent-only before wiring thresholds — it changes how often they fire.

**Korner → colour/space map** (fixed by domain): Sun → Orbit; Mercury → Murmur; Neptune → Kalendar/gathering; Jupiter → Kommons; Pluto → Market. Colours from the `2026-07-14` planet ramp.

**Manifest** — `enforced: false`; `hub_visible: false`; `pillar: true`; `icon: raven`; `emits:` / `listens:` blocks; per-korner Tier-3 default-loudness declarations (per activity type); settings block as in Surface 5.

**Relevance state (new, per user)** — a per-recipient **event `seen_at`** (so unread counts nudges, not only messages) and a **preference + mute record** (per-korner / per-type overrides + per-thread/object mutes). Everything else the relevance engine needs is derived (§ _Relevance engine_).

---

### Self-delivering delivery (decision B)

Nudges deliver on their **own** machinery, decoupled from the Mastodon `Notification` store the badge used to lean on. That store is now **legacy-only**: `/nudges/legacy` and the synthetic "Kronk system" view still read it for one release cycle, then it retires with the bell.

- **User-level live stream.** A per-account channel `timeline:nudges:account:<id>` (alongside the existing per-conversation `timeline:nudges:conversation:<id>`), so a new event or conversation pushes to U's open messenger live — not only when U already has that exact conversation open. The router holds the recipient; it publishes the envelope to the recipient's account channel as the event lands.
- **Event-aware unread.** Unread counts **events, not just messages** — nudge events carry the per-recipient `seen_at` above (or a per-conversation `has_unseen_event` flag), so a conversation whose only new item is a nudge still reads unread. Today `unread_count` counts messages and excludes events; that is the gap.
- **Nudge-native badge.** The pillar/nav badge reads the **nudges** unread (Σ conversation unread over messages _and_ events), seeded on list load and kept live by the account stream — replacing the read from the notification store's `nudge`-type count.

---

### In-space activity indicators — the second surface

Relevance produces a nudge; the **in-space indicator is a projection of the nudge system**, not a separate signal. A card or tile lights up when U has an **unseen nudge referencing that object or korner** (via the nudge's `source_ref`), and clears when U views it. One source of truth — unseen nudges — feeds both the messenger and the in-space dots, so "there's something here for you" reads consistently in the feed, on korner boards, and (as a count) on the Hub tile.

This **generalises the existing Kommons proposal-card indicator** — today a `WavingHandBadge` wired to unread notifications — into a shared, nudge-derived dot: a slot on the `StatusKornerCard` feed frame and on each korner's own board/detail card, driven by a shared selector keyed on the nudge's `(source_korner, object_id)`.

---

### Build stages

1. **Self-delivery** — account-level stream + event-aware unread + nudge-native badge (unblocks every event-driven nudge at once; independent of the relevance change).
2. **Relevance-engine router** — directed nudges bypass the Mate gate; add follow + tune-in as inputs; per-korner Tier-3 loudness from the manifest.
3. **In-space dots** — the shared nudge-derived indicator on the card frame + korner boards.
4. **Preferences + mutes** — the per-user override/mute record and per-korner manifest defaults.

This supersedes the hand-wired per-event Mate-gate bypass approach (e.g. the `mates.request.*` subscribers): those become Tier-1 directed nudges under the one rule.

---

### Non-negotiables

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

### Open decisions (surface to Tal, do not resolve unilaterally)

- **Non-Mate nudges — resolved.** A stranger frothing your proposal is a **Tier-1 directed** nudge (§ _Relevance engine_): it fires regardless of Mate status, and the pair's Mate conversation is created on demand (`Nudges::Conversation.mate_between!`). No separate surface; the Mate-gate-on-directed-events was the bug, not a missing conversation.
- **Passive aggregates in a 1:1.** Whether bare favourites/boosts aggregate into a single periodic strip inside a Mate chat, or stay as individual passive lines. Prototype keeps boosts and mentions inline, omits bare favourites.
- **Krew nudge volume.** A busy governance Krew can bury messages under froth/abstain lines. Options: collapse consecutive same-motion nudges into one expandable line, or gate low-signal ones behind `show_activity_in_chats`. Prototype renders everything.
- **Sidebar tiers.** Recency-only today. Whether to add a pinned section or unread-first ordering.
- **In-body search.** Name-only today. Searching inside private message bodies is a privacy decision (does that index exist at all?), not just a feature.
- **Threads placement** — resolved: Threads is a lens inside Nudges, not a fifth pillar. Recorded here so it is not reopened.

---

### Done

Backend: migrations for the new models, model specs, and the Aggregator → conversation-stream wiring green. Frontend: `yarn lint` clean, `NODE_OPTIONS=--max-old-space-size=2048 npx tsc --noEmit` clean. Then `gh pr create`. Note this feature introduces migrations and specs, which expands the usual frontend-only done-check set.

---

## Delivery: state of play

_Merged into this file on 2026-10-04 from `docs/spaces/nudges.md (Delivery: state of play)`; its own status notes and dates are kept as written._

> **Freshness.** Inventory below last checked **2026-08-12** against `8bef674`.
> Re-check with:
>
> ```
> grep -cE '^\s+- event:' config/korners/nudges.yaml     # manifest listeners (12 at time of writing)
> grep -rn 'KornerEvents.publish' app/ lib/              # publishers (note: some pass the name on the NEXT line)
> grep -n 'KornerEvents.subscribe' config/initializers/*.rb  # hand-wired
> ```
>
> If it disagrees, **correct this doc in your current PR** — do not park it in a
> note. See `decisions.md` 2026-08-12 (decision 6).

**Status: assessment, no code changed.** Written 2026-08-12 from the code at
`rebuild/2.0.0` tip `8bef674`, after the korner-doctor audit (#1357 / #1361)
surfaced eight korner notification declarations that can never fire. The
headline: **the good architecture already exists and works** — the problem is
that a second, retiring mechanism is still declared in manifests and still
enforced by the doctor, so there are two ways to do this and korner authors are
being pointed at the wrong one.

The normative spec is [`the Nudges spec part of this file`](nudges.md); this document
is the gap between that spec and the code, plus a proposed order of work. It
decides nothing — the open questions are marked and are Tal's.

---

### The mechanism that is right, and works

A korner publishes a domain event. The Nudges manifest declares which events it
cares about. A boot-time initializer turns each declaration into a subscriber
that routes the event into a conversation. Adding a nudge is **a manifest entry
plus one publish call** — no plumbing, no new files.

```
korner model                     config/korners/nudges.yaml        Nudges::EventRouter
Kronk::KornerEvents.publish  →   listens:                      →   → Nudges::Event
  'kommons.proposal.backed'        - event: kommons.proposal.backed    on a conversation
  actor_account_id:                  verb: backed
  recipient_account_id:              cta_route: '/hub/kommons/p/{id}'
  proposal_id:                       aggregation: { window: 10m }
```

Verified working end to end:

- **`Kronk::KornerEvents`** — the publish/subscribe bus (`lib/kronk/korner_events.rb`).
- **`config/initializers/nudges_event_bus.rb`** — reads the manifest `listens:`
  block at boot, registers one subscriber per entry, interpolates `{token}`
  placeholders from the payload into verbs and CTA routes.
- **`Nudges::EventRouter`** — drops self-nudges, applies the Mate gate (with a
  `directed:` bypass), ensures the conversation exists, collapses a burst onto
  one event when the entry declares an aggregation window.
- **Event-aware unread** — `Nudges::Conversation#unread_count_for` counts
  unseen **messages and events**, so a conversation whose only new item is a
  nudge reads unread. (The spec lists this as a gap; it has since been built.)
- **Account-level live stream** — `Nudges::StreamPublisher#fan_to_accounts`
  fans each envelope to every participant's `timeline:nudges:account:<id>`
  channel, so a member sitting on `/nudges` gets the push even for a
  conversation they don't have open.

That is spec Build stage 1 (_Self-delivery_) essentially complete, and the
declarative half of stage 2.

---

### What is actually wired — full inventory

**Manifest-declared listeners (10).** These are the clean path.

| Event                         | Korner       | Verb             | Interaction                  |
| ----------------------------- | ------------ | ---------------- | ---------------------------- |
| `kommons.proposal.backed`     | kommons      | `backed`         | interactive                  |
| `kommons.proposal.frothed`    | kommons      | `frothed`        | passive                      |
| `kommons.proposal.commented`  | kommons      | `commented`      | interactive, 10m aggregation |
| `kalendar.event.rsvpd`        | kalendar     | `rsvpd_{status}` | interactive                  |
| `wachuneed.offer.made`        | martketplace | `offered`        | interactive                  |
| `wachuneed.offer.accepted`    | martketplace | `offer_accepted` | interactive                  |
| `wachuneed.offer.declined`    | martketplace | `offer_declined` | passive                      |
| `kuestions.question.answered` | kuestions    | `answered`       | interactive                  |
| `kuestions.question.frothed`  | kuestions    | `frothed`        | passive                      |
| `booth.set.frothed`           | booth        | `frothed`        | passive                      |

Plus **`mates.request.sent` and `mates.request.accepted`**, added as declared
listeners with `directed: true` by #1367 — 12 in total. They were hand-wired
until the bus loop learned to forward `directed:` (gap 1 below, now closed).

**Hand-wired subscribers (3)** in the same initializer, below the manifest loop:
`krews.member.joined`, `krews.member.left`, `albutts.album.new_photo`.

The first two are genuine special cases (they target the Krew conversation
itself rather than a 1:1, so the Mate gate can't apply). The third is
hand-wired because of structural gap 2 below — not because it needs to
be. The initializer's own docstring says a new listener should take "a manifest
edit + a source-side publish — no touch to this file", so three of these are
drift from its stated contract.

**Published with no subscriber at all (5).** These fire into the void:

- `huddle.started`, `huddle.ended`, `huddle.room.created`, `huddle.room.retired`
- `krew.post.created`

**Publishes nothing.** Moments emits no korner events, so its three declared
notification types have no source event to route.

---

### The two structural gaps

**1 — `directed:` was not plumbed from the manifest. CLOSED by #1367.**
`Nudges::EventRouter` always accepted `directed:` and correctly bypassed the
Mate gate for it (spec § _Relevance engine_ Tier 1: "Fires always — no Mate,
follow, or tune-in test"), but the manifest→deliver mapping in
`nudges_event_bus.rb` never passed it, so every manifest-declared listener was
implicitly `directed: false`. A Tier-1 directed nudge therefore could not be
declared in a manifest at all — which is why the mate-request routes had to be
hand-wired. The bus loop now forwards `directed: entry['directed'] == true`,
and those two routes are declared listens. Gap 2 remains open.

**2 — the manifest path delivers to exactly one recipient.** The subscriber
reads `payload[:recipient_account_id]` and routes to that one account. That
covers Tier 1 (directed) and the "one obvious recipient" shape, but the spec's
other two tiers need fan-out to _many_ recipients computed at delivery time:

- **Tier 2** — everyone who follows or Mates the actor, for surfaced verbs.
- **Tier 3** — everyone tuned into the korner, or watching the object (derived
  from authorship / backing / RSVP / membership), dialed by per-korner loudness
  declared in the manifest.

There is no mechanism for either. So spec Build stage 2 (_Relevance-engine
router_) is **not** built beyond the Tier-1 flag, and per-korner Tier-3 loudness
declarations have nothing reading them. This is the real work in "get Nudges
fully working across all korners" — it is a design step, not a config step,
because it decides who computes the recipient set and when (inline vs a job) for
potentially large audiences.

---

### The second mechanism, which should go

Separately from all of the above, korner manifests declare
`notifications.types` — entries validated against the Mastodon `Notification`
store. `the Nudges spec part of this file` § _Self-delivering delivery (decision B)_ already
decided that store is **legacy-only**: `/nudges/legacy` and the synthetic "Kronk
system" view read it for one release cycle, then it retires with the bell.

Current declarations:

| Korner  | Declared type                 | Registered in `Notification::PROPERTIES`? | Renders anywhere?                          |
| ------- | ----------------------------- | ----------------------------------------- | ------------------------------------------ |
| kommons | `proposal_status_changed`     | yes                                       | yes — `KRONK_SYSTEM_TYPES`                 |
| kommons | `proposal_challenged`         | yes                                       | **no**                                     |
| kommons | `task_assigned`               | yes                                       | **no**                                     |
| albutts | `contribution_rights_granted` | no                                        | no                                         |
| albutts | `album_new_photo`             | no                                        | no — but the event _is_ routed, hand-wired |
| huddle  | `huddle_starting`             | no                                        | no                                         |
| huddle  | `huddle_participant_joined`   | no                                        | no                                         |
| huddle  | `huddle_ended`                | no                                        | no                                         |
| moments | `moments.froth`               | no                                        | no                                         |
| moments | `moments.reply_started`       | no                                        | no                                         |
| moments | `moments.mention`             | no                                        | no                                         |

Two things follow. First, **registering the eight unregistered types would
achieve nothing user-visible** — `proposal_challenged` and `task_assigned` are
already registered, fireable, and rendered nowhere, which is the state
registration alone produces. Second, **the doctor's L10 check enforces
conformance against the retiring mechanism**, so it actively points korner
authors at the wrong half. L10 as written is the reason those eight look like a
work item; they are not one.

`album_new_photo` is the clearest illustration: the manifest declares it as a
`Notification` type (unregistered, invisible), while the actual event
`albutts.album.new_photo` is already routed to Nudges by a hand-wired
subscriber. The same concept is declared once in the dying path and implemented
once in the live one.

---

### Proposed order of work

Smallest and safest first. Stages 1–3 are mechanical and low-risk; stage 4 is
the design step and should not be started before it is agreed.

1. ~~**Plumb `directed:` through the manifest** (gap 1), then move
   `mates.request.sent` / `mates.request.accepted` from hand-wired to
   declared.~~ **Done — #1367.** The hand-wired block is down to three, of which
   only `albutts.album.new_photo` is there for a reason stage 4 would remove.
2. **Decide Huddle's four events and `krew.post.created`.** Each is either a
   manifest entry (verb, interaction, CTA, aggregation) or an explicit decision
   that it is not nudge-worthy — publishing an event nobody consumes is the
   thing to stop. `huddle.started` is the obvious keeper.
3. **Retire `notifications.types` from the manifests, and repoint doctor L10 at
   the bus** — validate that a korner's declared nudges resolve to a published
   event and a listens entry, instead of to `Notification::PROPERTIES`. Move
   `albutts.album.new_photo` to a declared entry in the same pass. This leaves
   **one** mechanism and a doctor that enforces it. `Notification` stays for
   `legacy: true` history and the sunsetting Kronk-system view only.
4. **Build the relevance engine** (gap 2) — Tiers 2 and 3, per-korner loudness,
   preferences and mutes. This is spec Build stages 2–4 and needs a decision on
   recipient-set computation before code.

Moments sits behind stage 4 in practice: it publishes nothing today, and its
three declared types are froth / reply / mention — Tier-1-directed shapes that
would work once it publishes events, but which also want the froth path
Moments now shares with `Favourite` (per `decisions.md` 2026-08-09) rather than
a bespoke type.

### Open questions for Tal

- **Tier-2/3 recipient computation** — inline in the subscriber, or a job? A
  Tier-3 event on a well-subscribed korner could fan to most of the instance.
- **Huddle's four events** — which are nudge-worthy, and is `huddle.started`
  directed (to invitees) or Tier-3 (to tuned-in members)?
- **`krew.post.created`** — a nudge to the Krew conversation, or is the post
  itself already the signal?
- Whether stage 3 should also drop the now-unused `interactive:` /
  `default_push:` / `aggregation:` metadata from `notifications.types`, or
  migrate that metadata onto the corresponding `listens:` entries (aggregation
  already exists there; per-type push does not).

---

## Retiring legacy notifications

_Merged into this file on 2026-10-04 from `docs/spaces/nudges.md (Retiring legacy notifications)`; its own status notes and dates are kept as written._

> **Freshness.** Inventory last checked **2026-08-12** against `9a95e6c8`.
> Re-check with:
>
> ```
> grep -rl Notification app/ lib/ --include=*.rb | grep -v spec | wc -l   # backend surface
> grep -rn 'LocalNotificationWorker\|NotifyService' app/ lib/ --include=*.rb | grep -v spec
> grep -c 'legacy: true' app/models/notification.rb                       # legacy type count
> ```
>
> If it disagrees, **correct this doc in your current PR** —
> `decisions.md` 2026-08-12 (decision 6).

**Status: plan, nothing built.** Revised 2026-08-12 after Tal answered the three
open questions the first draft raised. Those answers **remove the blocker** the
draft had identified, and shrink the job substantially. See §2.

Context: `docs/spaces/nudges.md (Nudges spec)` § _Self-delivering delivery_ made the Mastodon
`Notification` store legacy-only. `docs/spaces/nudges.md (Delivery: state of play)` covers the
korner half; this plan is the whole surface.

---

### 1. What the old system actually is

Not a Kronk subsystem. `Notification` is core Mastodon, carrying the social,
moderation and federated notification sets.

**22 registered types — 17 legacy, 5 Kronk-native:**

|                 | Types                                                                                                                                                                                                                                                |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **legacy (17)** | `mention`, `status`, `reblog`, `follow`, `follow_request`, `favourite`, `poll`, `update`, `quote`, `quoted_update`, `severed_relationships`, `moderation_warning`, `annual_report`, `admin.sign_up`, `admin.report`, `event_invitation`, `media_tag` |
| **native (5)**  | `nudge`, `proposal_status_changed`, `proposal_challenged`, `task_assigned`, `email_confirmation_reminder`                                                                                                                                            |

**Backend — 79 Ruby files** (excluding specs): services 20, controllers 16,
models 13, workers 9, lib 9, serializers 8, mailers 1. **Frontend — 126 files**;
`features/notifications_v2/` alone is 25.

**Producers.** Mostly not Kronk code: `LocalNotificationWorker` →
`NotifyService`, called from the ActivityPub activity handlers (`Like`, `Follow`,
`Announce`, `QuoteRequest`), `FeedInsertWorker`, `PollExpirationNotifyWorker`,
`BlockDomainService`, `FollowMigrationService`; moderation from
`Admin::AccountAction` / `Admin::StatusBatchAction`. Kronk-written:
`Kronk::KornerNotifier` and `Kronk::ProposalStates`.

**Consumers:** in-app, `Web::PushSubscription`, `NotificationMailer`,
`Api::V1::Nudges::LegacyArchiveController` (`/nudges/legacy`), and
`nudges_messenger/kronk_system.ts` (`KRONK_SYSTEM_TYPES`).

### 2. Decisions taken (Tal, 2026-08-12)

The first draft flagged four unanswered categories and a hard prerequisite.
Three answers landed, and they change the shape of the work:

1. **Federation is deferred** — Kronk will not federate for a while, so plan as
   local-only.
2. **Moderation is deferred** — community moderation for the near future; a
   system/moderation channel is a later problem.
3. **The goal, stated plainly:** a user is notified when **anything happens with
   their content** — replies, reactions, nudges, mate requests, and so on.

#### Why (3) removes the blocker

The draft said nothing could start before **multi-recipient fan-out**. That was
right for the spec's full relevance engine and **wrong for this goal**.
"Something happened to _my_ content" has exactly one recipient: the owner. It is
Tier-1 **directed** in the spec's terms — fires regardless of Mate status — and
the manifest path already delivers that, single-recipient, since #1367 plumbed
`directed:` through.

Fan-out is only needed for the _discovery_ tiers — Tier-2 "someone I follow did
a thing" and Tier-3 "something happened in a korner I tuned into". Those are a
different feature, and they are **out of scope here**.

So the work is **additive publishers plus manifest entries**, on machinery that
already exists. No new delivery architecture.

### 3. What has to be built

Every one of these is a directed, single-recipient nudge to the content owner.

| Event to publish                                                           | Fires when                   | Exists?                                                                                                            |
| -------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `status.frothed`                                                           | someone froths your post     | **no** — `Favourite` publishes only korner-scoped froths (booth / kommons / kuestions), nothing for a plain status |
| `status.replied`                                                           | someone replies to your post | **no**                                                                                                             |
| `status.mentioned`                                                         | someone mentions you         | **no**                                                                                                             |
| `status.reblogged`                                                         | someone boosts your post     | **no**                                                                                                             |
| `status.quoted`                                                            | someone quotes your post     | **no**                                                                                                             |
| mate request / accept                                                      | —                            | **yes**, declared with `directed: true` (#1367)                                                                    |
| korner activity (backed, commented, answered, offered, RSVP'd, new photo…) | —                            | **yes**, 12 manifest listeners                                                                                     |

`Favourite` is the model to copy: it already publishes on create and branches by
what the status is backed by. Plain statuses need the fallback branch it lacks.

**Not in scope, by §2:** federated activity, moderation/admin/system messages,
`poll`, `annual_report`, and the Tier-2/3 discovery tiers.

### 4. What "remove the legacy code" should mean here

**Recommendation: stop writing to the store; do not drop it yet.**

- **Leave the ActivityPub handler calls alone.** They are dormant while Kronk
  doesn't federate, they cost nothing dormant, and they live in upstream files —
  the repo's own code rules say don't modify upstream unnecessarily, and leaving
  them keeps re-federation cheap when it comes.
- **Keep a residue reading the store** for the deferred categories:
  `moderation_warning`, `severed_relationships`, `admin.*`, `annual_report`,
  `email_confirmation_reminder`. Per §2.2 these have no new home, and inventing
  one now is exactly the work Tal deferred. The `/nudges/legacy` tab and the
  Kronk system pane stay until moderation is faced.
- **Do remove what we own and have replaced:** `Kronk::KornerNotifier` and the
  three Kommons native types once their events run on the bus, plus each
  migrated social type's write path.

Dropping the table is the last few percent of the value and carries the most
risk. It waits for the moderation decision.

### 5. Order

| #   | Phase                                                                                                                                                                                             | Blocked by |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 1   | **Render what already fires.** `proposal_challenged` and `task_assigned` are registered, fire, and display nowhere. Small, independent, and road-tests the surface before anything depends on it. | —          |
| 2   | **Publish the five `status.*` social events** and declare them as `directed: true` listens. Behind a flag, dual-running against `Notification` so the two can be compared on real traffic.        | —          |
| 3   | **Render them** in the conversation stream (froth/reply/mention/boost/quote as inline nudges, per spec § Surfaces 3). Decide whether bare froths aggregate — the spec leaves it open.             | 2          |
| 4   | **Cut the legacy write path** for the migrated types once dual-run is clean. Retire `Kronk::KornerNotifier`; drop the 3 Kommons native types.                                                     | 3          |
| 5   | **Korner notifications fully onto `delivery: nudge`**, retiring the last `planned:` entries as their features land.                                                                               | 2          |
| 6   | _Later, after the deferred decisions:_ moderation/system channel, push + email, Tier-2/3 fan-out, and only then the store itself.                                                                 | §2.1, §2.2 |

**Phases 1 and 2 can both start now.**

### 6. Sequencing traps

- **Don't delete `notifications.types` from manifests** — it drives the
  per-korner push toggles (`Api::V1::KornersController#push_preferences`) and the
  aggregation windows (`Nudges::Aggregator.window_for`, matched by `name`). This
  nearly happened; see #1404.
- **Don't remove types from `PROPERTIES` while rows reference them** — orphaned
  rows break serialization on read, including the archive still in use.
- **`notifications_v2/` is not dead code** — it renders the legacy tab, which
  §4 keeps for the deferred categories.
- **Dual-run before cutting (phase 2 → 4).** A social notification silently not
  firing is invisible until a user complains.
- **Froth is `Favourite`, not a bespoke model.** Moments moved off its private
  froth model on 2026-08-09 (`decisions.md`); publish from `Favourite` so every
  content type is covered once.
- **The suite is red** — 43 distinct failures on `rebuild/2.0.0`, so a regression
  here would not stand out (`decisions.md` decision 1).
