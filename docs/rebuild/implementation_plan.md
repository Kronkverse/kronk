# Kronk 2.0.0 Rebuild — Implementation Plan

> **Provenance.** Written 2026-07-10 under the codename `quiet-napping-hare`. Moved into
> the repo 2026-07-18 from `/home/shared/rebuild/plan/quiet-napping-hare.md` on the
> mainframe, which was its only copy. Local clone paths (`/home/claude/kronk-rebuild/...`)
> were rewritten repo-relative; nothing else was changed.
>
> **Read this correctly.** The _phase definitions_ below are authoritative — they are the
> canonical statement of what each phase contains, and nothing supersedes them. The _phase
> statuses_, PR counts and the "~15 calendar weeks" estimate are from 2026-07-10 and are
> stale. Several phases described here as planned have since shipped. For current status
> see the latest in-repo backlog — **`docs/rebuild/remaining_work_2026-08-04.md`** — not this
> file's inline statuses (which reconcile individual phases as they're audited: currently
> Phase 5 at 2026-08-03 and Phase 13 at 2026-08-04). Older audits
> (`phase_audit_2026-07-20.md`, `remaining_work_2026-07-23.md`) are kept for history;
> both are marked superseded. (Audits live in the repo now, per the source-of-truth
> doctrine; the old `~/kronk-notes/audits/` location on mainframe is retired.)

## Context

Kronk 1.7.0 shipped the first-pass "Korner framework": a manifest-driven system that lets thematically-scoped feature spaces (Kommons, Kuestions, Kalendar, Booth, InFlow, Nudges, etc.) register themselves via `config/korners/*.yaml`. Every existing korner has a retroactive manifest; a boot-time drift check warns without wedging production; a CLI (`bin/tootctl korners list`) surfaces drift.

Between 1.7.0 shipping and today (2026-07-10), Tal has workshopped a **rebuild spec** covering ~20 sections: manifest v2 (§1), language (§2), aesthetic tokens (§6), URL grammar (§4), storage discipline (§5), security (§7), feed projection (§8), platforms (§9), operations (§10), notifications-as-Nudges (§N), settings space (§K), org space (§O), profile rebuild, Kategories, Groups, Search, and new korners (Moments, Albutts, Map). One large paradigm pivot: **the planet metaphor is retired** — no more per-korner colour identity, shared Kronk-purple palette instead.

The rebuild ships as **Kronk 2.0.0**. Reason: the 2.x semver line was already reserved for it; every meaningful piece of the platform's foundation is touched; the surface break (URL grammar, notifications flip, planet metaphor drop) is too large for a minor bump. `main` stays on the 1.7.x line throughout; rebuild work targets a long-lived integration branch `rebuild/2.0.0`. Shadow env (`shadow.kronk.info`) is the dogfooding surface.

Intended outcome: a 2.0.0 release that (a) formalises the Korner framework to spec conformance, (b) retires the planet metaphor and replaces it with a token system, (c) migrates every korner under `/hub/<slug>`, (d) makes tune-in a real per-korner mechanism, (e) replaces the notifications bell with the Nudges chat surface, (f) ships the org space + rebuilt profile, and (g) lays the primitive layer (Kategories, Groups, Search) that 2.x new korners depend on.

## Phase overview

| #   | Phase                                                                          | PRs | Est. cal. time | Blocked by                |
| --- | ------------------------------------------------------------------------------ | --- | -------------- | ------------------------- |
| 0   | Warm-up (ships to `main` as 1.7.x)                                             | 5   | 1 week         | none                      |
| 1   | Framework core (manifest v2, registry rename, API, CLI)                        | 6   | 1.5 weeks      | Phase 0                   |
| 2   | Aesthetic system (tokens, planet retirement)                                   | 5   | 1.5 weeks      | Phase 0 (parallel with 1) |
| 3   | URL & routing migration to `/hub/<slug>`                                       | 3   | 3 days         | Phases 1, 2               |
| 4   | Tune-in + Hub personalisation                                                  | 4   | 1 week         | Phase 3                   |
| 5   | Nudges cutover (retire bell)                                                   | 6   | 2 weeks        | Phase 4                   |
| 6   | Status linkage canonicalisation                                                | 3   | 4 days         | Phase 1                   |
| 7   | Primitives: Kategories → Search → Groups                                       | 7   | 2.5 weeks      | Phase 4                   |
| 8   | Kuestions v2 (dedicated model + gate)                                          | 4   | 1 week         | Phase 6                   |
| 9   | Huddle korner split (Kalendar decouple)                                        | 4   | 1 week         | Phases 3, 6               |
| 10  | InFlow kosmic + Wachuneed greenfield + Skeleton WIP                            | 5   | 1.5 weeks      | Phase 1                   |
| 11  | Org space `/kronk/*` + Profile rebuild `/@user`                                | 4   | 1 week         | Phase 3                   |
| 12  | Nav-chrome redesign (Kronk menu, three-way switcher, wordmark, mobile tab-bar) | 3   | 1 week         | Phases 3, 11              |
| 13  | 2.x new korner manifests (Moments, Albutts, Map) — `enforced: false`           | 3   | 3 days         | Phase 1                   |
| 14  | Release hardening + main PR                                                    | 3   | 1 week         | all above                 |

**Total:** ~65 PRs, ~15 calendar weeks with parallelisation. Serial critical path ~10 weeks.

**Version scheme:** Phase 0 PRs bump 1.7.x on `main`. Phases 1–13 PRs into `rebuild/2.0.0` bump `2.0.0-alpha.N` as needed. Phase 14 opens the single main PR titled `2.0.0`.

**Parallelisation tracks** feeding `rebuild/2.0.0`:

- **A (framework):** 1 → 3 → 4 → 5 (serial critical path)
- **B (aesthetic):** 2 in parallel with 1; rebases when 1.2 lands
- **C (data):** 6 → 8 → 9 after Phase 1
- **D (primitives):** 7 after Phase 4
- **E (surfaces):** 10, 11, 12, 13 after Phase 1 + Phase 3

Recommended: 3–5 active PRs in review at any time across tracks. Integration branch rebases nightly.

---

## Per-phase detail

### Phase 0 — Warm-up (target: `main`, ships as 1.7.x)

Safe self-contained cleanups that reduce diff surface on the rebuild branch.

- **0.1 (1.7.1)** Extract shared SCSS accent-mixin from `_status_kommons_card.scss` to reduce Phase 2 sweep.
- **0.2 (1.7.2)** Refactor `bin/tootctl korners list` output columns into a shared formatter helper (prep for `describe`/`doctor`).
- **0.3 (1.7.3)** Build `Kronk::FeatureFlags` class — YAML-declared flags in `config/feature_flags.yaml`, boolean readers, `Rails.env`-scoped overrides. RSpec unit spec. **This closes a gap the Plan agent assumed existed.**
- **0.4 (1.7.4)** Create empty `app/javascript/mastodon/tokens/` with `README.md` reserving the path. Zero runtime effect.
- **0.5 (1.7.5)** Add stub `docs/korners/reserved_slugs.md` describing the concept; cross-link from `docs/kronk_korner_spec.md` §4.

Testing: existing lint + `test-ruby`, `test-js`, `test-migrations`. No migrations.

### Phase 1 — Framework core (target: `rebuild/2.0.0`)

Bring the manifest system in line with spec §1; boot warnings only (never raises).

- **1.1** Rename `Korners` → `Kronk::KornerRegistry`. Keep `Korners` as deprecated alias for one release. Sweep 3 call-sites.
- **1.2** Expand `Manifest` struct to full §1 fields (`resources`, `security`, `notifications`, `feed_projection` subfields, `settings`, `emits`, `listens`, `hub_teaser`, `launch`, `aesthetic`). Drop `planet:`. Backfill all 10 manifests to populate the new keys (no behaviour change).
- **1.3** Add `config/korners/reserved_slugs.yaml` + boot check. Reserved: `hub`, `settings`, `kronk`, `admin`, `api`, `auth`, `oauth`, `.well-known`, `nudges`, `home`, `explore`, `search`, `tags`, `notifications`, `favourites`, `bookmarks`, `lists`, `filters`, `preferences`, `follow_requests`, `mutes`, `blocks`, `apps`, `invites`, `media`.
- **1.4** `GET /api/v1/korners` + `GET /api/v1/korners/:slug/manifest`. New `Api::V1::KornersController` + `REST::V1::KornerSerializer` following `Api::V1::InstancesController` pattern (`app/controllers/api/v1/instances_controller.rb`, `app/serializers/rest/v1/instance_serializer.rb`).
- **1.5** `bin/tootctl korners describe <slug>` — dumps manifest as JSON/YAML.
- **1.6** `bin/tootctl korners doctor` — runs boot validator synchronously, exits non-zero on drift.
- **1.7** Security-shape conformance (spec §L1). Migrate the 8 root-level manifests (`booth`, `inflow`, `kalendar`, `klot`, `kommons`, `kuestions`, `wachuneed`, `nudges`) to the nested `security:` block; rename remaining `steward_role` → `maintainers` (8 manifests — the same set; `you.yaml` already renamed, `groups.yaml` uses `ownership_model`). If `nudges.yaml` is retired in Phase 5 (see `decisions.md`), skip migrating it. Today `extract_security` (`config/initializers/kronk_korner_registry.rb:200`) synthesizes a block from the legacy root-level fields, so the doctor's `security.blank?` L1 check cannot tell canonical from legacy — stop it masking the difference (or tag synthesized blocks) so `doctor` can warn. Gate: enforced korners require the canonical nested block. Decide Klot's `klot_phase_viewer` scope — fold into the shared scope model or record a sanctioned bespoke exception (see `decisions.md`).

Testing: RSpec heavy; new request specs for API; CLI specs.
Blocks: everything downstream that talks to the registry.

### Phase 2 — Aesthetic system

- **2.1** Add `app/javascript/mastodon/tokens/tokens.yaml` with 5 Kronk-purple accent tokens (dark + light). Add `bin/generate-tokens` — Ruby script, no new dep. CI check: `bin/generate-tokens --check` fails if generated diverges from committed.
- **2.2** Import generated `_tokens.scss` from `_variables.scss`; alias `--space-color` → `--accent`. Both names emit for one release.
- **2.3** Sweep `app/javascript/mastodon/*` SCSS + TSX inline styles for `--space-color` → `--accent`. Mechanical, reviewable.
- **2.4** Delete `app/javascript/mastodon/planets.tsx`. Replace `spaceColor()`, `planetName()`, `planetIcon()` sites (~13 files) with `useKorner(slug)` hook reading accent from manifest. Drop `planet:` from all manifests.
- **2.5** Retire `docs/spaces.md`, update `CLAUDE.md` to point at spec §3.

Testing: Vitest + Storybook visual on shadow.

### Phase 3 — URL migration to `/hub/<slug>`

- **3.1** Add `/hub/:slug` route family; existing routes (`/governance`, `/booth`, etc.) 301 to `/hub/kommons`, `/hub/booth`, etc.
- **3.2** Update in-app `<Link>` navigation to prefer `/hub/<slug>`. Old links continue to work via redirect.
- **3.3** Deep-link / mailer / push URLs regenerated. Add `Kronk::Url.hub_path(slug, *rest)` helper; sweep mailers and share-links.

Testing: RSpec redirect specs; integration spec walks every enforced korner's canonical route.
Rollout: shadow first; DNS cutover (`mastodon.kronk.info` → `kronk.info`) coordinated at Phase 14.

### Phase 4 — Tune-in + Hub personalisation

- **4.1** `korner_tune_outs(user_id, korner_slug, tuned_out_at)` table + partial unique index. **Uses implicit default: absence of a row = tuned in.** Matches Tal's "all tuned in on migration" decision and avoids the 1.5M-row backfill risk (R1). Existing users have no rows on migration → they're all tuned in.
- **4.2** Materialised view `korner_tune_in_counts` + refresh job every 5 min (counts derived from user total minus tune_outs).
- **4.3** `user_hub_order(user_id, korner_slug, position)` + `/api/v1/hub/order` REST endpoint.
- **4.4** Feed gate — home timeline query respects tune-outs. Guarded behind `Kronk::FeatureFlags.tune_in_enforced?` (default `false` until Phase 14).

Testing: migration specs; timeline spec matrix (flag off = no change; flag on = filtered).

### Phase 5 — Nudges cutover

**STATUS — reconciled against code 2026-08-03 (`rebuild/2.0.0` tip): Phase 5 is substantially shipped.** The delivery architecture diverged from the single-`KornerNotificationService` plan into **two coexisting paths**: (a) the in-process **event bus** — `Kronk::KornerEvents` → `Nudges::EventRouter` → a `Nudges::Event` on a Mate/Krew conversation, wired by each manifest's `listens:` block — carries `backed` / `frothed` / `commented`; and (b) the **`Notification` path** via `Kronk::KornerNotifier` (`app/lib/kronk/korner_notifier.rb` — the plan's "KornerNotificationService" under a different name) — carries the declared `notifications.types` (`proposal_challenged`, `proposal_status_changed`, `task_assigned`).

| Item | Status             | Reality in code                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5.1  | Done (renamed)     | Legacy tree preserved as `features/nudges_legacy` (`NudgesLegacyArchive` at `/nudges/legacy`), not `features/notifications_legacy` at `/hub/nudges?tab=legacy`. `/notifications`, `/conversations`, `/nudges/activity` `Redirect` → `/nudges` (`features/ui/index.jsx`). `features/notifications` is now dead (still cross-imported by two `notifications_v2` components).                                                   |
| 5.2  | Substantially done | `features/nudges_messenger` (18 files) is the primary chat-form surface; `features/notifications_v2` is _retained_ for shared components (compose reply/edit indicators, boost modal), not folded away.                                                                                                                                                                                                                      |
| 5.3  | Done               | `Notification::PROPERTIES` carries `legacy: true` markers; `scope :legacy_archive` (`notification.rb:190`) + the `NudgesLegacyArchive` view.                                                                                                                                                                                                                                                                                 |
| 5.4  | Done               | `Nudges::Aggregator` (service + spec + `Api::V1::Nudges::ActivityController`). Write-side aggregation added in #1095 (`EventRouter` honours a manifest `aggregation.window`).                                                                                                                                                                                                                                                |
| 5.5  | Done               | Classic tabs bar retired; **Nudges is a hub-switcher pillar** (`Me / Home / Hub / Nudges`, `hub_switcher.tsx`) carrying the unread badge (`selectHasUnreadNudges`). No bell in nav.                                                                                                                                                                                                                                          |
| 5.6  | Done, re-scoped    | Only types whose surfaces fire are declared. `kommons.yaml` declares `proposal_challenged`, `proposal_status_changed`, `task_assigned`; `backed`/`frothed`/`commented` deliver via the event bus (`nudges.yaml` `listens:`), not as `Notification` types. The `kommons.yaml` comment calling `proposal_backed`/`proposal_comment` "deferred — surfaces don't exist yet" is **stale** (both now fire; froth + comment #1099). |
| 5.7  | Done               | Generic emit path is `Kronk::KornerNotifier`. Producers live: `backed` (`kronk/tokens.rb`), `frothed` (`favourite.rb`), `commented` (`proposal_comment.rb`, #1099), `challenged` + `task_assigned` (`korner_notifier.rb`).                                                                                                                                                                                                   |
| 5.8  | Done               | L10 conformance check IS built (`lib/mastodon/cli/korners.rb:260` — flags declared-but-unregistered notification types + unresolved `subject_type`).                                                                                                                                                                                                                                                                         |

**Genuinely remaining:** notification-email prefs (`notification_emails.*`, `always_send_emails`, `software_updates`) not yet absorbed into the Nudges settings surface; dead-`features/notifications` cleanup (blocked on relocating the two components `notifications_v2` imports); optional polish (reply-fan-out to the parent commenter, comment-burst aggregation via the manifest-driven listen path). The "Shadow dogfood ≥3 days before 5.5" gate is **moot — 5.5 shipped**.

_Original planning list (historical — see status table above for current state):_

- **5.1** Rename `features/notifications` → `features/notifications_legacy`; add transitional route `/hub/nudges?tab=legacy` mounting legacy tree read-only.
- **5.2** Promote `features/notifications_v2` + `features/nudges` into unified `features/nudges` tree. Chat-form UI primary.
- **5.3** `Notification::PROPERTIES` — mark all non-`nudge` types with `legacy: true`. Add `Notification::LegacyArchive` scope + view.
- **5.4** `Nudges::Aggregator` service — groups repeated actor+verb+object within 10-min window.
- **5.5** Remove bell icon from nav; wordmark / Nudges tab becomes the surface.
- **5.6** Declare 5 Kommons notification types in the manifest (per delta rollup): `proposal_backed`, `proposal_challenged`, `proposal_comment`, `proposal_status_changed`, `task_assigned`. Each marked interactive (nudge) or passive (notice).
- **5.7** Make L10 a real delivery path, not just declarations. Framework registration for manifest-declared `notifications.types`, plus a generic `Kronk::KornerNotificationService` korners call to emit. Build the producers for the 4 declared-but-unbuilt types from 5.6 (`proposal_backed`, `proposal_challenged`, `proposal_comment`, `task_assigned`); the `Task` model, table and migration already exist (`app/models/task.rb`), so the remaining work is the notification producer + type registration, not new models. Only `nudge` + `proposal_status_changed` are registered today (`app/models/notification.rb:107,115`); everything else declared across korners is `legacy: true` or absent.
- **5.8** L10 doctor gate (spec §3 item 7). Extend `detect_conformance_issues` (`lib/mastodon/cli/korners.rb:152`) so every `notifications.types[].name` a manifest declares resolves to a registered `Notification` type and its `subject_type` to a real model; enforced korners with phantom types fail. Do this first within the phase — it stops new phantom types merging while 5.7 builds the real ones. (Currently there is no notifications check in `korners.rb`; §3 lists this as planned item 7.)

Testing: RSpec per-type test matrix; Vitest tab UI. Shadow dogfood ≥3 days before merging 5.5.

### Phase 6 — Status linkage canonicalisation

- **6.1** Migration adds `status_id` alias column on `proposals` populated from `discussion_status_id`. Trigger-based dual-write.
- **6.2** Sweep code readers from `discussion_status_id` → `status_id`. Old getter kept as `deprecated_alias`.
- **6.3** Migration adds `status_id` on `booth_sets` + `Status.has_one :booth_set`. **Blocking piece for Booth feed projection.**

Testing: migration specs; polymorphism sanity specs.
Rollout: dual-write one release; old column removed in 2.1.0.

### Phase 7 — Primitives (Kategories → Search → Groups)

Serial internally, per Tal's decision.

- **7.1** Add `curated:boolean` on `tags`; seed migration inserts ~20 default kategories from `config/kategory_defaults.yaml`.
- **7.2** Kategories API — `GET /api/v1/kategories`; filter tag search by curated. Explore UI hookup.
- **7.3** `Search::Meilisearch` adapter behind `SEARCH_BACKEND=meilisearch` env. Elasticsearch stays default until Phase 14. Docker-compose service in `test-ruby.yml` (nightly, not per-PR).
- **7.4** Search UI wired to Meilisearch when flag on.
- **7.5** Groups tables migration (`groups`, `group_memberships`, `group_moderation_events`).
- **7.6** Seeder + peer-support governance rules.
- **7.7** Groups API + UI stub under `/hub/groups`; manifest with `enforced: false`.

### Phase 8 — Kuestions v2

Depends on Phase 6.

- **8.1** New `questions` and `answers` tables (dedicated, not Status-polymorphic). Models + RSpec.
- **8.2** Answer-before-view gate — `Kuestions::VisibilityGate` policy; unanswered users see the question but not others' answers. Policy specs + request spec.
- **8.3** Feed projection card `kuestions_card` renders from `Question`, not `Status`. Manifest's `feed_projection.status_association` becomes optional.
- **8.4** Data migration from existing question-shaped Statuses into `questions`/`answers`; dual-read one release.

### Phase 9 — Huddle korner split

Depends on Phase 6, Phase 3.

- **9.1** New `huddle_sessions` + `huddle_participants` tables. Models + RSpec.
- **9.2** Retire `Event.event_type: 'huddle'` — data migration moves existing rows into `huddle_sessions`; leaves `events.huddle_session_id` FK for Kalendar linkage.
- **9.3** New `config/korners/huddle.yaml` with `emits: [huddle.started]`; Kalendar `listens: [huddle.started]`. Add tiny in-process event bus `Kronk::KornerEvents.publish/subscribe` sufficient for §6.
- **9.4** Huddle korner UI moves to `/hub/huddle`.
- **9.5** Event-bus wiring + runtime gate. The 9.3 `publish/subscribe` primitive shipped (`lib/kronk/korner_events.rb`), but the wiring did not — there are zero `KornerEvents.subscribe` calls in application code (only in specs), so every emit publishes into a void. Add the boot initializer that reads each manifest's `listens:` and registers real `Kronk::KornerEvents.subscribe` handlers. Upgrade `detect_orphan_listens` (`lib/mastodon/cli/korners.rb:323`) to check registered subscribers, not manifest text. Reconcile declared-but-unpublished `emits` (Wachuneed declares 5, publishes 0 — the Wachuneed/InFlow emit _implementation_ lands in Phase 10; 9.5 owns only the gate) and unwired `listens` (Huddle → `kalendar.event.created`): wire or drop each. Gate: a declared `emits`/`listens` with no runtime counterpart = `doctor` fail.

### Phase 10 — InFlow, Wachuneed, Skeleton

Parallel PRs, single phase for scheduling clarity.

- **10.1** `kosmic_updates` model + migration + scheduled job projecting daily InFlow update into feed.
- **10.2** InFlow manifest updated with `emits`/`feed_projection`.
- **10.3** Wachuneed greenfield — `listings`, `listing_photos`, `listing_offers` tables. Reference implementation.
- **10.4** Wachuneed manifest fully populated + `feed_projection.card = wachuneed_card` wired.
- **10.5** `config/korners/tree.yaml` marked `enforced: false`; Skeleton UI ships behind flag.

### Phase 11 — Org space + Profile rebuild

- **11.1** `/kronk/*` mounts markdown reader serving files from `content/kronk/` (per spec §O). Wordmark click routes to `/kronk`.
- **11.2** Seed `content/kronk/` with `about.md`, `values.md`, `contributors.md`, `governance.md`, stub `privacy.md`, `terms.md`, `contact.md`, `rules.md`. Content-only PR.
- **11.3** `/@user` sectioned profile — sections driven off manifests' `feed_projection` (korner-driven) + curated tags (kategory-driven) + Timeline. Owner picks order via new `profile_section_order` column.
- **11.4** `follower_approval_required` default `true` for new signups; existing users unchanged.

### Phase 12 — Nav-chrome redesign

Per Tal's mockup at `talitamoss.info/files/uploads/kronk_feed_redesign.html`. Ships as its own phase inside 2.0.0.

- **12.1** ЖЯѺƝ₭ wordmark top-left (routes to `/kronk` per Phase 11.1). Three-way top switcher Feed / Profile / Hub on desktop. Remove side navigation bar.
- **12.2** Kronk floating button with radial menu (Profile, Settings, Post, Search, Nudges). Bottom tab-bar on mobile with same three primaries.
- **12.3** Sub-bar (when inside a korner): back-to-Hub + breadcrumb glyph.

Testing: Vitest heavy on router + layout; visual regression via Storybook stories for each chrome piece.

### Phase 13 — 2.x new korner manifests

**STATUS — reconciled against code 2026-08-04.** Phase 13's original scope ("tiny stub PRs with `enforced: false` and coming-soon cards") is retired. All three korners have gone well beyond stubs; the status table below is authoritative. Original planning list preserved after for history.

| Item         | Status               | Reality in code                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------ | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 13.1 Moments | **Done, end-to-end** | Full model + composer + Home strip + korner page + deep-link viewer + per-Moment visibility (reach ladder + krew, editable after posting) + Log archive. Camera-in-composer (#1112). Photo + voice-clip pairing (#1119) built on shared `components/media/` (#1117). Spec at `docs/spaces/moments.md`. Manifest `enforced: true`.                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 13.2 Albutts | **Done, end-to-end** | Full backend (alpha.315) + frontend directory/detail/composers + feed card + Mate-gated new-photo fan-out nudges + Kalendar `spawn_album` linkage (alpha.315–.320). Status-backed photo refactor (#1028 — AlbumPhoto is now a thin join to Status; favourites/replies ride the standard pipeline). Zombie-row cleanup (#1106/#1109). Spec at `docs/spaces/albutts.md`. Manifest `enforced: true`.                                                                                                                                                                                                                                                                                                                                                                        |
| 13.3 Map     | **Done, end-to-end** | Renamed from Kompass at alpha.215; `/hub/kompass` still redirects. Full backend: `PresenceState` + `Trek` models, `Api::V1::Map::{PresenceController,TreksController}`, `Kronk::GeoCoarsen` (server-side raw→fuzzed point) + `Kronk::RoutePrivacy` (route trimming), migrations `create_presence_states` + `create_treks` (2026-07-24). Full SPA at `features/map_v2/` — Trek recording + GPX drag/drop/import + log-a-trek from compose bubble + Firehose Map/Trek card + people strip (#1029). Presence refresh is 30 s HTTP polling; realtime pubsub deferred to 2.1 as polish. The earlier "backend still to build" claim in the manifest header (and in an earlier cut of `remaining_work_2026-08-04.md`) was stale — both fixed in the same PR as this correction. |

_Original planning list (historical):_

- **13.1** `config/korners/moments.yaml` — ephemeral, 24h expiry noted in `settings`.
- **13.2** `config/korners/albutts.yaml` — shared albums.
- **13.3** `config/korners/map.yaml` — opt-in presence.

### Phase 14 — Release hardening + main PR

- **14.1** Flip `Kronk::FeatureFlags.tune_in_enforced` default to `true`. Flip `SEARCH_BACKEND` default to `meilisearch`.
- **14.2** Regenerate CHANGELOG.md summarising every rebuild PR. Bump `lib/kronk/version.rb` to `2.0.0`. Update `docs/kronk_korner_spec.md` v0.5 → v1.0. Retire `docs/spaces.md`.
- **14.3** Single PR `2.0.0`: `rebuild/2.0.0` → `main`. Body enumerates the 60+ PRs merged into the integration branch and points to the rollout runbook. DNS cutover `mastodon.kronk.info` → `kronk.info` coordinated with merge.

---

## Risk register

| #   | Risk                                                                                                            | Mitigation                                                                                                                                                 |
| --- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Explicit-row backfill for tune-in (`korner_tune_ins` × all users × all korners) locks DB at scale.              | **Resolved:** use `korner_tune_outs` (implicit-default) instead. Absence = tuned in. Matches Tal's decision and eliminates the backfill cost.              |
| R2  | Boot-time validator explodes with expanded §1 manifest fields.                                                  | Parser null-safe in 1.2; boot check remains warn-only (`Rails.logger.warn`), never raises. `doctor` CLI is where errors become non-zero.                   |
| R3  | URL migration breaks external deep links (federation, email, iOS PWA).                                          | Every old route 301s to `/hub/<slug>` for the full 2.x cycle. Federation URLs continue account-scoped, unaffected.                                         |
| R4  | Nudges cutover (Phase 5) removes the bell — user surprise.                                                      | Legacy tab under `/hub/nudges?tab=legacy` mounts the entire old UI for 2.0.0. Sunset call in 2.1.0 with warning banner. Shadow dogfood ≥3 days before 5.5. |
| R5  | `discussion_status_id` rename risks silent read failures in ActivityPub serializers.                            | Column aliased and dual-written; deprecated getter logs warning at first read; old column dropped only in 2.1.0. Federation roundtrip integration spec.    |
| R6  | Storybook drift as tokens + korner cards change simultaneously in Phase 2.                                      | Stories updated in the same PR that changes the token/component. CI runs Storybook build to catch dangling stories.                                        |
| R7  | `tsc --noEmit` OOM on portal during hooks (documented at 2048MB). Phase 2 sweep + Phase 5 renames spike memory. | Route commits through mainframe per CLAUDE.md; break sweep PR (2.3) into per-directory series if `tsc` fails.                                              |
| R8  | Meilisearch adds a new CI service (Phase 7.3).                                                                  | Tag Meilisearch specs; run nightly, not per-PR, until Phase 14 flips default. Elasticsearch remains CI default.                                            |
| R9  | Feature flag mechanism assumed by later phases (tune-in, search backend, org space visibility) not built.       | **Resolved:** built in Phase 0.3 as `Kronk::FeatureFlags`. All later phases depend on it existing before their PRs open.                                   |
| R10 | Kuestions data migration (Phase 8.4) irrecoverably loses answer visibility for legacy questions.                | Dual-read one release: old post_type=answer statuses continue to resolve; new answers land in `answers` table. Shadow-tested backfill before landing.      |

---

## Critical files

Files that will be modified or authored:

- `config/initializers/korners.rb` — module rename, struct expansion, reserved-slug check (Phase 1)
- `config/korners/*.yaml` — 10 existing manifests need planet drop + full field population (Phase 1, 2) _(as of 2026-07-23 this is 19 `config/korners/*.yaml`, core manifests + new-korner stubs included)_
- `lib/mastodon/cli/korners.rb` — `describe`, `doctor` subcommands (Phase 1)
- `app/controllers/api/v1/instances_controller.rb` — reference pattern for new `KornersController` (Phase 1.4)
- `app/serializers/rest/v1/instance_serializer.rb` — reference for `KornerSerializer` (Phase 1.4)
- `app/javascript/mastodon/planets.tsx` — delete (Phase 2.4)
- `app/javascript/styles/mastodon/_variables.scss` — merge with generated tokens (Phase 2.2)
- `docs/kronk_korner_spec.md` — v0.5 → v1.0 (Phase 14.2)
- `docs/spaces.md` — retire (Phase 2.5 + 14.2)
- `config/routes.rb` — add `/hub/:slug` family, 301 redirects (Phase 3.1)
- `lib/kronk/version.rb` — bumps per PR (all phases); final 2.0.0 bump (Phase 14.2)
- `.github/workflows/test-ruby.yml` — Meilisearch nightly integration (Phase 7.3)
- `db/migrate/` — many new migrations across Phases 4, 6, 7, 8, 9, 10, 11
- `app/models/notification.rb` — `PROPERTIES` legacy marker (Phase 5.3)
- `app/javascript/mastodon/features/notifications/` → shipped as `features/nudges_legacy/` (Phase 5.1; see §Phase 5 status table — the original `notifications_legacy` name was not used)
- `CLAUDE.md` — update Spaces section reference (Phase 2.5)

Files existing on `dev/chris` that will need decisions **before** Phase 1 lands:

- `app/javascript/mastodon/components/status_korner_card.tsx` (untracked WIP by Tal — needs commit or discard)
- `app/javascript/mastodon/components/status_booth_card.tsx` (untracked WIP)
- `app/javascript/mastodon/components/status_wachuneed_card.tsx` (untracked WIP)
- `app/javascript/mastodon/features/questions/answers_page.tsx` (untracked WIP)
- Various SCSS partials (untracked WIP)

Coordinated separately from this plan — Tal owns the disposition.

---

## Verification

**Per-PR:**

- `test-ruby`, `test-js`, `test-migrations` CI workflows pass on every PR.
- Pre-commit hooks (prettier, eslint, stylelint, `tsc --noEmit`) pass.
- New behaviour has RSpec (backend) and/or Vitest (frontend) coverage.
- Migrations have `up`/`down` specs where relevant.

**Per-phase:**

- Merge integration-branch tip into shadow env (`~/deploy-staging.sh rebuild/2.0.0`).
- Manual walkthrough of the surface each phase touches (e.g., Phase 5 = walk every notification path; Phase 3 = walk every korner's redirect).
- `bin/tootctl korners doctor` returns clean for enforced korners after each phase touching manifests.

**Pre-launch (Phase 14):**

- Full-fleet shadow dogfood by Tal + core contributors (~3 days).
- `bin/tootctl korners doctor` clean across all 10 enforced korners.
- Meilisearch index rebuilt and searchable on shadow.
- Every 301 redirect verified via integration spec + curl check.
- Federation roundtrip: post from shadow, read from a peer, react from peer, receive nudge on shadow — end-to-end.
- Documentation live: `kronk_korner_spec.md` v1.0 published, `content/kronk/` seeded, CHANGELOG landed.

**Post-launch:**

- 2.0.0 tagged; `mastodon.kronk.info` DNS flipped to `kronk.info`.
- Legacy tab (`/hub/nudges?tab=legacy`) monitored for 30 days.
- `bin/tootctl korners doctor` runs on cron; drift alerts to instance admins.
- 2.1.0 milestone opens for follow-up work (Map presence, Moments/Albutts backends, `discussion_status_id` column removal).
