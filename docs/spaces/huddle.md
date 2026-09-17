# Huddle (`huddle`)

**Manifest:** `config/korners/huddle.yaml` · **Mount:** `/hub/huddle` · **Status:** in-flight (Phase 9)

## Purpose

Huddle is a **digital hangout space** — live, low-friction, come-and-go.
Somewhere between a Discord voice channel and a shared campfire: users
drop in to be around each other, chat, work in parallel, share a
moment. Not a meeting; not a livestream; a hangout.

## Current shape (1.7.x)

Huddle currently piggybacks on Kalendar's Event polymorphism —
`Event.event_type: :huddle` marks an Event as a Huddle-flavoured
gathering. Models `HuddleSession` and `HuddleParticipant` exist
(`app/models/huddle_session.rb`, `app/models/huddle_participant.rb`),
linked from Event via `huddle_session_id`. Frontend has a
picture-in-picture surface at `features/huddle_pip/`.

The polymorphism means "Huddle" and "Event" are tangled: creating a
Huddle today means creating an Event with `event_type: :huddle`, which
mixes the ambient-hangout affordance with the deliberate
schedule-a-thing-in-Kalendar affordance.

## Rebuild vision (2.0.0)

The 2.0 rebuild decouples Huddle from Event polymorphism and reshapes
it around **three categories of hangout space** (Phase 9): the
universal Main Huddle, open topical Rooms, and Krew Huddles. No
free-form per-user private Huddles — hangouts are either shared open
spaces or Krew-scoped.

### Three categories of Huddle

**1. The Main Huddle — perpetual, universal.** One room, always open,
everyone welcome. It is not started, it is not ended — it simply
exists. The Main Huddle is joined, never created. Landing on
`/hub/huddle` surfaces it as the always-there entry point at the top
of the page. This is the "campfire" of Kronk — walk up any time,
someone might be there.

**2. Rooms — open, topical, user-created.** Themed hangout spaces
that anyone signed in can join: Coworking, Meetings, Music &
sound, Late-night, Reading room, etc. Same shape as the Main Huddle
(perpetual room identity, ephemeral session content) but themed by
purpose rather than by "everyone".

- **Anyone can create a Room** — one-tap "New Room" affordance on
  `/hub/huddle`. The creator names it and (optionally) adds a
  one-line description and an emoji or icon. No governance gate on
  creation; Rooms are cheap.
- **Anyone can join** — no membership, no invite, no gating. If the
  Room exists and isn't at capacity, you're in.
- **Auto-retire after 6 months of no use.** A Room with no session
  activity (nobody has joined it) for 6 continuous months is
  retired by the reaper. The row is soft-deleted so any historical
  reference (e.g. a Kalendar Event that once pointed at it) stays
  resolvable; discovery drops it from the list. If people come back
  to a retired Room, they create a new one — the identity is not
  precious, the moment is. See § Data model for the `last_active_at`
  column.

**3. Krew Huddles — one per Krew (Group).** When a user creates a Krew
they see a checkbox: _"Add a Huddle space for this Krew?"_ If checked,
the Krew gets its own Huddle attached at creation. If unchecked, any
member of the Krew can instantiate one later from the Krew's page.

Each Krew Huddle is scoped to that Krew's members — only members can
join. Every joinable Huddle for a given user (the Main Huddle + open
Rooms + the Huddles of every Krew they're in) appears on their
`/hub/huddle` page as a list.

Model-wise these are all distinct Jitsi-style rooms:

- Main Huddle → singleton `HuddleSession` row (`scope: :main`).
- Rooms → `HuddleSession` rows with `scope: :room`, no `group_id`,
  a `name` and optional `description` + `icon`.
- Krew Huddles → `HuddleSession` rows with `scope: :krew`, linked via
  `group_id`.

### Media

Full stack — **audio + video + screen share**. Each participant
chooses per-modality what they broadcast (mic on/off, camera on/off,
share screen). No modality is required; you can join silent-lurker.

### Data model (Phase 9.1 + 9.2 + 9.6)

`huddle_sessions` and `huddle_participants` become the canonical
tables. `huddle_sessions` gains:

- `scope` — enum `main` (singleton row) / `room` (open topical) /
  `krew` (linked via `group_id`)
- `name` — string, present on `room` and `krew` scopes; nil on `main`
  (Main Huddle's name is always the same)
- `description` — optional short string on `room` scope for the
  themed purpose ("For focused co-work sessions", etc.)
- `icon` — optional emoji or icon token on `room` scope
- `created_by_account_id` — nullable; set on `room` scope
  (attribution, and a creator-side deletion path if we add one),
  unset on `main` / `krew`
- `last_active_at` — updated whenever a participant joins; drives the
  6-month auto-retirement reaper for `room` scope
- `retired_at` — nullable timestamp; set by the reaper; retired rooms
  are excluded from discovery but stay resolvable for old references

Drops the Event dependency. Data migration moves existing
`event_type: :huddle` rows into `huddle_sessions`. `events.huddle_session_id`
stays as an optional FK so a Kalendar event can point at a Huddle
(see open decisions — attachment scope TBD). `Event.event_type: :huddle`
retires.

### Discovery

`/hub/huddle` renders three ordered sections:

- **Main Huddle** — top of the page. Always visible, always joinable,
  no gating.
- **Rooms** — beneath the Main Huddle. Every open, non-retired Room
  with its occupancy count. Ordered by activity (currently-in-session
  Rooms first, then most-recently-active). A "New Room" affordance
  at the end of the list — one tap, name + optional description +
  optional emoji, creates on submit.
- **Your Krew Huddles** — beneath Rooms. One entry per Krew the user
  is a member of (with occupancy count). A user only ever sees the
  Krew Huddles they're eligible for.

### Cross-korner event bus (Phase 9.3)

Introduce `Kronk::KornerEvents.publish/subscribe`. The manifest
declares `emits: [huddle.started, huddle.ended, huddle.participant.joined,
huddle.room.created, huddle.room.retired]`
(`HuddleSession#start!`/`#end!` publish `huddle.started`/`huddle.ended`;
Room creation via `HuddleRoom::CreateService` publishes
`huddle.room.created`; the auto-retire reaper publishes
`huddle.room.retired`); Groups listens to update member-online indicators.

**Kalendar interplay — Krew-mediated, not Huddle-direct.** Kalendar
Events do **not** attach Huddles directly. Instead, attending an
Event is the mechanism by which a user gets access to a Krew, and
therefore to that Krew's Huddle. The vision wants no direct
Event→Huddle link (Events belong to Krews, Krews own Huddles, so the
chain is Event → Krew → Krew Huddle) — but note this is **unresolved
against the code**: `events.huddle_session_id` still exists as a column

- index in `db/schema.rb`, so the "drop the FK" step has not landed.
  The Data-model section above (which keeps the FK as optional) and this
  one disagree; treat the removal as an open decision, not a done fact.
  (Precise semantics of "attending an event introduces you to the Krew"
  — permanent vs event-scoped access — is also open, see decisions below
  and will be refined in `kalendar.md` and `groups.md`.)

### URL move (Phase 9.4)

Huddle UI moves to `/hub/huddle`. Legacy routes 301-redirect.

### Persistence — purely ephemeral

When a Huddle empties or ends, **nothing survives**. No transcript,
no recording, no feed card, no "Alice was in the Krew Huddle" residue.
Session content is always thrown away.

Room _identity_ persists at different lifetimes per category:

- **Main Huddle** — perpetual (singleton, never retired).
- **Rooms** — persist until 6 continuous months of no session
  activity, then the reaper retires them (soft-delete: `retired_at`
  set, row excluded from discovery but historical FKs still resolve).
  If people miss a retired Room, they create it again — the name
  isn't sacred.
- **Krew Huddles** — persist as long as the owning Krew does.

Huddles are the moment, not the artefact.

### Moderation — flat and distributed

**Every participant in a Huddle has moderation powers.** No host role,
no gradient of authority. Any participant can:

- **Mute** another participant (muted user can un-mute themselves
  unless kicked).
- **Remove** another participant from the current session (they can
  rejoin later — no persistent ban from a mid-session kick alone).

Rationale: Huddles are small enough for community norms to carry the
weight, and distributed powers avoid making moderation a prize. No
room-lock, no permanent-ban powers in the initial 2.0 shape — those
would need to route through Krew governance (seeders) if we add them.

### Capacity

- **Main Huddle:** hard cap at Jitsi's practical ceiling (~35
  participants). When full, newcomers see a plain "The Main Huddle
  is full right now — try again soon" message. No overflow rooms, no
  waitlist, no nudges toward alternatives. Clean, unopinionated
  reject.
- **Rooms:** same Jitsi ceiling per Room (~35). Rooms don't shard
  or overflow when full — a Coworking Room at capacity shows the
  same "full right now" message. If a Room fills consistently,
  that's a signal for a Kommons proposal (e.g. "Coworking B" as a
  sibling), not automatic infrastructure sprawl.
- **Krew Huddles:** capacity inherits the Krew's practical scale
  (see `groups.md` for Krew sizing). Same Jitsi ceiling applies per
  room.

### Aesthetic

Rebuild the PiP surface + korner directory in line with the current
Kronk aesthetic tokens (post-planet-metaphor). Coordinating on visual
mockups with Claude web.

## Open decisions

- **Event → Krew semantics** — attending a Kalendar Event grants Krew
  access; is that access **permanent** (RSVP = join the Krew for
  good), **event-scoped** (access only during and shortly after the
  Event), or **user-opt-in** (RSVP + a "stay in the Krew after" toggle)?
  This is really a Kalendar/Groups question; will be refined in
  `kalendar.md` and `groups.md`.
- **When a Krew is archived/deleted** — does its Huddle vanish
  immediately, or persist as read-only-empty for some window?
- **Krews without a Huddle** — Krew creation offers an opt-in checkbox
  and any member can instantiate later; what's the reverse — can a
  Krew _remove_ its Huddle if it goes unused, and does that need
  governance?
- **Room name collisions** — anyone can create a Room, so two people
  could create "Coworking" simultaneously (or one at a time). Do we
  enforce name uniqueness at the DB level, warn client-side on
  create with a "you might mean this existing Room?" hint, or leave
  it alone and let dupes coexist until the reaper picks one off?
- **Can a Room creator delete their own Room?** — the reaper handles
  the 6-month case, but a mistake ("New Roon" typo) shouldn't have
  to wait half a year. Simplest: creator-side delete allowed while
  no session has ever occurred; after first activity, Kommons only.
- **Room attribution** — do we show "created by @tal" on the Room's
  discovery entry? Signals ownership + accountability, but might
  feel more like a property claim than a shared space. Lean: no
  attribution in discovery; who-made-it is one tap away in the
  Room's own header if we surface it at all.

## Related drafts

- `../rebuild/implementation_plan.md` — the rebuild plan (Phase 9: Huddle korner split; event-bus wiring to Kalendar/Groups).
- `../kronk_korner_spec.md` — the korner framework spec (inter-korner events §6).
- Related korner: `groups.md` (Krews own Huddle spaces)
