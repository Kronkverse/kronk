# Per-post audience — scope + krews + people

> **Status.** Proposed design, agreed in conversation with Tal on 2026-08-28.
> **Not yet built.** The "Exists today" call-outs describe current code so the
> gap is legible. Companion to `docs/kronk_feed_and_reach.md` (the reach ladder)
> — read that first; this extends it. Not normative until ratified into
> `decisions.md` and implemented.
>
> **Freshness / grounding.** Anchors below were checked against
> `rebuild/2.0.0` on 2026-08-28. Re-check the load-bearing ones:
>
> ```
> grep -n "deliver_to_mentioned_followers\|deliver_to_krew_members" app/services/fan_out_on_write_service.rb
> grep -n "mention_exists?\|viewer_in_targeted_krew?" app/policies/status_policy.rb
> grep -n "visibility\|krews" app/services/update_status_service.rb   # still omitted?
> ```

## The idea

An author, on any post they've made, can **see who can see it** and **add** or
**remove** specific people — on top of the reach scope. Audience stops being a
single enum value and becomes **three composable layers**:

```
audience = scope  +  krews  −/+  people
           (ladder)  (named groups)  (ad-hoc individuals)
```

| Layer      | What it is                                            | Exists today?                 |
| ---------- | ----------------------------------------------------- | ----------------------------- |
| **Scope**  | the reach ladder: public / mates / orbit / self_only  | yes                           |
| **Krews**  | additive, **named, reusable** groups added on top     | yes                           |
| **People** | additive/subtractive **ad-hoc individuals**, per post | add-only today (via mentions) |

## Core rule — public is a true broadcast

**Per-person add/remove applies to the gated scopes only** (`mates` / `orbit` /
`self_only`). A **public** (Kronkverse-visible) post **cannot be restricted**:
public means everyone on Kronk, full stop.

This is a correctness rule, not a shortcut:

- **No theater.** A public post can't truly be hidden from anyone (logged-out
  view, boosts, shared links). "Remove from public" would be a privacy lie.
  Restricting the feature to read-gated scopes makes **every use real,
  enforced access control**.
- **Always knowable.** The only unenumerable audience — "everyone on Kronk" — is
  exactly the excluded case. Every post the feature touches has a **bounded**
  audience you can list and edit.
- On `public`, "add" is a no-op and "remove" is a lie, so disabling the controls
  there is _semantically correct_.

**Teachable rule:** _public is broadcast; everything narrower is an audience you
shape._ UX: on a public post, offer a nudge — "Want to limit who sees this?
Choose Mates, Orbit, or Just me." — rather than a dead control.

**Bonus:** `self_only` + add-people is the clean rebuild of "post to specific
people" — what the retired `direct`/`limited` visibilities did, but on an
enforceable base.

## How it fits the visibility retirement

The retirement (`decisions.md` 2026-08-28) replaces the Mastodon follower-model
visibilities with the reach ladder. `direct`/`limited` were never scopes — they
were the _explicit-recipient_ mechanism, built on **Mentions**. Folding them
away (#1427) removes the only per-person control the system had. **This feature
is the correct replacement** for the half worth keeping: reach stays a clean
ladder; per-person audience becomes an explicit layer _on top_, not a visibility
mode.

**Consequence for retirement Phase 2b (important).** 2b was scoped to purge the
"dead" `limited`/`direct` machinery. **That scope must change.** The per-recipient
read-grant + fan-out this feature reuses —
`StatusPolicy#mention_exists?`, `FanOutOnWriteService#deliver_to_mentioned_followers!`,
`ProcessMentionsService` (already re-runs on edit) — must be **kept and
generalized**, not deleted. 2b removes the retired _enum values_ + their
_selection_, and keeps the recipient machinery. #1427 (data fold) is unaffected
— it only rewrites data.

## What each capability entails

### A. Add specific people — mostly exists

The per-post, per-account, mutable read-grant already exists: **Mentions**
(`app/models/mention.rb`, `app/services/process_mentions_service.rb`,
`StatusPolicy#mention_exists?`, `FanOutOnWriteService#deliver_to_mentioned_followers!`).
So "add a person" is largely built.

Design fork: mentions are **public + notifying** (parsed from `@handle`, shown
in the post, ping the person). If "add" should be **silent** (grant access
without a public @-mention), add a lightweight grant table —
`status_audience_grants(status_id, account_id)` — cloned from the mention shape
minus text-resolution + notification, with its own `StatusPolicy` clause and
fan-out branch. Small–medium.

### B. Remove specific people — the hard one, now honest

No precedent — every axis today is an _additive grant_; nothing subtracts. Needs:

- a `status_exclusions(status_id, account_id)` table;
- a `StatusPolicy` clause returning **false if excluded**, evaluated **before**
  the reach grant;
- fan-out that **skips** excluded accounts on write and **pulls** the post from
  their home feed if they're excluded post-hoc (see D).

Because the feature no longer touches `public`, every exclusion is on a read-gated
scope, so the deny clause **fully enforces** it — B is a genuine primitive, not
theater. Still the hardest to _build_ (subtractive + feed reconciliation).

### C. See who can see it — no precedent, medium

No endpoint returns a status's audience today. Resolve `scope + krews + added −
removed` into a set. `mates` / `self_only` render as **exact lists**; `orbit`
(mates-of-mates) is bounded but large + graph-dynamic, so it reads as a
**described set** ("your mates and theirs — plus Bob, minus Alice"); `public`
just says "Everyone on Kronk," controls disabled. Viewer-relative and orbit is
expensive — cache or bound.

### D. Edit a post's audience after posting — no precedent for Status

`app/services/update_status_service.rb` deliberately omits `visibility` and
`krews` today — audience is fixed at creation for statuses. (Mentions _can_
change on edit — a useful precedent.) Moments and Albums re-audience after
posting (`moments_controller#update`, `albums_controller#sync_album_krews`) —
patterns to copy, but not Status. The hard part is **feed reconciliation**:
fan-out is write-once today; changing audience later means pushing to new feeds
and **pulling** from newly-excluded ones (a `FeedUnpush`-style path).

## Proposed build order

Each step is independently shippable and defers risk:

1. **Audience readout (C)** — read-only "who can see this" on your own posts.
   Forces the resolution model; zero write risk.
2. **Add people (A)** — silent per-person grant + surface it. Reuses the mention
   pattern.
3. **Post-hoc edit, additive only (D)** — widen / add after posting; additive-only
   sidesteps the feed-pull problem first.
4. **Remove people (B) + feed reconciliation** — the deny-list + pull path. Last:
   hardest to build, and best done once the rest is proven.

## Open questions

- **Silent add vs. mention add** — do we want a non-notifying grant, or is a
  (nicely-surfaced) mention the "add"? Decides whether we need a new grant table
  or just UI over mentions.
- **`orbit` readout** — is a described set acceptable, or should `orbit` be
  excluded from the exact-list UI and only support add/remove without a full
  enumeration?
- **Edit-time notifications** — if you add someone to an old post, do they get
  notified / does it surface in their feed as new? (Feed reconciliation policy.)
- **Interaction with boosts** — a `mates`-scoped post boosted by a mate: does the
  exclusion still hold down the boost chain? (Boosts of gated posts are already
  constrained; confirm the exclusion rides along.)
