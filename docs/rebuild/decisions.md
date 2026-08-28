# Rebuild decisions

Append-only. Newest first. One entry per decision, dated, with the reasoning
and what it supersedes.

**Why this file exists.** Until 2026-07-19, rebuild decisions were kept
deliberately _outside_ the repo, in the maintainer's working notes. That
produced a failure worth remembering: a settings IA was "locked" on 07-12 in
a note; a different settings IA was written into `docs/kronk_settings_ia.md`
on 07-15; and on 07-18 the node registry was built from the repo doc — the
only one its author could see — matching neither. A decision nobody working
in the repo can see is not a decision; it is a trap for the next person.

**Precedence when sources disagree: code > repo docs > anything outside the
repo.** Repo docs are not automatically right — several describe the intended
end state in the present tense and read as fact. Verify against code.

---

## 2026-08-28 — Per-post audience: scope + krews + people; public is unrestrictable

**Decision (Tal).** Post audience is **three composable layers**, not a single
mode: **scope** (the reach ladder) + **krews** (named reusable groups) +
**people** (ad-hoc individuals added/removed per post). An author can see who can
see any of their posts and add or remove specific people — but **only on the
gated scopes** (`mates`/`orbit`/`self_only`). A **`public` post cannot be
restricted**: public means everyone on Kronk.

**Why the public exclusion is a correctness rule.** A public post can't truly be
hidden (logged-out view, boosts, links), so "remove from public" would be a
privacy lie, and "who can see it" would be unenumerable. Restricting the feature
to read-gated scopes makes **every use real, enforced access control**, and every
audience **bounded/knowable**. `self_only` + add-people then cleanly rebuilds
"post to specific people" (what `direct`/`limited` did) on an enforceable base.

**Consequence for the visibility retirement (Phase 2b).** The per-recipient
read-grant + fan-out this feature reuses — `StatusPolicy#mention_exists?`,
`FanOutOnWriteService#deliver_to_mentioned_followers!`, `ProcessMentionsService`
— must be **kept and generalized**, NOT purged. Phase 2b removes the retired
_enum values_ + their _selection_ only; the recipient machinery stays. #1427
(data fold) is unaffected.

**Status.** Direction ratified; design in `docs/rebuild/per_post_audience.md`
(build order: readout → add → additive edit → remove-with-feed-reconciliation).
Not yet implemented.

---

## 2026-08-28 — Retire the Mastodon visibilities; the reach ladder is the only audience vocabulary

**Decision (Tal).** The Mastodon follower-model visibilities —
`unlisted`, `private`, `direct`, `limited` — are **retired** from Kronk. The
Kronk **reach ladder** (`public` = Kronkverse, `mates`, `orbit`, `self_only`)
becomes the _only_ way to choose who sees a post. This ratifies the "Path B"
work that until now lived only in PR descriptions (#1423 / #1427) and was never
recorded here.

**Why now.** Those four visibilities encode _follower-graph + federation_
semantics (unlisted = off public timelines but link-shareable; private =
followers-only; direct/limited = addressed audiences). Kronk is unfederated
through 2.0.0 and **federation is not a live constraint** (Tal, 2026-08), so the
only reason to keep them — cross-instance compatibility — doesn't apply. The
reach ladder already covers every audience Kronk actually has, natively. Keeping
both was a half-migrated state: the reach ladder shipped _alongside_ the old
values (the enum still declares all of them) rather than replacing them.

**Supersedes** the current tip's `Status::Visibility.selectable_visibilities`,
which kept `unlisted` + `private` selectable (`visibilities.keys - %w(direct
limited)`). All four go.

**Canonical fold mapping** (Tal's mapping, matches the compose reducer's
`REACH_MAP` + the #1427 migration):

| Retired    | Folds to    |
| ---------- | ----------- |
| `unlisted` | `self_only` |
| `private`  | `mates`     |
| `direct`   | `mates`     |
| `limited`  | `mates`     |

Not reversible: three sources collapse onto `mates` with no discriminator to
un-collapse them.

**Phased plan** (each phase lands only after the one before it):

1. **Phase 1B — composer (#1423).** The composer stops _offering_ the four
   retired values; `selectable_visibilities` returns the reach ladder only. The
   enum still _declares_ them so legacy rows stay valid. _(Rebased + green.)_
2. **Phase 2a — data fold (#1427).** One migration rewrites existing
   `statuses.visibility` + `users.settings` default*privacy per the mapping
   above, so no live row still carries a retired value. Must land **after** 1B
   (so nothing new is created mid-fold) and its migration timestamp must be
   current, not the stale 2026-08-13 one. *(Rebased + green.)\_
3. **Phase 2b — narrow + purge (follow-up).** Once 2a has run on shadow, drop
   the retired names from the Ruby enum and delete the now-dead
   federation-shaped logic they fed (e.g. `distributable_visibility`,
   `list_eligible_visibility`, `not_direct_visibility`, direct-message plumbing)
   plus the ~120 remaining `unlisted`/`private`/`direct`/`limited` references
   across `app/`. This is the large slice; it cannot start until 2a's fold is
   live, or it would orphan rows on values the enum no longer knows.

**Non-negotiable ordering:** 1B → 2a (after fold deploys) → 2b. Skipping ahead
either lets users create values that are about to vanish, or removes enum values
while rows still hold them.

---

## 2026-08-16 — The bio stays visible on a gated profile

**Decision (Tal).** On a gated profile, the visible identity is **name +
avatar + bio** — not name + avatar alone. The bio (`account.note`) is the
public self-description a stranger reads to decide whether to become Mates, so
gating it would make the "Mate?" prompt ask people to commit blind. Everything
else stays gated: told-cards, drawn shelves, structured fields, mates/post
counts, and the post timeline.

**Consequences.**

- **Supersedes** the "everything except name + avatar" framing in the gated-view
  work below, and **retires the follow-up** that entry flagged (blanking
  `note` in `REST::AccountSerializer`). Because the bio is meant to be seen,
  there is nothing to blank server-side and no per-timeline reach-check cost —
  the JSON already carries `note`, which is now correct rather than a leak.
- Frontend only: the gated view renders `AccountBio` (shelved `/@user` and the
  classic `/@user/posts` header); the counts/fields blocks stay behind the gate.

---

## 2026-08-16 — Profile privacy is a per-account reach scope, defaulting to Kronkverse

**Decision (Tal).** The "opt out later" privacy control promised by the
present-by-default decision below is the **reach ladder applied to the whole
profile** — not a new privacy vocabulary. A member picks who can see their
profile from the same rungs every other reach control uses, defaulting to the
widest (Kronkverse), and can narrow it.

**What this means in code.**

- **New `accounts.profile_visibility`** (integer enum, default `0` = `public`).
  Values reuse the `ProfileVisibility` ladder integers (`public:0, mates:1,
orbit:3, self_only:4`) so the number line stays uniform across models.
  `Account#profile_visible_to?(viewer)` mirrors `ProfileVisibility#visible_to?`
  resolved against `self`: `public` = any signed-in local member, `mates` =
  mutual follows, `orbit` = + mates-of-mates, `self_only` = owner only.
- **Enforcement** is at the profile-content controllers
  (`Api::V1::Accounts::Profile::CardsController`,
  `…::SectionsController` index + statuses): a viewer who fails
  `profile_visible_to?` gets **no** cards/shelves, over and above each card's
  own per-card reach. **Name + avatar stay visible regardless** — a private
  profile is still a face in the Kommunity (present-by-default holds).
- **The control** rides the existing `/api/v1/settings/privacy` endpoint (new
  `profile_visibility` enum field) and renders in the Privacy screen with the
  canonical `ReachDropdown` (Me / Mates / Orbit / Kronkverse), not the generic
  enum widget — a raw "Public" label would misread as fediverse-public.
- **Orthogonal to `discoverable` / `kommunity_discoverability`.** Those govern
  whether you're _found_ (Directory / search / Kommunity list); this governs
  whether a viewer who reaches the profile can _see its content_. A member can
  be discoverable but profile-private (findable face, private shelves).

**Scope of this cut (follow-ups).** The gate covers profile cards + drawn
shelves (the rebuild's profile content). The bio (`note`) and the account's
post timeline are **not** gated by `profile_visibility` yet — they carry their
own reach/visibility and gating them touches the account serializer + the
per-status reach chain. A "this profile is limited" affordance on the SPA
(exposing `profile_visibility` in the account serializer) is also deferred.

**Fulfils** the "Still to do" note in the present-by-default decision below.

---

## 2026-08-19 — The unconfirmed-account purge is disabled (it deleted a live member)

**Decision (Tal).** No account may be deleted for being unconfirmed. Upstream
`Scheduler::UserCleanupScheduler` hard-deletes unconfirmed users >7 days old via
`Account.where(...).delete_all` (no callbacks, no `DeleteAccountService`, no
sidekiq jobs, no moderation log — hence zero trace). That assumes email
confirmation is mandatory. It is not in Kronk, so an unconfirmed account is a
real member — and on 2026-08-18 06:11 this sweep silently deleted **@ladatal**
(an unconfirmed signup), unrecoverably.

**What this means in code.** `clean_unconfirmed_accounts!` is removed from
`Scheduler::UserCleanupScheduler#perform`; it now only runs the discarded-status
cleanup. The existing unconfirmed accounts were confirmed by hand to take them
off the clock. Complements the activate-on-signup change above (which stops
accounts becoming unconfirmed in the first place) — together they guarantee no
member is ever auto-purged for confirmation state.

---

## 2026-08-19 — Signups are activated immediately; email confirmation is a separate optional step

**Decision (Tal).** Now that email confirmation is voluntary, it must not be the
**activation** gate either. Before this, a real signup stayed `confirmed_at =
NULL` (the confirmation mail is optional / undeliverable on shadow), which meant
`prepare_new_user!` — feed bootstrap, welcome, approval routing — **never ran**,
leaving the account half-provisioned and reading as `confirmed? == false`
everywhere. Observed on shadow: recent web signups (`itsa_mango`, `tomasbusby`,
`snowtal`) were all unconfirmed and un-bootstrapped, while bridge accounts
(`tootctl create --confirmed`) were fine.

**What this means in code.** `User#auto_confirm_signup!` (`after_create_commit`,
guarded by `sign_up_ip.present? && !confirmed?`) calls the existing
`mark_email_as_confirmed!` on a genuine registration, so the account is confirmed
at signup and the normal confirmation flow (including approval routing — pending
accounts stay pending) runs. `sign_up_ip` is the real-registration marker (web +
app both set it); bridge / tootctl / fabricated users have none and arrive
confirmed anyway, so they're untouched. **"Confirmed" now means "activated";
"verified email" is a separate, optional concern.**

**Builds on** the voluntary-email decision below — that removed the confirmation
_gates_; this removes the confirmation _activation dependency_.

---

## 2026-08-16 — Everyone is present in Kronk by default; discoverability is opt-out, not opt-in

**Decision (Tal).** Every member should be **present in Kronk** by default —
name + profile picture visible in the Kommunity, findable in the Directory and
Kronk search — and then choose for themselves how private their profile is. The
signup-time "Make my profile discoverable" opt-in is retired. "Present" stops at
Kronk: new accounts are **discoverable but not indexable** — "present in Kronk,
not Google."

**What this means in code.**

- **New local accounts default to `discoverable = true`.** Set in a
  `User#default_account_discoverability` `before_create` (covers both the web
  registration and the app `AppSignUpService` paths; internal/service actors
  have no `User`, so they are untouched). `indexable` keeps its schema default
  of `false`, so external search engines stay out.
- **The onboarding profile step no longer manages `discoverable`/`indexable`.**
  The "Make my profile discoverable" `Toggle` (and its `recommended` /
  `onboarding.profile.discoverable*` strings) were removed from
  `features/onboarding/profile.tsx`; the server owns the default.
- **Kommunity presence was already universal** — `kommunity_discoverability`
  defaults to `everyone` and is independent of the Mastodon `discoverable` flag,
  so the Kommunity list did not depend on this change.

**Still to do (not this change).** Surface privacy as a real per-profile setting
so a member can opt out of the Directory / search after the fact. Until then,
opting out is possible only through the existing account settings.

**Supersedes** the onboarding discoverability opt-in. Builds on the voluntary-email
decision below (both make presence the default and privacy a member's own choice).

---

## 2026-08-16 — Email confirmation is voluntary and never gates visibility or interaction

**Decision (Tal).** Email in Kronk is for **password recovery + communication**,
at the **user's discretion** — it is **not** an anti-spam/anti-bot lever, and it
**never affects how a member interacts with the platform or whether others can
see them**. Anti-spam rides on **approval + invite/trusted onboarding**, not on a
confirmed inbox.

**What this means in code.** `confirmed_at` must not appear in any _visibility_
or _interaction_ gate. `User#functional_or_moved?` already dropped it for access;
the remaining stale gates are being removed as they surface:

- `AccountOwnedConcern` + `Api::V1::AccountsController` — profile page / account
  API (#1521).
- `Account.kommunity_discoverable_to` + the Kommunity orb (#1538).
- `Account.without_unapproved` (→ `User.approved`) + `Account::Search` raw SQL
  (this change) — search + directory.

The gates that **stay**: `approved` (admin gate), not `suspended`/`silenced`/
`disabled`/`memorial`/`moved`, and — on _discovery_ surfaces specifically
(Kommunity) — `current_sign_in_at` present, which hides registered-but-never-
active default-avatar rows. That last is about "has actually used the account,"
not about email.

**Legitimate `confirmed_at` uses that remain:** the confirmation flow itself,
password recovery, announcement/notification recipients, and feed vacuum. Those
are not visibility gates.

**Guidance for the next person:** do not re-introduce a `confirmed_at` /
`User.confirmed` check to decide whether an account shows up or can act. If you
need "a real, visible member," that's approved + active — not confirmed email.

---

## 2026-08-14 — Profile editing consolidated into Arrange mode; `/@:acct/edit` composer retired

**Decision.** There is one profile-editing surface: **Arrange mode on the
shelved profile** (`/@:acct/shelves`, owner-only). The standalone
`/@:acct/edit` composer (`features/profile_compose/`) is retired.

**Why.** We had two editors. The shelved profile's Arrange mode edited
cards/shelves but had **no** identity editing; the `/@:acct/edit` composer was
reachable by nothing but its own route (orphaned) yet had grown a duplicate
identity editor (display name, bio, avatar, header, fields). Arrange is
already the owner's edit entry point, so identity editing belongs there.

**What shipped.**

- **PR A** — identity editor folded into Arrange (`profile_shelves/components/
identity_editor.tsx`), rendered above `ArrangeStage`. Saves via a direct
  partial `update_credentials` (not the `updateAccount` action, which
  force-writes `discoverable`/`indexable` and would clobber privacy).
- **PR B** — retired the composer: deleted `features/profile_compose/` +
  `_kcompose.scss`, removed the SPA route + async component, and made
  `/@:acct/edit` a `<Redirect>` to `/@:acct/shelves`. The settings-nav
  "Profile" row now points at `/@:acct/shelves`.

**Node graph.** `profile.edit` is **kept** (relabelled "Profile editor",
`lifecycle: live`, url still `/@:user/edit` — which now resolves to the
redirect). Kept rather than deleted so its inbound refs stay valid with zero
cascade: the `settings.profile` `settings_for` link and two
`kommons_tracker.yaml` items (`privacy-to-profile`, `profile-composer-complete`)
still point at a real node.

**Landmine noted.** The `profile_composer` feature flag is **not** the
composer — it gates the `profile_cards` API endpoints that Arrange depends on.
It stays enabled; only its comment was corrected. Renaming it was deliberately
avoided (churn).

**Follow-up (PR C).** Onboarding's profile step (`onboarding/profile.tsx`) is
still a separate identity editor (it has extras: a discoverability toggle +
next-flow navigation). Dedupe it onto a shared component later.

---

## 2026-08-14 — Cross-korner connections: one `korner_attachments` table + manifest-declared consent

Kronk already has three cross-korner connections (Kalendar Event → Albutts
Album via `album.event_id` + a bespoke subscriber; Kalendar Event → Booth
Set via `booth_set.event_id`; Kalendar Event → Huddle Session via
`event.huddle_session_id` + `huddle` listening for `kalendar.event.created`).
Every pair is a new column, a new subscriber, a new UI. That doesn't scale
to the next five pairs (Kommons → Kalendar for a "voting deadline event,"
Booth → Martketplace for "buy the DJ's release," Nudges → any-korner for
reminders, …).

**Decision:** ship one generic primitive — `korner_attachments`, a join
table keyed by manifest slug + record id — and let every future cross-
korner connection be a **config change (manifest fields) + a UI wiring**,
not a schema migration.

Shape:

- **`korner_attachments`** — `(source_slug, source_id, target_slug, target_id,
kind, metadata, created_by, created_at)`. `kind` is one of `spawn` (auto-
  created by a source trigger, cascade-delete), `link` (user-added,
  independent lifecycle), `reference` (passive mention). Not Rails
  polymorphic — slug strings are the primary keys of the manifest, which is
  already the registry.
- **`attaches:` / `accepts:` manifest fields** — every korner declares what
  it may attach to + what it accepts from. `bin/tootctl korners doctor`
  enforces bidirectional consent. Matches how `emits:` / `listens:`
  already work.
- **Shared React primitives** — `useAttachments`, `<AttachmentSection>`,
  `<AttachmentPicker>` (new rows on `docs/kronk_platform_primitives.md`
  at Phase 2). New korners get the UX for free.
- **Migration path:** 5 phases (§5 of the spec doc), starting with the
  schema and API (no UI), then primitives plus one adopter, then backfill
  of the existing bespoke pairs. FK columns stay as a passive mirror for
  one release cycle after the join is authoritative — makes rollback cheap.

**Motivation:** Tal 2026-08-14 — "How can we ensure this is open ended for
other korners to connect into at a later date? I want to create the
plumbing, then the standard fittings for building korners moving forward
which can be used and reused."

**Full spec:** [`docs/kronk_korner_attachments.md`](../kronk_korner_attachments.md).

**Supersedes:** the intent behind the bespoke `album.event_id` +
`booth_set.event_id` + `event.spawn_album` + `albutts_event_bus.rb`
pattern. Those stay in place until Phase 3 backfills them into the join.

## 2026-08-14 — Account & Security: the "connected apps" / capability surface is coming-soon

Context: scoping the Account & Security settings rebuild. Phase 1 shipped the
native landing + signed-in devices + recent sign-ins (#1482). While scoping the
rest of "Group A" — the _authorised apps_ surface (see and revoke what has a
token to act on your account) — we hit the real question: **Kronk has no
third-party app ecosystem yet**, so that surface is near-empty today. Its first
genuine entry would be a **pod client**, and the designated first one is **YOU**
(`docs/spaces/you.md`) via the **Anthemos membrane** — the consent layer of
recipient-scoped, revocable capability grants.

**Decision (Tal): park it as coming-soon, don't build it now.** The user-facing
"connected apps" / capability consent+revoke surface is the same thing the
membrane needs, and the membrane is deferred (blocked on Anthemos). Building an
empty grant-management screen before there is anything to grant is effort for a
dormant capability — same reasoning that deferred aliases (federation) earlier.

What this means concretely:

- **Not built now:** a "Connected apps" surface, log-in-with-Kronk for YOU, and
  projecting YOU signals onto the Kronk profile (the "✓ Anthemos" chip in
  `docs/prototypes/kronk-profile-redesign.html`). These stay in
  `docs/spaces/you.md` § Deferred.
- **When it lands:** the consent/revoke UI is an Account & Security surface (it
  belongs next to signed-in devices), and YOU is its first real entry — so the
  settings thread and the membrane thread meet there. The doc's
  "secure only once / provisional until Anthemos-verified" pattern is the licence
  to ship a provisional slice first.
- **Account & Security continues** with the surfaces that serve _live_ needs —
  Data export/import next — not the app/capability surfaces that wait on
  Anthemos.

Supersedes nothing; records a deferral so it is not rediscovered.

## 2026-08-13 — No stacked PRs: every branch starts from the integration tip

Tal's call, from watching it fail twice in one session. The contributor rule now
lives in `CLAUDE.md` §1; this entry records the reasoning so it is not
rediscovered.

**A stacked PR cannot survive its parent merging.** Branch B off open PR A, and
when A lands the merge queue squashes it. B still carries A's _original_
commits, so the rebase collides, and B is **ejected from the queue**: still open,
still green, simply not merging, with no notification. It has to be rebased by
hand, once per parent, every round.

**What it cost.** A four-deep stack (#1415 → #1417 → #1418 → #1420 → #1426, plus
the icon work on top) was ejected **twice**. Each round needed the whole tail
re-rebased, re-pushed, re-linted and re-queued, and each round the PRs _looked_
queued in the meantime. The ejections were only noticed because someone went to
queue the next PR and found the queue empty with the earlier ones still open.
Rebasing was safe every time — git dropped the already-landed commits and every
file came back byte-identical to the version that had passed lint — but "safe"
still meant three manual interventions that independent branches would not have
needed at all.

**The trade being made.** Stacking buys a tidier review diff: each PR shows only
its own change. Independent branches sometimes show overlapping context and
occasionally need a conflict resolved at merge time. That is a much smaller cost
than serialised merges that eject themselves silently — especially with a
lint-only gate, where an ejected PR gives off no signal at all.

**Decisions.**

1. **Base every branch on `origin/rebuild/2.0.0`.** Accept duplication in review.
2. **If work cannot compile without earlier work, it is one PR.** Split by
   reviewable unit, not commit tidiness.
3. **Stacking is a documented exception**, declared in the PR body, and whoever
   stacks owns the re-rebasing.
4. **"Queued" is not "landed."** Re-check state after any parent merges. This
   applies to agents especially: reporting a PR as done on the strength of having
   queued it was wrong twice today.

---

## 2026-08-13 — Stage layer publishes three archetype classes (`.stage-fill`, `.stage-column`, `.stage-grid`)

Every korner mounts into the same Stage rectangle, but until now each
one wrote its own outer flex/scroll/max-width wrapper — `.kalendar-shell`,
`.kuestions-shell`, `.hub-page__board`, `.booth-native`, `.albutts-*-grid`
etc. — with subtly different padding, subtly different overflow rules,
and subtly different responsive behaviour. Kalendar shipping its own
`.kalendar-shell` on 2026-08-13 (the FeedDrum-in-Stage sizing fix) was the
tipping point: it was the third or fourth "shell" class that did the
same job as an earlier one.

`_kronk_stage.scss` now publishes three shared archetypes. A korner's
Stage-child picks one, or writes its own if none fit:

- **`.stage-fill`** — full-bleed: fills the Stage rectangle, no side
  padding, no max-width. For canvases and rotators (Kalendar Spiral,
  the Kalendar rotator itself, Map, Kommunity orb, Inflow veil).
- **`.stage-column`** — capped reading column, centred, `max-width: 38.75rem`
  (matches Mastodon's classic reading width), vertical scroll only.
  For list-shape faces (Kalendar list, Kommons proposals, Kuestions
  panels, Krew list, Mate list).
- **`.stage-grid`** — capped-width responsive tile grid,
  `minmax(min(140px, 100%), 1fr)` (the `min(…)` clamp lets tiles
  shrink below their nominal 140px on narrow phone Stages instead of
  forcing a horizontal scrollbar). For tile landings (Hub, Albutts,
  Booth gallery).

**Vertical-scroll only.** Both scrolling archetypes (`.stage-column`
and `.stage-grid`) declare `overflow-x: hidden` explicitly. Per the
CSS spec, `overflow-y: auto` with default `overflow-x: visible` gets
promoted to `overflow-x: auto` in Chromium — so setting `hidden`
explicitly is what actually keeps them vertical-only on phone. Kronk
phone views never side-scroll (Tal, 2026-08-13: "the thing i very
specifically do not want is the half/view, side scroll of the phone
screen, only vertical scroll").

**Migration is opt-in, not forced.** This decision introduces the
classes and converts Kalendar (both faces) as the reference adopter.
Shipped korners that already have working shells (Kuestions, Hub,
Albutts, Booth, Krew, Kommons) keep them. Follow-up sweeps convert
one at a time so per-korner idiosyncrasies (Kuestions' star-field
backdrop, Hub's tile-icon chrome, Booth's size-variant gallery) get
audited on their own PR rather than in a single sprawling refactor.

New korners land on an archetype by default. If the manifest reviewer
sees a fresh `-shell` class doing what an archetype already does, that
is the reason to say "use `.stage-fill` / `.stage-column` / `.stage-grid`
instead" during intake.

**Supersedes:** the Kalendar `.kalendar-shell` (already retired here).

## 2026-08-12 — Notifications: own-content first, federation and moderation deferred

Three calls that scope the retirement of the legacy `Notification` store. The
sweep behind them is `docs/rebuild/notification_retirement_plan.md`.

**Federation is deferred.** Kronk will not federate for a while, so notification
work plans as **local-only**. This resolves the contradiction the sweep found:
`kronk_nudges.md` § Non-negotiables says "No federation. Nudges is local-only",
while the store being retired carries federated activity (a remote account
favouriting or following you, via the ActivityPub handlers). With federation
deferred those paths are **dormant, not broken** — so they are left in place
rather than removed. They live in upstream files, cost nothing while dormant, and
leaving them keeps re-federation cheap. Revisit when federation is real.

**Moderation is deferred.** Community moderation covers the near future, so no
system/moderation channel is built now. `moderation_warning`,
`severed_relationships`, `admin.*`, `annual_report` and
`email_confirmation_reminder` keep reading the legacy store, and `/nudges/legacy`
plus the Kronk system pane stay for them. Consequence to hold: **the store is
not dropped**, and "retire the legacy system" means _stop writing what we have
replaced_, not _delete the table_. Dropping it is the last few percent of value
and the largest share of the risk.

**The goal: notify a user when anything happens with their content** — replies,
reactions, nudges, mate requests, and so on.

### Why this unblocks the work

The sweep concluded nothing could start before **multi-recipient fan-out**. That
was correct for the spec's full relevance engine and wrong for this goal.
"Something happened to _my_ content" has exactly one recipient — the owner — and
is Tier-1 **directed** in the spec's terms, which the manifest path has delivered
since #1367 plumbed `directed:` through. Fan-out is only required for the
_discovery_ tiers (Tier-2 "someone I follow did a thing", Tier-3 "something
happened in a korner I tuned into"), and those are a separate feature.

So the remaining work is **additive publishers plus manifest entries** on
machinery that already exists: five `status.*` events (`frothed`, `replied`,
`mentioned`, `reblogged`, `quoted`), none of which is published today —
`Favourite` publishes only korner-scoped froths and has no plain-status branch.
No new delivery architecture, and two phases can start immediately.

Supersedes the "nothing can start before fan-out" framing in the first draft of
the plan, and narrows the "retires with the bell" scope in
`docs/kronk_nudges.md` § _Self-delivering delivery_ to the types we have
actually replaced.

---

## 2026-08-12 — Checks must be trustworthy before we add more

From a doc-vs-code audit that turned into six bug fixes. The individual fixes
are in #1357, #1361, #1367, #1369, #1372, #1381, #1392; this entry records the
pattern behind them, because fixing them one at a time will not stop the next
one.

### The pattern

Every problem found was **a second copy of the truth that nothing compared back
to the original**:

- Normative docs describing an audience model the code had already replaced
  (`kronk_feed_and_reach.md` §2 still said a post reaches a tier _or_ a krew,
  after krew became additive — and `Status::Visibility` cites that section as
  its spec).
- `db/schema.rb` disagreeing with its own migrations in **both** directions:
  missing three columns one migration adds, and still carrying an
  `album_photos` constraint another migration drops. A DB built from it crashed
  on every unread count and rejected every album-photo insert.
- The korner doctor's L1 icon check grepping for the korner **slug** in a map
  keyed by Material Symbols **name** — so it failed for all 13 non-core
  enforced korners regardless of whether the icon was wired, and could never
  have caught the cross-wiring §3 credits it with.
- The `file_input_aesthetic` guard matching the literal `<input type="file">`
  inside a **prose comment** documenting the upload flow — failing on its own
  documentation while the real input was correctly hidden.
- Manifest `notifications.types` validated against the `Notification` store
  that `kronk_nudges.md` § _Self-delivering delivery_ already retired, so L10
  actively points korner authors at the dying mechanism.

### Why it stayed invisible: red is the normal colour

`test` had 43 distinct failures. `Historical data migration test` failed on
**every PR**. The doctor renders red. When everything is red, no single red
carries information — so a real regression is indistinguishable from the
background. That is how a broken from-scratch database build survived weeks,
and why 13 bogus icon failures went unremarked.

This compounds: because the suite is untrustworthy, only `lint` can gate
(2026-08-02); because only `lint` gates, the suite drifts further. That trade
was right for a shadow-only branch, but this is where the bill arrives.

### Decisions

1. **Get CI to zero, then gate it.** Clear the remaining spec failures (#1369
   and #1372 took 7 of 43; the largest remaining cluster is 8 in
   `registrations_controller_spec`), shard the rspec suite so it is fast enough
   to gate, then make `test` required. Sharding was already named as the
   durable answer in the 2026-08-02 entry; until this lands, nothing else here
   really sticks.
2. **Every guard ships with a proof it can fail.** A new check must come with a
   known-bad input that makes it go red. Both the icon check and the file-input
   guard die at birth under this rule, and it costs almost nothing. Applies to
   `korners doctor` checks, repo-scanning tests, and stylelint governance
   entries alike — a green run on a file whose rules never matched is worse
   than no check, because it reports safety it never established.
3. **Reconcile generated artefacts in CI.** Add a job that rebuilds
   `db/schema.rb` from the migration history and fails on a diff. That one job
   catches both of today's schema bugs mechanically, forever. It is only
   possible now that #1372 makes the history replayable.
4. **Prefer generating over restating.** Hand-maintained tables of what the
   code already knows — the doctor's layer coverage in `korner_standard.md` §3,
   the wired-event inventory in `nudges_bus_state.md`, korner lists — are
   accurate the day they are typed and rot from then on. Where a fact is
   derivable, emit it from the code (a task, or the doctor's own output) rather
   than transcribing it.
5. **Every hand-written factual claim carries the command that checks it.**
   The `> **Current state (date)**` callouts already date claims; the addition
   is to name the one-liner that re-verifies them, so staleness is cheap to
   detect instead of requiring an audit to discover.
6. **Drift-prone docs ask the reader to fix them, on the spot.** A short
   `> **Freshness**` block at the top of each such doc gives the date it was
   last checked, the command that re-checks it, and an instruction: if the
   command disagrees with the doc, **correct the doc in your current PR**.
   Rationale over the alternatives — a scheduled sweep produces a report nobody
   owns, and a passive "verify against code" note (already in this file's
   header) is advice without an owner or a moment. Correction-at-point-of-read
   has both: whoever is reading is already in a PR with the context loaded, and
   it self-prioritises by traffic, since a doc nobody reads harms nobody until
   it is read. The block must stay **short and copy-pasteable** — a wall of
   preamble gets skipped, which is the failure mode to design against. Prefer
   naming a command CI already runs, so the check itself stays exercised
   (decision 2 applies to these commands too: a rotted verification command is
   the same bug one level up).

   Applies to normative/derived docs. **Not** to closed records
   (`krew_axis_migration.md`) or dated snapshots (`remaining_work_*.md`), which
   are meant to describe a past moment and are not stale for doing so.

### Non-goals

This is not a call for more checks. The point is the opposite: an untrustworthy
check is a liability, so the existing ones get fixed and gated before new ones
are added.

---

## 2026-08-12 — Compose surfaces standardise on `<ComposeShell>`

Every korner's "create a new thing" surface is a shared `<ComposeShell>`
overlay opened via the Ж bubble at a canonical `/hub/<slug>/composer` URL.
Piloted with Albutts (PR #1213, 2026-08-07) and Moments; extended today to
Map's trek composer (was a full-page `/hub/map/logger` form inside Map's
Stage — presenting complaint: "opens uncentered"). The remaining korners
still on bespoke surfaces (Krew, Kuestions, Kommons, Booth, plus the TBDs
Kalendar / Martketplace / Huddle) migrate PR-by-PR against this shape.

### The shell owns

- **Portal mount to `document.body`.** Every composer floats over the app,
  above the Stage's own scroll, always centred, dim backdrop behind.
- **Canonical URL `/hub/<slug>/composer`.** URL is the source of truth for
  open/closed — the FAB is a `<Link>`, the back button closes, refresh
  keeps the composer open. Each korner's manifest points its
  `compose.route` here.
- **Chrome slots.** Korner icon (from `useKornerIcon(slug)`) + label +
  optional subtitle in the header; optional `switcher` chip pair for
  multi-composer korners (Albutts: Album/Contribute; Maps eventually
  Post/Place); optional `headerAction` slot that reach controls slot into
  (Moments + trek composer both put `<ReachDropdown>` here).
- **Cancel + primary submit footer.** Body owns `canSubmit` +
  `submitting`; the shell disables the CTA and swaps `submitLabel` for
  `submittingLabel` mid-flight. Escape + backdrop-click both cancel
  (disabled while submitting so an in-flight create can't be
  double-cancelled).
- **Success unmounts.** The body's `onCreated` hands control back to the
  parent, which navigates to the new thing (Albutts → album detail; trek
  composer → My treks). No inline "saved!" banner inside the shell.

### What NOT to do

- No bespoke modals (`<Modal>`, `dispatch(openModal(...))`, or hand-rolled
  overlays) for korner create actions. Compose = shell.
- No full-page compose surfaces mounted as one of a korner's `views:`.
  Compose is not a browse face — it's an overlay on top of one.
- No local `ComposeFab`. The Ж bubble in the site chrome is the only entry
  point; it reads `compose.route` from the manifest. Albutts dropped its
  local FAB in PR #1358 (2026-08-09) after the Ж shipped.
- No compose-inline reach control in the body when the shell's
  `headerAction` will do. Reach is chrome.

### The Ж bubble is the only entry point

Each korner's manifest declares:

```yaml
compose:
  label: 'Log a trek' # what the Ж bubble tooltip / a11y label says
  route: '/hub/map/composer' # canonical shell URL
```

Legacy pre-shell URLs (Albutts: `/new`; Map: `/logger`) resolve to the same
overlay so bookmarks + in-flight tabs don't 404 during the migration.
Retire the aliases once the analytics say nobody hits them.

### Migration order

1. **Map / trek composer** — done today, this decision.
2. **Krew, Kuestions** — cheap wins. Single composer each, simple form,
   already URL-addressable.
3. **Kommons, Booth** — larger surfaces. Booth has two composers
   (upload / share), a good second reference for the `switcher` slot.
4. **Kalendar / Martketplace / Huddle** — declare `compose.route` in the
   manifest but no shell-shaped composer yet. Do first-implementation
   against this decision rather than shipping a bespoke one.

Non-korner composers (Nudges messenger, profile shelves' Tell composer,
Kommons tree's create-node composer) are out of scope — they're inline
panels inside larger surfaces, not "create a new thing at a korner URL"
actions.

### Enforcement

`bin/tootctl korners doctor` scans every `*composer*.tsx` under
`features/**/` and warns when a file misses the shell (no
`ComposeShell` import, direct `createPortal`, `openModal` dispatch,
or a local `<ComposeFab>` render). Warning-level so a WIP composer
can land — promote to `issues` once the standard is proven stable
and any legit exceptions are documented.

---

## 2026-08-09 — Cross-site standardisation decisions

From a site-wide standardisation audit (six read-only sweeps: composers,
space chrome, audience/reach, media/uploads, post interactions, cross-cutting
idioms). Four calls made by Tal; the remainder are ranked opportunities, not
decisions.

### Reach: the widest tier is "Kronkverse" everywhere

The widest reach/visibility tier shows **Kronkverse** on every picker and the
feed switcher. It was labelled three ways: `Kronk` (ReachDropdown, the feed
scope switcher, the Kuestions dial) and `Everyone on Kronk` (ScopePicker);
`KornerVisibilityPicker` already said Kronkverse. Display copy only — the
internal values (`public` / `kommunity` scope keys, the `kronk` ring-mark
glyph) are unchanged. The bespoke pickers (Kuestions' `VisibilityDial`,
profile shelves' `ReachPicker`, the map/event `<select>`s) fold onto the
shared `ReachDropdown` in follow-ups; that is the one standard visibility
selector.

### Krew is an orthogonal axis, not a visibility value

Per the reach spec, a krew is a group you post _into_, independent of the
distance ladder — "mates **and** krew X" must be expressible. Today every
model (`Status`, `Moment`, `Album`) encodes krew as a mutually-exclusive enum
value (picking krew discards the tier), and the krew integer slot disagrees
across models (`Status` krew=5, `Moment`/`Album` krew=2). Decision: krew
becomes a **separate field** (reach tier + krew id(s)) — a schema/enum
migration across the three models plus the picker rework, which also fixes
the integer mismatch. Supersedes the implicit "krew is one slot in the
ladder" the code assumed.

### Moments are Home-strip-only; they do not project to the feed

Moments live in the Home strip, not as feed cards. The `Moment` model /
`MomentsController` docstrings asserting "every Moment projects to a Status
for feed presence" are wrong — nothing populates `status_id`, and `moment` is
not a registered korner card. Fix: correct the docstrings and drop the dead
`belongs_to :status`. (Separately, Moments froth moves off the bespoke
`MomentFroth`/star model onto the shared `Favourite`/heart — the last korner
still on a private froth model after Albutts moved on 2026-07-31.)

### mARTketplace listings do project to the feed

Listings should appear as feed cards. The wiring exists (`Listing belongs_to
:status`, `Status has_one :listing`, a `KORNER_CARDS` entry) but
`listings_controller` never calls `PostStatusService` or stamps
`source_korner`, so the link is never populated and listings are silently
absent from the feed. Fix: wire the projection (through the shared
`FeedProjectable` concern when it lands).

### Open (from this audit)

- What `vouched` (the `ProfileCard` / `ProfileSection` visibility tier, which
  has no equivalent in the mates graph) maps onto — to be decided during the
  reach-unification pass.

---

## 2026-08-04 — Launch card retired (no producer, no in-feed announcement)

The manifest's `launch:` block (§8.7 of `kronk_korner_spec.md`) was the
"one-time in-feed announcement when a korner opens" mechanism —
`blurb` + `cta` per korner, projected into every user's feed once at
open time. Field is parsed; ~10 korners declare their copy; no
producer was ever built.

Retired on Tal's call — no producer, no announcement. The `launch:`
field stays parsed as-is (vestigial rather than an active concept)
because ripping it out of ~10 manifests is churn for no user-facing
gain; a subsequent cleanup can drop the field when the spec is next
revised.

Consequence for Phase 14: no "welcome our new korners" flow.
Discovery of new korners routes through the normal channels — Hub
tile lighting up, Kronk menu, `/kronk/about`, word-of-mouth. The
implication that the launch card was necessary for Phase 14 (in
`remaining_work_2026-08-04.md` — "needed for the Phase 14
announcement flow") is retracted in the same edit.

---

## 2026-08-04 — `tsc --noEmit` removed from the pre-commit hook

The pre-commit hook (`lint-staged`) bundled the cheap changed-file auto-fixers
(`prettier --write`, `eslint --fix`, `rubocop -a`, `stylelint --fix`) with a
**project-wide `tsc -p tsconfig.json --noEmit`**. TS can't be scoped to changed
files, so that ran over the whole codebase on every `.tsx` commit — ~2 GB, slow,
OOM-prone on portal. The predictable consequence: contributors committed with
`--no-verify` to escape it, which skips the _entire_ hook — including
`prettier --write`. Unformatted code then reached PRs and failed the `lint`
merge gate (prettier "Check formatting"), so those PRs couldn't enter the queue
and parked/staled. This was the actual cause of the 2026-08-03 "slow queue"
(≈10 parked profile-shelves PRs), not queue congestion.

Removed the `tsc` line from `lint-staged.config.js`. The hook is now fast enough
that there's no reason to bypass it, so the formatters always run. **Nothing is
lost:** CI runs the identical `yarn typecheck` (`tsc --noEmit`) in
`.github/workflows/lint-js.yml`, and contributors can run it locally before
pushing. Supersedes the CLAUDE.md "pre-commit runs tsc" guidance (updated in the
same PR); continues the queue-hygiene thread from the 2026-08-02 lint-only
decision below.

## 2026-08-02 — Merge queue gates down to `lint` only

`rebuild/2.0.0`'s merge queue required two checks — `lint` and
`test (.ruby-version)`. The Ruby suite ran ~15 min and _was_ the entire queue
latency; a PR sat ~15–20 min even though `lint` (which catches most breakage
cheaply) finished in ~2. Dropped `test` from the required checks on ruleset
20013211 and set the batch wait 5→0, so **only `lint` gates** and merges land
in ~2 min. `test` still runs on every PR (visibility) and on push to
`main`/`stable-*`; it just no longer runs in the merge group (`test-ruby.yml`
lost its `merge_group:` trigger) or blocks the merge.

Trade accepted: the queue no longer re-verifies the _combined_ result of
stacked PRs against the suite — a pair that each pass alone but break together
can land, caught on the next PR's run. Acceptable because `rebuild/2.0.0` feeds
shadow, not production. The durable "fast _and_ fully-gated" answer is to shard
the rspec suite (~15→~4 min) and re-add it as a gate; until then, **read your
PR's `test` result yourself — a green queue is not a green suite.** Contributor
guidance is in `CLAUDE.md` (§"CI gates" + §3, incl. the "Enable auto-merge"
parking trap). Prior ruleset config was backed up before the change.

Supersedes the "two required gates" framing from the 2026-08-01 CI work.

## 2026-07-20 — Korner conformance gates (L1 / L10) + event bus

Decisions taken while building the conformance gates from
`implementation_plan.md` Phases 1.7 / 5.7 / 9.5 (PRs #387–#393). All verified on
a real Postgres + Redis env before merge.

### D2 — Klot's `klot_phase_viewer` is a sanctioned exception, not migrated now

Klot's bespoke visibility scope points at a shared authorization layer (§7) that
does not exist yet. Rather than build §7 to satisfy one scope, `klot_phase_viewer`
stays enforced by its existing ownership check + `KlotShare` allowlist and is
documented as a **sanctioned exception** in `korner_standard.md`. It migrates onto
the shared layer when §7 lands. (Klot's manifest _shape_ was still migrated to the
nested `security:` block — #392.)

### D3 — Nudges and Groups are accepted structural exceptions

Named in `korner_standard.md` so they stop reading as drift: **Nudges** is a
`core:` space (own mount `/nudges`, no Hub tile, not tune-out-able) that carries a
manifest only because a manifest is how anything is declared; **Groups** opts out
of feed projection by design (`render_target: web`, no `status_association`), so
its L3/L4 gates are N/A, not failures.

### §5.7 — a manifest declares only notification types that actually fire

The L10 gate (#388) requires every declared `notifications.types[].name` to be a
registered `Notification` type. Rather than register dead types to satisfy it, the
rule is: **declare only what has a working producer.** Built `proposal_challenged`

- `task_assigned` (real hooks exist); removed the declarations whose trigger
  surfaces don't exist yet — kommons `proposal_backed`/`proposal_comment`, kuestions
  `question_answered`/`answer_frothed`, wachuneed's four `listing_*` — each with a
  manifest comment on when it returns (#393). They come back _with their producers_.

### §9.5 — event-bus wiring is deferred

The bus (`Kronk::KornerEvents`) has publishers but no runtime subscribers and no
handler-naming convention. The entire system has **one** cross-korner listen
(huddle ← `kalendar.event.created`; the names align, so it is not an orphan), its
handler is unbuilt _feature_ work, and huddle is `enforced: false`. Building a
generic wiring framework + convention for a single non-enforced consumer is
premature. Deferred until a second real listener or a concrete need exists; the
`listens:`/`emits:` text check in `korners doctor` remains adequate until then.

### Process — a reverted feature must restore its migrations too

The 2026-04-27 "Kommons" revert deleted 8 migrations; when Kommons was re-added
only `create_tasks` came back, leaving `proposals` (and others) in `schema.rb`
with no creating migration — the from-scratch migration replay was red for weeks.
Recovered verbatim from the pre-revert commit (#390). Lesson: when reverting then
re-landing a feature, the migration set travels with it; the replay job is the
check that catches a half-restore.

## 2026-07-19 — The space model

### A space is the general thing; a korner is one kind of space

"Space" has no strict definition and does not need one: it is any top-level
surface of Kronk. "Korner" is precise — a pluggable, manifest-declared space
that can be added or removed.

**Feed, Profile, Nudges and Hub are spaces that are not korners.** They have
no collective name beyond "spaces"; naming them as a category was considered
and rejected as unnecessary vocabulary.

### The top-level spaces are Feed, Profile, Nudges, Hub

Matching what shipped in `hub_switcher.tsx` — Me / Home / Nudges, with Hub on
the korner rail.

**Consequence, applied.** `Kronk::NodeRegistry::BUCKETS` is now
`feed|profile|hub|nudges|settings|kronk` — `nudges` is accepted, and the
`settings` and `kronk` namespaces became buckets too. `build_node` still
returns `nil` for an unknown bucket, but no longer silently: it logs
`Kronk::NodeRegistry: dropped <source> node '<id>' — <reason>` naming the
offending value, so a bad bucket is visible even though the node never enters
the registry (the doctor's L6 checks read the registry, so they can only see
nodes that survive validation).

### The Skeleton is plumbing, not only a map

A Skeleton node is not merely a page. Each node carries what it is _wired to_
— its settings, its notifications, its projections — and other subsystems
read the Skeleton to find out: Nudges reads it to know what can notify,
settings reads it to know what can be configured, feed rendering reads it to
know what projects.

This is why registry drift matters more than bookkeeping. A manifest that
declares five notification types while the code registers one is not untidy;
it is a registry lying to its consumers. (`config/korners/kommons.yaml`
declares `proposal_backed`, `proposal_challenged`, `proposal_comment`,
`task_assigned`, `proposal_status_changed`; `app/models/notification.rb`
registers only the last. The doctor does not currently check this.)

### One mechanism: every space gets a manifest

Supersedes the split between `config/korners/*.yaml` (korners) and
`config/kronk_nodes.yaml` (everything else).

Core spaces — feed, profile, nudges, hub — get manifests like any korner,
flagged non-removable. `config/kronk_nodes.yaml` becomes core manifests.

**Blocked as written.** `config/korners/reserved_slugs.yaml` reserves `feed`,
`hub`, `home` and `settings`, and `docs/korners/korner_standard.md` §L1 fails
any manifest whose slug is reserved — so `feed.yaml` and `hub.yaml` cannot
exist under the current rule. Resolving this needs the reserved-slug check to
distinguish _core_ manifests from korner manifests, rather than forbidding the
slug outright. Noted here rather than quietly worked around, because the
reservation exists for a good reason: it stops a korner claiming a platform
route.

Corroboration that the direction is right: `reserved_slugs.yaml` already
anticipates it — _"Once the Nudges cutover completes (task #30) and the
manifest is retired, `nudges` moves back into this list as a reserved platform
stem."_ The repo was already planning for Nudges to stop being a korner and
become a platform space.

**Reasoning:** if every node must declare what it is wired to, core spaces
need the same declaration surface korners already have, because they have the
same things. Feed has settings (`/home/settings`). Nudges has notification
preferences. Under two mechanisms the core cannot declare what a korner can,
so core wiring lives scattered in code where nothing can read it.

That privileged core is what produced the settings mess: settings had no
honest home, so it was filed under the `profile` bucket in the registry while
`docs/spaces/settings.md` claimed it was a `hub` sub-tree.

### Settings: a hub _and_ contextual entry, converging

Both reachable, both opening the same canonical area — a central hub that
indexes everything, and entry from within each space and korner.

This was never actually in dispute: the 07-12 workshop note (§3) and the
07-15 in-repo IA both said it. Only the section cut differed.

**Mastodon's classic settings pages are to be retired entirely.** That
requires every existing setting to be inventoried and given a home first —
2FA, sessions, authorised apps, migration, delete-account and data
import/export do not belong to any one space and still need somewhere to
live. Retiring before that inventory is complete would silently drop
capabilities users rely on.

### Settings section cut: Privacy → Profile, Notifications → Nudges (2026-07-20)

Resolves the "section cut" open item, confirming `docs/kronk_settings_ia.md`
(07-15). **Privacy is not a standalone page** — it folds into Profile ("Me"),
with its incoming blocks/mutes/filters facet living on Feed. **Notifications has
no standalone section** — notification preferences fold into **Nudges** (IA §3,
"Notifications ≡ Nudges"). The registry still carries `settings.privacy` and
`settings.notifications` as `lifecycle: live` nodes; re-homing them is
implementation follow-up — notifications with the Nudges work, privacy with the
Profile/settings work.

---

### Upstream Mastodon pages: search unified, lists cut, discovery to be rebuilt (2026-07-23)

Audit of the ~29 leftover Mastodon page-components during the Frame migration
(`docs/kronk_frame.md`). Decisions:

- **Search** — KronkSearch (`/hub/search`) is canonical. The Kronk menu now opens it;
  Mastodon's `/search` + `features/search` are retired.
- **Lists** — cut. Mastodon lists (`features/lists`, `list_timeline`, the deck
  `LIST` column, the list nav panel) are removed; Feed scope
  (Friends / FoF / ₭ommunity) is the only reading filter.
- **DMs** — `/conversations` redirects to Nudges (the messenger is the DM home).
- **Dead code** — `community_timeline`, `public_timeline` (superseded by Firehose)
  and the unrouted `notifications_v2/index` page are removed.
- **Discovery — split, one half done (2026-08-05).**
  - **`/directory`** (profile listing) — **retired.** The Kronk-native
    `/hub/kommunity/discover` (#1149) replaces it: opt-in per-account
    visibility (everyone / orbit / nobody), activity-ordered, tap-through
    to shelved profiles where Groove + Nudge live. The SPA `/directory`
    now 301-redirects to Kommunity Discover; the `features/directory`
    bundle + its action / api / reducer entries are deleted. The
    `/api/v1/directory` REST endpoint stays intact for federation-facing
    external consumers (third-party clients, ActivityPub actors); only
    the Kronk-side UI usage is gone.
  - **`/explore`** (trends — statuses, tags, links) — **still open.** No
    Kronk-native replacement yet. The retirement is scoped to when a
    replacement exists; until then, `/explore` remains as a placeholder.

---

### Two earlier "blocked/consequence" notes are now resolved in code (2026-07-23)

Both landed while their prior notes above still read as open:

- **`NodeRegistry::BUCKETS` (from "The top-level spaces are Feed, Profile,
  Nudges, Hub", 07-19) is caught up.** `app/lib/kronk/node_registry.rb:46` now
  reads `BUCKETS = %w(feed profile hub nudges settings kronk)` — a `bucket:
nudges` (or `settings`/`kronk`) node is no longer silently dropped. The "not
  yet applied" consequence is applied; the standard's four-bucket §L6 and the
  code agree.
- **Core-space manifests exist (from "One mechanism: every space gets a
  manifest", 07-19) — the reserved-slug block is gone.**
  `config/korners/{feed,hub,profile,settings}.yaml` are all present, and the
  doctor distinguishes core from korner via `manifest.core?`
  (`config/initializers/kronk_korner_registry.rb#core?`; the reserved-slug and
  conformance gates in `lib/mastodon/cli/korners.rb` skip on `next if
manifest.core?`). A reserved slug no longer forbids its own core manifest.

---

## Open

- Where account-level settings (security, sessions, account lifecycle,
  import/export) live under the subset model.
- Whether `settings.*` nodes survive at all once each space declares its own
  settings, or whether `/settings` becomes purely a view over the Skeleton.
