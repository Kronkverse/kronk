# Per-space docs

This folder holds **one canonical doc per space in Kronk** — the
folder's contents mirror the Kommons Skeleton
(`bin/tootctl korners doctor` reads the same registry).

A **space** is any top-level surface of Kronk. A **korner** is one kind
of space — pluggable, declared by a manifest, addable and removable.
Feed, Profile, Nudges and Hub are spaces that are not korners; they
have no collective name beyond "spaces".

The top-level spaces are **Feed (Home), Profile (Me), Nudges and Hub**,
matching the shipped `hub_switcher.tsx`.

Each file here is the up-to-date reference for that space — what it's
for, how it works today, how it's changing, what's open. Portal-me and
other agents read this folder to stay in sync with the platform's
direction.

Architecture decisions, with dates and what they supersede, live in
[`../rebuild/decisions.md`](../rebuild/decisions.md). **Precedence when
sources disagree: code > repo docs > notes outside the repo.** Several
docs in this folder describe intended end states in the present tense —
verify against code before relying on one.

## Layout

### Korner spaces (one per korner manifest)

Slug matches `config/korners/<slug>.yaml`.

| Doc                            | Manifest                        | Notes                                                                                               |
| ------------------------------ | ------------------------------- | --------------------------------------------------------------------------------------------------- |
| [`albutts.md`](albutts.md)     | `config/korners/albutts.yaml`   | Discovery landed 2026-07-20 (R1+R2) — enforced: false, models pending                               |
| [`booth.md`](booth.md)         | `config/korners/booth.yaml`     | Enforced — audio sharing                                                                            |
| [`groups.md`](groups.md)       | `config/korners/groups.yaml`    | Enforced (framework) — UI heads toward "Krew"; slug rename planned                                  |
| [`huddle.md`](huddle.md)       | `config/korners/huddle.yaml`    | Models shipped; `/hub/huddle` mount pending                                                         |
| [`inflow.md`](inflow.md)       | `config/korners/inflow.yaml`    | Models + projection shipped; UI reshape pending Tomas Round 2                                       |
| [`kalendar.md`](kalendar.md)   | `config/korners/kalendar.yaml`  | Enforced — rebuild spiral view pending                                                              |
| [`klot.md`](klot.md)           | `config/korners/klot.yaml`      | Stub                                                                                                |
| [`kommons.md`](kommons.md)     | `config/korners/kommons.yaml`   | Enforced — Skeleton, token ledger and lifecycle shipped; backing UI pending                         |
| [`kompass.md`](kompass.md)     | `config/korners/kompass.yaml`   | Stub — physical map                                                                                 |
| [`kuestions.md`](kuestions.md) | `config/korners/kuestions.yaml` | Enforced — swipe-deck UI pending                                                                    |
| [`wachuneed.md`](wachuneed.md) | `config/korners/wachuneed.yaml` | Enforced — directory shipped; detail/composer pending. Renamed from `marketplace` 2026-07-21.       |
| [`moments.md`](moments.md)     | `config/korners/moments.yaml`   | Stub                                                                                                |
| [`nudges.md`](nudges.md)       | `config/korners/nudges.yaml`    | Activity feed shipped; pillar move open (PR #331 closed 2026-07-18 pending the nav design decision) |
| [`you.md`](you.md)             | `config/korners/you.yaml`       | Portal (link-out to Kashka's YOU PWA)                                                               |

### Cross-cutting spaces (not owned by a korner manifest)

Nodes declared in `config/kronk_nodes.yaml`.

| Doc                          | Node bucket          | Notes                                           |
| ---------------------------- | -------------------- | ----------------------------------------------- |
| [`feed.md`](feed.md)         | `feed`               | Home + Nudges activity feed                     |
| [`profile.md`](profile.md)   | `profile`            | Sectioned profile + view/edit/media/connections |
| [`settings.md`](settings.md) | `profile` (see note) | Account/global settings (`/settings/*`)         |
| [`hub.md`](hub.md)           | `hub.landing`        | The `/hub` landing grid itself                  |

Note on settings: `config/kronk_nodes.yaml` files every `settings.*`
node except `settings.feed` and `settings.hub` under the `profile`
bucket. This doc previously claimed a `hub` sub-tree, which was never
true in the registry. Settings has no honest home under the current
three-bucket scheme — see
[`../rebuild/decisions.md`](../rebuild/decisions.md).

The `nudges` bucket documented in
[`../korners/korner_standard.md`](../korners/korner_standard.md) L6 is
**not accepted by the code**: `Kronk::NodeRegistry::BUCKETS` is
`feed|profile|hub`, and a node declaring `bucket: nudges` is silently
dropped.

## How this folder is used

- **Feature suggestions on a specific space** land as PRs against
  `docs/spaces/<slug>.md`. That's the source-of-truth everyone reads.
- **Meta docs** (Standard, adding-a-korner walkthrough, anatomy) live
  in [`../korners/`](../korners/) — they describe the _framework_, not
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
