# The Korner Standard

> **Status:** v1 (2026-07-16, two open decisions resolved — see foot). The normative definition of what makes a korner **slide in smoothly** to Kronk's infrastructure. Derived from the 2026-07-16 recreation audit (the dimensions where real korners broke) + the aesthetic standard (`docs/kronk_aesthetic_system.md` §6). Companion docs: `docs/kronk_korner_spec.md` (manifest field reference) and `docs/korners/adding_a_korner.md` (the build walkthrough — follows this standard).
>
> **How to read it:** §1 is the lifecycle gate — *what's required when*. §2 is the nine layers — *the checklist*. §3 is the conformance matrix — *what `korners doctor` enforces automatically vs. what a human signs off*. A korner is done when it passes every layer required for its lifecycle stage.
>
> **`⚙︎` = machine-checkable** (target for the extended `korners doctor`, see §3). **`◇` = human sign-off.** **`▲` = a v0 open decision for review.**

## 0. Why this exists

`korners doctor` and stylelint gave false confidence: the audit found `enforced: true` korners (Marketplace, In Flow) that passed every automated check yet had no serializer, no card, and a dead `/hub/<slug>` mount. The guardrails validated *slugs and associations* but not *whether the korner actually works end to end*. This standard names every layer a korner must satisfy, so "it passes" means "it slides in" — and §3 makes the automatable layers into doctor checks so the gap can't reopen.

## 1. The lifecycle gate — what's required when

A korner's `lifecycle` (in its node) and its manifest `enforced` flag are **promises about completeness**. Requirements scale with the stage; the golden rule is that you don't make a bigger promise than the korner keeps.

| Stage | Manifest `enforced` | In Hub grid? | Projects to feed? | Required layers (from §2) |
|---|---|---|---|---|
| **soon** (stub) | `false` | shown as "soon" tile | no | L1 identity · L5 mount (via `KornerStub`) · L6 node (`lifecycle: soon`) · L7 aesthetic |
| **building** (partial) | `false` | no | no | + L2 data (models/tables/migrations/schema) |
| **live** (complete) | `true` | yes | yes | **all nine layers L1–L9** |

> **⚠ The golden rule.** `enforced: true` says: *this korner mounts, projects, serialises, and renders — right now.* Do not set it until every layer in §2 passes. Marketplace and Nudges were `enforced: true` while their `/hub/<slug>` was a dead link — that's the exact failure this rule prevents. A korner under construction stays `enforced: false` (and its node `lifecycle: soon|building`), which keeps it out of the Hub grid and the feed until it's real.

## 2. The nine layers

### L1 — Identity & manifest
- ⚙︎ Manifest exists at `config/korners/<slug>.yaml`.
- ⚙︎ **Slug** is one lowercase word (no hyphens/underscores), **equals the filename**, is **not** in `reserved_slugs.yaml`, and is unique across korners. *(Audit: `in-flow` has a hyphen and ≠ its filename `in_flow.yaml`.)*
- ⚙︎ `name` and `icon` present; **`icon` is wired in `hooks/useKornerIcon.tsx`** and the mapping matches the manifest's `icon:` field. *(Audit: huddle/nudges icons are cross-wired vs their manifests.)*
- ⚙︎ **No colour field** — no `--space-color`, no per-korner hex/hue. Differentiation is icon + name + content only.
- ⚙︎ **Canonical manifest shape.** Every manifest carries identity + `resources` + `storage` + a nested **`security:`** block (permissions / visibility / federation / maintainers) + `feed_projection` (if it projects) + `settings` (if it has options) + `nodes`. The nested `security:` shape (matching groups/huddle) is canonical. The ~9 older root-level manifests migrate to it; stubs gain a `security:` block when they graduate to `enforced`.

### L2 — Data
- ⚙︎ Every resource declared in `resources:` has a real model (`app/models/<x>.rb`), a table, and a migration.
- ⚙︎ `db_namespace` matches the real table prefix(es).
- ⚙︎ The tables are present in `db/schema.rb` (so `db:schema:load` builds a working DB). *(Audit P0: schema.rb was 8 weeks stale — fixed in #336.)*
- ⚙︎ If the korner projects to the feed, `Status has_one :<x>` (or the appropriate association) exists.

### L3 — API & serialization
- ⚙︎ CRUD controllers exist for the korner's resources (`app/controllers/api/v1/<korner>/…`) with routes in `config/routes/api.rb`.
- ⚙︎ **Serializer exposure** — `REST::StatusSerializer` exposes the projection attribute, **and** the `REST::<Korner>SummarySerializer` the card needs actually exists. *(Audit: Marketplace `enforced` but no controllers, no serializer attr, summary serializer only referenced in a comment — the single biggest doctor blind spot.)*

### L4 — Feed projection
- ⚙︎ `feed_projection.card` names a component.
- ⚙︎ That **card component exists** (`components/status_<korner>_card` or via the shared `StatusKornerCard` frame).
- ⚙︎ The card is **registered** in the card registry (`components/korner_cards.tsx` → `KORNER_CARDS`). *(Audit: groups/in_flow/huddle/albutts/moments declare cards with no registry entry.)*
- ⚙︎ The serializer (L3) **populates the field** the card reads — projection is only real when all three (declare → serialise → render) line up.

### L5 — Mount & routing
- ⚙︎ **`/hub/<slug>` resolves** in `features/ui/index.jsx` — either the real feature, or a `KornerStub` for `soon`.
- ⚙︎ **`enforced: true` ⇒ the mount resolves.** No enforced korner may show a Hub tile whose link 404s. *(Audit: Marketplace + Nudges `enforced` with dead `/hub/<slug>`.)*
- ◇ If the korner graduated from a legacy route (e.g. `/nudges`), that route redirects/aliases to `/hub/<slug>`.

### L6 — Tree & nodes
- ⚙︎ `nodes:` block: valid `bucket` (`feed|profile|hub|nudges`), `parent` is a registered slug, `lifecycle` set.
- ⚙︎ Each node's `route_name` resolves to a Rails named route **or** `spa: true`. *(Audit: `feed.nudges` failed this — fixed in #335.)*
- ⚙︎ No node-id collisions (across korners + `kronk_nodes.yaml`); all link targets (`settings_for`, `listens`, `projects_to`, …) resolve.

### L7 — Aesthetic & tokens
*(This layer is `docs/kronk_aesthetic_system.md` §6, restated as korner requirements.)*
- ⚙︎ Every colour / radius / elevation / motion value is a **token** — no raw hex, no legacy pre-token vars (`--background-color`, `--color-border`, `--surface-border`, `--surface-hover`). *(Audit: booth/kommons/kuestions/tree card SCSS + the shared frame drift here.)*
- ⚙︎ The korner's SCSS (incl. its feed-card partial) is in the **stylelint governance list**. *(Audit: card partials are ungoverned + `color-no-hex` is only a warning — item 7 closes this.)*
- ◇ Uses `var(--accent)` + semantic tokens (never a raw palette token) → automatically respects the **Personal Appearance** per-user layer (accent/theme/font/scale). Both themes work with no branching. Header uses `@include kronk-cover-glow()`; radius language applied by role.

### L8 — Settings (§K)
- ⚙︎ If the korner has user options: a `settings:` block **and** a `settings.<slug>` / per-korner node linked with `settings_for`, rendered at `/hub/<slug>/settings` via the settings widget kit.
- ◇ Settings are schema-driven (a `FIELDS` controller map + widgets), not a bespoke page.

### L9 — Tests & docs
- ◇ A korner spec covering the model + the projection path — **SHOULD** (recommended, not gating). Rises to MUST once a cheap korner-test harness exists.
- ◇ Manifest is self-documenting; no phantom references. *(Audit: `nudges.yaml` cites a non-existent spec; `adding_a_korner.md` holds up non-existent Klot models — item 9 rewrites it against this standard.)*

## 3. Conformance matrix — the automated gate

Everything marked ⚙︎ above is **machine-checkable** and becomes an extended `korners doctor` check (item 7). Today's doctor validates only L1 (slug/reserved) + L2 (db-namespace) + the `Status` association — which is why the L3/L4/L5 gaps sailed through. The extension adds:

| Check | Layer | Catches |
|---|---|---|
| slug is a word · == filename · unique | L1 | `in-flow` |
| icon wired in `useKornerIcon`, matches manifest | L1 | huddle/nudges cross-wiring |
| model + table + schema present per resource | L2 | stale-schema failures |
| serializer exposes projection attr; summary serializer exists | L3 | Marketplace/In Flow non-functional projection |
| card component exists **and** is registered | L4 | groups/in_flow phantom cards |
| `/hub/<slug>` resolves; **enforced ⇒ mount resolves** | L5 | Marketplace/Nudges dead tiles |
| node bucket/parent/lifecycle valid; route_name resolves or spa; no id collision; links resolve | L6 | `feed.nudges` route |
| card partial is stylelint-governed (no raw hex) | L7 | ungoverned card drift |

`◇` items stay human sign-off (aesthetic judgment, tests). Canonical manifest-shape conformance (nested `security:`) is `⚙︎` per L1.

## 4. Definition of done — "slides in smoothly"

A korner **slides in** when, for its lifecycle stage:
1. `korners doctor` is green (all ⚙︎ for that stage), **and**
2. a human has signed off the `◇` items for that stage, **and**
3. its `enforced` flag and node `lifecycle` honestly reflect what works (§1 golden rule).

For a **live/enforced** korner specifically: you can create its records via API, they project into the feed as a token-clean card, its `/hub/<slug>` and `/hub/<slug>/settings` render, its nodes resolve in the Tree, and it looks identical-in-family to every other korner (icon/name aside) in both themes and under any Personal Appearance choice.

## 5. Proving the standard — Marketplace

Marketplace is the v0 test case (item 8): billed as the greenfield "reference korner," `enforced: true`, yet failing L3 (no controllers/serializer), L4 (card never populated), and L5 (dead mount). Bringing it to this standard — and watching the extended doctor light up every gap, then go green — is how we validate both the standard and the checker against a real rebuild. What Marketplace *teaches* during that rebuild feeds back into this doc (v1).

---

_v1 decisions (2026-07-16, Tal): **(L1)** the nested `security:` block is the canonical manifest shape — the ~9 root-level manifests migrate to it. **(L9)** a korner spec is **SHOULD**, not gating. The standard is now normative for the recreation work._
