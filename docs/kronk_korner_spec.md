# KRONK KORNER SPEC

**The framework every new Kronk space is built against.**

_Status: Draft v0.5 — working document. Federation is parked for now. Two load-bearing decisions remain open (see §13). Everything below is either a settled convention, a recommended default awaiting sign-off, or an explicitly open question._

---

## 0. Purpose

As Kronk grows, spaces will be built by many hands. Without a shared framework, each new space reinvents its own navigation, storage habits, permission checks, and visual language — and the seams between them become where things break and leak.

This document defines the contract a new space (a **Korner**) is built against so that spaces interoperate: they share storage discipline, talk to each other through defined channels, enforce the same access rules, and **converge on one feed**.

The feed is the payoff. It is the single surface where a user encounters Kronk as _one thing_ rather than a set of separate tools. Every space projects into it — a new Wachuneed listing, a Kommons question, a comment — and each projection appears not as a plain written post but as a **space card**: visibly from a specific space, tappable through to that space. Standardising how spaces project into the feed, and who receives those projections, is the core the rest of this framework serves.

The framework's spine is a **manifest** — a declaration each Korner registers itself with. Navigation, theming, storage namespacing, permissions, and feed projection are all derived _from_ the manifest.

**How to use this doc:** every new-space Claude Code brief and spec inherits from this document. Resolve ambiguities here first, then build.

---

## 1. What a Korner is — the manifest

A Korner is a thematically-scoped space that mounts into Kronk's Cosmos and declares itself through a manifest. The manifest is the single source of truth the platform reads to place, theme, wire, gate, and project the space.

### 1.1 Manifest fields (illustrative)

```yaml
slug:            market                # route segment + namespace root; lowercase, unique
name:            Market                # display name (follows §2 naming grammar)
icon:            storefront            # a Material Symbol NAME (not a file); shared Kronk-purple accent
render_target:   hosted                # native | hosted | hybrid   (see §9 — OPEN)
version:         0.2.0                 # semver; app reads this for compatibility

security:                              # the nested access block every manifest carries (see §7)
  permissions:                         # what the space asks to do
    - read:listings
    - write:listings
  visibility_scopes:                   # any NEW scopes this space introduces
    - listing_buyers
  maintainers:                         # space roles mapped onto the shared vocabulary (moderator, …)
    - moderator
  federates:     false                 # PARKED — local-only for now (see §8.8)

resources:                             # the addressable things this space owns (see §4, §5)
  - name:         listings             # → /hub/market/listings, market_listings, spaces/market/listings/
    primary:      true                 # the space's canonical resource

storage:
  db_namespace:  market_               # table/model prefix  → market_listings
  media_prefix:  spaces/market/        # DO Spaces path root → spaces/market/listings/<id>/…
  redis_prefix:  market:               # Redis key root      → market:listing:<id>:…

emits:                                 # internal events this space publishes (see §6)
  - market.listing.created
listens:
  - []

feed_projection:                       # how this space appears in the feed (see §8)
  card:           listing_card         # shared card template
  title_from:     title                # field that fills the card headline
  summary_from:   blurb                # field that fills the card summary
  links_to:       /hub/market/listings/<id>   # canonical permalink (§4); <id> is the domain id, not the Status id
  default_visibility: public           # default scope; poster may narrow (see §8.5)

subscription:                          # MUST-HAVE for every Korner (see §8.6); the
  default:        off                  # user-facing verb is "tune in" — the manifest field stays `subscription`
                                       # off = opt-in (recommended) | on = opt-out

launch:                                # one-time announcement when the space opens (see §8.7)
  blurb:          "Market is open — buy, sell, and trade within Kronk."
  cta:            "Tap in"             # inline tune-in action shown on the launch card

feature_flag:    market_enabled        # merge-dark switch (see §10)
```

### 1.2 The manifest must be server-served

The manifest is exposed as a queryable endpoint so the Android app (and future iOS) can render the Cosmos Hub dynamically and learn which spaces exist and are enabled — without shipping a new binary. This keeps the app in step with a framework designed for continuous space addition. See §9.

---

## 2. Language

Kronk has a distinctive lexicon; new spaces extend it rather than diverge from it.

- **Naming grammar.** The K-alliteration (Kommons, Kalendar) is the house style. (The celestial metaphor — planets/moons — was retired 2026-07-10; see §3.) Whether the K-grammar is a _rule_ or a _strong default_ is open (§13).
- **Shared verb set.** Common actions read identically everywhere: join/leave, post/publish, back/block, tune in/tune out. A space does not invent its own verb for a shared concept.
- **Reserved terms.** Words with platform-wide meaning: **steward** (= Mastodon moderator), **membrane**, **capability**, **tune-in**. A space must not repurpose these. (**fan**, **moon**, and **planet** are retired, not reserved.)
- **i18n as the enforcement point.** All user-facing strings pass through Mastodon's react-intl locale pipeline — never hardcoded. Translation hygiene _and_ the chokepoint where shared vocabulary stays consistent.

---

## 3. Aesthetic

Kronk shares one aesthetic vocabulary across every Korner. The framework declares it in a single source (`app/javascript/mastodon/tokens/tokens.yaml`), generates CSS custom properties from it (`_tokens.scss`), and enforces token usage via stylelint. A Korner author never invents visual language — they compose the shared kit.

Living reference: **`/styleguide`** renders every token + representative components. Change the token; refresh the page; see it applied. If it looks broken in the guide, it's broken everywhere.

### 3.1 Palette — Kronk-purple only

The planet metaphor is retired (2026-07-10). There is one shared palette: **Kronk-purple**, an indigo family matching the running production instance. Korner identity comes from **icon + name + content**, never colour.

Palette tokens (dark theme):

| Token                    | Value     | Role                                       |
| ------------------------ | --------- | ------------------------------------------ |
| `--kronk-purple-primary` | `#3034a0` | Brand — gradient anchors, borders          |
| `--kronk-purple-bright`  | `#8c8dff` | Highlight, focus, hover state              |
| `--kronk-purple-deep`    | `#36248c` | Surface tint, atmosphere                   |
| `--kronk-purple-muted`   | `#343070` | Supporting text, low priority              |
| `--kronk-purple-accent`  | `#6364ff` | Accent on cards, chips, borders            |
| `--accent`               | alias     | Consumer alias for `--kronk-purple-accent` |

Semantic surface + text tokens (dark theme):

| Token                | Value     |
| -------------------- | --------- |
| `--surface-primary`  | `#191b22` |
| `--surface-elevated` | `#292938` |
| `--border-default`   | `#3d2a6e` |
| `--text-primary`     | `#ffffff` |
| `--text-secondary`   | `#9c9cc9` |
| `--text-muted`       | `#606085` |
| `--warning-red`      | `#ef4444` |
| `--success-green`    | `#4b9160` |

Light theme mirrors with darkened palette values and inverted surfaces; see `_tokens.scss` for the full override block.

**Do not hardcode hex codes in Korner SCSS.** The stylelint config rejects them. Colours reach visible surfaces via tokens or `color-mix(in oklab, var(--kronk-purple-accent) N%, transparent)` layers.

### 3.2 Typography

| Token            | Family                                                | Role                                          |
| ---------------- | ----------------------------------------------------- | --------------------------------------------- |
| `--font-display` | `'Liberation Serif', Georgia, serif`                  | Wordmark, Korner names, headings, hero titles |
| `--font-body`    | `mastodon-font-sans-serif, sans-serif`                | Body copy, controls, chrome labels            |
| `--font-mono`    | `'Roboto Mono', 'Fira Mono', ui-monospace, monospace` | Code, hex chips, telemetry                    |

Bundle Liberation Serif and the Ӂ Я Ѻ Ɲ ₭ wordmark glyphs on every platform. Not on stock Android; verify early.

### 3.3 Radius — universal corner language

Everything rounds. No sharp corners in the shell. If a surface can't fit a radius, it becomes a hairline divider (border, not box).

| Token             | Value   | Applied to                                                                       |
| ----------------- | ------- | -------------------------------------------------------------------------------- |
| `--radius-small`  | `6px`   | Inline chips, small icon buttons, focus rings, dropdown items                    |
| `--radius-medium` | `10px`  | Cards, panels, dropdowns, sidebar tiles, Ӂ menu items                            |
| `--radius-large`  | `16px`  | Hero surfaces — top strip, sidebar, Hub Korner cards, Ӂ menu panel, modal frames |
| `--radius-round`  | `999px` | Pills — HubSwitcher, tags, badges, tune-in controls, every capsule button        |

### 3.4 Elevation presets

| Token                  | Shadow                               | Role                               |
| ---------------------- | ------------------------------------ | ---------------------------------- |
| `--elevation-subtle`   | `0 1px 2px rgb(0 0 0 / 12%)`         | Inline surfaces, subtle depth      |
| `--elevation-card`     | `0 4px 12px -4px rgb(0 0 0 / 30%)`   | Floating cards, panels             |
| `--elevation-floating` | `0 8px 24px -8px rgb(0 0 0 / 40%)`   | Top strip, sidebar, floating menus |
| `--elevation-menu`     | `0 20px 48px -12px rgb(0 0 0 / 50%)` | Ӂ menu panel, modals               |

Additional shadow layers are composed on top when a surface needs accent glow — usually `color-mix(in oklab, var(--kronk-purple-accent) N%, transparent)`.

### 3.5 Motion

| Token           | Value                               | When to use                                                   |
| --------------- | ----------------------------------- | ------------------------------------------------------------- |
| `--dur-fast`    | `120ms`                             | Hover, focus, small state changes                             |
| `--dur-medium`  | `200ms`                             | Panel opens, transitions between views                        |
| `--dur-slow`    | `400ms`                             | Large transitions, page shifts                                |
| `--ease-out`    | `cubic-bezier(0.16, 1, 0.3, 1)`     | Default deceleration                                          |
| `--ease-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)`    | Reversible motion                                             |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Playful, springy — buttons scaling on hover, sidebar row lift |

The Korner sidebar reorders with a hand-rolled FLIP animation using `--ease-spring` + `--dur-medium`. Hub Korner card hover lifts with the same easing. This is the shared vocabulary; new motion should reach for these tokens before authoring new curves.

### 3.6 Component kit

A shared, documented set: buttons, cards, toggles, chips, pills, modals, column chrome, feed card (§8.2), Ӂ menu, HubSwitcher, sidebar tiles, Korner card. New Korners **compose these**, not roll their own. `/styleguide` is the living source of truth; when a Korner needs a new visual pattern that isn't there, that pattern lands in the shared kit and the style guide first, then the Korner picks it up.

Every Korner-authored SCSS file lives under `app/javascript/styles/mastodon/` and gets a stylelint override that enforces token usage. Adding a new file? Add it to the override list in `stylelint.config.js`.

### 3.7 Cross-platform token parity

Tokens live as CSS `:root` vars on web. Android must generate a matching Compose theme from the same `tokens.yaml` source, or the two drift. iOS follows the same rule when the app shell lands. `bin/generate-tokens` is the shared generator entry point.

### 3.8 Korner overrides — when they are permitted

A Korner does not override the palette. Ever. Kronk-purple is universal.

A Korner **may** override radius, elevation, or motion for surfaces it owns, if that surface's function requires it (e.g. a card-flip animation using `cubic-bezier` beyond `--ease-spring`). Overrides live in the Korner's own SCSS file, scoped to its selector root, and are reviewed for whether they belong in the shared kit instead. Nine times out of ten they do.

### 3.9 Changing the aesthetic

The whole system retunes from one file. To iterate:

1. Edit `app/javascript/mastodon/tokens/tokens.yaml`.
2. Regenerate `_tokens.scss` via `bin/generate-tokens`.
3. Refresh `/styleguide` to preview every token + component.
4. Deploy to shadow; verify against representative Korner surfaces.
5. Ship.

**Never hardcode hex codes, durations, radii, or shadow values in component SCSS.** Stylelint rejects them at pre-commit. Every value goes through the tokens file. This discipline is what makes future retunes trivial.

---

## 4. Navigation & addressing

- **Route root.** Every space lives under the Hub, keyed off its slug: `/hub/<slug>`. Feature modules at `app/javascript/mastodon/features/<slug>/`.
- **URL grammar.** Within a space, addresses derive from the manifest's declared `resources`:

  ```
  /hub/<slug>                          space landing / index
  /hub/<slug>/<resource>               a collection (e.g. listings)
  /hub/<slug>/<resource>/new           create form
  /hub/<slug>/<resource>/<id>          canonical permalink to one item   ← a feed card's links_to
  /hub/<slug>/<resource>/<id>/edit     action on an item
  /hub/<slug>/<resource>?by=<account>  filtered views use query params, not new paths
  ```

  Keep the `<resource>` segment even for single-resource spaces — predictability across every space is the point, and it survives a space growing a second resource. The `<id>` is the **domain id** (the listing), not the underlying Status id: the Status is the feed projection, the object is the thing, and the URL points at the thing.

- **Slug uniqueness.** Because all spaces share the `/hub/` namespace, slugs must be unique and reserved; this is checked at manifest registration (ties to the enforcement decision, §13).
- **Shared chrome.** Consistent affordances wrap every space: header, reliable "back to Cosmos," breadcrumb. A user is never lost.
- **Structure over port.** Nav is defined abstractly (Hub entry, space header, back) so each platform renders it natively (§9).
- **Deep links.** The route convention maps to Android App Links; a feed card's `links_to` resolves to the right space and item, cold-start included.

---

## 5. Storage & data

Kronk is a monolith fork, so this is database discipline, not microservices.

### 5.1 One identity, three mirrors

A single object is addressed the same way in all three layers, derived from `slug / resource / id`:

```
URL      /hub/market/listings/42
Storage  spaces/market/listings/42/original-typewriter.jpg
DB       market_listings  →  row 42
```

Given any one, you can derive the other two. That symmetry is the organisation, and all three fall out of the manifest's `resources` and `storage` blocks — a space declares its shape once and routing, storage paths, and table names follow.

### 5.2 Database

- **Table-prefix, not separate schemas.** Tables are prefixed by `db_namespace` (`market_listings`, `market_offers`). Separate Postgres schemas would give more isolation but fight ActiveRecord and Mastodon's single-`public`-schema convention; the prefix gives legibility and collision-safety without the friction.
- **Schema is protected.** Schema changes are out of scope for UI-only PRs. Backend-before-UI; migration review required.

### 5.3 Object storage (DO Spaces)

- **Mirror the path** under each space's `media_prefix`:

  ```
  spaces/<slug>/<resource>/<id>/<variant>-<filename>
  ```

  Deleting an item is one prefix delete (`spaces/market/listings/42/`); a whole space's media is one prefix (`spaces/market/`) for retention rules or teardown.

- **`spaces/` keeps Korner media out of Mastodon's own tree** (`accounts/`, `system/`) so the two never tangle.
- **Sharding** the id into the path (`.../listings/00/42/…`) is available for spaces expecting enormous object counts — premature at current scale; note it, don't build it.

### 5.4 Redis

Keys are prefixed by `redis_prefix` (`market:listing:42:views`) so no space clobbers another's keys.

### 5.5 Data rules

- **Reusable media capability.** The HTTP range-request pattern (from DJ sets) belongs in the shared kit.
- **Placement rule.** Social-fabric data lives in the space; self-shaped data defers to Anthemos via the membrane. Ask: does this describe _the self_ (→ Anthemos) or _the social fabric_ (→ the space)?

### 5.6 Identity & deletion

An id, once issued, is **never reissued**. Delete listing 42 and the number is retired permanently — the next insert gets a new id, and a gap is left where 42 was. Gaps are expected and fine. This matters because the id is permanent and shareable: it lives in feed cards, bookmarks, DMs, external links. Reuse would silently repoint all of those at different content.

- **ID scheme: Mastodon Snowflakes, not raw auto-increment.** Korner objects use the platform's existing Snowflake IDs — the same scheme Statuses use — for consistency (one id philosophy platform-wide) and because sequential ids are enumerable. Sequential numbering would let anyone walk `/listings/1, /2, /3…` to count objects and read deletion history off the gaps, which leaks volume and activity — off-message for a platform that refuses surveillance. (UUIDv7 is the alternative if stronger non-enumerability is ever wanted; Snowflake is the default for consistency.)
- **Delete leaves a tombstone, not a hole.** On deletion, purge the content and its media (`spaces/<slug>/<resource>/<id>/` removed — _deleted means deleted_), but keep a minimal marker: id, `deleted_at`, optional reason. A request for a deleted id then resolves to an explicit **410 Gone** ("this listing was removed") — never a 404, and never a different object. Its feed card is withdrawn or flipped to a removed state.
- **Retiring an id retires all three mirrors** (§5.1) coherently — URL, storage prefix, and table row go together.
- **Tombstones are the ActivityPub-native shape**, so this stays consistent when federation returns (§8.8).

---

## 6. Inter-space communication

One answer for "how does one space tell another something," not one per pair.

- **Stable interfaces, no reaching in.** A space exposes service objects others call; spaces never read each other's tables directly.
- **Lightweight internal event bus.** Fire-and-forget signals via Redis pub/sub or `ActiveSupport::Notifications`. The manifest's `emits` / `listens` document the contract.
- _(Federation boundary parked — see §8.8.)_

---

## 7. Security & access control

The load-bearing dimension, and the place where inconsistency leaks data. The failure mode is each space inventing its own visibility checks, and content surfacing at a seam that never checked — including in the feed (§8).

- **Single authorisation layer.** A Pundit-style policy set that _every_ space calls. Ad-hoc `if` checks scattered per feature are prohibited. New scopes are defined and enforced in this one place; a space declares any new scope in its manifest (`visibility_scopes`).
- **Capability model as north star.** The membrane's recipient-scoped, revocable grants are the conceptual target for cross-space visibility, mirrorable internally before Anthemos lands.
- **Layered gates.** The invite-only perimeter gates the instance; per-space and per-object policies gate within.
- **Role mapping.** Every space's roles map onto the shared vocabulary (steward = moderator) via `steward_role`.
- **"Secure only once."** A space may ship a visibility feature now, marked _provisional_, until Anthemos-verified identity backs it.

Feed projection (§8) runs _through_ this layer. It is the reason the single authorisation layer is not optional.

---

## 8. Feed projection & subscription

The feed is the convergence surface — the payoff the framework serves. Every space projects into it, and every projection is a **space card**, not a plain post.

### 8.1 The card is a Status underneath

A space-originated feed item remains a real Mastodon `Status`, flowing through the normal timeline machinery (FeedManager, home/local feeds, notifications, search, moderation). Do **not** build a parallel feed — that fights Mastodon at its most load-bearing point. What makes it a card is structured metadata riding on the status: origin space, title/summary, type badge, deep link. The client renders a card off that metadata instead of plain text. Questions and comments are the existing reference implementation — generalise that, don't reinvent it.

### 8.2 Card anatomy (standardised)

One anatomy, filled per space:

- Space **icon + name** (origin obvious at a glance)
- "from {Space}" attribution
- Type badge (Question, Listing, Comment, …)
- Title / summary drawn from manifest-declared fields
- Tap-through **deep link** into the object in its space

Consistency comes from shared anatomy; recognisability comes from **icon + name + content** against the one shared accent (Kronk-purple) — colour no longer distinguishes spaces (§3).

### 8.3 The manifest declares the projection

Each space's `feed_projection` block (see §1.1) names the card template, the payload fields, the deep-link target, and the default visibility. Adding a projection is filling in the manifest, not writing feed code.

### 8.4 Two independent gates — never conflate them

Whether a card reaches a given user is governed by **two separate gates**, evaluated in order:

1. **Permission (visibility scope) — security.** Who is _allowed_ to see the object: public / followers-only / group-scoped / etc. Enforced in the authorisation layer (§7). A followers-only listing is invisible to non-followers, full stop.
2. **Subscription (injection) — preference.** Among those permitted, who has _opted in_ to this space appearing in their feed (§8.6).

A card is assembled for a viewer only if they pass **both**: _permitted_ **and** _subscribed_. Enforce them separately and in this order — permission first, subscription second. **Never let subscription stand in for permission.** Treating "they're subscribed" as "they're allowed" is the classic leak. Cards are generated per-viewer: gated by policy, then filtered by subscription.

### 8.5 Per-post visibility

Spaces differ — some project publicly, some to followers only. The space declares its `default_visibility` in the manifest and, where it makes sense, the poster may narrow it. Visibility **reuses the existing status visibility system** (public / unlisted / followers / direct) plus any space-introduced scopes (§7). No new visibility primitive is invented per space.

### 8.6 Subscription is a Korner must-have

Every Korner **must** implement subscribe / unsubscribe — "tapping into" a space. This is the same primitive as the Groups model's follow-toggle-as-injection, kept strictly separate from membership and permission. A user subscribes to control what appears in their feed, and can unsubscribe (mute a space) without losing access to it.

Because algorithmic burying is off the table by principle, subscription is the **only structural lever** against feed noise — which is exactly why it is mandatory, not optional. Someone who doesn't want Questions in their feed unsubscribes from that space; the space still exists and is still reachable from the Hub.

- **Default subscription state** is declared per space (`subscription.default`). Recommendation: most spaces default **off (opt-in)** to protect the feed; a small number of high-value spaces may default **on (opt-out)**. The platform-wide posture is open (§13).

### 8.7 Launch announcement (a lifecycle projection)

When a space opens, it announces itself with a one-time **launch card** in the feed — the framework projecting its own new member. The card carries the space icon and name (shared Kronk-purple accent), a "new Korner" badge, the manifest `launch.blurb`, and taps through to the space's root (not to any object).

The launch card is the one projection **exempt from the subscription gate (§8.4)** — and must be, because no one can have subscribed to a space that did not yet exist. It stays permission-gated (respecting the perimeter and any restriction on who may see the space at all) but bypasses subscription by nature. The launch card _is_ the invitation to subscribe: it carries the inline `launch.cta` action ("Tap in"), so a user goes announce → subscribe → receiving that space's projections in one step. This is a deliberate, named exception; do not "fix" it by requiring subscription, which would make launches invisible.

Launch cards are one-per-space and rare, so they carry no feed-noise risk. A single global "space announcements" preference is the appropriate opt-out (per-space opt-out is meaningless for a space you haven't met yet). Because a launch is often a Seed bearing fruit or a Kommons-backed build, the card is a natural place to surface that provenance.

### 8.8 Federation — parked

Federation is out of scope for now. Projections are **local-only** (`federates: false`). When federation returns to the table, two things get designed then: a plain-text-plus-link fallback body for cards leaving to vanilla instances, and the internal-vs-federated event boundary. Not before.

---

## 9. The app & cross-platform

The app is where the framework either holds or quietly breaks, because it does not share the web side's core assumption.

On web, a new Korner is live the moment its module merges. `kronk-app` is a **separate native codebase shipping on Google Play's cadence plus review lag** — it gains spaces only when a binary is cut and approved. The framework must be designed around that mismatch.

### 9.1 The load-bearing decision — `render_target` _(OPEN — §13)_

| `render_target` | Meaning                                             | Trade-off                                                         |
| --------------- | --------------------------------------------------- | ----------------------------------------------------------------- |
| `native`        | Built in Compose                                    | Highest fidelity; a second implementation + app release per space |
| `hosted`        | Rendered as web inside a native shell               | New spaces appear with no binary; slightly less native feel       |
| `hybrid`        | Hosted by default, native where capabilities demand | Best velocity/fidelity balance                                    |

**Recommended default: hybrid, leaning hosted.** The app becomes a native shell (auth, nav, notifications, deep links) rendering most Korners as web, native reserved for capability-heavy spaces. Keeps the app in lockstep with the web framework and makes iOS far cheaper. Cost accepted: reduced native feel for hosted spaces. _Pending sign-off._

### 9.2 Consequences

- **Server-driven manifest** (§1.2). App reads the registry, renders the Hub dynamically. Version the API; assume permanent server/app skew. Unknown space → fall back to webview or hide, never crash.
- **Feed cards on mobile.** The card anatomy (§8.2) must render natively in the app's timeline, tapping through via deep link. Whatever a space's `render_target`, its _feed card_ is part of the shared shell.
- **Nav re-expressed, not ported.** Bottom bar + touch Hub; orbital animation simplified for battery and weaker GPUs.
- **Native capabilities decide what must be native.** Background audio (DJ sets → Media3 `MediaSessionService`), push notifications, camera/media capture, share-to-Kronk, offline caching, biometric app-lock.
  - _Decide:_ notification transport — UnifiedPush (degoogled) vs FCM (convenient).
- **Secure token storage.** Auth tokens in the Android Keystore; matters more once the app may carry Anthemos capability tokens.
- **Hybrid Views/Compose seam.** A known hazard (`ViewTreeLifecycleOwner not found`). Native Korners follow one documented integration pattern (Compose-first, stated rule for when Views are allowed).
- **Reviewer wall.** An invite-only app needs a review-mode or demo credential, or store review can't get past the gate.

---

## 10. Operations & lifecycle

- **Proposal path.** An idea can be _planted_ as a Seed openly; structural moves — a new visibility scope, new storage, a new planet, a change to this spec — route through a Kommons proposal. _Ideas are things to build; places are structural._
- **Merge dark.** One monolith on one droplet means spaces ship together. Feature flags (`feature_flag`) are non-negotiable.
- **Standard spec template.** Each space ships a spec doc from a shared template (formalising KRONK_HUB_UI.md, KOMMONS_UI_REDESIGN.md).
- **Versioning & retirement.** The manifest declares a version; a defined retirement path cleans up routes, data, feed projections, subscriptions, and the nav entry.
- **Observability ≠ surveillance.** Operational metrics (error rates, storage use) are not behavioural profiling. Naming the line keeps contributors from avoiding basic observability out of principle.

---

## 11. Governance fit

Open, plantable moves need no proposal; anything touching shared structure — scopes, storage, planets, the feed contract, the manifest schema — is a Kommons decision. Mirrors the pipeline tool's resolution: _sub-layers are places; ideas are things to build._

---

## 12. Non-negotiables

- No tracking, no data sales, no algorithmic manipulation, no extraction — a space cannot introduce any of these. (This is also why subscription, not an algorithm, is the feed-noise lever.)
- Social-fabric data may live in a space; **self** data belongs to Anthemos, reached only through the membrane.
- The invite-only perimeter is the outer gate; per-space policy is enforced through the single authorisation layer, never ad-hoc.
- **Feed projection is gated by permission before subscription, always in that order** (§8.4). Subscription must never substitute for a permission check.
- **Every Korner implements subscribe / unsubscribe** (§8.6).
- All shared systems (tokens, component kit, auth layer, event bus, feed card) are used as-is; a space does not fork them silently.

---

## 13. Open decisions

Forks that change the spine of this document:

1. **Manifest enforcement.** Partially resolved: `bin/tootctl korners doctor` now validates and gates conformance (L1/L3/L4/L5/L10) for `enforced` korners, so uniformity is machine-checked. The remaining fork is whether the platform should _hard-refuse to mount_ a space with no valid manifest, or keep the doctor as a boot/CI gate followed by discipline.
2. **App `render_target` default** (§9.1). Native-per-space vs hosted-shell vs hybrid. Recommended: hybrid, leaning hosted. Also sets the cost of iOS.
3. **Subscription default posture** (§8.6). Platform-wide, do new spaces default opt-in (off) or opt-out (on)? Per-space override via `subscription.default` is assumed either way. Recommended: opt-in.

Smaller pending items: naming grammar as rule vs default (§2); notification transport UnifiedPush vs FCM (§9.2). (Single-source token generation, §3.4, is resolved — `bin/generate-tokens` + CI `--check` shipped in Phase 2.)

---

## 14. Glossary

- **Korner** — a thematically-scoped space built against this framework and mounted into the Cosmos.
- **Manifest** — the per-space declaration the platform reads to place, theme, wire, gate, and project a space; the spine of the framework.
- **Feed projection** — how a space appears in the feed: a space card rendered from status metadata, tapping through to the space.
- **Space card** — the standardised feed item for space-originated content; shared anatomy, identified by icon + name (one shared Kronk-purple accent), deep-linked.
- **Launch card** — the one-time announcement projected when a space opens; permission-gated but tune-in-exempt, carries the inline tune-in action.
- **Tune-in** (manifest field: `subscription`) — a user's opt-in to a space's projections appearing in their feed; the injection gate, separate from permission. A Korner must-have. "Tune in / tune out" is the user-facing verb; the manifest field and code stay `subscription`.
- **Permission gate / visibility scope** — who is allowed to see an object; enforced in the authorisation layer.
- **Hub** — the korner navigation surface at `/hub`; a flat grid of korner tiles (the planet/moon metaphor was retired 2026-07-10).
- **Membrane** — Anthemos's consent layer; where self-data is projected outward under consent.
- **Steward** — a space role mapping to Mastodon's moderator.
- **Seed** — the open coordination primitive for planting buildable ideas.
- **Kommons** — the governance space where structural proposals are decided.

---

_Versioned alongside the Kronk repos. A v0.5 skeleton to build from, not a frozen spec — expand each section as conventions settle and the open decisions in §13 are made._
