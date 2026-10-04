# Feed

**Node bucket:** `feed` (Kronk::NodeRegistry) · **Cross-cutting** — not owned by a single korner manifest.

## Purpose

Feed is Kronk's home-screen surface — where the platform reads as
**one thing** rather than a set of separate tools. Every korner
projects into the feed via its `feed_projection.card`; the feed is
the place a user encounters the whole of Kronk in one continuous
scroll.

## Nodes in the Skeleton

Declared in `config/kronk_nodes.yaml`:

- **`feed.home`** — the feed itself (the one continuous scroll). `/home`. Live.
- **`settings.feed`** — Feed's own settings (`bucket: feed`). `/home/settings`.

Feed is deliberately **one** destination, not a set of timeline tabs. The
local/federated/explore/hashtag timelines are the same feed at a different
**scope** (Friends / FoF / Kommunity), which is a setting — not separate
nodes. Saved collections (froths, bookmarks, lists) are your content, not the
feed; the composer is the global Post action; a post permalink is where every
post lives. None of those are Skeleton destinations, so they carry no node.
(`feed.nudges` lives in the `nudges` bucket — the Nudges pillar — not here.)

## Cross-references

- The feed-projection contract for each korner is documented on its
  own space doc plus in `docs/korners/adding_a_korner.md (Framework spec (v0.5))` §"Feed
  projection".
- Card frame: `StatusKornerCard` — the shared visual frame every
  korner card composes with. Card partials: `_status_<korner>_card.scss`
  in `app/javascript/styles/mastodon/`.
- Card registry: `app/javascript/mastodon/components/korner_cards.tsx`.

## Status

Home feed is a stable Mastodon-inherited surface, dressed in Kronk
chrome. The Nudges activity feed shipped (Nudges pillar spec).

_This is a stub. Contributions welcome — see the pattern of the
korner-space docs in this folder for the target shape._

---

## Feed and reach

_Merged into this file on 2026-10-04 from `docs/spaces/feed.md (Feed and reach)`; its own status notes and dates are kept as written._

> **Freshness.** §2 claims last checked **2026-08-12**. Re-check with:
>
> ```
> grep -A4 'enum :visibility' app/models/concerns/status/visibility.rb   # is krew a visibility value?
> grep -n feed_scope_enforced config/feature_flags.yaml                  # are the tiers enforced, and where?
> ```
>
> If either disagrees, **correct this doc in your current PR** — `Status::Visibility`
> and `Reachable` both cite §2 as their spec, so a stale §2 misleads at the point
> of reading the code. See `decisions.md` 2026-08-12 (decision 6).

> **Status.** Design spec, decided in a workshop with Tal on 2026-07-24. This is the
> normative model for how korners post to the feed, who sees what, and the social graph it
> rides on. It **extends and, where they conflict, supersedes** the feed-projection notes in
> `docs/korners/adding_a_korner.md (Framework spec (v0.5))` §8 and `docs/spaces/feed.md`. Implementation had not started at
> time of writing — the "Current state" call-outs describe what exists so the gap is legible.
>
> **Read this correctly.** The decisions in §0 are authoritative. The §6 open items are
> genuinely undecided and must not be treated as settled. The build order in §5 is the
> intended sequence, not a status report.

---

### 0. Decisions (authoritative)

Three connected layers, built bottom-up (see §5):

1. **Mates graph.** Kronk drops one-way _following_ entirely. The only person-to-person
   relationship is **Mates** — symmetric, mutual, formed by **request → accept**. Because
   Kronk ships as a _copyable platform_ (federation is Kronk-to-Kronk, not fediverse interop),
   Mates is **Mate-native**: we do not bend the model to ActivityPub's follow semantics.
2. **Reach & scope.** A single distance scale **Mates → Orbit → Kronk** governs both _what a
   user sees_ (feed width) and _how far a post radiates_ (reach). **Krew** is a **separate
   axis** — a chosen group you post _into_, whose members see the post **whether or not they
   are Mates**.
3. **Feed projection.** Korner content posts a **card** into the timeline **automatically on
   create**. The **manifest is the source of truth**: the frontend card registry is driven by
   each korner's `feed_projection`, not a hand-maintained list. A new **`source_korner`** field
   on the status is the single discriminator that drives _which card_, _the tune-in gate_, and
   _reach_. Cards share the `StatusKornerCard` frame (customisable), with one functional action
   plus click-through. **Tune-in is enforced** as the per-korner feed gate.
4. **Replies inherit the parent's visibility.** If a viewer can see a post, they can see every
   reply on it — no separate reach gate on the reply. This drops the classic "friend replying
   to a stranger" hiding pattern from other networks (Tal 2026-09-05) because Kronk doesn't
   have follows / followers for that pattern to gate against. Consequence: **no
   reply-visibility feed setting.** The reach + krew rules on the parent status already fully
   determine who sees the thread.

Everything below elaborates these.

---

### 1. Mates (the social graph)

**Decision.** Replace one-way following with mutual-only **Mates**.

- **Mechanic:** **request → accept.** Alice sends a mate request to Bob; Bob accepts; they are
  Mates. Consent is explicit on both sides.
- **States:** `none` → `pending` → `mates`. There is no "follower" state in the Kronk product
  surface — you are unconnected, pending, or Mates.
- **`Orbit`** = **Mates of Mates** (one relationship hop out). Used as the middle reach/scope
  tier (§2). How Orbit is computed (live traversal vs. maintained set) is an open item (§6).
- **Federation is not a constraint.** Kronk is released as a copyable platform; "federation"
  means other Kronk instances federating with a Kronk instance, not interop with follow-based
  Mastodon servers. So Mates can be first-class and _following can be genuinely removed_ — we
  are not preserving an ActivityPub follow graph underneath for interop's sake.

> **Current state.** The codebase is follow-based (Mastodon `Follow`), and "Mates = mutual
> follow" already exists as a derived notion (e.g. `Nudges::EventRouter` gates on mutual
> follows). This spec promotes Mates to the _only_ relationship and removes the one-way
> follow product surface. Migration of existing follows is an open item (§6).

---

### 2. Reach & scope

#### 2.1 The distance scale

One scale, widest to tightest:

| Tier        | Who                                 | Notes                                                 |
| ----------- | ----------------------------------- | ----------------------------------------------------- |
| **Kronk**   | The whole community on the instance | The broadest reach                                    |
| **Orbit**   | Mates of Mates (one hop out)        | The middle ring                                       |
| **Mates**   | Your mutual connections             | The tightest social ring on the scale                 |
| **Just me** | The author alone (profile timeline) | Below Mates; no fan-out at all (tightened 2026-07-29) |

> **Implemented (2026-07-25; Just-me semantics tightened 2026-07-29).**
> The reach tiers are Status visibility values: `mates` (6),
> `orbit` (7), `self_only` (8) in `Status::Visibility`, all local-only.
> (`krew` held slot 5 until 2026-08-11, when it stopped being a
> visibility value at all — see §2.2. The slot is left empty rather
> than renumbered, because renumbering rewrites every row.) `Kronk` maps to the existing
> `public` visibility. Read enforcement lives in `StatusPolicy#show?`
> and `AccountStatusesFilter#permitted_visibilities`; write fan-out
> in `FanOutOnWriteService` (`mates`/`orbit` → Mates' home feeds;
> `self_only` → **no feeds at all — not even the author's own home**,
> only the profile timeline). Mention + quote notifications are also
> suppressed for `self_only` (the recipient can't see the Status and
> would 403 on click-through). `Just me` was added to the ladder in
> the 2026-07-25 workshop and hardened on 2026-07-29 so it means
> "on my profile only, not in anyone's feed"; the proactive Orbit→FoF
> home push remains deferred (§6).

The same scale is used for **two things**:

- **Feed width (viewing).** In feed settings, a user chooses how wide a slice they want to
  _see_: Mates / Orbit / Kronk.
- **Reach (posting).** How far a post _radiates_: Mates / Orbit / Kronk.

#### 2.2 Krew — a separate axis

**Krew is not on the distance scale.** It is a _group target_: you post **into** a chosen Krew,
and **its members see the post regardless of whether they are your Mates** (Krew membership is
independent of the Mates graph). Krew rides the existing `statuses_krews` scoping primitive.

> **Krew is an orthogonal, additive axis (implemented 2026-08-10/11).** A post
> carries **exactly one** reach tier **and**, independently, **any set of
> krews** — the two are not alternatives. A post's audience is
> _reach-tier audience_ **∪** _members of the krews it targets_, so
> "Mates **and** Krew X" is expressible. `krew` is therefore **not** a
> `visibility` value on any model (Status, Moment, Album). The shared rule
> lives once in `app/models/concerns/reachable.rb`; read enforcement is
> `StatusPolicy#show?`, write fan-out is `FanOutOnWriteService`. Rows that
> were `visibility = krew` migrated to `self_only` **keeping their krew
> link**, which preserves their audience exactly. Full history and staging:
> [`docs/decisions.md (2026-08-09, Krew is an orthogonal axis)`](../decisions.md);
> decision: [`rebuild/decisions.md`](../decisions.md) 2026-08-09.

#### 2.3 Per-user feed settings

Two controls live in **feed settings**:

- **View width** — Mates / Orbit / Kronk (what the feed shows).
- **Standard-post reach** — the default reach for the user's _ordinary_ posts (Mates / Orbit /
  Kronk), overridable per post.

> **Current state (2026-07-29).** `UserSettings.kronk.feed_scope` uses the new
> tier names `mates | orbit | kommunity`, default `orbit` (alpha.330). The API accepts
> the legacy `friends | friends_of_friends` names on write and normalises them so any
> stored values migrate on next write. The picker lives on `/home/settings`; the Home
> column reads the setting once on mount and renders one feed accordingly (alpha.332
> retreated the inline chip row from the Home column — it lived under the ColumnHeader
> briefly in alpha.330–.331 and was rolled back); Kommunity drives the local timeline.
> Krew as a feed target on the Home column is not currently wired. Standard-post-reach
> as a second job on this setting remains open.
>
> **Update (2026-08-12) — the tiers are enforced on shadow.**
> `Kronk::FeatureFlags.feed_scope_enforced` has landed, and
> `Api::V1::Timelines::HomeController` narrows the feed through
> `Kronk::AudienceScope` when it is on. In `config/feature_flags.yaml` the flag
> is `false` under `default:` but **`true` under `production:`** — and shadow
> runs `RAILS_ENV=production` off `shadow`, so on **shadow** Mates vs
> Orbit are genuinely narrowed and the picker is no longer display-only. Since
> the 2.0.0 release (2026-09-20) `main` carries the same block, so the tiers are
> enforced in production too.

#### 2.4 Korner-card reach

- Each korner declares a **default reach** in its manifest — this is the **ceiling** (maximum
  radiation) for that korner's cards. e.g. Kommons / Kuestions / mARTketplace → **Kronk**; more
  personal korners → **Mates**.
- The author may **narrow** a card's reach per post (Kronk → Orbit → Mates → Just me) but **may
  not widen** beyond the korner's declared default. The default is the ceiling. Krew is **not**
  a rung on that ladder — it is the separate additive axis of §2.2, so targeting a krew neither
  narrows nor widens the tier.
- **Krew-targeting** is available wherever the composer offers the krew submenu; today that is the
  main composer, Moments (single-krew) and Albutts. It is additive, so the narrow-not-widen rule
  applies to the tier only.

> **Not built (as of 2026-08-12).** This section is design intent, not shipped
> behaviour: no korner manifest declares a default reach (there is no
> `default_reach`/`reach:` key in `config/korners/*.yaml`), the ceiling is not
> enforced anywhere, and the `krew_targetable` flag named in earlier drafts of
> this section **does not exist in the codebase** — krew-targeting is decided
> per composer in the frontend instead. Treat the ceiling rule as unimplemented
> until a manifest key and a check exist.

---

### 3. Feed projection (how korners post cards)

#### 3.1 The write path (unchanged shape, formalised)

A korner posts to the feed by creating a real `Status` and linking it back to the korner record
(the §5.5 `status_id` convention):

1. Korner content is created → the korner **automatically** posts a card (Decision: _auto on
   create_, not opt-in share).
2. `PostStatusService` makes the `Status` at the resolved **reach** (§2.4) — mapped onto
   visibility for Mates/Orbit/Kronk and onto `statuses_krews` for Krew targets.
3. The korner record's `status_id` is set; **`Status.source_korner`** is stamped with the
   korner slug (§3.2).

#### 3.2 `source_korner` — the single discriminator

**Decision.** Add a **`source_korner`** slug column to `statuses` (nullable; null = an ordinary
post, not a korner card). It is the one field that drives:

- **Which card** — the registry looks up the adapter for that slug (§3.3).
- **The tune-in gate** — the timeline filter excludes cards whose `source_korner` the viewer has
  tuned out (§3.4).
- **Reach context** — ties the card back to its korner's manifest reach ceiling.

This replaces today's inconsistent discrimination (Kommons keys on `post_type`; Booth / Event /
Listing key on "which association got serialized"). `post_type` may remain for legacy readability
but is **not** the card discriminator.

#### 3.3 Manifest-driven card registry

**Decision.** The frontend card registry is **driven by the manifests**, not a hand-maintained
JS array.

- Each korner's `feed_projection` (served to the client) declares its `card` name and the fields
  the card needs (`title_from`, `summary_from`, `links_to`, …) — and these fields are **actually
  read**, not just documented.
- Adding or changing a card = **manifest edit + adapter component**. No edit to a central
  predicate list.
- The **boot validator checks the declared `card` resolves to a real adapter** (today it only
  validates `status_association`). Declared-but-unbuilt cards become a visible drift error, not a
  silent gap.

> **Current state.** `components/korner_cards.tsx` is a hardcoded predicate array; the manifest
> `feed_projection` is largely documentation. Fields `title_from` / `summary_from` /
> `discriminator` / `links_to` are declared but never read. Five manifests declare cards with no
> component (huddle, moments, albutts, inflow/kosmic, plus retired kuestions).

#### 3.4 Tune-in as the feed gate

**Decision.** **Enforce tune-in.** When a user tunes a korner out, that korner's cards
(`source_korner = <slug>`) **stop appearing in their feed** — a server-side filter on the
timeline query. This makes real the promise the settings UI already states.

> **Current state.** `KornerTuneOut` exists and the settings copy says tune-in controls whether
> "this korner's cards appear in your feed," but **no server-side feed filter reads it** — today
> tune-out only affects Hub-grid / icon chrome.

#### 3.5 Card contract

**Decision.** Shared frame as the standard; korners may customise.

- All korner cards use the shared **`StatusKornerCard`** frame (icon, korner label, title,
  summary, link) as the baseline chrome.
- **Functional baseline + depth:** the frame exposes **one standard action slot** for the card's
  primary act (RSVP an event, back a proposal, froth), and **tapping the card opens the full
  korner record** for anything deeper. Cards are useful in-feed without turning the timeline into
  the whole app.
- Korners **may customise** beyond the baseline where warranted.

#### 3.6 Cleanup folded into the rebuild

- **Port the Event card onto the shared base** — it is currently stateful/self-fetching (RSVP
  mutation) and routes to the legacy `/kalendar/:id`; bring it onto the standard action-slot
  contract and the `/hub/kalendar/...` route.
- **Retire the dead `question_card`** declaration (Kuestions stopped projecting in Phase 3a).
- **Drop Booth's orphan `shared_status_id`** column (the controller uses `status_id`;
  `shared_status_id` is pre-2.0 dead weight).
- **Build the stubbed cards** (huddle, moments, albutts, inflow/kosmic) — including the missing
  `Status` serializer wiring for `huddle_session` / `kosmic_update` so their data reaches the
  client.

---

### 4. Schema & manifest additions (summary)

**Status model**

- `statuses.source_korner` — slug string, nullable, indexed. Null = ordinary post. The card /
  gate / reach discriminator (§3.2).

**Manifest `feed_projection`** (per `config/korners/*.yaml`)

- `card` — adapter name; **now validated at boot** and **read by the registry**.
- `reach` — the korner's **default = ceiling** reach: `mates | orbit | kronk` (§2.4).
- `krew_targetable` — boolean; may this korner's cards be posted into a specific Krew (§2.4).
- `title_from` / `summary_from` / `links_to` — **now actually consumed** by the registry/adapter.
- (existing) `status_association` retained for the boot drift-check.

**User settings** (feed settings surface)

- View width: `mates | orbit | kronk`.
- Standard-post reach default: `mates | orbit | kronk`.

---

### 5. Build order

Bottom-up — each layer depends on the one below:

1. **Mates graph.** Request/accept, mutual-only, remove the following product surface, compute
   **Orbit**, migrate existing follows (§6). _Everything else's reach semantics depend on this._
2. **Reach & scope.** The Mates/Orbit/Kronk scale + Krew targeting; feed settings (view width +
   standard-post reach); enforce the timeline reach filter.
3. **Feed projection.** `source_korner`; manifest-driven registry + boot validation;
   auto-post-on-create at the resolved reach; enforce tune-in; the card-contract cleanup (§3.6).

---

### 6. Open items (not yet decided)

These were surfaced but deliberately left for later:

- **Follow → Mate migration.** What happens to existing one-way follows on cutover — convert
  mutual pairs to Mates and drop the rest? Convert all to `pending`? A one-time migration + a
  rake/backfill task.
- **Where mate-requests surface.** The request/accept inbox — in Nudges, a dedicated requests
  view, or both.
- **Orbit computation.** Live graph traversal per query vs. a maintained "mates-of-mates" set;
  performance at scale; staleness tolerance.
- **Standard-post reach default value** for new users (Mates? Kronk?) and how per-post override
  UI reads.
- **Tune-in × Krew interaction.** If you're a member of a Krew whose post came from a korner you
  tuned out, do you still see it? (Krew membership is deliberate; tune-out is a feed preference —
  likely Krew wins, but confirm.)
- **Reach × edit/delete lifecycle.** What happens to a card's audience if reach changes after
  posting, or the korner record is deleted (tombstone behaviour).

---

### 7. Superseded / related docs

- `docs/korners/adding_a_korner.md (Framework spec (v0.5))` §8 (feed projection) — this doc supersedes its dispatch model
  (manifest-driven, `source_korner`) and adds the reach/Mates layers.
- `docs/spaces/feed.md` — the feed space; update its "what appears here" section to the reach +
  tune-in model once built.
- `docs/spaces/nudges.md (Nudges spec)` — Nudges is a candidate home for mate-requests (§6).
- Per-korner `docs/spaces/*.md` — each should state its `reach` ceiling and whether it is
  `krew_targetable` once the manifests are updated.

---

## Per-post audience

_Merged into this file on 2026-10-04 from `docs/spaces/feed.md (Per-post audience)`; its own status notes and dates are kept as written._

> **Status.** Proposed design, agreed in conversation with Tal on 2026-08-28.
> **Not yet built.** The "Exists today" call-outs describe current code so the
> gap is legible. Companion to `docs/spaces/feed.md (Feed and reach)` (the reach ladder)
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

### The idea

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

### Core rule — public is a true broadcast

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

### How it fits the visibility retirement

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

### What each capability entails

#### A. Add specific people — mostly exists

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

#### B. Remove specific people — the hard one, now honest

No precedent — every axis today is an _additive grant_; nothing subtracts. Needs:

- a `status_exclusions(status_id, account_id)` table;
- a `StatusPolicy` clause returning **false if excluded**, evaluated **before**
  the reach grant;
- fan-out that **skips** excluded accounts on write and **pulls** the post from
  their home feed if they're excluded post-hoc (see D).

Because the feature no longer touches `public`, every exclusion is on a read-gated
scope, so the deny clause **fully enforces** it — B is a genuine primitive, not
theater. Still the hardest to _build_ (subtractive + feed reconciliation).

#### C. See who can see it — no precedent, medium

No endpoint returns a status's audience today. Resolve `scope + krews + added −
removed` into a set. `mates` / `self_only` render as **exact lists**; `orbit`
(mates-of-mates) is bounded but large + graph-dynamic, so it reads as a
**described set** ("your mates and theirs — plus Bob, minus Alice"); `public`
just says "Everyone on Kronk," controls disabled. Viewer-relative and orbit is
expensive — cache or bound.

#### D. Edit a post's audience after posting — no precedent for Status

`app/services/update_status_service.rb` deliberately omits `visibility` and
`krews` today — audience is fixed at creation for statuses. (Mentions _can_
change on edit — a useful precedent.) Moments and Albums re-audience after
posting (`moments_controller#update`, `albums_controller#sync_album_krews`) —
patterns to copy, but not Status. The hard part is **feed reconciliation**:
fan-out is write-once today; changing audience later means pushing to new feeds
and **pulling** from newly-excluded ones (a `FeedUnpush`-style path).

### Proposed build order

Each step is independently shippable and defers risk:

1. **Audience readout (C)** — read-only "who can see this" on your own posts.
   Forces the resolution model; zero write risk.
2. **Add people (A)** — silent per-person grant + surface it. Reuses the mention
   pattern.
3. **Post-hoc edit, additive only (D)** — widen / add after posting; additive-only
   sidesteps the feed-pull problem first.
4. **Remove people (B) + feed reconciliation** — the deny-list + pull path. Last:
   hardest to build, and best done once the rest is proven.

### Open questions

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

---

## Scope carousel

_Merged into this file on 2026-10-04 from `docs/spaces/feed.md (Scope carousel)`; its own status notes and dates are kept as written._

_How we'd build the "rotating stand" selector for **what you see** and **who sees you**, site-wide — and its twin, a standardised **composer frame** the selector slots into. Grounded in the actual codebase (2026-08-06)._

> **Status:** delivery investigation — not yet built. The visual design is being
> prototyped separately ("The Prism"). Related: [Scope Picker](albutts.md),
> [Feed & Reach](feed.md).
>
> **Fragmentation partly fixed since this was written (2026-08-12).** The
> "who-can-see" row below counts krew as one option among the reach tiers and
> the composers as four separate UIs. Both have moved: **krew is now an
> orthogonal additive axis**, not a reach option
> ([Feed & Reach §2.2](feed.md)), and the main composer,
> Moments and Albutts were unified onto the shared `reach_dropdown.tsx`
> (with a `krewSingleSelect` mode) in #1331/#1332/#1343. The carousel's case
> still stands, but the "before" picture it argues against is out of date.

### The one-line answer

Build **one shared `<ScopeCarousel>`** component — a horizontal, swipe/arrow "rotating stand" — used in **two sizes**: LARGE for choosing a feed/content view, SMALL for choosing a post's reach. Build it with the stack we already use (`@react-spring/web` + `@use-gesture/react`), by lifting the engine out of the carousel we already ship. **No new dependencies, no three.js, no true-3D.**

### What the carousel selects — the real prize

It's not just UI polish; it's the forcing function to **unify a fragmented model.** Today there are **three axes** and they're scattered:

| Axis                           | Options                                       | Where it lives now                                                                    |
| ------------------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------- |
| **See** (feed width)           | mates / orbit / kommunity                     | one place: feed-settings cards                                                        |
| **Who-can-see** (post reach)   | public / orbit / mates / self_only **+ krew** | **four** different UIs (status modal, moments strip, kuestions "dial", albutts chips) |
| **Who-can-add** (contribution) | open / closed / invited / krew / event        | chris's new ScopePicker (albutts only)                                                |

Two facts the docs are firm on: **"See" and "Who-can-see" are the _same distance ladder_** (Mates → Orbit → Kronk) used for viewing vs radiating — yet they share no UI today. And **Krew is a separate group-target**, not a ladder rung. Also flagged: the widest tier is named three different things (`kronk` in docs / `kommunity` in feed_scope / `public` in visibility), and Album re-numbers the visibility enum vs Status. **The carousel is the moment to converge on one canonical ladder + vocabulary.**

### How to build it (delivery)

**Engine:** copy `components/featured_carousel.tsx` almost verbatim — it's the only real carousel in the app and already does the whole thing: a flex track animated by `useSpring` to `-{index*100}%`, `useDrag({swipe})` for flick-to-next, chevron arrow buttons, wraparound, and carousel a11y. It's just welded to post content today; we swap the slides for option "faces."

**The "stand turning" feel** without literal 3D: wrap the flat translate track in `perspective: 1200px` and give each face a react-spring-interpolated `rotateY` based on its distance from center (incoming ~35°→0°, outgoing 0°→−35°). Reads as a rotating stand, keeps flat DOM (hit-testing, scroll, a11y all sane). True CSS-3D prism was considered and rejected — fights `overflow`, janky on mobile, no precedent. _(Note: the "Prism" design prototype does commit to true CSS-3D and makes it work — if that direction wins, the engine is a barrel rather than a flat track, but the option model, a11y, and reduced-motion contract below are unchanged.)_

**Reduced motion is free:** the app already does `Globals.assign({skipAnimation: true})` when the user prefers reduced motion (`main.tsx:36`), so every react-spring animation snaps instantly. The rotation collapses to a clean instant swap automatically.

**Option model** — one shared shape (widen the existing `SelectItem`):

```ts
interface ScopeOption {
  key: string;
  label: string;
  icon?: string /* +gating */;
}
```

Icons resolve from a manifest string via the existing `kornerIcon()` resolver, so each korner can name the faces it supports. Labels via `defineMessages` (static ids — house rule). Selection colour is a token concern (`--accent` / `--kronk-purple-*`), not option data.

**Accessibility** (it's a real selector, not a toy): `role="radiogroup"` with `role="radio"` + `aria-checked` faces (lift from ScopePicker's `ChipRow`); roving arrow keys + Home/End; swipe AND click-arrows both call one `rotateTo()`; `aria-live` announces the selected view; off-centre faces get `inert`. Keep `touch-action: pan-y` so horizontal swipe never eats vertical feed scroll.

**Large vs small:** same component, `size` prop. LARGE (feed header) shows the rotation flourish and is manifest-driven off each korner's `views:`. SMALL (compose bar) sits in the `dropdown-button` footprint, arrows + swipe, rotation optional — crisp over showy in a dense row. Both are **pure controlled inputs** (`value` / `onChange`); all side effects (change the feed route vs set a compose field) live in the two call sites.

### What we reuse vs replace

- **Lift the engine** from `featured_carousel.tsx` (drag + spring + index + a11y).
- **Lift selection/gating/keyboard** from `components/scope_picker.tsx` `ChipRow` (chris's) — already a generic radiogroup with per-option gating.
- **Feed the large one** the manifest `views:` mechanism that `space_view_picker.tsx` already reads.
- **Keep `ScopePicker`** as the two-axis _wrapper_ (Who's this for? / Who can add?) that stacks two carousels and owns cross-axis constraints (e.g. suppress `open` when `self_only`; mirror Krew across axes).
- **Absorb & retire** over time: the status `visibility_modal`, moments' `korner_visibility_picker`, kuestions' bespoke `visibility_dial`, Trek's map reach picker, and the feed-settings scope cards — all become one carousel.
- **Krew** = a face that reveals a small sub-picker (not a ladder rung). **Tune-in / subscription** is a _separate fourth gate_ — do NOT fold it into reach.

### Phasing

1. **Storybook-first** — build/tune `ScopeCarousel` in isolation (Storybook is set up; `scope_picker.stories.tsx` is the template). This is where the design + rotation feel get nailed before any wiring.
2. **Consolidate the option lists** — one exported canonical ladder (`SelectItem[]`), reconcile the naming drift + the Album-vs-Status enum divergence.
3. **LARGE first** — replace `SpaceViewPicker`'s internals + the feed-settings cards. Manifest-driven, lower blast radius.
4. **SMALL next** — swap it in behind/for compose `VisibilityButton` (isolate compose-flow regressions).
5. **Migrate the stragglers** — moments / kuestions / trek onto the shared primitive; retire the bespoke UIs.

### Top risks

- **Enum reconciliation** — Status vs Album use different integer mappings for the same tier names; the unified selector needs one canonical vocabulary + a backend adapter or alignment.
- **Gesture vs scroll contention** — verify `touch-action: pan-y` end-to-end so the swipe doesn't fight vertical feed scroll or the edge-drag nav-open.
- **react-spring string interpolation** — keep translate (`%`) and rotation (`deg`) as separate animated props, don't concatenate into one transform string.
- **Migration surface** — this replaces visible affordances; land LARGE behind the manifest first, keep SMALL/compose as a separate step.

### For the design work (what the visuals must respect)

- It's semantically a **single-select radiogroup** (screen-reader + keyboard), presented as a rotating stand.
- The **See** and **Who-can-see** faces are the _same ladder_ — visually rhyme them so people learn it once.
- **Krew** is a distinct kind of face (reveals a sub-picker), not a ladder tier — give it its own visual note.
- Design a **reduced-motion** resting state (the instant-swap look), since the rotation disappears for those users.
- Two sizes, one language: LARGE (feed) can be lush; SMALL (compose) must fit a dense toolbar.

### Key files to copy from

`components/featured_carousel.tsx` (engine + a11y) · `features/navigation_panel/index.tsx:466-518` (velocity/rubberband drag) · `components/scope_picker.tsx:207-254` (radiogroup semantics) · `components/space_view_picker.tsx` (manifest view model) · `hooks/useKornerIcon.tsx` (icon resolver) · `main.tsx:36-40` (reduced-motion) · `styles/mastodon/components.scss:11963-12009` (carousel CSS) · `components/scope_picker.stories.tsx` (Storybook harness).

---

### The Composer Frame — the twin

The carousel is one _slot_ in a bigger coherence play: **standardising the post-creation frame.** Kronk has ~6 hand-rolled composers, each reinventing the chrome around genuinely different bodies. The scope carousel is the frame's reach slot, so it lands first — but the frame is where the familiarity payoff compounds.

#### Verdict

Worth it — but the target is a shared **frame**, not one composer. There are ~6 hand-rolled composers (`album_composer`, `contribute_composer`, moments `composer`, `kommons_tree/composer`, `tell_composer`, nudges `composer`) plus the main status composer, each reinventing the chrome around genuinely different bodies.

#### The key finding: coherence lives on TWO levers, and they only meet at one seam

You **cannot** unify posting behind a single write endpoint — the backend intake genuinely differs per korner, and **four surfaces mint no `Status` at all** (Moments, profile "tell"/`ProfileSection`, nudges, Kuestions answers). So there is no "one endpoint with a discriminator." Instead there are two real convergence levers:

1. **Frontend — a shared `<ComposerFrame>`** = the common chrome, with a korner-specific body slot and an `onSubmit(payload)` that dispatches to each korner's **own** create endpoint.
2. **Backend — the already-shared `PostStatusService` + a `source_korner` stamp.** The Status-minting korners (albutts, kommons, kuestions, kalendar, map/trek-on-publish, booth) each keep their own domain model + endpoint + lifecycle, then delegate to the one shared `PostStatusService` and stamp `source_korner` (`albutts`/`kommons`/`kuestions`/`kalendar`/`map`/`booth`) on the resulting Status.

They meet **only at the `source_korner` discriminator**, not at a shared write path. So: standardise the _frame_ and lean on `PostStatusService` — don't try to merge the create endpoints.

#### The ComposerFrame contract (the standardised chrome)

One `<ComposerFrame>` primitive (next to `scope_picker.tsx` / `scope_carousel.tsx`), pure and controlled — all side effects in the call site:

- **Identity** — who's posting (avatar + handle) + the account-switcher hook.
- **Scope slot** — the **scope carousel** (who-can-see / who-can-add). _This is why the carousel lands first — it's a frame slot._
- **Body slot** — the korner-specific content (photos, a date+place, answer options, a map). The frame owns everything around it, not this.
- **Media** — attach + preview (reuse the compose store's uploader).
- **Kategory tagger** — the cross-cutting taxonomy at compose time.
- **Primary action** — Post / Publish / Send, with the korner's verb; wired to `onSubmit(payload)`.
- **Validation / char-count / error display** — one shared surface.
- **Drafts / autosave**, **title/header**, **cancel/close**.

Each korner supplies: the body component, the `onSubmit` (→ its own endpoint), the allowed scope options (manifest), and the action verb.

#### What to build on vs replace (frame)

- **Reuse:** the main `features/compose` redux store's shared sub-pieces (media uploader, char counter) where they generalise; `ScopePicker`/the carousel; `PostStatusService` + a small `source_korner` projection helper server-side.
- **Watch:** each korner composer keeps _local_ state today rather than the compose store — the frame should be state-agnostic (controlled) rather than force everything through the redux compose store.
- **New:** `<ComposerFrame>` (frontend). No new backend intake — the frame delegates.

#### Migration order (each independently shippable)

1. **Carousel first** (it's the scope slot).
2. **The main status composer** onto the frame — highest familiarity payoff, the reference implementation.
3. **The Status-minting korners** that already share `PostStatusService` — **albutts album, kommons proposal, kuestions question, kalendar event** — lowest friction (backend already converged; just adopt the frame + delegate).
4. **The no-Status / bespoke oddballs last** — Moments, profile "tell", nudges — adopt the frame purely as chrome with a custom `onSubmit`, since they mint no Status. Treks/map (kommons tree) may stay bespoke behind an escape hatch.

#### Risks (frame)

- **Over-standardising bespoke korners** — treks/map and kommons-tree have genuinely unusual flows; keep an escape hatch (use the frame or not).
- **The no-Status surfaces** — the frame must NOT assume it's minting a Status (4 surfaces don't); it's chrome + delegate, persistence-agnostic.
- **Redux-store vs local-state split** — keep `<ComposerFrame>` a controlled input; don't force every korner through the compose store.
- **Doc/code drift found en route:** Moments' controller comments reference a `post_status_service!` that doesn't exist — Moments is effectively standalone (no Status). Worth a cleanup PR regardless.

#### The through-line

Carousel → generalise the frame around it (status composer first) → migrate the Status-minting korners → mop up the no-Status oddballs. Each step is small and shippable; coherence compounds as korners adopt the frame.

---

## Comments

_Merged into this file on 2026-10-04 from `docs/spaces/feed.md (Comments)`; its own status notes and dates are kept as written._

> **Status:** exploration, 2026-09-14. Opened by Tal — "comments should
> definitely be different to posts" — after noticing that search returns a
> reply and a post as the same kind of thing. Nothing here is decided; the
> numbers are measured from the live instance.

### The state of it

A comment is a post with a parent. One table, one model, one word. That is
Mastodon's design and Kronk inherited it whole.

Except Kronk has already stopped believing it, in behaviour if not in
vocabulary:

- **The home feed drops every reply.** `FeedManager#filter_from_home` opens
  with a bare `return :filter if status.reply?` — a Kronk addition, sitting
  above Mastodon's much more nuanced rules about which replies to show, which
  are now unreachable. The feed's position is absolute: a comment is not feed
  content.
- **Nudges already names it.** A reply to your post fires `status.replied`,
  its own event, distinct from a froth or a mention.
- **Korners keep growing their own.** Kuestions answers are a dedicated model
  precisely because a reply could not carry the answer-before-you-read rule.
  Album photo comments were dropped when photos became status-backed. Kommons
  proposal comments are declared and deliberately deferred. Every time a
  korner has needed a comment, it has built something that is not a reply.
- **Search is the exception.** Replies are indexed, returned, and labelled
  "Post", indistinguishable from a top-level one. It is the only surface that
  still insists the two are the same thing.

So the concept already exists. It is enforced in three places, named in one,
and modelled in none.

### What the data says

From the live instance (2026-09-14), 2,614 posts:

|                                  | Count | Share                 |
| -------------------------------- | ----- | --------------------- |
| Top-level posts                  | 1,278 | 49%                   |
| Replies                          | 1,336 | **51%**               |
| …replies to a reply              | 610   | 46% of replies        |
| …replies to your own post        | 330   | 25% of replies        |
| …carrying media                  | 187   | 14% of replies        |
| Distinct people who have replied | 124   | of 108 local accounts |
| Longest single thread            | 15    |                       |

Three things fall out of that.

**Half the content is replies.** Whatever a comment turns out to be, it is not
a minor case, and a decision that treats it as second-class content is a
decision about half of everything on Kronk.

**"Comment" is not one shape.** At least three behaviours are wearing the same
clothes:

1. **A reply to someone else** — the thing everyone means by "comment".
2. **A reply to your own post** (330). Not a comment at all; a continuation.
   Someone finishing a thought, or threading a longer piece.
3. **A reply to a reply** (610). A conversation, where the parent post is
   context rather than subject.

**Depth is normal.** 46% of replies are replies to replies. Any model that
assumes one flat layer of comments under a post is wrong about nearly half of
them on day one.

### Decided (Tal, 2026-09-14)

> "Replies to a post are comments, and replies to those replies are also
> comments, replying to your own thought is also a comment. A comment is
> visible to anyone the original post is visible to."

**One concept, flat.** Depth does not change what a thing is and neither does
who wrote it — all three shapes above are comments.

And the reach question is answered: **a comment is not the commenter's to
scope.** It takes the reach of the root of its thread. No mates-only comment
under a public post; no public comment under a private one.

#### What that means in practice

Enforced **when a comment is written**, not when one is read. That distinction
is the whole of the safety: 84 replies on the live instance are currently
narrower than their root — most of them Mastodon-era private messages that the
cutover turned into author-only posts — and resolving reach through the root at
read time would publish them. Existing rows keep exactly what they have.

Reach is read off `Status#thread_root`: the conversation's root where there is
one, walking the parent chain (bounded) where there is not. A comment five deep
still answers to the post, not to the comment above it. Whatever the client
asks for is ignored rather than rejected — there is nothing to argue about.

Krew targeting is untouched; it is an additive axis, not a reach tier.

#### Still open after this

- The composer still offers a reach picker when replying. It is decorative now
  and should say so, or go.
- Nothing stops a korner-native comment from behaving differently.
- The model question below. This decides the **rule**, not where a comment
  lives.

### The model question, still open

Not "should comments look different" — they should, and that costs nothing.
The question is **what a comment is**, and there are three honest answers:

#### 1. A post with a flag

Keep one table, derive the distinction (`in_reply_to_id.present?`), and let
every surface decide how to treat it. This is what exists, minus the pretence
that they are the same.

Cheap, reversible, and honest about the fact that a reply really is a post
with a parent. But it leaves every surface to make its own decision, which is
how search ended up disagreeing with the feed.

#### 2. A post with a type

`post_type` already exists as an enum on Status (`normal`, `question`,
`answer`, `proposal`, `album_photo`). A comment would be a value in it, set at
creation, indexed, filterable everywhere.

More work, but it puts the answer in one place and lets a korner say "my thing
accepts comments" without inventing its own. It also fits the direction
korners have already been walking.

#### 3. Its own model

Comments become a table, with their own reach rules, their own lifecycle,
their own relationship to the thing they are on — like Kuestions answers.

The most expressive and by far the most expensive: 1,336 existing rows to
migrate, threading to rebuild, and everything that reads a status timeline to
teach. Worth it only if a comment turns out to need rules a post cannot carry.

### What has to be decided, and only by Tal

- **Does a comment have its own reach?** Today a reply carries its own
  visibility, independent of its parent — you can write a mates-only reply to
  a public post. Should a comment instead inherit the audience of the thing it
  is on? That single answer decides most of the rest.
- **Is a self-reply a comment?** 330 of them. If continuing your own thought is
  a different act from commenting on someone else's, the model needs to say so.
- **Do comments belong to their korner?** A comment on an album, on an event,
  on a proposal — is that the same object as a comment on a post, or does each
  korner keep its own as Kuestions did?
- **Where can a comment appear on its own?** The feed says nowhere. Search
  currently says everywhere. A profile shelf, a korner page, a search result —
  each needs an answer, and "wherever a post can" is not obviously right for
  something that is meaningless without its parent.

### How to explore it

Cheapest first, and let the real data argue.

1. **Name them where they already differ.** Search now labels a comment as a
   Comment rather than a Post — one line, no schema, no migration, and it
   makes the question visible against 1,336 real replies. _(Done.)_
2. **Look at it.** Search for a word that appears in both. Does knowing "this
   is a comment" change what you click? Does a comment out of its thread read
   as useful or as noise?
3. **Give a comment its parent.** A comment result showing what it is replying
   to is the next cheapest step and probably the one that settles whether they
   belong in search at all.
4. **Only then choose a model.** By that point the question stops being
   architectural and starts being obvious.

The order matters because the expensive decision — 1, 2 or 3 above — is much
easier to make after looking at labelled comments in a real search than before.
