# Per-space docs

This folder holds **one canonical doc per space in Kronk** — the
folder's contents mirror the Kommons Directory
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
| [`kommons.md`](kommons.md)     | `config/korners/kommons.yaml`   | Enforced — Directory, token ledger, lifecycle and backing UI shipped                                |
| [`map.md`](map.md)     | `config/korners/map.yaml`   | Prototype — physical map / presence (renamed from Kompass)                                                                                 |
| [`kuestions.md`](kuestions.md) | `config/korners/kuestions.yaml` | Enforced — v2 shipped (dedicated models, swipe deck, gated answers, daily prompt)                   |
| [`wachuneed.md`](wachuneed.md) | `config/korners/wachuneed.yaml` | Enforced — directory shipped; detail/composer pending. Renamed from `marketplace` 2026-07-21.       |
| [`moments.md`](moments.md)     | `config/korners/moments.yaml`   | Stub                                                                                                |
| [`nudges.md`](nudges.md)       | `config/korners/nudges.yaml`    | Activity feed + unified messenger shipped; pillar move done (`core: true`, `pillar: true`, in `hub_switcher.tsx`) |
| [`you.md`](you.md)             | `config/korners/you.yaml`       | Portal (link-out to Kashka's YOU PWA)                                                               |

### Cross-cutting spaces (not owned by a korner manifest)

Nodes declared in `config/kronk_nodes.yaml`.

| Doc                          | Node bucket          | Notes                                           |
| ---------------------------- | -------------------- | ----------------------------------------------- |
| [`feed.md`](feed.md)         | `feed`               | Home + Nudges activity feed                     |
| [`profile.md`](profile.md)   | `profile`            | Sectioned profile + view/edit/media/connections |
| [`settings.md`](settings.md) | `settings` (see note) | Account/global settings (`/settings/*`)         |
| [`hub.md`](hub.md)           | `hub.landing`        | The `/hub` landing grid itself                  |

Note on settings: settings now owns its **own `settings` bucket** and a
core-space manifest (`config/korners/settings.yaml`). Every personal/account
`settings.*` node declares `bucket: settings` in `config/kronk_nodes.yaml`
(only `settings.feed` and `settings.hub` stay in their space's bucket). The
earlier "no honest home under the three-bucket scheme" is resolved — see
[`settings.md`](settings.md) and
[`../rebuild/decisions.md`](../rebuild/decisions.md).

`Kronk::NodeRegistry::BUCKETS` is now
`feed profile hub nudges settings kronk` (`app/lib/kronk/node_registry.rb`),
so the `nudges` bucket documented in
[`../korners/korner_standard.md`](../korners/korner_standard.md) L6 **is
accepted** — `feed.nudges`, `nudges.index` and `nudges.thread` all declare
`bucket: nudges`.

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
