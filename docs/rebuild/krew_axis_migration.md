# Krew orthogonal-axis migration — status & handoff

**Status: complete.** Krew is an orthogonal, additive audience axis end-to-end
— Moments, Album, and Status models; every composer (main, Moments, Albutts)
and the Moments edit path; and the shared `ReachValue`/`StatusVisibility` types
no longer carry `krew`. Albutts contribution became additive too (people ∪
krews). The final cleanup (#1347) merged 2026-08-11 — every stage has landed.
Last updated 2026-08-12.

This is the closed record of a multi-stage change to core visibility. The
decision itself lives in [`decisions.md`](./decisions.md)
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

| Stage | What                                                                   | PR    | State     |
| ----- | ---------------------------------------------------------------------- | ----- | --------- |
| 1/4   | **Moments** — krew orthogonal, migration, accept-both                  | #1312 | ✅ merged |
| —     | **Extract `Reachable`** + Moment adopts it                             | #1316 | ✅ merged |
| 2/4   | **Album** — adopts `Reachable`, krew orthogonal, migration             | #1319 | ✅ merged |
| 3/4   | **Status** — StatusPolicy + fan-out + federation, migration            | #1325 | ✅ merged |
| 4a/4  | **Main composer** — additive krew submenu in the reach dropdown        | #1331 | ✅ merged |
| 4b/4  | **Moments composer** — single-krew additive submenu                    | #1332 | ✅ merged |
| 4c/4  | **Albutts** — additive contribution roster (backend)                   | #1339 | ✅ merged |
| 4c/4  | **Albutts** `ScopePicker` — additive audience + contribution (UI)      | #1343 | ✅ merged |
| 4d/4  | **Moments edit** (`viewer.tsx`) — additive on the edit path            | #1347 | ✅ merged |
| 4e/4  | **Remove `krew` from the shared `ReachValue`/`StatusVisibility` type** | #1347 | ✅ merged |

Every stage has landed (4d + 4e in the final cleanup PR). Krew is an additive
axis end-to-end — models, feeds, federation, every composer, and the shared
types — and legacy `visibility=krew` remains accept-both everywhere as a
permanent safety net.

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

## How it was built (per stage)

Each composer learned to send a reach tier **plus** an independent set of krews.
The stages below are the historical record; all are merged.

### The composer UX (decided)

The audience control is a **single visibility dropdown**. It lists the reach
tiers (Me / Mates / Orbit / Kronkverse, single-select) and a **“Krews ›”** row
that flies out into a **multi-select** submenu. Ticking krews does **not**
change the reach tier — it adds their members on top (“Mates _and_ Studio” is
one post). This lives in the shared `components/reach_dropdown.tsx` behind
optional props (`krews`, `selectedKrewIds`, `onToggleKrew`); a call site that
omits them gets an unchanged plain reach picker.

### 4a — Main composer (PR #1331, merged)

- `components/reach_dropdown.tsx` — the additive krew submenu (above).
- `hooks/useAvailableKrews.ts` — one place to fetch the viewer's postable krews.
- `features/compose/components/compose_reach_dropdown.tsx` — hides the krew
  rung, wires the submenu to `compose.krew_ids`, drops the old
  clear-krew-on-leave coupling. (`submitCompose` already sent `visibility` +
  `krew_ids` separately, so no store/submit change.)
- Removes the old gated `KrewTargets` chip row.

### 4b — Moments composer (PR #1332, merged)

- `reach_dropdown.tsx` gains an optional `krewSingleSelect` mode — the submenu
  renders as a **radio** list for single-krew korners.
- `features/moments/composer.tsx` — Moment's model holds **one** `krew_id`, so
  it uses `krewSingleSelect` (the call site enforces single via `onToggleKrew`).
  Drops `'krew'` from its `Visibility` type, hides the rung, always sends
  `krew_id` independent of reach, removes the gate / clear-on-leave / krew-
  required submit guard / the separate `KornerKrewPicker`.

### 4c — Albutts (decided: split, and made contribution additive too)

Albutts wasn't a mechanical port. Decision (2026-08-11): the audience and
contributor krew sets are **split**, and — because the motivating case was "an
album shared with mates where only a few can add" — **contribution itself
became additive**, mirroring audience: an open/restricted base + a roster that
is the union of specific **people** and **krews**. This also shipped the
long-stubbed `invited` roster.

- **Backend (#1339, merged).** The `contribution` enum's `open` already meant
  "anyone who can see it", so restricted = not-open; no new albums column. The
  roster is `album_krews.for_contribution` (contributor subset — a contributor
  krew is always also an audience krew) + a new `album_contributors` join
  (people). `contributable_by?` = visible AND (owner OR open OR invited-person
  OR contributor-krew-member). Behaviour-preserving migration + accept-both.
- **Frontend (#1343, merged).** `ScopePicker` rebuilt: reach chips + an
  audience-krew multiselect; a contribution open/restricted toggle revealing
  contributor-krew + contributor-people pickers. New reusable
  `AccountMultiSelect` + `KrewMultiSelect`. `api/albutts` now sends the roster
  arrays at the top level (fixes a latent create-time bug where `krew_ids` were
  nested under `album:` and never read).

### 4d — Moments edit path

`features/moments/viewer.tsx` still edits a Moment's audience via
`KornerVisibilityPicker` (a manifest button-strip with a `krew` chip) +
`KornerKrewPicker`. Bring it onto the additive model for parity with the
composer. Lower traffic; accept-both holds meanwhile.

### 4e — Retire `krew` as a type value

Once no composer sends `visibility='krew'`, remove `krew` from `ReachValue`
(`reach_dropdown.tsx`) and `StatusVisibility` (`api_types/statuses.ts`), plus
the now-dead `visibility_button.tsx` / the edit-only `visibility_modal.tsx`
krew branch. Backend accept-both can stay as a permanent safety net.

---

## Risks & open items

- **`album_krews` serves two axes.** On Album, the krew join feeds both the
  additive-visibility krew _and_ the `contribution == 'krew'` roster (the picker
  auto-mirrors them). Left as-is for now; a cleaner separation is a possible
  follow-up.
- **Frontend/back coordination.** Accept-both keeps every backend stage safe on
  its own; the frontend stops sending `visibility='krew'` composer-by-composer
  (4a → 4b), and the type isn't removed (4c) until all of them have.
- **Public/Kronkverse + krews is redundant** (everyone already sees a public
  post). The submenu currently still allows it; harmless, but a later polish
  could disable the krew row at the widest reach tiers.
