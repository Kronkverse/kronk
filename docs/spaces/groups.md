# Krew (`krew` — code: `Group`)

**Manifest:** `config/korners/krew.yaml` · **Mount:** `/hub/krew` · **Status:** shipped-2.0 (framework); Phase 1 flipped the URL, Phase 2 renamed the backend (tables `krews`/`krew_memberships`/`statuses_krews`, `Krew` model, `/api/v1/krews`). Phase 3 adds the new capabilities from the brief.

> **Build spec:** [`krew_build_spec.md`](./krew_build_spec.md) — the actionable
> layer (the four UI surfaces with locked decisions, built-vs-needed, build
> order). This file is the full rationale.

## Purpose

A Krew is **audience-scoping for posts** — it lets you share
selectively with a defined group of people. There is **no physical
Krew space** you visit to see Krew posts; the Krew is the _filter on
who sees what_, not a destination.

Concrete examples:

- Post reflections about an event to the event's Krew — only attendees
  see it in their timeline.
- Post an album to the Mayhem Krew — only Mayhem members see it.
- Post "anyone got a lift?" to the event Krew without bothering
  everyone.
- Join the Melbourne Krew to see posts local to Melbourne.

Krews create **networks of intent** so people can be more specific
about who they're posting to.

## Current shape (1.7.x → shipped-2.0)

Substantial framework already in place:

- `Group` model at `app/models/group.rb` with `HABTM :statuses` via
  `statuses_groups` (a Status can target N Krews).
- `GroupMembership` model with `role: 'seeder'` (planted-the-Krew role;
  multiple seeders allowed from creation) vs regular members.
- 5 **governance frameworks** on structural changes (rename, archive):
  `peer_support` (default, one second) / `two_key` (two seconds) /
  `threshold` (N supporters) / `majority` (>50%) / `consensus` (all).
- `slug` + `SLUG_PATTERN` (validated); `discoverable: bool` toggle for
  public listing.
- Searchable via `Kronk::Search` when `discoverable?`.
- Manifest at `config/korners/groups.yaml`; UI at
  `app/javascript/mastodon/features/groups/`.

## Rebuild vision (2.0.0)

### Vocabulary + URL shift

The user-facing name becomes **Krew**. URL and manifest slug shift:

- `/hub/groups` → `/hub/krew`
- `slug: groups` (in manifest) → `krew`
- Feature dir `features/groups/` → `features/krews/`
- Model class stays `Group`, DB table stays `groups` — no rename in
  code/DB (see memory `reference_kronk_vocab_krew.md`).

### Krew visibility + joining

Two visibility states, one auto-join mechanic:

- **Listed** — the Krew appears in the `/hub/krew` directory. **Anyone
  who can see it can join it freely** (tap join → you're in). No
  gate, no approval, no invite required.
- **Unlisted** — the Krew does not appear in the directory and does
  not surface in search. You can only join via a direct **invite/link**
  from a member. Once you have the link, you're in.

**Event-associated Krews** are a special case that layers on top of
either visibility state: RSVPing a Kalendar event that belongs to a
Krew **auto-adds you** to that Krew (opt-out anytime — see Event ↔
Krew below). The Krew's visibility to non-attendees is orthogonal.

There is no "approval-gated" or "seeder-invites-manually" mode — the
directory is the gate. If a Krew is listed, joining is instantaneous.

### No Krew-internal moderation

Krews have no moderation layer of their own. Seeders **cannot remove
members** — leaving is purely voluntary. If someone is disruptive,
members block them individually (using Kronk's account-level block
tool) or leave the Krew themselves. Wider Kronk moderation (reports,
admin action) is the safety net; there is no Krew-scoped
kick/mute/ban.

### Event ↔ Krew — bidirectional

- **Event → Krew (auto-join on RSVP).** When a user RSVPs to a
  Kalendar event that belongs to a Krew, they're **auto-added to the
  Krew**. This gives them: visibility into Krew-scoped posts, the
  Krew's Huddle in their `/hub/huddle` list. They can **opt out of
  the Krew at any time** without affecting their RSVP — leaving the
  Krew doesn't cancel event attendance. Membership is auto-on,
  free-to-leave.
- **Krew → Event visibility.** An event can be created that's
  **visible only to certain Krew(s)**. Non-members of the target
  Krew(s) don't see the event at all.

### Multi-Krew posts + composer

A Status can target multiple Krews (already supported via
`statuses_groups` HABTM). Audience is the **union** of members across
all target Krews — anyone in any one of them sees the post.

**Composer UX:** The existing post-visibility dropdown (public /
followers / direct) gains a **`Krew…`** entry. Selecting it opens a
Krew multi-select of the Krews you're a member of. Krew visibility is
mutually exclusive with the other visibility modes — a post either
goes to a Public/Followers/Direct audience _or_ it goes to one-or-more
Krews, not both. No new composer surface; the change lives inside the
existing dropdown.

### Krew feed surface

Krew-targeted posts appear **inline in your Home timeline** alongside
your regular follows, marked with a small Krew badge that identifies
which Krew(s) the post was targeted to. **No separate Krew feed,
no filter tab, no per-Krew timeline view** — Krews are a filter on
outgoing posts, not a destination. The Krew's page at `/hub/krew/:slug`
shows metadata (members, description, associated events/Huddle), not
a post stream.

### Krew accretion — Huddle owned, rest TBD

Krews already own **Huddle** spaces (opt-in at Krew creation; any
member can instantiate later). Other candidate accretions (Krew-scoped
Kalendar events, Kommons proposals, Booth sets, Wachuneed listings,
Krew-only Kuestions) are **not decided yet** — will be resolved
per-korner as those rebuild docs get written.

### Governance retiring — Krews will be built once, then locked

The 5 governance frameworks
(`peer_support`/`two_key`/`threshold`/`majority`/`consensus`) are
**scheduled for retirement in 2.1.0**. As of alpha.54 the
`governance_framework` column + `GOVERNANCE_FRAMEWORKS` constant +
`threshold_present_when_required` validator are still present in
`app/models/group.rb` — the retirement lives in the 2.1.0 cleanup
migration, alongside the other dual-write column drops.

Rationale for retirement: with Krews reframed as audience filters
(not governed mini-communities), the collective-agency layer is
overbuilt. Once a Krew exists, its **identity is immutable** — no
renames, no framework changes, no seeder-role transitions.

**What stays mutable:**

- **Description** (seeders can edit)
- **Adding a Huddle** (any member can instantiate if there isn't one)
- **Linking a Kalendar event** to the Krew

**What retires from the model (in the 2.1.0 cleanup migration):**

- `GOVERNANCE_FRAMEWORKS` constant
- `governance_framework` column
- `governance_threshold` column
- `threshold_present_when_required` validator
- Any governance-decision UI/model

Event-associated Krews **persist forever** like any other Krew — no
auto-archive tied to event lifecycle.

### Discovery

- **`/hub/krew` public directory** — every discoverable Krew is
  browsable. Filter/search planned; see open decisions.
- **Kronk::Search** — Krews already indexed when `discoverable?`.
  Universal search returns Krews as a result group.
- **Invite links** — invite-only Krews are discovered through explicit
  invitation, not directory.

### Aesthetic

Rebuild the Krew directory + membership UI in line with current Kronk
aesthetic tokens (post-planet-metaphor). Coordinating on visual
mockups with Claude web.

### Size

**No cap on Krew membership.** Krews can be arbitrarily large — a
"Melbourne Krew" with thousands of members is a valid shape. Posting
to a large Krew is a genuine broadcast; no soft warnings or throttles
in the initial 2.0 shape. (Huddle capacity is a separate concern:
individual rooms cap around ~35 regardless of Krew size, see
`huddle.md`.)

## Open decisions

- **Account deletion** — when a member's account is deleted, what
  happens to their Krew-targeted posts? Standard Kronk deletion path
  should handle it, but worth confirming for the audience-scoping case.
- **Krew accretion (Kalendar events, Kommons, Booth, Wachuneed,
  Kuestions)** — will be resolved as each korner's rebuild doc
  materialises.
- **Immutable identity edge cases** — if a Krew is created with a
  typo in its name, is there truly no recourse? (Consider: a
  seeder-only edit on name/slug within N minutes of creation, to
  catch typos before members join.)

## Related drafts

- `../rebuild/implementation_plan.md` — the rebuild plan (Phases 7.5–7.7: Groups).
- `../kronk_korner_spec.md` — the korner framework spec (Groups as a framework primitive).
- Related korners: `huddle.md` (Krews own Huddles), `kalendar.md` (Event ↔ Krew bidirectional), `kommons.md` (Krew-scoped proposals TBD)
