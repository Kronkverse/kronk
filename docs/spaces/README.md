# Per-space docs

This folder holds **one doc per space in Kronk**: what it is for, how it
works today, and what is still open.

A **space** is any top-level surface of Kronk. A **korner** is one kind of
space: pluggable, declared by a manifest in `config/korners/`, shown as a
tile on the Hub, and something you can tune in or out of. Feed, Profile,
Nudges, Hub and Settings are **core** spaces: they also carry a manifest
(`core: true`), but they are not Hub tiles and cannot be tuned out of.

The top-level switcher (`hub_switcher.tsx`) shows **Me · Home · Always
was, always will be (`/awawb`) · Hub · Nudges**.

Architecture decisions, with dates and what they supersede, live in
[`../decisions.md`](../decisions.md). **When sources disagree: code > repo
docs > notes outside the repo.** Check a doc against the code before
relying on it.

## Layout

### Korners

Slug matches `config/korners/<slug>.yaml`. Every korner below is
`enforced: true` and live at `/hub/<slug>`, except YOU, which is a portal.

| Doc                            | Manifest                        | What it is                                                                     |
| ------------------------------ | ------------------------------- | ------------------------------------------------------------------------------ |
| [`albutts.md`](albutts.md)     | `config/korners/albutts.yaml`   | Shared photo albums where every photo keeps its author's credit                |
| [`art.md`](art.md)             | `config/korners/art.yaml`       | Single-author physical works (paintings, sculpture, prints, photos of them)    |
| [`booth.md`](booth.md)         | `config/korners/booth.yaml`     | Audio: DJ sets and mixes                                                       |
| [`cinema.md`](cinema.md)       | `config/korners/cinema.yaml`    | Single-author short films (direct MP4)                                         |
| [`huddle.md`](huddle.md)       | `config/korners/huddle.yaml`    | Live video rooms                                                               |
| [`inflow.md`](inflow.md)       | `config/korners/inflow.yaml`    | A daily moment of celestial reflection                                         |
| [`kalendar.md`](kalendar.md)   | `config/korners/kalendar.yaml`  | Events and gatherings                                                          |
| [`karporn.md`](karporn.md)     | `config/korners/karporn.yaml`   | Single-author car posts (year, make, model, optional location)                 |
| [`klot.md`](klot.md)           | `config/korners/klot.yaml`      | Private cycle tracker; share the phase, not the data                           |
| [`kommons.md`](kommons.md)     | `config/korners/kommons.yaml`   | Proposals and backing: the community decides what Kronk builds                 |
| [`kommunity.md`](kommunity.md) | `config/korners/kommunity.yaml` | The follow graph as a 3D orb, plus Discover                                    |
| [`krew.md`](krew.md)           | `config/korners/krew.yaml`      | Krews: defined groups you can post to. The build spec                          |
| [`groups.md`](groups.md)       | `config/korners/krew.yaml`      | Krew: the rationale (code began as `Group`)                                    |
| [`kronikles.md`](kronikles.md) | `config/korners/kronikles.yaml` | Single-author long-form writing (markdown)                                     |
| [`kuestions.md`](kuestions.md) | `config/korners/kuestions.yaml` | Ask and answer; answer to unlock. Plus a daily prompt                          |
| [`map.md`](map.md)             | `config/korners/map.yaml`       | Mates-only presence pins and treks                                             |
| [`moments.md`](moments.md)     | `config/korners/moments.yaml`   | Ephemeral posts, gone by morning                                               |
| [`rose.md`](rose.md)           | `config/korners/rose.yaml`      | A wordless daily gesture to a Mate, cleared at 3am Sydney                      |
| [`wachuneed.md`](wachuneed.md) | `config/korners/wachuneed.yaml` | Person-to-person listings and offers (renamed from `marketplace`)              |
| [`you.md`](you.md)             | `config/korners/you.yaml`       | Portal to Kashka's YOU app (`enforced: false`; the Hub still shows it as live) |

### Core and cross-cutting spaces

Nodes are declared in `config/kronk_nodes.yaml`.

| Doc                          | Node bucket | What it is                                                         |
| ---------------------------- | ----------- | ------------------------------------------------------------------ |
| [`feed.md`](feed.md)         | `feed`      | Home: the feed, who sees what, the reach ladder                    |
| [`profile.md`](profile.md)   | `profile`   | The profile at `/@user`                                            |
| [`nudges.md`](nudges.md)     | `nudges`    | The messenger and activity feed (`core: true`, `pillar: true`)     |
| [`settings.md`](settings.md) | `settings`  | Account and personal settings                                      |
| [`hub.md`](hub.md)           | `hub`       | The `/hub` korner grid                                             |
| [`kronk.md`](kronk.md)       | `kronk`     | The org space (`/kronk/*`), static markdown under `content/kronk/` |

`Kronk::NodeRegistry::BUCKETS` (`app/lib/kronk/node_registry.rb`) is
`feed profile hub nudges settings kronk search`. Settings nodes declare
`bucket: settings`, except `settings.feed` and `settings.hub`, which stay
in their space's bucket.

The `welcome` core manifest (signup) has no doc here; signup is covered in
[`../design.md`](../design.md).

## How this folder is used

- **Changes to a space** land as PRs against `docs/spaces/<slug>.md`.
- **Every enforced korner needs a doc here.** `bin/lint-korner-docs` fails
  the `lint` job if one is missing (scaffolds with `enforced: false` are
  exempt). A new korner also adds a row to the table above.
- **Framework docs** (the Korner Standard, the adding-a-korner walkthrough)
  live in [`../korners/`](../korners). They describe the framework, not
  individual spaces.
- **Machine-readable definitions** live in `config/korners/*.yaml` and
  `config/kronk_nodes.yaml`. These docs are prose companions to them.

## History

Moved into the repo on 2026-07-18 from a mainframe scratch folder.
Rewritten 2026-10-05 to match what is built. Earlier version:
`git show 231cca937:docs/spaces/README.md`.
