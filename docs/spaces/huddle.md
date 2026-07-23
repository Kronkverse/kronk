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
it around **two categories of hangout space** (Phase 9). No
free-form per-user Huddles — every Huddle is either the universal
Main Huddle, or attached to a Krew (Group).

### Two categories of Huddle

**The Main Huddle — perpetual, universal.** One room, always open,
everyone welcome. It is not started, it is not ended — it simply
exists. The Main Huddle is joined, never created. Landing on
`/hub/huddle` surfaces it as the always-there entry point at the top
of the page. This is the "campfire" of Kronk — walk up any time,
someone might be there.

**Krew Huddles — one per Krew (Group).** When a user creates a Krew
they see a checkbox: *"Add a Huddle space for this Krew?"* If checked,
the Krew gets its own Huddle attached at creation. If unchecked, any
member of the Krew can instantiate one later from the Krew's page.

Each Krew Huddle is scoped to that Krew's members — only members can
join. Every joinable Huddle for a given user (the Main Huddle + the
Huddles of every Krew they're in) appears in their `/hub/huddle` page
as a list.

Model-wise these are all distinct Jitsi-style rooms; the Main Huddle
is a singleton room, Krew Huddles are `HuddleSession` rows linked to
their owning `Group`.

### Media

Full stack — **audio + video + screen share**. Each participant
chooses per-modality what they broadcast (mic on/off, camera on/off,
share screen). No modality is required; you can join silent-lurker.

### Data model (Phase 9.1 + 9.2)

`huddle_sessions` and `huddle_participants` become the canonical
tables. `huddle_sessions` gains a `scope` (`main` singleton row or
`krew`, linked via `group_id`) and drops the Event dependency. Data
migration moves existing `event_type: :huddle` rows into
`huddle_sessions`. `events.huddle_session_id` stays as an optional FK
so a Kalendar event can point at a Huddle (see open decisions —
attachment scope TBD). `Event.event_type: :huddle` retires.

### Discovery

- **Main Huddle** — top of every user's `/hub/huddle` page. Always
  visible, always joinable, no gating.
- **Krew Huddles** — listed on `/hub/huddle` beneath the Main Huddle,
  one entry per Krew the user is a member of (with occupancy count).
  A user only ever sees the Krew Huddles they're eligible for.

### Cross-korner event bus (Phase 9.3)

Introduce `Kronk::KornerEvents.publish/subscribe`. The manifest
declares `emits: [huddle.started, huddle.ended, huddle.participant.joined]`
(`HuddleSession#start!`/`#end!` publish `huddle.started`/`huddle.ended`);
Groups listens to update member-online indicators.

**Kalendar interplay — Krew-mediated, not Huddle-direct.** Kalendar
Events do **not** attach Huddles directly. Instead, attending an
Event is the mechanism by which a user gets access to a Krew, and
therefore to that Krew's Huddle. The vision wants no direct
Event→Huddle link (Events belong to Krews, Krews own Huddles, so the
chain is Event → Krew → Krew Huddle) — but note this is **unresolved
against the code**: `events.huddle_session_id` still exists as a column
+ index in `db/schema.rb`, so the "drop the FK" step has not landed.
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
The Main Huddle's room *identity* persists (it's always there), and
Krew Huddles' *rooms* persist as long as the Krew does — but the
content of every session vanishes with the participants. Huddles are
the moment, not the artefact.

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
  Krew *remove* its Huddle if it goes unused, and does that need
  governance?

## Related drafts

- `../rebuild/implementation_plan.md` — the rebuild plan (Phase 9: Huddle korner split; event-bus wiring to Kalendar/Groups).
- `../kronk_korner_spec.md` — the korner framework spec (inter-korner events §6).
- Related korner: `groups.md` (Krews own Huddle spaces)
