# In Flow (`in_flow`)

**Manifest:** `config/korners/in_flow.yaml` · **Mount:** `/hub/in_flow` · **Status:** in-flight (Phase 10.1) — Round 1 with Tomas complete, Round 2 pending

> **State as of alpha.54 (2026-07-18):** The `kosmic_updates` model, feed
> projection card (`kosmic_daily_card`), event bus emission
> (`in_flow.kosmic_update.published`), notification type
> (`inflow_daily_posted`), and settings (`daily_delivery_time`,
> `strands_of_interest: [light, dark, soil, season]`) all ship in the
> manifest. Design decisions with Tomas below are for the *next-slice
> reshape*, not the initial code — the plumbing is live regardless.
> One tension worth flagging: the manifest still has all four strands
> as settings options, but Tomas's Round 1 wants the four-strand tab
> structure retired in favour of a unified dashboard. Waiting on his
> Round 2 responses to resolve.

## Purpose

In Flow is the space in Kronk for being **in flow with the kosmos** —
attuning to the rhythms that exist around and within us (birds, sun,
moon, stars, seasons) and interacting with them meaningfully.

The animating philosophy is **observe + interact**:

- **Observe** — attune to what's happening around and within (natural
  cycles, celestial events, ecological patterns).
- **Interact** — respond via planting, contemplation, shared
  observation, or social contribution.

In Flow deliberately **errs away from prescription** (unlike much of
astrology, which tells users what to do) and toward **invitation and
agency**. The daily update doesn't say "you should do X today"; it
surfaces what's happening and invites a response.

**Ideal user (draft):** someone already interested in ecology,
planting, photography, seasonal awareness. In Flow is a space to
build and deepen that passion; it offers something of value to people
already oriented toward those interests. (Tomas is still refining
this framing.)

## Current shape (1.7.x)

- Manifest at `config/korners/in_flow.yaml` — describes as
  "celestial navigation + daily Kosmic Update".
- Resources: `observations` (primary, existing) + `kosmic_updates`
  (new, being added in Phase 10.1).
- Storage namespace: `kosmic_`.
- Frontend at `app/javascript/mastodon/features/in_flow/` — currently
  organised as **four strand tabs**: light / dark / soil / season,
  with per-strand components (LightStrand, DarkStrand, EarthStrand,
  FestivalStrand). Uses celestial icons.
- No emits/listens on the manifest yet.

## Rebuild vision (2.0.0)

_Based on Tomas's Round 1 response, 2026-07-16. Iterative; several
areas explicitly still-refining._

### Retire the four-strand tab structure — unified dashboard

The four strands (light / dark / soil / season) as separate tabs
**separate what should be woven together**. In Flow 2.0 moves toward
a **unified dashboard/panel** where all four dimensions surface
together and their **interactions with each other** are visible
(e.g., current lunar phase influences soil chop-and-drop timing;
season shapes what's available to plant).

The tabbed structure retires; the panel treatment consolidates.

### Soil — the depth-focus strand

Community feedback identifies **Soil** as the biggest attractor. It
gets **deeper development** in 2.0:

- **Chop-and-drop timing** — the dashboard shows when to and when
  not to (e.g., not during full moon, when water is in the limbs
  not the roots).
- **More plants** — expand the planted / harvest catalogue.
- **Locally-occurring edible and medicinal plants** — regionally
  aware plant surfacing.

Bringing users into deeper harmony with working with nature is
Soil's mandate.

### Observations — user-generated response to kosmic prompts

The daily update **invites a response**, not prescribes an action.
Users respond with:

- A photo (sunrise, a bird, a plant, the moon)
- A journalled reflection
- An insight / poem / short piece
- Something they planted or harvested (photo + note)

This turns In Flow into a **participatory attunement space** — the
daily kosmic update is a prompt, the observations are the community
answering.

**Data integration** (aspirational, TBD): aggregated observations
form a **collective informational resource** — what's happening
individually, communally, ecologically, celestially, across the
network. Precious data if we can integrate it well.

### Kosmic Update — dynamic, subscribable, ephemeral in feed

The daily update evolves from static-templated toward:

- **Dynamic content synthesis** — takes the key points of that moment
  in time (celestial, seasonal, ecological, whatever is genuinely
  interesting *right now*) and synthesises into a single update.
  **Not always about the moon** if nothing interesting is going on
  with the moon.
- **Subscribable** — users toggle Kosmic updates on/off.
- **Ephemeral in the main feed** — appears in the feed for X days,
  then removed. Not permanent Home clutter.
- **Persisted on the In Flow "profile"** — after leaving the feed,
  the update lives on an In Flow-specific profile surface (see
  below).

### In Flow as a new form of "profile"

Tomas is exploring whether **In Flow becomes a new form of profile**
rather than a standalone korner space:

- An In Flow "profile" looks/feels distinct from an individual
  Kronk profile.
- Archived Kosmic updates live here.
- A user's observations (their responses to prompts) live here.
- Accessible from side navigation like any other profile-shaped
  surface.

If someone engages with the daily update, that engagement might
surface on their friends' pages for a day or few — a way for
observations to ripple socially.

### Deep Kalendar coupling

In Flow and Kalendar are **tightly coupled**:

- **In Flow → Kalendar**: In Flow projects celestial rhythms (moons,
  solstices, equinoxes, key ecological turnpoints) into Kalendar.
  Locked in per `kalendar.md`.
- **In Flow ← Kalendar**: local events (community planting days,
  full-moon gatherings) surface in the In Flow dashboard when
  relevant.

Exact projection contract still to be defined; will materialise as
Phase 10.1 work lands.

### Aesthetic + language

Written language across In Flow needs another pass — Tomas notes it
still needs work. Aesthetic rebuild in line with Kronk 2.0 tokens.
Coordinating on visual/mockup work through Claude web track.

## Open decisions

_(Round 2 questions being sent back to Tomas — see below.)_

- **"In Flow as profile"** vs "In Flow as korner space" — is the
  In-Flow-as-profile direction the primary shape, or does In Flow
  remain a distinct korner space with a dashboard AND some
  profile-surface accretion?
- **Gamification of responses** — Kosmic points? Or a Kronk-native
  frame? Or no gamification, and observations are their own reward?
- **Observations data integration** — public aggregate feed, private
  to the user, opt-in collective research? What are the audiences?
- **Kosmic update lifecycle timing** — how many days in the main feed
  before it's archived to the In Flow profile? 1 day? 3? 7?
- **Locality/geo** — location-aware content (e.g., locally edible
  plants) is a stretch goal. What's the minimum locality primitive
  needed to make Soil work well? Deferred until V2 direction is
  confirmed per Tomas.
- **Retirement of `observations` model** vs evolution — the current
  `observations` primary resource still fits the new frame (it's
  literally what users produce), so likely evolves rather than
  retires. Confirm.
- **Live data streams integration** — Tomas notes this needs work;
  what's the source-of-truth for celestial + ecological data
  (ephemerides library? external API? Kronk-authored yaml)?

## Related drafts

- `/home/shared/rebuild/plan/quiet-napping-hare.md` §Phase 10.1 (kosmic_updates + daily scheduler)
- `/home/shared/rebuild/spec/kronk_korner_spec.md` §In Flow
- `/home/shared/rebuild/memory/project_kronk_rebuild_feed_projection_spec_draft.md` (Kosmic update projection into feed)
- Related korners: `kalendar.md` (In Flow → Kalendar celestial projection), `nudges.md` (potential push channel for daily update subscribers)
