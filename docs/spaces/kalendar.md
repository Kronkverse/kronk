# Kalendar (`kalendar`)

**Manifest:** `config/korners/kalendar.yaml` · **Mount:** `/hub/kalendar` · **Status:** 1.7 carry (rebuild in progress)

## Purpose

Kalendar is about **mapping the rhythms of the shared space** — the
communal almanac. What lands here isn't only user-created events but
also **birthdays, full moons, seasonal turnpoints**, and other ambient
rhythms that the community lives inside. It's less "RSVP tool" and
more "here's what's happening in and around us".

- **User events** — parties, gigs, meetups, workshops, gatherings.
- **Personal rhythms** — birthdays visible in the calendars of people
  who share space with the birthday-person.
- **Celestial/natural rhythms** — full moons, solstices, seasonal
  turnpoints, other cosmic markers.

This shifts Kalendar from "event coordination surface" to "community
almanac surface". Events remain a first-class citizen; they share
Kalendar with ambient rhythms.

## Current shape (1.7.x)

Kalendar today is event-centric:

- `Event` model at `app/models/event.rb` — title, description,
  location, start/end times, cover image, optional Status linkage,
  optional parent_event for recurrences.
- `EventRsvp` — RSVP states `going`, `interested` (going_accounts,
  interested_accounts relations).
- `EventInvitation` — explicit invite roll.
- Recurring events via `parent_event_id` / `occurrences`.
- `event_type: :event | :huddle` — Huddle piggybacks (retires in
  Phase 9, see `huddle.md`).
- Emits `kalendar.event.created` to the framework event bus.
- Searchable via `Kronk::Search` (indexed in `kalendar_events`).
- No birthdays, no celestial, no ambient rhythms in the model today.

## Rebuild vision (2.0.0)

### Multi-source rhythm mapping

Beyond user-created events, Kalendar surfaces:

- **Birthdays** — users can post their birthday and pick who sees it
  from the standard Kronk visibility scopes: **public / mates /
  specific Krew(s) / direct-invite**. Alice's birthday appears in the
  Kalendars of accounts that fall within her chosen visibility scope.
  (See memory `reference_kronk_vocab_mates.md` — Kronk is shifting from
  followers to "mates" as its social primitive; visibility settings
  themselves are mid-redesign platform-wide.)
- **Celestial rhythms** — full moons, solstices, equinoxes, and other
  cosmic markers. **Projected from Inflow.** Inflow owns the
  canonical source; Kalendar subscribes and renders. Cross-korner
  emit/listen wiring: Inflow emits (e.g., `inflow.rhythm.published`),
  Kalendar listens and materialises the entry in the calendar view.

These non-event rhythms are Kalendar-first-class alongside `events` —
same view surface, different rendering treatment.

### Events — individual host, optional Krew spawn

Events have an **individual host** (an Account), not a Krew. The
current `Event.account_id` FK stays.

At event creation the host sees a checkbox:
_"Spawn a Krew for attendees?"_ If checked:

- A Krew is created **at event creation** (not deferred to first
  RSVP). Only the host is a member initially.
- **Name is derived from the event:** `"[Event name] Krew"`. Immutable
  once created, per Krew rules — so it's fixed the moment the event
  is created.
- Anyone who RSVPs to the event is **auto-added to the Krew**.
- Attendees can opt out of the Krew at any time without cancelling
  their RSVP (see `groups.md`).
- The Krew persists after the event ends (Krews persist forever;
  event-associated Krews are not special-lived).

If unchecked, the event runs with no attached Krew — attendees just
RSVP and show up. No Krew-scoped post channel, no auto-Huddle-access.

### Event visibility

**Creator's choice.** The event host picks visibility at creation from
the standard Kronk visibility scopes:

- **Public** — anyone can see + RSVP; listed in the public directory;
  indexed in Kronk::Search.
- **Mates** — visible only to the host's mates (the "mates"
  primitive is replacing followers platform-wide; see memory
  `reference_kronk_vocab_mates.md`).
- **Krew-scoped** — visible only to members of one or more specified
  Krews. Non-members don't see the event at all.
- **Direct-invite** — visible only to accounts explicitly invited via
  `EventInvitation`. Not listed; not searchable.

Kalendar's visibility scopes align with the broader Kronk visibility
scopes for posts and birthdays.

> **Not yet shipped.** These four scopes are aspirational. The shipped
> `create_event_form.tsx` uses the standard 4-option Mastodon
> visibility select — Public / Unlisted / Followers only / Mentioned
> only — and `db/schema.rb` has no Krew-spawn or visibility-scope
> columns on `events` yet.

### RSVP states — "Be there or be square"

Three states, with Kronk-native labels that play on the old
"be there or be square" line:

- **"I'll be there"** — attending. Shown to others as _"X will be there"_.
- **"I'm a round"** — maybe (pun: "I'm around" + geometric shape).
- **"I'll be square"** — not attending, declined.

The shipped `EventRsvp` enum is `going / interested / not_going`
(`app/models/event_rsvp.rb`) — the playful labels above are aspirational
copy, not yet built; the UI still shows the plain states.

### Recurring events

Kept as-is from the 1.7 model. `Event.parent_event_id` + `occurrences`
association stays. Weekly jams, monthly book clubs, and other
recurring gatherings are core to the "community rhythm" Kalendar is
built for. The recurrence **UX** may get refinement in the 2.0 sweep
(compose flow, edit-one-vs-edit-all handling) — the data model does not.

### Huddle decoupling (Phase 9)

`Event.event_type: :huddle` retires per `huddle.md`. Kalendar no
longer knows about Huddles directly. Instead, a Krew-associated event
gives attendees access to the Krew's Huddle via the Krew membership
chain (Event → Krew → Krew Huddle). The
`events.huddle_session_id` column may retire entirely, or become an
unused legacy column pending cleanup.

### Discovery

- **Public directory** at `/hub/kalendar` — upcoming public events
  listed chronologically. Anyone can browse.
- **Feed projection** — event cards appear in Home feeds when someone
  in your network hosts or RSVPs to an event. Social-graph-driven
  surfacing alongside the directory.
- **Kronk::Search** — events already indexed; universal search
  returns events as a result group.
- (Personal "my Krews' events" default view — not the primary
  discovery lens; Kalendar leans social/discovery-oriented rather
  than personal-agenda-oriented.)

### View mode — spiral + chronological list

The primary Kalendar view is a **spiral** — a Kronk-native visual
metaphor being designed (with Claude web). Alongside the spiral,
events surface as a **chronological list** for direct scanning of
what's coming up. Both views draw from the same underlying data:
user events + birthdays + celestial rhythms, weaved together.

The spiral view is one of the rebuild's distinctive visual designs;
mockups and interaction spec come out of the Claude web track.

### Aesthetic

Rebuild event listing + event page in line with current Kronk
aesthetic tokens (post-planet-metaphor). Coordinating on visual
mockups with Claude web.

## Open decisions

- **Inflow → Kalendar projection contract** — exact event name(s),
  payload shape, and which celestial markers are canonical
  (moons + solstices + equinoxes minimum; anything else?). Will be
  refined in `inflow.md`.
- **Birthday capture UX** — where does a user set their birthday +
  its visibility? Profile? Settings? A per-user dialog on first-run?
  Related to the platform-wide visibility-settings redesign.
- **Recurring events UX refinements** — edit-one vs. edit-all,
  exceptions, cancelling an occurrence without the series. Data
  model stays; interaction spec needs a pass.
- **Spiral view spec** — visual mockup + interaction spec comes from
  the Claude web track; capture the contract here once landed
  (zoom levels, event density handling, tap-to-open, etc.).

## Related drafts

- `../rebuild/implementation_plan.md` — the rebuild plan (Phase 9: Huddle decouple; Phase 10.1: InFlow kosmic overlap).
- `../kronk_korner_spec.md` — the korner framework spec.
- Related korners: `huddle.md` (Huddle-decouple + Event → Krew → Huddle chain), `groups.md` (Krew spawn from RSVPs), `inflow.md` (potential celestial overlap — TBD)
