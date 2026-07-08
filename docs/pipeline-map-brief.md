# Kronk Pipeline Map — Build Brief

A navigable map of everything in Kronk's pipeline: what exists, what's planned, what depends on what, and what a dev can pick up right now. Two lenses (Map + List) over one editable tree.

Reference prototype: `kronk_mindmap.html` (self-contained, vanilla JS/SVG, **in-memory only — no persistence**). Treat it as the behavioural + visual spec, not code to port line-for-line.

---

## The model

**Two node kinds — this distinction is the spine of the whole tool:**
- **Sub-layer** = *a place.* The curated skeleton. Kept few (~3 per branch) as a discipline. Adding one reshapes the shared structure.
- **Idea** = *a thing to build.* An unlimited leaf that hangs inside a place. This is how everyone contributes.

**Top structure (seeded, editable in-tool — NOT baked in):**
- **Digital** → Development · Sovereignty · Infrastructure
- **Community** → User Experience · Relationships · Community
- **Platform** → Governance · Structure · Vision

Nesting is unlimited below that (e.g. `Community / UX / Profile / Visibility`). Colour follows the top layer (Digital = purple `#563ACC`, Community = green, Platform = amber).

**Dependencies (cross-tree), three types:**
- `needs` — hard block. Can't be built until the target is `done`.
- `secures` — "secure only once…". Buildable now, but not *sovereign-secure* until the target ships. This is the Anthemos pattern (e.g. Profile visibility is buildable but provisional until Verified identity lands).
- `relates` — soft conceptual link.

**Readiness (computed, never hand-set):** `blocked` → `provisional` → `ready` → `building` → `done`. Hard blockers surface before security caveats.

**Each idea carries:** status, priority, description, a **Framework** (free-text spec + a steps checklist), and a **Discussion** (comment thread).

**Actions:** plant idea / sub-layer (both with a description), **move/relocate** (cycle-safe — a place can't move into its own branch), focus a branch, search / jump.

## The two views (shared detail panel + shared focus)
- **Map** — horizontal mind-map. Click a layer to focus into that branch (it becomes the root); breadcrumb climbs back. Fold sub-branches, dependency arcs, readiness rings.
- **List** — spaces rail (every place, all depths) + ideas grouped under their sub-layers, with readiness filters and sort ("Ready first" default). The "what can I pick up" view.

---

## Open decisions (these gate Phase 2, not Phase 0/1)
1. **Dependency capture:** inline stub-create (type a name that doesn't exist yet → creates a stub to home later) **vs** strict link-to-existing-only.
2. **Structural change:** adding a *sub-layer* open to anyone **vs** gated as a Kommons proposal (aligns with the governance ethos; ideas always stay open).

---

## Delivery phases

**Phase 0 — Ship the prototype as a static reference (today, zero backend).**
Drop `kronk_mindmap.html` into the kronk repo's `public/` as `public/pipeline.html`. Mastodon serves `public/` statically, so it's live at `/pipeline.html` behind the invite wall. The team can click it immediately. State resets per session — reference only.

**Phase 1 — Recon + spec (no code).**
Map where a real React feature mounts (mirror the Cosmos Hub: `app/javascript/mastodon/features/…`, route e.g. `/pipeline`), how assets build, and where a small persistence store would live.

**Phase 2 — Build the real feature.**
React/TS port of Map + List + panel, plus **minimal persistence** (tree, deps, ideas, comments). Backend before UI for anything introducing shared state. Persistence = a Rails model/controller in the fork over the existing Postgres, exposing a small JSON API. **Local-only; no federation.**

## Tech notes
- Aesthetic tokens already in the prototype (black canvas, `#563ACC`, serif voice / sans chrome, layer-colour system, `needs`/`secures`/`relates` link styles). Reuse them.
- Persistence shape: `nodes {id, kind, parent, name, desc, status, priority, framework, steps[]}`, `deps {from, to, type}`, `comments {node, who, text, at}`.
- Mount behind the invite-only wall like any other member feature.

## Out of scope — protect
ActivityPub / federation / existing schema and the account, timeline, and moderation models must **not** be touched by this work. This is an additive feature plus its own store.

---

## Claude Code session plan (recon-first, one concern per session)
1. **Recon only, no code** — repo structure; how the Hub feature is mounted/routed; asset build; where a new feature + store would live. Output: findings note + proposed file list.
2. **Scaffold** — route + empty feature component; render a hard-coded tree.
3. **Map view** — port the mind-map.
4. **List view + detail panel** — port the rest.
5. **Persistence** — model / controller / JSON API + wire reads/writes (the only session with a migration).
6. **Cleanup sweep.**

**When done each frontend session:** `yarn lint` · `NODE_OPTIONS=--max-old-space-size=2048 npx tsc --noEmit` · `gh pr create`. No migrations or rspec on frontend-only sessions.
