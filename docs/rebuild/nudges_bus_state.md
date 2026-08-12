# Nudges delivery — state of play and the path to one mechanism

**Status: assessment, no code changed.** Written 2026-08-12 from the code at
`rebuild/2.0.0` tip `8bef674`, after the korner-doctor audit (#1357 / #1361)
surfaced eight korner notification declarations that can never fire. The
headline: **the good architecture already exists and works** — the problem is
that a second, retiring mechanism is still declared in manifests and still
enforced by the doctor, so there are two ways to do this and korner authors are
being pointed at the wrong one.

The normative spec is [`../kronk_nudges.md`](../kronk_nudges.md); this document
is the gap between that spec and the code, plus a proposed order of work. It
decides nothing — the open questions are marked and are Tal's.

---

## The mechanism that is right, and works

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

## What is actually wired — full inventory

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

**Hand-wired subscribers (5)** in the same initializer, below the manifest loop:
`krews.member.joined`, `krews.member.left`, `albutts.album.new_photo`,
`mates.request.sent`, `mates.request.accepted`.

Only the first two are genuine special cases (they target the Krew conversation
itself rather than a 1:1, so the Mate gate can't apply). The other three are
hand-wired because of the two structural gaps below — not because they need to
be. The initializer's own docstring says a new listener should take "a manifest
edit + a source-side publish — no touch to this file", so three of these are
drift from its stated contract.

**Published with no subscriber at all (5).** These fire into the void:

- `huddle.started`, `huddle.ended`, `huddle.room.created`, `huddle.room.retired`
- `krew.post.created`

**Publishes nothing.** Moments emits no korner events, so its three declared
notification types have no source event to route.

---

## The two structural gaps

**1 — `directed:` is not plumbed from the manifest.** `Nudges::EventRouter`
accepts `directed:` and correctly bypasses the Mate gate for it (spec § _Relevance
engine_ Tier 1: "Fires always — no Mate, follow, or tune-in test"). But the
manifest→deliver mapping in `nudges_event_bus.rb` never passes it, so every
manifest-declared listener is `directed: false` and subject to the Mate gate.
Consequence: **a Tier-1 directed nudge cannot be declared in a manifest** — it
has to be hand-wired. That is exactly why `mates.request.sent` and
`mates.request.accepted` sit in the hand-wired block.

This is a small, contained fix: accept `directed: true` on a listens entry and
pass it through.

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

## The second mechanism, which should go

Separately from all of the above, korner manifests declare
`notifications.types` — entries validated against the Mastodon `Notification`
store. `kronk_nudges.md` § _Self-delivering delivery (decision B)_ already
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

## Proposed order of work

Smallest and safest first. Stages 1–3 are mechanical and low-risk; stage 4 is
the design step and should not be started before it is agreed.

1. **Plumb `directed:` through the manifest** (gap 1), then move
   `mates.request.sent` / `mates.request.accepted` from hand-wired to declared.
   Shrinks the hand-wired block to the two genuine Krew special cases.
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

## Open questions for Tal

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
