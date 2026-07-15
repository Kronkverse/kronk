# Kronk Nudges — Specification

> **Status:** draft (rev. 2026-07-15). Defines Nudges as Kronk's **fourth pillar** and the target architecture for merging the notification system into it. Shaped with Tal (2026-07-15). Supersedes the ad-hoc, veneer-over-`Notification` implementation that shipped incrementally (PRs #226/#230/#231/#284) and amends the three-surface model in `docs/kronk_settings_ia.md` (§3, §5) to four surfaces.

## 1. What Nudges is

Nudges is the **interpersonal stream** of Kronk — one unified inbox of everything that reaches *you as a participant*: the 1:1 social "ping/voices" gesture **and** the aggregated activity that replaces Mastodon's notification bell, as **facets of a single stream**.

It is being **promoted from a Hub korner to a top-level pillar**. Kronk's navigation resolves to **four key pillars**, each a Kommons Tree bucket:

| Pillar | Test | Bucket |
|---|---|---|
| **Feed** | *Incoming* — content you consume | `feed` |
| **Profile** | *Outgoing* — you, what you publish, your account | `profile` |
| **Hub** | *Spaces* — the korners | `hub` |
| **Nudges** | *Interpersonal* — who's reaching toward you, and the activity around your presence | `nudges` **(new)** |

Nudges is not "notifications with a new name" — it is the social/activity pillar, of which the bell-replacement feed is one facet and direct pings are another.

## 2. Architecture — hybrid (own stream, projected activity)

The decision (Tal, 2026-07-15) is **hybrid**, deliberately avoiding both extremes:

- **Own the stream layer.** Nudges gets its own store for everything Kronk-native — pings, threads, reactions, read/pending state, streaks, quiet-hours, and **preferences** (which today have *no backing store at all*). This is what makes the unified stream and a real settings home possible; the classic `Notification` row has nowhere to put any of it.
- **Project federated activity — don't re-capture it.** Mentions, follows, boosts, favourites and every other federated event already flow into `Notification` via `NotifyService` (battle-tested, ActivityPub-wired). Nudges **reads from** that table as its event source rather than duplicating capture. Re-implementing federated event capture is the expensive, fragile part of a "full rebuild" and buys nothing.

So: **permanent veneer for activity *capture*, own store for the stream *layer* on top.**

```
Federated events ─► NotifyService ─► Notification (upstream, kept as plumbing)
                                          │  projected (read-only)
Native gestures ─► NudgeService ──► Nudge stream store  ◄── the unified inbox
   (pings, reactions, read-state,        │
    quiet-hours, streaks, prefs)         ▼
                                   /nudges  (the pillar surface)
```

### 2.1 Why this over the alternatives

- **vs. permanent veneer:** the veneer can't hold the things you asked for. A *unified* stream (pings + activity as one inbox), per-type prefs, quiet-hours-as-data, and digests have no home on `Notification`; that is exactly why the current code notes "nudge preferences have no backing store yet." An own stream layer fixes that without a migration of federated data.
- **vs. full rebuild:** re-capturing federated activity into a bespoke store duplicates upstream and risks federation breakage on every merge, for no user-visible gain. Keep `Notification` as the source.
- **Upstream posture:** the hybrid *reduces* the diff against upstream `Notification`/`NotifyService` over time (the pillar lives in Kronk-owned tables), which keeps future Mastodon merges cleaner — a Code Rule in `CLAUDE.md`.

## 3. The unified stream

One inbox, two (or more) **facets** of a single model:

- **Pings ("voices")** — the 1:1 social gesture. Today: `Notification(type:'nudge')` + `NudgeMessage` (thread) + `NudgeReaction`. Target: first-class rows in the Nudge stream store, with threads + reactions native rather than bolted onto a notification row.
- **Activity** — the bell replacement. Today: `Nudges::Aggregator` collapsing `current_account.notifications` in a 10-minute window. Target: the same projection, surfaced *in* the unified stream alongside pings, with grouping/aggregation windows that are **configurable per type** (see §6 — the aggregation-override config block is currently missing, so everything falls back to the 10-min default).

The stream carries, natively: **read / pending state**, **reactions**, **threading** (for pings), **streaks** and **pending counts** (already exposed via `nudge_streak` / `nudge_pending_count`), and **quiet-hours suppression** applied as data, not just display.

## 4. Settings — `/settings/nudges`

Nudges preferences get **one home**, at a top-level pillar surface `/settings/nudges` (node `settings.nudges`, bucket `nudges`) — *not* `/hub/nudges/settings`, *not* a Profile row.

It **folds together** everything scattered today:
- **Email digests** — `notification_emails.*`, `software_updates` (currently at the standalone `/settings/notifications`, `Api::V1::Settings::NotificationsController`).
- **Push** — Web Push subscription per-type alerts (currently only expressible via the push subscription, with no settings home).
- **In-app / per-type** — which activity nudges you.
- **Nudge behaviour** — quiet-hours (`quiet_hours_start/end`), `show_activity_in_chats`, `auto_read_on_open` (currently manifest config at `/hub/nudges/settings`).

This requires the **preferences backing store** from §2. It **retires** two surfaces:
- the standalone **`settings.notifications`** Profile row — *reverses the placement PR #326 shipped* (that node was registered in the `profile` bucket and rendered in the "You" list; it moves to `settings.nudges` in the `nudges` bucket), and
- the **`/hub/nudges/settings`** korner page (its controls migrate here).

## 5. Classic notifications — disposition

- **Keep** `Notification`, `NotifyService`, and the `v1`/`v2` notifications API — they are the **event source** for projected activity and the federation seam. Removing them would break Nudges and federation.
- **Remove** the dead, hidden **bell UI remnants**: `NotificationsLink` (→ `/notifications`, with a classic unread badge) still ships in `navigation_panel/index.tsx` and survives only because `_kronk_chrome.scss` blanket-hides the whole panel. Once the four-pillar top bar lands, drop the leftover bell affordance so there's no hidden-but-shipped notifications entry.
- **Keep** the `/notifications → /nudges` redirect and the hotkey remap.
- **Full retirement** of the classic table is *not* required by this design and is out of scope; the hybrid keeps it as plumbing indefinitely.

## 6. Node registry / Tree changes

- Add **`nudges`** to `Kronk::NodeRegistry::BUCKETS` (`feed profile hub` → `feed profile hub nudges`) in `lib/kronk/node_registry.rb`. *(Touches the Tree's registry — coordinate with the Tree owner per `docs/kronk_settings_ia.md` §7.)*
- Add nodes to `config/kronk_nodes.yaml`:
  - `nudges.stream` (bucket `nudges`) — the pillar surface at `/nudges`.
  - `settings.nudges` (bucket `nudges`) — the settings surface at `/settings/nudges`.
- Migrate `settings.notifications` out of the `profile` bucket (remove the node + its `YOU_PRESENTATION` row in `features/settings/nav.tsx`).
- Decide the fate of the **`config/korners/nudges.yaml`** manifest (§9) — Nudges is no longer a korner.
- Fill the **aggregation-override** block the `Aggregator` reads per type — it is absent from `nudges.yaml` today, so aggregation always uses the 10-min default.

## 7. Build slices

1. **Bucket + nodes + settings surface.** Add the `nudges` bucket, `nudges.stream` + `settings.nudges` nodes; build `/settings/nudges` folding email/push/quiet-hours/behaviour prefs; add the **preferences backing store**; retire `settings.notifications` (profile) + `/hub/nudges/settings`.
2. **Preferences store + wiring.** Back the folded prefs with real storage; wire push/per-type/quiet-hours to it (schema-driven, reuse the settings widgets).
3. **Unified stream read-model.** Merge native pings + projected `Notification` activity into one inbox at `/nudges`; per-type aggregation windows from config.
4. **Four-pillar top bar.** Promote Nudges into the top-bar nav alongside Feed/Profile/Hub. *(Coordinate with the nav-chrome work.)*
5. **Classic bell cleanup.** Remove the dead `NotificationsLink`/panel remnants; keep the API backbone + redirect.

Slices 1–2 are independent of the stream/nav work and can land first.

## 8. Reconciliation with the Settings IA

`docs/kronk_settings_ia.md` currently describes **three** surfaces (Feed/Profile/Hub) and §3 folds "Notifications ≡ Nudges" into *Hub → Nudges §K*. This spec supersedes that: Nudges is a **fourth peer surface**, and notification prefs live at the pillar-level `/settings/nudges`, not under Hub. The settings IA should be amended to four surfaces, and its §5 "Remaining work" item 4 (Nudges absorbs notification prefs) is defined here.

## 9. Open decisions (for review)

- **Naming.** Is the pillar "Nudges" with facets "Activity" (bell replacement) and "Voices/Pings" (1:1)? Or a different vocabulary? The current UI mixes `nudges`, `voices`, `activity`.
- **Stream store shape.** New dedicated table(s) vs. extending `NudgeMessage` into the general stream row. (Leaning: a `nudge_stream_items` read/store model with native pings + projected-activity refs.)
- **Korner manifest fate.** Retire `config/korners/nudges.yaml` entirely, or keep a thin manifest for the projection config? Nudges as a pillar no longer mounts under `/hub`.
- **Federation posture for pings.** Pings are `federates: false` today — stays local, or eventually federates?
- **Migration of existing data.** Existing `Notification(type:'nudge')` + `NudgeMessage` rows → the new stream store: in-place backfill vs. read-through shim.

---

_Related: `docs/kronk_settings_ia.md` (the settings projection, now four surfaces), `docs/kronk_korner_spec.md` (korner manifests + `nodes:`), the Kommons Tree (`lib/kronk/node_registry.rb`). Nudges preference sections are schema-driven like every other settings surface (`features/settings/setting_widgets.tsx`)._
