# Rebuild phase audit — 2026-07-20 (superseded)

**SUPERSEDED on 2026-07-23 by [`remaining_work_2026-07-23.md`](./remaining_work_2026-07-23.md) (repo now alpha.196).** This snapshot was pinned to alpha.79 and has been displaced; read the newer doc for current status. The phase-by-phase notes below are kept for history only — do not treat them as current.

> **This is the current status source** for `implementation_plan.md`. That file's
> phase _definitions_ remain authoritative; its inline statuses are from
> 2026-07-10 and are stale. This audit verified every sub-item against code at
> `rebuild/2.0.0` @ `6477ced08` (four parallel readers, plan statuses ignored).

**Headline: the rebuild is far more built than the plan statuses suggest.**
Phases 0, 1, 2, 4, 6, 11, 12, 13 are essentially shipped; 3, 7, 8, 9 are mostly
shipped with small gaps. Remaining work clusters in Phase 5 (Nudges cutover),
Phase 10.1 (Kosmic projection), and Phase 14 (release hardening).

## Per-phase status

| Phase                        | Status          | Notes / gaps                                                                                                                                                                                                                                                                     |
| ---------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 Warm-up                    | shipped (moot)  | 0.1/0.2/0.5 prep steps bypassed — end states shipped directly                                                                                                                                                                                                                    |
| 1 Framework core             | **shipped**     | registry rename, manifest v2, `/api/v1/korners`, tootctl (incl doctor), 1.7 conformance all in                                                                                                                                                                                   |
| 2 Aesthetic                  | **shipped**     | tokens.yaml + generator + CI check; planet metaphor fully retired; `--space-color`→`--accent` swept                                                                                                                                                                              |
| 3 URL migration              | mostly          | 3.1/3.2 shipped (`/hub/<slug>` + 301s + dual-path Links). **3.3**: `Kronk::Url.hub_path` exists but has no callers — mailers/share-links unswept                                                                                                                                 |
| 4 Tune-in                    | shipped         | tune-out table, hub order, feed gate (flag-off default). **4.2** deliberately a Redis TTL cache, not a materialised view + cron                                                                                                                                                  |
| 5 Nudges cutover             | **least done**  | backend shipped (5.3 legacy flags, 5.4 Aggregator, 5.8 L10 gate). **5.5 bell NOT removed** (`navigation_bar.tsx:196`); **5.1/5.2** UI not unified (`notifications_v2` still imported, `async-components.js:10`); **5.7** no generic service, producers hand-wired, 2 deferred    |
| 6 Status linkage             | shipped         | `status_id` canonical on proposals + booth_sets; dual-write is Ruby-model (not DB trigger)                                                                                                                                                                                       |
| 7 Primitives                 | mostly          | Kategories, Search adapter, Groups shipped. **7.3** Meilisearch has no CI docker service. **7.5** `group_moderation_events` table never created                                                                                                                                  |
| 8 Kuestions v2               | mostly          | dedicated Question/Answer models+tables, visibility gate, backfill. **8.3** feed card still renders off Status `post_type`, not the `Question` model; `status_association` not made optional                                                                                     |
| 9 Huddle split               | mostly          | tables/models/mount shipped. **9.2** `Event.event_type='huddle'` retirement deferred. **9.3** emit/listen inverted (huddle emits `huddle.started` with no listener). **9.5** event-bus wiring not started (deferred — see decisions 2026-07-20)                                  |
| 10 InFlow/Wachuneed/Skeleton | mostly          | Wachuneed fully shipped. **10.1** Kosmic does NOT project into the feed (scheduler writes a row, no Status; `Inflow::PublishKosmicUpdate` doesn't exist; visible card is a client banner). **10.5** no `tree.yaml`; Skeleton shipped as a Kommons sub-feature, not behind a flag |
| 11 Org + Profile             | **shipped**     | `/kronk/*` markdown reader + wordmark; `content/kronk/` seeded; `/@user` sectioned profile; follower-approval default (via `locked`)                                                                                                                                             |
| 12 Nav chrome                | **shipped**     | wordmark, three-way switcher (Me/Home/Nudges), Kronk menu, mobile tab-bar, korner sub-bar. Label sets differ from plan wording                                                                                                                                                   |
| 13 New korners               | **shipped**     | moments/albutts/kompass manifests, `enforced:false`, shared stub card                                                                                                                                                                                                            |
| 14 Release hardening         | **not started** | version still `2.0.0-alpha.79`; flags unflipped (`tune_in_enforced`, `SEARCH_BACKEND`); spec still "Draft v0.5"; CHANGELOG unreleased; release PR not cut                                                                                                                        |

## What's left, ranked

**Tier 1 — path to a 2.0.0 release**

- **5.5** remove the bell from the nav (the headline user-facing cutover).
- **14** release hardening: bump `lib/kronk/version.rb` to `2.0.0`, flip `tune_in_enforced` + `SEARCH_BACKEND`, spec v0.5→v1.0, finalise CHANGELOG, cut the rebuild→main PR + DNS cutover.
- Base **lint/format** CI (pre-existing offenses) — green it before release.

**Tier 2 — feature gaps**

- **10.1** real Kosmic feed projection (build `Inflow::PublishKosmicUpdate`; scheduler should create the Status).
- **5.1/5.2/5.7** Nudges UI unification + a generic korner-notification service.
- **8.3** render the kuestions card from the `Question` model.
- **7.5** `group_moderation_events` table (or drop it from the plan).
- **3.3** adopt `hub_path` in mailers/share-links.

**Tier 3 — deferred / deliberate deviations (likely fine as-is)**

- 9.5 event-bus wiring (deferred, recorded 2026-07-20).
- 9.3 huddle/kalendar emit/listen inversion.
- 4.2 Redis cache vs materialised view.
- 7.3 Meilisearch CI service.
- Plan-wording deviations that met the sub-item goal (11.3 profile_sections table, 11.4 `locked`, 12.x label sets).

## Method

Four parallel readers, one per phase group (0-3, 4-6, 7-9, 10-14), each verifying
every numbered sub-item against code with file:line evidence. SHIPPED / PARTIAL /
NOT-STARTED per sub-item; full evidence tables in the audit run, condensed here.
