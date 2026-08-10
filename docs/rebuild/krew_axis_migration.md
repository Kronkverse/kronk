# Krew orthogonal-axis migration — status & handoff

**Status: 2 of 4 stages shipped + the shared concern extracted. Status (3/4)
and the composers/feed (4/4) remain.** Last updated 2026-08-10.

This is a living tracker for an in-progress, multi-stage change to core
visibility. The decision itself lives in [`decisions.md`](./decisions.md)
(2026-08-09 "Krew is an orthogonal axis"); this document is the _how_ and the
_where we are_.

---

## Goal

Today a post's audience is picked from **one** list —
`Just me · Mates · Orbit · Kronkverse · A Krew` — so krew is mutually exclusive
with the reach ladder: you can post to your mates **or** to a krew, never both.

The migration splits that one list into **two independent controls**:

```
Reach:  self_only · mates · orbit · public     ← always exactly one
Krews:  [optional set of krews]                ← additive, independent
```

**Krew becomes additive.** A post's audience = _reach-tier audience_ ∪ _members
of the krews it targets_. "Mates **and** krew X" is now expressible.

The `krew` value leaves each model's `visibility` enum — which, as a bonus,
erases the old integer-slot mismatch (`Status` had krew=5, Moment/Album krew=2).

---

## The decision that shaped the migration

Existing rows with `visibility = krew` (audience today: krew members only) are
remapped to **`visibility = self_only`, keeping their krew link**. Net audience
is unchanged — owner + that krew's members — because krew membership now grants
visibility additively at any tier.

Why not `mates + krew`? That would _widen_ old krew-only posts to all your mates
(a privacy leak). Concretely, for a post that was "krew X only":

| viewer                 | today              | after (`self_only + krew`)     |
| ---------------------- | ------------------ | ------------------------------ |
| mate **in** krew X     | sees it (via krew) | sees it (via krew) — unchanged |
| mate **not in** krew X | doesn't            | doesn't — unchanged            |

Krew members always see it; the migration keeps everyone else exactly as-is.

---

## The shared `Reachable` concern

`app/models/concerns/reachable.rb` holds the reach + additive-krew rule **once**,
so it isn't copy-pasted per content type. An including model declares its
`enum :visibility` (any prefix/suffix) with the four reach values and supplies a
small adapter:

```ruby
class Foo < ApplicationRecord
  include Reachable

  enum :visibility, { public: 0, mates: 1, orbit: 3, self_only: 4 }

  def self.reachable_owner_column = :account_id        # or :owner_id
  def self.reachable_krew_scope(krew_ids)              # items targeting any krew_ids
    where(krew_id: krew_ids)                           # or a join subquery
  end

  private

  def reachable_owner_id = account_id
  def reachable_owner    = account
  def reachable_krew_member?(viewer)                   # is viewer in a krew this targets?
    viewer.present? && viewer.krews.exists?(id: krew_id)
  end
end
```

The concern then provides `Foo.visible_to(viewer)` (scope) and
`foo.visible_to?(viewer)` (single-record). A new korner post-type gets correct
visibility for free.

`Reachable` is deliberately **separate from `ProfileVisibility`** (profile
cards/shelves): profiles have no krew and a members-only "public", so they speak
their own dialect. A later unification is possible but not attempted here.

---

## Progress

| Stage | What                                                                       | PR    | State          |
| ----- | -------------------------------------------------------------------------- | ----- | -------------- |
| 1/4   | **Moments** — krew orthogonal, migration, accept-both                      | #1312 | ✅ merged      |
| —     | **Extract `Reachable`** + Moment adopts it                                 | #1316 | ✅ merged      |
| 2/4   | **Album** — adopts `Reachable`, krew orthogonal, migration                 | #1319 | ✅ merged      |
| 3/4   | **Status** — StatusPolicy + feed/timeline + federation                     | —     | ⬜ not started |
| 4/4   | **Composers + feed** — reach picker drops krew; separate krew multi-select | —     | ⬜ not started |

The two "korner content" models (Moment, Album) are done and share one rule.

---

## Reusable patterns (established in stages 1–2)

- **Drop `krew` from the enum, leave the integer gap.** Moment/Album now read
  `{ public: 0, mates: 1, orbit: 3, self_only: 4 }` — the 2 slot stays empty
  rather than renumbering (renumbering would rewrite every row's integer).
- **Migration = one bounded `UPDATE`.** `SET visibility = <self_only> WHERE
visibility = <krew>`, wrapped in `safety_assured`. The krew association is
  untouched, so the audience is preserved. Down-migration restores `krew` for
  self_only rows that still carry a krew.
- **Controllers accept-both.** A legacy `visibility=krew` from an un-migrated
  client is mapped to `self_only`, keeping the krew id(s). This is what lets the
  backend land before the composer PR with **no broken window**.
- **Serializers/services stop gating on `krew_visibility?`.** Krew data is
  exposed / attached whenever the item targets any krew, regardless of tier.
- **Specs** assert: `visibilities` no longer has `'krew'`; a self_only+krew item
  is visible to a krew member but not a stranger; a mates+krew item is visible
  to a non-mate krew member; the `visible_to` scope includes krew-targeted items
  at any tier.

---

## Remaining work

### 3/4 — Status (the hard one)

Status's visibility is **not** a simple model scope — it's spread across code
that governs the main feed and federation, so it will _not_ slot into
`Reachable` cleanly. Thread the additive-krew change through, carefully:

- `app/models/concerns/status/visibility.rb` — the enum
  (`… krew: 5, mates: 6, orbit: 7, self_only: 8`, plus legacy Mastodon
  `public/unlisted/private/direct/limited`). Retire the `krew` value → migrate
  krew statuses to `self_only`, keeping `statuses_krews`.
- `app/policies/status_policy.rb` — `krew_scoped?` (`record.krew_visibility?`),
  `viewer_in_targeted_krew?` (`record.krews`), and `selectable_reach_visibility?`
  / the show branch. Make krew **additive**: a viewer in a targeted krew passes
  regardless of the reach tier, then fall through to the tier check.
- `app/models/status.rb` — `has_and_belongs_to_many :krews, join_table:
:statuses_krews` (multi krew — same shape as Album).
- **Feed / timeline SQL** — wherever krew-visibility is filtered into home /
  list / public timelines (FeedManager + any `krew_visibility` SQL). This is the
  performance-critical, leak-sensitive part; test it hard.
- **Federation** — krew (like the other Kronk-only tiers) is non-distributable;
  confirm a self_only+krew status still never federates.
- Accept-both in the statuses controller (legacy `visibility=krew` → self_only,
  keep krew_ids).

Note: `StatusPolicy` uses the `record.krew_visibility?` predicate name — after
the enum change, switch these to "does this status target any krew?"
(`record.krews.exists?`), not the retired enum predicate.

### 4/4 — Composers + feed UI

- `components/reach_dropdown.tsx` — drop the `krew` rung from the ladder; it
  becomes reach-only (self_only/mates/orbit/public — labelled …/Kronkverse).
- A **separate, always-available krew multi-select** shown alongside the reach
  control (not gated on picking "krew"). This is where "Mates **and** krew X"
  finally appears in the UI. Wire it in the composers that currently send
  `visibility=krew`: main compose (`krew_targets.tsx`), Moments
  (`KornerKrewPicker`), Albutts (`ScopePicker` — it already has a Krews axis),
  etc.
- `lib/kronk/audience_scope.rb` + the home-feed scope filtering — make sure the
  Home audience ladder and any krew filtering agree with the additive model.
- Retire the frontend's `'krew'` visibility value everywhere it's still sent as
  a reach tier.

---

## Risks & open items

- **Leak surface (Status/feed).** The 3/4 change touches the code that decides
  what shows in the main feed. A single check that still treats krew as "the
  whole audience" instead of "additive" is a leak or a disappearance. Verify
  every krew check-point (policy, feed SQL, search) agrees.
- **`album_krews` serves two axes.** On Album, the krew join now feeds both the
  additive-visibility krew _and_ the `contribution == 'krew'` roster (the picker
  auto-mirrors them). Left as-is for now; a cleaner separation is a possible
  follow-up.
- **Frontend/back coordination.** Accept-both keeps each backend stage safe on
  its own, but the composer stage (4/4) is where the old `visibility=krew` send
  path is finally retired — do it after Status lands.
