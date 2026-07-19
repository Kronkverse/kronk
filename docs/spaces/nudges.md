# Nudges (`nudges`)

**Manifest:** `config/korners/nudges.yaml` · **Mount:** `/nudges` (there is no `/hub/nudges` route) · **Status:** activity feed shipped; `enforced: false`

> Corrected 2026-07-19. This header previously read "Mount: `/hub/nudges` ·
> Status: shipped-2.0", which the manifest in the same repo contradicts —
> `nudges.yaml` carries `enforced: false # Path A: /hub/nudges mount missing`.
> The real routes are `/nudges`, `/nudges/activity` and `/nudges/:accountId`.
> Nudges is a top-level space, not a korner reached from the Hub grid; the
> pillar move is open (PR #331 closed 2026-07-18 pending the nav decision).

## Purpose

_One paragraph. What is this space for? Who uses it and why?_

## Current shape (1.7.x)

_Where the code lives today. Bullet the key models/controllers/features._

## Rebuild vision (2.0.0)

_What changes. Data-model shifts, URL moves, gate flips, retirements. Cross-link to phases in `/home/shared/rebuild/plan/quiet-napping-hare.md`._

## Open decisions

- _Delete each line as it's answered._

## Related drafts

- `/home/shared/rebuild/memory/project_kronk_rebuild_<topic>_spec_draft.md`
- `/home/shared/rebuild/spec/kronk_korner_spec.md` §_N_
