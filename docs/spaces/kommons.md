# Kommons (`kommons` — rendered ₭ommons)

**Manifest:** `config/korners/kommons.yaml` · **Mount:** `/hub/kommons` · **Status:** shipped-2.0 (Tree + backend), rebuild polish ongoing

## Purpose

Kommons is **Kronk's transparency + participation space**. It's where
users can:

- **See how Kronk fits together** — the Kommons Tree maps every
  user-facing page, feature, and connection between korners. It makes
  the platform's structure legible.
- **Participate in guiding Kronk's development** — proposals and
  feedback land here, tagged to a specific Tree node so they attach
  to what they're about.
- **Engage with others' contributions** — see what others have
  suggested, second what resonates, discuss, and shape direction
  collectively.
- **(Aspirational)** — in later phases, users will be able to
  **design or build their own spaces from within Kommons** — turning
  Kommons into the meta-mechanism by which the platform grows.

Kommons is **Kronk-level only** in 2.0. There is no Krew-scoped
Kommons; Krew-internal coordination happens via Krew posts and Huddle,
not through formal proposal machinery.

## Current shape (2.0 already shipped)

Substantial 2.0 work has already landed in the Kommons Tree series
(PRs #287, #292, #295, #297, #300):

### Kommons Tree — the transparency layer

- **`Kronk::NodeRegistry`** at `lib/kronk/node_registry.rb`. Boots
  from two sources:
  1. `config/kronk_nodes.yaml` — cross-cutting nodes (Home timeline,
     Nudges activity, profiles, settings pages).
  2. Per-korner `nodes:` blocks in `config/korners/<slug>.yaml`.
- **Every node has a stable `node_id`** independent of URL; feedback
  proposals key on `node_id` so they follow a page across URL changes.
- **Three-bucket drilldown**: `feed`, `profile`, `hub` — organises
  the Tree at the top level.
- **Backend-derived connections** — the Tree shows cross-korner
  links (which pages relate to which).
- **`bin/tootctl korners doctor`** — anti-drift check ensures nodes
  declared in manifests match reality.
- **Live composer** — replaces the old stub; users can compose a real
  Kommons proposal from any node.
- **Frontend at `app/javascript/mastodon/features/kommons_tree/`**;
  route `/hub/kommons/tree`.
- **API**: `GET /api/v1/kommons/nodes` serves the tree JSON.

### Proposal model + governance UI

- **`Proposal`** model (`app/models/proposal.rb`) — `title`, `body`,
  `summary`, `created_by_account`, `status`, `parent_proposal`
  (hierarchy), optional discussion Status linkage (pre-2.0
  `discussion_status_id` dual-writes during transition).
- **`ProposalVote`**, **`ProposalCompletionSuggestion`**,
  **`ProposalChallengeCondition`** models.
- **Node-keyed proposals** — `Proposal.node_id` associates a proposal
  with a Tree node.
- **Searchable via `Kronk::Search`** — indexed as
  `kommons_proposals`.
- **Governance UI** at `features/governance/` (legacy route
  `/governance`, also `/hub/kommons`).
- **Feed projection** — `kommons_card` renders `Proposal` in feeds
  (already declared in the manifest).
- **Rendered as ₭ommons in nav** (unicode Kra).

## Rebuild vision (2.0.0 — remaining polish)

### Categories retiring

The 10 fixed categories (timeline/huddle/events/marketplace/identity/
moderation/infrastructure/app/design/governance) are **scheduled for
retirement in 2.1.0**. As of alpha.54 `Proposal.categories` column +
`CATEGORY_VALUES` constant + `categories_within_allowed_values`
validator are still present in `app/models/proposal.rb` — retirement
lives in the 2.1.0 cleanup migration alongside other dual-write drops.

Rationale for retirement: proposals key on `node_id`, so the Tree
itself locates a proposal; the parallel category taxonomy is
redundant.

**Model changes (in the 2.1.0 cleanup migration):**
- `Proposal.categories` column drops
- `CATEGORY_VALUES` constant retires
- `categories_within_allowed_values` validator retires

Migration: existing categorised proposals get their categories
dropped (the `node_id` link is authoritative for placement).

### Proposal lifecycle states

Formalise the lifecycle. Today `Proposal.status` is a free-ish string;
in 2.0 it becomes a proper state machine with **four** states (the
old `seconded` intermediate retires — see Token backing below):

- **draft** — being composed; visible only to the author.
- **open** — public; accepting community backing (tokens).
- **enacted** — the author has marked the proposal complete. Tokens
  invested in the proposal return to their backers.
- **archived** — no longer active (rejected, superseded, or aged out).
  Token behaviour on archive is TBD (see open decisions).

State transitions:

- **`draft` → `open`**: author publishes.
- **`open` → `enacted`**: **two-step** for anti-gaming reasons.
  - A **developer/maintainer marks the proposal complete from the
    backend** (signals the change has actually shipped).
  - The **author signs off** — confirms the completion meets the
    proposal's intent and quality bar.
  - Backers can also **suggest completion** via a UI affordance,
    which sends a Nudge to the author — but doesn't move the state
    directly.
  - Only when both dev-marks and author-signs-off does the proposal
    reach `enacted`.
- **`open` → `archived`**: archive is only permitted for proposals
  with **zero token backing**. Once backers have invested, the
  proposal is committed — it cannot be archived, only enacted (or
  left `open` indefinitely).

State transitions are auditable; history is preserved.

### Token backing — new subsystem

The old "seconding threshold" gate retires. In its place, 2.0
introduces a **per-user token system** for backing proposals:

- Every user has a **token balance**.
- Users **invest tokens in a proposal** they want to back — any
  amount from 1 up to their available balance.
- Tokens are **locked once committed** — you cannot pull them back
  out of a proposal to spend them elsewhere.
- Tokens **return to the backer when the proposal is enacted**.
- A record of every user's token investments is maintained (per-user
  history of where tokens are dedicated).

**Why tokens instead of simple counts:** scarcity forces
prioritisation. Backing a proposal signals real commitment (you
committed a limited resource), not just a click. Users have to choose
which proposals matter enough to back.

### Token supply — earn-through-enactment

Tokens are **earned by having your proposals enacted**. The author of
an enacted proposal receives a payout scaled to the community backing
their proposal received:

- **`author_payout = max(1, floor(total_backer_tokens / 10))`**
- 80 tokens backed → author earns 8
- <10 tokens backed → author earns 1 (floor)

This closes the earning loop: users spend tokens backing proposals
they want; when those proposals ship, backers get their tokens back
AND authors are rewarded (from a Kronk-managed pool, not from the
backers themselves).

**Bootstrap:** how does a user get their first tokens if you can only
earn them by shipping proposals? Open decision — see below.

**Anti-gaming (why the dev-signoff two-step exists):** without
back-end verification, a user could propose something trivial, back
it with tokens from a friend, self-mark complete, and farm the payout.
The dev-signoff step means real completion (something actually shipped
in the codebase or platform) is required, gated by the maintainer.

### Token display

On a proposal, backing is shown as:

- **Total tokens + icon** (e.g., `247 ⭘`)
- **Backer count + icon** (e.g., `18 👤`)
- **Ranked position** — where this proposal sits relative to other
  open proposals (`#4 most-backed`)

Discovery: browsing proposals can be sorted by ranked position, so
strongly-backed proposals surface without an explicit threshold.

### Infrastructure to build (not yet shipped)

- `AccountTokenBalance` (or equivalent) — per-user balance.
- `TokenInvestment` — links account to proposal with amount and
  timestamps.
- `TokenPayout` (or ledger event) — records author payouts on
  enactment.
- Investment API — invest / view own investments.
- Balance API — check available tokens.
- Recycling on enact — return tokens to backers.
- Payout on enact — grant author their `floor(total/10)` reward.
- Existing `ProposalVote` model may be superseded or repurposed.

See memory `project_kronk_token_system.md` for the cross-cutting note
on this subsystem.

### Voting / seconding UX polish

The "second a proposal" interaction ships but is rough. Needs an
aesthetic pass in line with 2.0 tokens: cleaner visualisation of
support levels (how many seconds), a better animation moment when you
second, mate/Krew affinity signals ("3 of your mates have seconded
this").

### Kommons feed projection

Proposals surface in Home feeds via the existing `kommons_card`
projection — but the *social triggers* need shaping. Feed appearance
scenarios to design:

- Someone in your network raises a proposal
- Someone in your network seconds a proposal
- A node you've interacted with gets a wave of feedback

### Reflection prompts on visited pages

Kronk surfaces a **persistent "reflect on this page" button in a
corner** of every page. Small, unobtrusive, always present but never
nagging. Tapping it composes a Kommons proposal keyed to the current
node. Ambient = present-but-quiet.

Exact corner + visual treatment coming from the Claude web track.

### Long-term: user-designed spaces (aspirational)

Later phases (post-2.0.0) aim to let users **design or build their
own spaces from within Kommons**. This turns Kommons into the
meta-mechanism for platform growth: a proposal could be *"a new
korner for [purpose]"*, and the Kommons workflow gates its transition
from idea → prototype → shipped korner. Out of scope for 2.0.0;
noted here for direction.

### Aesthetic

Rebuild the governance + Tree UI polish in line with current Kronk
aesthetic tokens (post-planet-metaphor). Coordinating on visual
mockups with Claude web.

## Open decisions

- **Bootstrap: how does a user get their first tokens?** Earning
  requires shipping proposals, but you can't back proposals without
  tokens. Options: signup grant (e.g., 10 tokens), earned via other
  activity (posting, engagement), Kronk-maintainer distribution, or
  something else.
- **Dev-signoff mechanic** — where does the maintainer sign off?
  Admin UI? CLI (`bin/tootctl kommons enact <proposal_id>`)? Linked
  to a merged PR reference?
- **Reflection prompt corner + visual** — Claude web track will
  design; capture spec here once landed.
- **User-designed spaces roadmap** — even though out of scope for
  2.0, capture the shape (what does a "propose a korner" proposal
  look like? What state moves it from proposal to prototype?).
- **`ProposalChallengeCondition` retention** — the existing model
  isn't obviously used post-tokens; decide whether it survives, gets
  repurposed, or retires.
- **Token icon/glyph** — a specific glyph for the tokens (something
  Kronk-native, not a generic coin)?

## Related drafts

- `/home/shared/rebuild/plan/quiet-napping-hare.md` (no dedicated phase — Kommons Tree shipped in an early rebuild slice)
- `/home/shared/rebuild/spec/kronk_korner_spec.md` §Kommons
- `/home/shared/rebuild/memory/project_kronk_rebuild_kommons_reflections_spec_draft.md` (reconciled to Kommons framing)
- Related korners: `krew.md` (no Krew-scoped Kommons in 2.0), all korners (their `nodes:` blocks feed the Tree)
