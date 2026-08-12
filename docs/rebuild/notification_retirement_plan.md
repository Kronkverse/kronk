# Retiring the legacy notification system — sweep and plan

> **Freshness.** Inventory below last checked **2026-08-12** against
> `9a95e6c8`. Re-check with:
>
> ```
> grep -rl Notification app/ lib/ --include=*.rb | grep -v spec | wc -l   # backend surface
> grep -rn 'LocalNotificationWorker\|NotifyService' app/ lib/ --include=*.rb | grep -v spec
> grep -c 'legacy: true' app/models/notification.rb                       # legacy type count
> ```
>
> If it disagrees, **correct this doc in your current PR** —
> `decisions.md` 2026-08-12 (decision 6).

**Status: plan, nothing built.** A sweep of what "the old system" actually
covers, what already runs on the new one, and the order to move the rest. Four
categories have **no answer yet**, and two of them conflict with a stated
non-negotiable — those are decisions for Tal, flagged as such below. This
document does not resolve them.

Context: `docs/kronk_nudges.md` § _Self-delivering delivery_ made the Mastodon
`Notification` store legacy-only, retiring "with the bell" at 2.1.x.
`docs/rebuild/nudges_bus_state.md` covers the korner half. This plan is the
whole surface.

---

## 1. What the old system actually is

Not just korner notifications. `Notification` is core Mastodon and carries the
entire social, moderation and federated notification set.

**22 registered types — 17 legacy, 5 Kronk-native:**

|                 | Types                                                                                                                                                                                                                                                |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **legacy (17)** | `mention`, `status`, `reblog`, `follow`, `follow_request`, `favourite`, `poll`, `update`, `quote`, `quoted_update`, `severed_relationships`, `moderation_warning`, `annual_report`, `admin.sign_up`, `admin.report`, `event_invitation`, `media_tag` |
| **native (5)**  | `nudge`, `proposal_status_changed`, `proposal_challenged`, `task_assigned`, `email_confirmation_reminder`                                                                                                                                            |

**Backend surface — 79 Ruby files** (excluding specs): services 20,
controllers 16, models 13, workers 9, lib 9, serializers 8, mailers 1.

**Frontend — 126 files** reference notifications; `features/notifications_v2/`
alone is 25 files / ~128K.

**Who creates them.** Almost none of it is Kronk code:

- `LocalNotificationWorker` → `NotifyService`, called from **ActivityPub
  activity handlers** (`Like`, `Follow`, `Announce`, `QuoteRequest`),
  `FeedInsertWorker`, `PollExpirationNotifyWorker`, `BlockDomainService`,
  `FollowMigrationService`
- **moderation**: `Admin::AccountAction`, `Admin::StatusBatchAction` →
  `moderation_warning`
- **Kronk-written, direct-create**: `Kronk::KornerNotifier` (used by
  `proposals_controller`, `tasks_controller`) and `Kronk::ProposalStates`

**Other consumers:** `Web::PushSubscription` (browser push),
`NotificationMailer` (email digests), `Api::V1::Nudges::LegacyArchiveController`
(the `/nudges/legacy` tab), `Api::V1::Nudges::ActivityController` (excludes
`LEGACY_TYPES`), `nudges_messenger/kronk_system.ts` (`KRONK_SYSTEM_TYPES`).

## 2. What already runs on the new system

The bus works and is not the problem: `Kronk::KornerEvents` →
nudges manifest `listens:` → `Nudges::EventRouter` → `Nudges::Event`, with
aggregation, Tier-1 `directed:`, event-aware unread and an account-level live
stream all built. **12 manifest-declared listeners** across kommons, kalendar,
wachuneed, kuestions, booth and mates; 3 hand-wired. See
`nudges_bus_state.md`.

## 3. The four categories with no answer

These are why "remove all legacy code" is not a porting job. Each needs a
decision before any code.

### 3.1 Federated activity — conflicts with a non-negotiable

`kronk_nudges.md` § Non-negotiables states **"No federation. Nudges is
local-only."** But the notifications being retired include federated ones: a
remote account favourites your post, follows you, or boosts you, and an
ActivityPub handler calls `LocalNotificationWorker`. If `Notification` goes and
Nudges is local-only, **those events have nowhere to land at all.**

Three ways out, all requiring a call:

1. Relax the non-negotiable — Nudges accepts remote actors (they can't be Mates,
   so every remote event is Tier-1 directed or nothing).
2. Keep a minimal `Notification` store for federated activity only, and accept
   that "remove the old system" means "shrink it to the federation edge".
3. Decide federated social activity does not notify in Kronk, and say so
   explicitly. This is a product decision with real consequences.

**Nothing can be removed safely until this is answered**, because it determines
whether the store shrinks or disappears.

### 3.2 Moderation and system messages — unaddressed by the spec

`moderation_warning`, `severed_relationships`, `admin.sign_up`, `admin.report`,
`annual_report`, `email_confirmation_reminder`. These are not person-to-person,
and a Nudges conversation is Mate or Krew. The current answer is the synthetic
pinned "Kronk" conversation (`KRONK_SYSTEM_TYPES`), which **reads the
Notification store** — so it is not a destination, it is a view of the thing
being removed.

A moderation warning must be undeliverable-by-mistake and un-mutable. That is a
different contract from a nudge, which is dialed by preference and quiet hours.
**Decision needed:** a third conversation kind (`system`) with its own rules, or
a separate surface outside Nudges entirely.

### 3.3 Push and email

`Web::PushSubscription` and `NotificationMailer` both read `Notification`.
Nudges has no push path of its own, and no digest. The spec covers per-type
push _toggles_ but not the delivery mechanism. **Decision needed:** does Nudges
grow push + email, or do those keep a store to read from?

### 3.4 The whole social set

`mention`, `favourite`, `reblog`, `follow`, `poll`, `quote` and friends are the
bulk of what users actually receive. The spec does intend these as nudges (§
Surfaces 3 renders boosts and mentions inline, and § Open decisions debates
whether bare favourites aggregate). But it is a large build, and it is gated on
the prerequisite below.

## 4. The hard prerequisite: multi-recipient fan-out

The manifest path delivers to **exactly one** `recipient_account_id`. Every
category above needs more:

- a favourite on a status with many watchers
- a moderation warning to one account, but a domain block severing many
- Tier-2 ("people you chose") and Tier-3 ("somewhere you tuned in") from the
  spec's own relevance engine, which have **no mechanism at all**

This is gap 2 in `nudges_bus_state.md` and it blocks everything in §3. It also
needs its own decision — recipient sets computed inline or in a job — because a
Tier-3 event on a popular korner could fan to most of the instance.

**Nothing else on this page should start before fan-out exists.**

## 5. Proposed order

Each phase leaves the system working. No phase deletes a store before its
replacement carries traffic.

| #   | Phase                                                                                                                                                                                                           | Blocked by |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 0   | **Answer §3.1–3.3 and the fan-out question.** Write the answers into `decisions.md`.                                                                                                                            | —          |
| 1   | **Build multi-recipient fan-out** + Tier-2/3 relevance from the manifest. Spec Build stage 2.                                                                                                                   | 0          |
| 2   | **Render what already fires.** `proposal_challenged` and `task_assigned` are registered, fire, and display nowhere. Fixing that is small, independent, and worth doing first as a real test of the system pane. | —          |
| 3   | **Migrate korner notifications** to `delivery: nudge`, retire `Kronk::KornerNotifier`, drop the 3 kommons native types.                                                                                         | 1          |
| 4   | **Migrate the social set** (§3.4) behind a flag, dual-running against `Notification` so behaviour can be compared before the old path is cut.                                                                   | 1          |
| 5   | **System/moderation channel** per the §3.2 decision.                                                                                                                                                            | 0, 1       |
| 6   | **Push + email** per §3.3.                                                                                                                                                                                      | 0, 1       |
| 7   | **Cut the legacy read paths** — `/nudges/legacy`, `LEGACY_TYPES`, `KRONK_SYSTEM_TYPES`, `notifications_v2/`. This is the "retires with the bell" step and the first point where anything is deleted.            | 2–6        |
| 8   | **Remove the store** — or shrink it to the federation edge, per §3.1. Migration for existing rows: decide archive vs drop.                                                                                      | 7          |

**Phase 2 is the only one that can start today.** Everything else waits on
phase 0 or 1.

## 6. Sequencing traps

- **Do not delete `notifications.types` from manifests.** It drives the
  per-korner push toggles (`Api::V1::KornersController#push_preferences`) and
  the aggregation windows (`Nudges::Aggregator.window_for`, matched by `name`).
  This nearly happened; see `korner_standard.md` §L10.
- **Do not remove types from `Notification::PROPERTIES` while rows reference
  them.** `type` is an enum-ish string column; orphaned rows break serialization
  on read, including in the legacy archive people are still using.
- **`notifications_v2/` is not dead code** — it renders the legacy tab. It dies
  in phase 7, not before.
- **Dual-run before cutting.** Phase 4 exists so the two systems can be compared
  on real traffic. A social notification silently not firing is invisible until
  a user complains.
- **The suite is red.** 43 distinct spec failures on `rebuild/2.0.0` means a
  regression in this work would not stand out. Clearing CI (decisions.md
  2026-08-12, decision 1) is worth more than it looks before touching 79 files.

## 7. Honest sizing

79 backend files, 126 frontend files, 22 types, 5 delivery consumers (in-app,
push, email, legacy archive, system pane), and one stated non-negotiable that
currently contradicts the goal. This is a multi-milestone programme, not a
sweep-and-delete. The plan above is written so it can stop after any phase and
still leave a coherent system.
