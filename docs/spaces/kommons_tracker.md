# Kommons as the rebuild's build-tracker — plan

Turn every remaining piece of the 2.0 build into a Kommons proposal, so the
platform tracks its own construction — and we harden Kommons by living in it.

> Status: **plan, not yet built.** Sources: `../rebuild/phase_audit_2026-07-20.md`,
> `../rebuild/remaining_work_2026-07-20.md`, and the Kommons schema
> (`proposals`, `tasks`, `proposal_backings`, `token_*`).

## The insight: the primitives already exist

Kommons is further along than "console-only" suggests, and — crucially — **the
checklist is already a model.**

A `Proposal` already carries: `title`, `body`, `summary`, a `status` lifecycle
(`open` → `delivered` → `completed` / `annulled`), a **`node_id`** that pins it
to a Skeleton node, a **`categories`** tag array (GIN-indexed), a
`proposal_type` (small/medium/large), and `parent_proposal_id` for nesting.

And a `Proposal` **has many `tasks`** — each a row with a `title`,
`description`, and a `status` of `open` / `in_progress` / `done`. **That is the
checklist.** There is already an `api/v1/tasks_controller`.

So this is not "build a tracker." It is two moves: **populate the model** from
the docs, and **surface it** in the UI. And the second fit is the payoff: every
proposal's `node_id` means the **Skeleton and Lattice already draw the count of
open proposals on each node**. Anchor the build items to nodes and the map
_becomes_ the build-status view for free — a glance shows which limb has the
most left to do.

## How the work maps onto proposals

One **proposal per theme** (a phase, a korner's UI, a track), not one per
micro-item, so the board stays readable. Inside each, the concrete steps become
**tasks** (the checklist). Fields do the organising:

- **`node_id`** — anchor to the Skeleton node the work lives on
  (`nudges.index`, `booth.index`, `kommons.index`…). Drives the map badges.
- **`categories`** — filter tags: `rebuild` on every tracker proposal, plus
  `phase-5`, `release`, `korner:booth`, `framework`, `settings`, so a lens can
  show one slice.
- **`tasks`** — the checklist. A proposal's progress is `done ÷ total`.
- **`proposal_type`** — small/medium/large, a rough size signal.
- **`status`** — the proposal's own lifecycle; a theme flips to `completed`
  when its tasks are done.

## The proposal set

Drawn from `phase_audit_2026-07-20.md` and `remaining_work_2026-07-20.md`.
Each row is one proposal, its anchor node, and its checklist. This is the full
backlog — the tracker's initial content.

### ① Release track — the path to 2.0.0 (critical)

| Proposal                         | Anchor               | Tasks                                                                                                                                          |
| -------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Phase 5 — Nudges cutover**     | `nudges.index`       | remove the bell (nav); unify the Nudges UI (retire `notifications_v2`); generic korner-notification service (§5.7); fold notification prefs in |
| **Phase 14 — Release hardening** | `kronk.how_it_works` | bump `version.rb` → 2.0.0; flip `tune_in_enforced` + `SEARCH_BACKEND`; spec v0.5 → v1.0; finalise CHANGELOG; cut rebuild→main PR + DNS         |
| **Green the base CI**            | `kronk.how_it_works` | clear pre-existing lint/format/i18n offenses so release CI is clean                                                                            |

### ② Feature gaps — backend shipped, piece missing

| Proposal                                | Anchor            | Tasks                                                                                                          |
| --------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------- |
| **10.1 — Real Kosmic feed projection**  | `inflow.index`    | build `Inflow::PublishKosmicUpdate`; scheduler creates a Status, not just a row; retire the client-side banner |
| **8.3 — Kuestions card from the model** | `kuestions.index` | render the feed card off the `Question` model, not `post_type`; make `status_association` optional             |
| **7.5 — group_moderation_events**       | `groups.index`    | create the table, or drop it from the plan                                                                     |
| **3.3 — Adopt hub_path in links**       | `hub.landing`     | `Kronk::Url.hub_path` has no callers; sweep mailers + share-links onto it                                      |

### ③ Framework gaps — the korner platform

| Proposal                                   | Anchor               | Tasks                                                                               |
| ------------------------------------------ | -------------------- | ----------------------------------------------------------------------------------- |
| **Launch card producer (§8.7)**            | `kronk.how_it_works` | declared in 10 manifests, parsed, but nothing emits it — build the producer/service |
| **Korner tombstones / 410 Gone (§5.6)**    | `kronk.how_it_works` | `deleted_at` + 410 resolution for korner objects, not just AP Statuses              |
| **Complete "every space gets a manifest"** | `kronk.how_it_works` | core-space manifests done; finish node-ownership migration off `kronk_nodes.yaml`   |
| **L7 stylelint-governance doctor check**   | `kronk.how_it_works` | spec lists it ⚙︎; doctor implements L1/L3/L4/L5/L10 only                           |
| **Make `render_target` live (§9.1)**       | `kronk.how_it_works` | inert today; app-shell path unbuilt — also open decision §13.2                      |

### ④ Per-korner UI — backend shipped, surface unbuilt

| Proposal                       | Anchor            | Tasks                                                                                                                               |
| ------------------------------ | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Groups → Krew**              | `groups.index`    | audience-scoping (the central promise); Krew badge; listed/unlisted + invite links; Event↔Krew; the `groups→krew` vocab/URL rename |
| **Wachuneed UI**               | `wachuneed.index` | listing detail + composer; the 5 interaction modes; "or trade" flag; mate-affinity signals                                          |
| **Kommons backing / token UI** | `kommons.index`   | backing is console-only; token display glyph; "reflect on this page" button                                                         |
| **Kuestions UI**               | `kuestions.index` | swipe deck; answer-format field; daily-prompt post-box; answer edit history                                                         |
| **Kalendar**                   | `kalendar.index`  | birthdays; event visibility scopes; Krew-spawn-from-event; playful RSVP labels; spiral view                                         |
| **Huddle**                     | `huddle.index`    | Main + per-Krew Huddle model; flat moderation; capacity cap                                                                         |
| **Booth**                      | `booth.index`     | `kind` taxonomy; BoothSeries; save/library + live listener count; storage migration                                                 |
| **Inflow**                     | `inflow.index`    | unified dashboard (retire 4 strand tabs); observations response UI; Kosmic subscribe toggle                                         |

### ⑤ Settings retirement — blocks killing classic `/settings`

| Proposal                                   | Anchor             | Tasks                                                                                                         |
| ------------------------------------------ | ------------------ | ------------------------------------------------------------------------------------------------------------- |
| **Account & Security rehome**              | `settings.account` | 2FA, sessions, apps, migration, delete, export/import — still classic-only, must move to SPA                  |
| **Notifications → Nudges** (decided 07-20) | `nudges.index`     | fold notification prefs into Nudges; retire the standalone Notifications page + `settings.notifications` node |
| **Privacy → Profile** (decided 07-20)      | `profile.edit`     | fold Privacy into "Me"; retire `settings.privacy` node                                                        |
| **Profile composer completeness**          | `profile.edit`     | can't yet edit avatar/header/display-name but advertises `lifecycle: live`                                    |

### ⑥ Quick correctness fixes (Tier 0) — one proposal, a task each

Anchor `kronk.how_it_works`:

- `settings.account` / `settings.data` nav nodes lead nowhere (URLs, no route)
- `default_quote_policy` absent from the posting-settings API
- dead `features/market` "Coming Soon" placeholder
- `fetch_link_card` allow-list uses legacy korner paths, not `/hub/<slug>`
- dead `interactions.must_be_follower/following` settings keys
- Wachuneed `subcategory` column removal (doc says retired; still persists)

## Kommons building Kommons

The loop: putting the backlog _into_ Kommons immediately surfaces what Kommons
needs to be usable — and each becomes its own tracked proposal, anchored to
`kommons.index`. The data is there; these are the surfaces.

- **Task checklist on the proposal page** — render `proposal.tasks` as a
  checkable list; toggling a task hits `tasks_controller`. The single
  highest-value piece: without it, the checklists are invisible.
- **Progress on the card + the map** — a proposal card shows `done ÷ total`;
  the Skeleton/Lattice node badge (already drawing open-proposal counts) reads
  the same, so the map shows build progress.
- **Browse by node and by category** — a node's detail lists its proposals
  ("what's left here"); a `category: rebuild` lens is the whole board. Both are
  query filters on data that already exists.
- **Backing / token UI** — surface the token ledger + backing that's
  console-only today, so we can weight what to build next by backing proposals.

None of these need new tables — they render `tasks`, `categories`, `node_id`,
and the token models that already ship. The act of loading the tracker _is_ the
spec for the next Kommons UI proposals.

## How the proposals get created

~30 proposals and ~90 tasks — too many to hand-type well, and we want them
reproducible.

- **Source of truth = a data file in the repo** — a `config/kommons_tracker.yaml`
  (or seed) listing each proposal: title, body, node, categories, type, and its
  tasks. Version-controlled, reviewable, and the tracker can be re-synced from it.
- **An idempotent seeder** — a rails task that upserts proposals + tasks from
  that file (keyed by a stable slug in `categories` or the title), run on
  shadow's rebuild DB. Safe to re-run as the backlog shifts.
- **A handful via the composer** — deliberately create two or three through the
  actual UI first, to dogfood the compose flow before bulk-seeding the rest.

Change the YAML, re-seed, the tracker updates — and the file doubles as a
human-readable backlog in the repo.

## Sequence

1. **Make the tracker viewable.** Build the task-checklist on the proposal page
   - node/category filtering (minus backing). Small, and everything else depends
     on being able to _see_ it.
2. **Author & seed the backlog.** Write `kommons_tracker.yaml` from this plan,
   create 2–3 via the composer, seed the rest. Now the Skeleton/Lattice show
   live build progress.
3. **Use it, and let it drive the next round.** Work items off it, tick tasks,
   and file the friction (backing UI, sorting, whatever's missing) as fresh
   Kommons proposals. Kommons hardens by carrying its own build.

## Decisions (resolved 2026-07-20)

1. **Granularity** — one proposal per theme, its steps as a task-checklist
   (~30 proposals).
2. **Anchor to the map** — yes; each proposal pins to a Skeleton `node_id`, so
   the Skeleton/Lattice node badges read as live build status.
3. **Order** — **seed first.** The map lights up with build-status badges the
   moment the proposals land (the badges already render); the task-checklist UI
   follows so the checklists themselves become visible.
4. **Open decisions** — tracked as their own `decision`-category proposals on
   the board, so blockers stay visible.

Implemented as `config/kommons_tracker.yaml` (the backlog, source of truth) plus
`bin/rails kommons:tracker:seed` (idempotent, keyed on proposal title). Every
theme hangs off one root proposal, `Kronk rebuild — build tracker`, via
`parent_proposal` — so the board is `root.child_proposals` and each theme still
anchors to its own `node_id`. (Track/phase tags live in the proposal body, not
the `categories` column, which is a validated legacy taxonomy slated for
retirement.) Run on shadow's rebuild DB with `ACCOUNT=<username>`.
