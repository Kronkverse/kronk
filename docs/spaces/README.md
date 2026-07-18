# Per-space docs

This folder holds **one canonical doc per space in Kronk** — the
folder's contents mirror the Kommons Tree
(`bin/tootctl korners doctor` reads the same registry).

A "space" is any addressable surface where a user reflects on Kronk
in the sense the Tree uses it: a korner, the feed, the profile, the
settings hub. Each file here is the up-to-date reference for that
space — what it's for, how it works today, how it's changing, what's
open. Portal-me and other agents read this folder to stay in sync
with the platform's direction.

## Layout

### Korner spaces (one per korner manifest)

Slug matches `config/korners/<slug>.yaml`.

| Doc | Manifest | Notes |
|---|---|---|
| [`albutts.md`](albutts.md) | `config/korners/albutts.yaml` | Stub — enforced: false |
| [`booth.md`](booth.md) | `config/korners/booth.yaml` | Enforced — audio sharing |
| [`groups.md`](groups.md) | `config/korners/groups.yaml` | Enforced (framework) — UI heads toward "Krew"; slug rename planned |
| [`huddle.md`](huddle.md) | `config/korners/huddle.yaml` | Models shipped; `/hub/huddle` mount pending |
| [`inflow.md`](inflow.md) | `config/korners/inflow.yaml` | Models + projection shipped; UI reshape pending Tomas Round 2 |
| [`kalendar.md`](kalendar.md) | `config/korners/kalendar.yaml` | Enforced — rebuild spiral view pending |
| [`klot.md`](klot.md) | `config/korners/klot.yaml` | Stub |
| [`kommons.md`](kommons.md) | `config/korners/kommons.yaml` | Enforced — Tree, token ledger and lifecycle shipped; backing UI pending |
| [`kompass.md`](kompass.md) | `config/korners/kompass.yaml` | Stub — physical map |
| [`kuestions.md`](kuestions.md) | `config/korners/kuestions.yaml` | Enforced — swipe-deck UI pending |
| [`marketplace.md`](marketplace.md) | `config/korners/marketplace.yaml` | Enforced — directory shipped; detail/composer pending |
| [`moments.md`](moments.md) | `config/korners/moments.yaml` | Stub |
| [`nudges.md`](nudges.md) | `config/korners/nudges.yaml` | Activity feed shipped; pillar move open (PR #331 closed 2026-07-18 pending the nav design decision) |
| [`tree.md`](tree.md) | `config/korners/tree.yaml` | Kommons Tree work lives in `kommons.md`; this manifest may retire |
| [`you.md`](you.md) | `config/korners/you.yaml` | Portal (link-out to Kashka's YOU PWA) |

### Cross-cutting spaces (not owned by a korner manifest)

Nodes declared in `config/kronk_nodes.yaml`.

| Doc | Node bucket | Notes |
|---|---|---|
| [`feed.md`](feed.md) | `feed` | Home + Nudges activity feed |
| [`profile.md`](profile.md) | `profile` | Sectioned profile + view/edit/media/connections |
| [`settings.md`](settings.md) | `hub` sub-tree | Account/global settings (`/settings/*`) |
| [`hub.md`](hub.md) | `hub.landing` | The `/hub` landing grid itself |

## How this folder is used

- **Feature suggestions on a specific space** land as PRs against
  `docs/spaces/<slug>.md`. That's the source-of-truth everyone reads.
- **Meta docs** (Standard, adding-a-korner walkthrough, anatomy) live
  in [`../korners/`](../korners/) — they describe the *framework*, not
  the individual spaces.
- **Cross-cutting rebuild plan** lives at
  [`../rebuild/implementation_plan.md`](../rebuild/implementation_plan.md).
- **Machine-readable definitions** live in `config/korners/*.yaml` and
  `config/kronk_nodes.yaml`; these Markdown docs are prose companions
  to those files.

## History

Consolidated 2026-07-18 from `~/kronk-notes/korners/` — a mainframe-
local scratch space that used to hold these drafts. Now living in
the repo so portal-me and other agents see the same up-to-date view.
