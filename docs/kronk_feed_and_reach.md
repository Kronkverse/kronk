# Kronk — Mates, Reach & Feed Projection

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
> `docs/kronk_korner_spec.md` §8 and `docs/spaces/feed.md`. Implementation had not started at
> time of writing — the "Current state" call-outs describe what exists so the gap is legible.
>
> **Read this correctly.** The decisions in §0 are authoritative. The §6 open items are
> genuinely undecided and must not be treated as settled. The build order in §5 is the
> intended sequence, not a status report.

---

## 0. Decisions (authoritative)

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

## 1. Mates (the social graph)

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

## 2. Reach & scope

### 2.1 The distance scale

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

### 2.2 Krew — a separate axis

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
> [`rebuild/krew_axis_migration.md`](rebuild/krew_axis_migration.md);
> decision: [`rebuild/decisions.md`](rebuild/decisions.md) 2026-08-09.

### 2.3 Per-user feed settings

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
> runs `RAILS_ENV=production` off `rebuild/2.0.0`, so on **shadow** Mates vs
> Orbit are genuinely narrowed and the picker is no longer display-only. Real
> production deploys from `main`, which does not carry that block, so the tiers
> remain unenforced there.

### 2.4 Korner-card reach

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

## 3. Feed projection (how korners post cards)

### 3.1 The write path (unchanged shape, formalised)

A korner posts to the feed by creating a real `Status` and linking it back to the korner record
(the §5.5 `status_id` convention):

1. Korner content is created → the korner **automatically** posts a card (Decision: _auto on
   create_, not opt-in share).
2. `PostStatusService` makes the `Status` at the resolved **reach** (§2.4) — mapped onto
   visibility for Mates/Orbit/Kronk and onto `statuses_krews` for Krew targets.
3. The korner record's `status_id` is set; **`Status.source_korner`** is stamped with the
   korner slug (§3.2).

### 3.2 `source_korner` — the single discriminator

**Decision.** Add a **`source_korner`** slug column to `statuses` (nullable; null = an ordinary
post, not a korner card). It is the one field that drives:

- **Which card** — the registry looks up the adapter for that slug (§3.3).
- **The tune-in gate** — the timeline filter excludes cards whose `source_korner` the viewer has
  tuned out (§3.4).
- **Reach context** — ties the card back to its korner's manifest reach ceiling.

This replaces today's inconsistent discrimination (Kommons keys on `post_type`; Booth / Event /
Listing key on "which association got serialized"). `post_type` may remain for legacy readability
but is **not** the card discriminator.

### 3.3 Manifest-driven card registry

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

### 3.4 Tune-in as the feed gate

**Decision.** **Enforce tune-in.** When a user tunes a korner out, that korner's cards
(`source_korner = <slug>`) **stop appearing in their feed** — a server-side filter on the
timeline query. This makes real the promise the settings UI already states.

> **Current state.** `KornerTuneOut` exists and the settings copy says tune-in controls whether
> "this korner's cards appear in your feed," but **no server-side feed filter reads it** — today
> tune-out only affects Hub-grid / icon chrome.

### 3.5 Card contract

**Decision.** Shared frame as the standard; korners may customise.

- All korner cards use the shared **`StatusKornerCard`** frame (icon, korner label, title,
  summary, link) as the baseline chrome.
- **Functional baseline + depth:** the frame exposes **one standard action slot** for the card's
  primary act (RSVP an event, back a proposal, froth), and **tapping the card opens the full
  korner record** for anything deeper. Cards are useful in-feed without turning the timeline into
  the whole app.
- Korners **may customise** beyond the baseline where warranted.

### 3.6 Cleanup folded into the rebuild

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

## 4. Schema & manifest additions (summary)

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

## 5. Build order

Bottom-up — each layer depends on the one below:

1. **Mates graph.** Request/accept, mutual-only, remove the following product surface, compute
   **Orbit**, migrate existing follows (§6). _Everything else's reach semantics depend on this._
2. **Reach & scope.** The Mates/Orbit/Kronk scale + Krew targeting; feed settings (view width +
   standard-post reach); enforce the timeline reach filter.
3. **Feed projection.** `source_korner`; manifest-driven registry + boot validation;
   auto-post-on-create at the resolved reach; enforce tune-in; the card-contract cleanup (§3.6).

---

## 6. Open items (not yet decided)

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

## 7. Superseded / related docs

- `docs/kronk_korner_spec.md` §8 (feed projection) — this doc supersedes its dispatch model
  (manifest-driven, `source_korner`) and adds the reach/Mates layers.
- `docs/spaces/feed.md` — the feed space; update its "what appears here" section to the reach +
  tune-in model once built.
- `docs/kronk_nudges.md` — Nudges is a candidate home for mate-requests (§6).
- Per-korner `docs/spaces/*.md` — each should state its `reach` ceiling and whether it is
  `krew_targetable` once the manifests are updated.
