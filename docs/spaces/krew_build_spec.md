# Krew — build spec

**Surface:** `krew` (code: `Krew`) · **Mount:** `/hub/krew` · **Status:**
framework shipped, rebuild in progress (Phases 1 + 2 landed — URL flip

- backend model rename. Phase 3 adds new capabilities per §Data model
  in this brief).

> **Companion:** [`groups.md`](./groups.md) is the full Krew spec (rationale,
> governance frameworks, visibility, Event ↔ Krew, accretion). This file is the
> actionable layer: the UI surfaces with their locked decisions, what's built
> vs. what's needed, and a build order. Where the two disagree, `groups.md`'s
> narrative wins on _why_; this file wins on _what to build next_.

## What a Krew is (one screen)

A Krew is **audience-scoping for posts** — a defined group of people you share
with selectively. It is a **filter on who sees what, not a place you visit**:
there is no Krew timeline. You post to the Mayhem Krew and only Mayhem members
see it in their own Home feed. Krews turn one broadcast audience into
overlapping _networks of intent_.

Krews are low-ceremony: **listed** (in the directory, join instantly, no
approval) or **unlisted** (invisible, join only via an invite link) — the
directory _is_ the gate. No internal moderation (seeders can't remove members;
leaving is voluntary; disruption is handled with Kronk's account-level
block/report). Krews accrete framework pieces: each can own a **Huddle**, and
they wire bidirectionally into **Kalendar** (RSVP auto-joins the event's Krew;
an event can be visible only to certain Krews). A post can target multiple
Krews — the audience is the union of their members.

## The four UI surfaces (decisions locked with Tal, 2026-07-22)

1. **Compose — post to a Krew.** The existing visibility dropdown
   (Public / Followers / Direct) gains a **`Krew…`** entry that opens a
   multi-select of the Krews you belong to. Krew audience is **mutually
   exclusive** with the other modes — a post goes _either_ to a
   Public/Followers/Direct audience _or_ to one-or-more Krews. No new composer
   surface; the change lives inside the dropdown.
2. **Read — Krew posts inline.** Krew-scoped posts appear **in your Home
   timeline** among your follows, each marked with a small **named, tappable
   badge** (`▸ Mayhem Krew`) that shows provenance and links to the Krew page.
   There is **no separate Krew feed, no filter tab, no per-Krew timeline**.
3. **Discover — a first-class directory.** `/hub/krew` is a browsable,
   searchable directory of **listed** Krews with a one-tap **Join** on each
   (listed = instant join). Finding and joining Krews is a core part of the
   surface.
4. **The Krew page — metadata, not a stream.** `/hub/krew/:slug` is a metadata
   card: member count, description, its Huddle and associated events, and the
   **Join / Invite-link** actions. **No post stream** — a Krew is something you
   belong to and post _through_, never a destination you scroll.

## Built vs. needed

Grounded in the code, not the prose.

**Built (framework shipped):**

- `Group` model (`app/models/group.rb`): `slug` + `SLUG_PATTERN`,
  `discoverable` toggle, `has_and_belongs_to_many :statuses` via
  `statuses_groups` (a Status targets N Krews), `searchable_as :groups`.
- `GroupMembership` with the `seeder` role (multiple seeders from creation).
- The five governance frameworks for structural changes (peer_support / two_key
  / threshold / majority / consensus).
- Directory + detail UI: `features/groups/index.tsx` and `group_detail.tsx`.
- **A composer targeting UI already exists** — `GroupTargets`
  (`features/compose/components/group_targets.tsx`), rendered in
  `compose_form.jsx`: a chip multi-select of your groups.

**Needed:**

- **Vocabulary + URL shift** to `krew`: `/hub/groups → /hub/krew`, manifest
  `slug: groups → krew`, feature dir `features/groups → features/krews`. Model
  class stays `Group`, DB table stays `groups` (see memory
  `reference_kronk_vocab_krew.md`) — no code/DB rename.
- **Move composer targeting into the visibility dropdown.** The current
  `GroupTargets` is a standalone chip picker (the "prominent" form); the locked
  decision is the **`Krew…` entry inside the Public/Followers/Direct dropdown**,
  mutually exclusive with the other modes. Rework/relocate, don't add a second
  surface.
- **Named, tappable Krew badge** on timeline posts (which Krew[s] a post went
  to → the Krew page).
- **Invite links** for unlisted Krews (no join/invite endpoint exists yet).
- **Event ↔ Krew auto-join** on Kalendar RSVP (opt-out without dropping the
  RSVP); event visibility scoped to Krew(s).
- **One-tap join** from the directory for listed Krews (confirm the flow).
- **Keep the Krew page metadata-only** — no post stream (explicitly decided).

## Build order

1. **Vocabulary + URL shift** (`krew`) — the rename is the base everything else
   reads as; do it first so new UI lands on the right paths.
2. **Composer into the dropdown** — the `Krew…` visibility entry (relocate
   `GroupTargets`), mutually exclusive with Public/Followers/Direct.
3. **Timeline badge** — named + tappable, on Krew-scoped posts.
4. **Directory + Krew page polish** — one-tap join; metadata-only page with
   Huddle/events + Join/Invite-link.
5. **Invite links** (unlisted) and **Event ↔ Krew** auto-join.
