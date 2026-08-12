# Retiring the legacy notification system — sweep and plan

> **Freshness.** Inventory last checked **2026-08-12** against `9a95e6c8`.
> Re-check with:
>
> ```
> grep -rl Notification app/ lib/ --include=*.rb | grep -v spec | wc -l   # backend surface
> grep -rn 'LocalNotificationWorker\|NotifyService' app/ lib/ --include=*.rb | grep -v spec
> grep -c 'legacy: true' app/models/notification.rb                       # legacy type count
> ```
>
> If it disagrees, **correct this doc in your current PR** —
> `decisions.md` 2026-08-12 (decision 6).

**Status: plan, nothing built.** Revised 2026-08-12 after Tal answered the three
open questions the first draft raised. Those answers **remove the blocker** the
draft had identified, and shrink the job substantially. See §2.

Context: `docs/kronk_nudges.md` § _Self-delivering delivery_ made the Mastodon
`Notification` store legacy-only. `docs/rebuild/nudges_bus_state.md` covers the
korner half; this plan is the whole surface.

---

## 1. What the old system actually is

Not a Kronk subsystem. `Notification` is core Mastodon, carrying the social,
moderation and federated notification sets.

**22 registered types — 17 legacy, 5 Kronk-native:**

|                 | Types                                                                                                                                                                                                                                                |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **legacy (17)** | `mention`, `status`, `reblog`, `follow`, `follow_request`, `favourite`, `poll`, `update`, `quote`, `quoted_update`, `severed_relationships`, `moderation_warning`, `annual_report`, `admin.sign_up`, `admin.report`, `event_invitation`, `media_tag` |
| **native (5)**  | `nudge`, `proposal_status_changed`, `proposal_challenged`, `task_assigned`, `email_confirmation_reminder`                                                                                                                                            |

**Backend — 79 Ruby files** (excluding specs): services 20, controllers 16,
models 13, workers 9, lib 9, serializers 8, mailers 1. **Frontend — 126 files**;
`features/notifications_v2/` alone is 25.

**Producers.** Mostly not Kronk code: `LocalNotificationWorker` →
`NotifyService`, called from the ActivityPub activity handlers (`Like`, `Follow`,
`Announce`, `QuoteRequest`), `FeedInsertWorker`, `PollExpirationNotifyWorker`,
`BlockDomainService`, `FollowMigrationService`; moderation from
`Admin::AccountAction` / `Admin::StatusBatchAction`. Kronk-written:
`Kronk::KornerNotifier` and `Kronk::ProposalStates`.

**Consumers:** in-app, `Web::PushSubscription`, `NotificationMailer`,
`Api::V1::Nudges::LegacyArchiveController` (`/nudges/legacy`), and
`nudges_messenger/kronk_system.ts` (`KRONK_SYSTEM_TYPES`).

## 2. Decisions taken (Tal, 2026-08-12)

The first draft flagged four unanswered categories and a hard prerequisite.
Three answers landed, and they change the shape of the work:

1. **Federation is deferred** — Kronk will not federate for a while, so plan as
   local-only.
2. **Moderation is deferred** — community moderation for the near future; a
   system/moderation channel is a later problem.
3. **The goal, stated plainly:** a user is notified when **anything happens with
   their content** — replies, reactions, nudges, mate requests, and so on.

### Why (3) removes the blocker

The draft said nothing could start before **multi-recipient fan-out**. That was
right for the spec's full relevance engine and **wrong for this goal**.
"Something happened to _my_ content" has exactly one recipient: the owner. It is
Tier-1 **directed** in the spec's terms — fires regardless of Mate status — and
the manifest path already delivers that, single-recipient, since #1367 plumbed
`directed:` through.

Fan-out is only needed for the _discovery_ tiers — Tier-2 "someone I follow did
a thing" and Tier-3 "something happened in a korner I tuned into". Those are a
different feature, and they are **out of scope here**.

So the work is **additive publishers plus manifest entries**, on machinery that
already exists. No new delivery architecture.

## 3. What has to be built

Every one of these is a directed, single-recipient nudge to the content owner.

| Event to publish                                                           | Fires when                   | Exists?                                                                                                            |
| -------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `status.frothed`                                                           | someone froths your post     | **no** — `Favourite` publishes only korner-scoped froths (booth / kommons / kuestions), nothing for a plain status |
| `status.replied`                                                           | someone replies to your post | **no**                                                                                                             |
| `status.mentioned`                                                         | someone mentions you         | **no**                                                                                                             |
| `status.reblogged`                                                         | someone boosts your post     | **no**                                                                                                             |
| `status.quoted`                                                            | someone quotes your post     | **no**                                                                                                             |
| mate request / accept                                                      | —                            | **yes**, declared with `directed: true` (#1367)                                                                    |
| korner activity (backed, commented, answered, offered, RSVP'd, new photo…) | —                            | **yes**, 12 manifest listeners                                                                                     |

`Favourite` is the model to copy: it already publishes on create and branches by
what the status is backed by. Plain statuses need the fallback branch it lacks.

**Not in scope, by §2:** federated activity, moderation/admin/system messages,
`poll`, `annual_report`, and the Tier-2/3 discovery tiers.

## 4. What "remove the legacy code" should mean here

**Recommendation: stop writing to the store; do not drop it yet.**

- **Leave the ActivityPub handler calls alone.** They are dormant while Kronk
  doesn't federate, they cost nothing dormant, and they live in upstream files —
  the repo's own code rules say don't modify upstream unnecessarily, and leaving
  them keeps re-federation cheap when it comes.
- **Keep a residue reading the store** for the deferred categories:
  `moderation_warning`, `severed_relationships`, `admin.*`, `annual_report`,
  `email_confirmation_reminder`. Per §2.2 these have no new home, and inventing
  one now is exactly the work Tal deferred. The `/nudges/legacy` tab and the
  Kronk system pane stay until moderation is faced.
- **Do remove what we own and have replaced:** `Kronk::KornerNotifier` and the
  three Kommons native types once their events run on the bus, plus each
  migrated social type's write path.

Dropping the table is the last few percent of the value and carries the most
risk. It waits for the moderation decision.

## 5. Order

| #   | Phase                                                                                                                                                                                             | Blocked by |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 1   | **Render what already fires.** `proposal_challenged` and `task_assigned` are registered, fire, and display nowhere. Small, independent, and road-tests the surface before anything depends on it. | —          |
| 2   | **Publish the five `status.*` social events** and declare them as `directed: true` listens. Behind a flag, dual-running against `Notification` so the two can be compared on real traffic.        | —          |
| 3   | **Render them** in the conversation stream (froth/reply/mention/boost/quote as inline nudges, per spec § Surfaces 3). Decide whether bare froths aggregate — the spec leaves it open.             | 2          |
| 4   | **Cut the legacy write path** for the migrated types once dual-run is clean. Retire `Kronk::KornerNotifier`; drop the 3 Kommons native types.                                                     | 3          |
| 5   | **Korner notifications fully onto `delivery: nudge`**, retiring the last `planned:` entries as their features land.                                                                               | 2          |
| 6   | _Later, after the deferred decisions:_ moderation/system channel, push + email, Tier-2/3 fan-out, and only then the store itself.                                                                 | §2.1, §2.2 |

**Phases 1 and 2 can both start now.**

## 6. Sequencing traps

- **Don't delete `notifications.types` from manifests** — it drives the
  per-korner push toggles (`Api::V1::KornersController#push_preferences`) and the
  aggregation windows (`Nudges::Aggregator.window_for`, matched by `name`). This
  nearly happened; see #1404.
- **Don't remove types from `PROPERTIES` while rows reference them** — orphaned
  rows break serialization on read, including the archive still in use.
- **`notifications_v2/` is not dead code** — it renders the legacy tab, which
  §4 keeps for the deferred categories.
- **Dual-run before cutting (phase 2 → 4).** A social notification silently not
  firing is invisible until a user complains.
- **Froth is `Favourite`, not a bespoke model.** Moments moved off its private
  froth model on 2026-08-09 (`decisions.md`); publish from `Favourite` so every
  content type is covered once.
- **The suite is red** — 43 distinct failures on `rebuild/2.0.0`, so a regression
  here would not stand out (`decisions.md` decision 1).
