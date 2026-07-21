# Kommons (`kommons` — rendered ₭ommons)

**Manifest:** `config/korners/kommons.yaml` · **Mount:** `/hub/kommons` · **Status:** shipped-2.0 (Skeleton, backend, token ledger, lifecycle) — backing UI pending

> **Companion:** [`kommons_lattice.md`](./kommons_lattice.md) (the operable second
> view of the map), [`kommons_tracker.md`](./kommons_tracker.md) (the plan to
> run the rebuild's own backlog as Kommons proposals + task-checklists), and
> [`kommons_proposal_page.md`](./kommons_proposal_page.md) (the build spec for a
> single proposal's page — one scroll, steps checklist up front).

## Purpose

Kommons is **Kronk's transparency + participation space**. It's where
users can:

- **See how Kronk fits together** — the Kommons Skeleton maps every
  user-facing page, feature, and connection between korners. It makes
  the platform's structure legible.
- **Participate in guiding Kronk's development** — proposals and
  feedback land here, tagged to a specific Skeleton node so they attach
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

Substantial 2.0 work has already landed in the Kommons Skeleton series
(PRs #287, #292, #295, #297, #300):

### Kommons Skeleton — the transparency layer

- **`Kronk::NodeRegistry`** at `lib/kronk/node_registry.rb`. Boots
  from two sources:
  1. `config/kronk_nodes.yaml` — cross-cutting nodes (Home timeline,
     Nudges activity, profiles, settings pages).
  2. Per-korner `nodes:` blocks in `config/korners/<slug>.yaml`.
- **Every node has a stable `node_id`** independent of URL; feedback
  proposals key on `node_id` so they follow a page across URL changes.
- **Three-bucket drilldown**: `feed`, `profile`, `hub` — organises
  the Skeleton at the top level.
- **Backend-derived connections** — the Skeleton shows cross-korner
  links (which pages relate to which).
- **`bin/tootctl korners doctor`** — anti-drift check ensures nodes
  declared in manifests match reality.
- **Live composer** — replaces the old stub; users can compose a real
  Kommons proposal from any node.
- **Frontend at `app/javascript/mastodon/features/kommons_skeleton/`**;
  route `/hub/kommons/skeleton`.
- **API**: `GET /api/v1/kommons/nodes` serves the tree JSON.

### Proposal model + governance UI

- **`Proposal`** model (`app/models/proposal.rb`) — `title`, `body`,
  `summary`, `created_by_account`, `status`, `parent_proposal`
  (hierarchy), optional discussion Status linkage (pre-2.0
  `discussion_status_id` dual-writes during transition).
- Sibling models: **`ProposalVote`**, **`ProposalBacking`**,
  **`ProposalAttachment`**, **`Task`**, **`BudgetItem`**,
  **`ChallengeCondition`**, **`ChallengeResponse`**, **`TokenBalance`**,
  **`TokenTransaction`**. (There is no `ProposalCompletionSuggestion` or
  `ProposalChallengeCondition` model — challenge data lives in
  `ChallengeCondition`/`ChallengeResponse`.)
- **Node-keyed proposals** — `Proposal.node_id` associates a proposal
  with a Skeleton node.
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

Rationale for retirement: proposals key on `node_id`, so the Skeleton
itself locates a proposal; the parallel category taxonomy is
redundant.

**Model changes (in the 2.1.0 cleanup migration):**

- `Proposal.categories` column drops
- `CATEGORY_VALUES` constant retires
- `categories_within_allowed_values` validator retires

Migration: existing categorised proposals get their categories
dropped (the `node_id` link is authoritative for placement).

### Proposal lifecycle states

**Shipped 2026-07-18** (#368, #369). `Proposal.status` is an enum with
four states:

- **open** — accepting backing.
- **delivered** — a dev has built the thing and marked it done from the
  back end. Backing closes. The proposer is notified and is the only
  person who can move it on.
- **completed** — the proposer confirmed delivery. Backers are refunded
  and the author is paid. Terminal.
- **annulled** — a dev released the proposal from the back end. Backers
  are refunded, the author is paid nothing. Terminal.

```
open ──dev──> delivered ──proposer──> completed   refund + payout
 │
 ├──dev──> annulled                               refund, no payout
 └──archive (only while backing is zero)
```

**Archiving is not a state.** It stays an `archived_at` timestamp, and is
only permitted while total backing is zero. Once tokens are committed the
proposal is committed too — it can only be completed or annulled, both of
which return the stakes.

**There is no `delivered` → `annulled` edge.** Once delivered, the only
way out is the proposer completing it. A problem found after delivery is
a new proposal.

**`deliver` and `annul` are back-end only** — `tootctl kommons deliver
<id>` and `tootctl kommons annul <id>`. Both move tokens and both are dev
actions, so access is governed by who can get a shell on the server
rather than by a role check; there is no in-app surface to discover or
mis-permission. Completing is the proposer's and happens in the app via
`POST /api/v1/proposals/:id/complete`.

Delivery fires a `proposal_status_changed` notification to the proposer —
a Kronk-native (non-legacy) type registered in `Notification::PROPERTIES`,
per Korner Standard L10.

#### Two states were retired, not renamed

`vetoed` and `in_progress` are gone (migration `CollapseProposalStates`
remaps both to `open`).

`vetoed` was never a lifecycle state. `reconcile_status!` recomputed it on
every vote and unvote as "has at least one block vote" — a cached boolean
living in the status column. No user ever set it and there was no veto UI.
It survives as a **response count** off `proposal_votes`, which is where it
always actually lived. Nothing is lost: every previously-vetoed proposal's
blocks are still in `proposal_votes`.

`in_progress` had no producer anywhere in the repo — only an enum entry,
two TypeScript declarations and two label strings.

The migration also fixed the column default, which was `0` — not a valid
enum value, so any row written without an explicit status landed unmapped.

### Token backing

**Shipped 2026-07-18** (#366). The old "seconding threshold" gate retires.
In its place, a per-user token system:

- Every user has a **token balance**.
- Users **invest tokens in a proposal** they want to back — any amount
  from 1 up to their available balance.
- Tokens are **locked once committed** — there is no un-back.
- Tokens **return to the backer** when the proposal is completed or
  annulled.
- **Backings accumulate.** A backer may top up; each investment is its own
  row and a stake is their sum. Rows are never edited or deleted — a
  refund is recorded as a transaction, not by unwinding the backing that
  earned it.

**Why tokens instead of simple counts:** scarcity forces prioritisation.
Backing a proposal signals real commitment (you committed a limited
resource), not just a click. Users have to choose which proposals matter
enough to back.

### Token supply — earn through completion

**Shipped 2026-07-18** (#366).

Every user starts with **10 tokens** — backfilled for existing accounts by
the ledger migration, and granted on create for new ones, so a new signup
can back something immediately. This closes the bootstrap question that
was previously open here.

Beyond that, tokens are **earned by having your proposals completed**. The
author of a completed proposal receives a payout scaled to the backing it
attracted:

- **`author_payout = max(1, floor(total_backer_tokens / 10))`**
- 80 tokens backed → author earns 8
- fewer than 10 backed → author earns 1 (the floor)

The payout comes from a Kronk-managed pool, **not** from the backers —
their stakes are returned in full separately.

**Anti-gaming (why the two-step exists):** without back-end verification a
user could propose something trivial, back it with tokens from a friend,
self-mark complete and farm the payout. Delivery is a dev action taken
from a shell; only after it can the proposer complete and trigger the
payout.

### Token display

On a proposal, backing is shown as:

- **Total tokens + icon** (e.g., `247 ⭘`)
- **Backer count + icon** (e.g., `18 👤`)
- **Ranked position** — where this proposal sits relative to other
  open proposals (`#4 most-backed`)

Discovery: browsing proposals can be sorted by ranked position, so
strongly-backed proposals surface without an explicit threshold.

### Ledger infrastructure (shipped)

**Shipped 2026-07-18** (#366, #368, #369).

Tables — `token_balances` and `token_transactions` sit at platform level,
since a user's balance is not Kommons-specific and may back other things
later; `proposal_backings` sits under the korner's `proposal_` namespace
per Standard L2.

- **`TokenBalance`** — one row per account. Stored, not derived.
- **`TokenTransaction`** — append-only audit trail. Signed amounts, kinds
  `grant` / `backing` / `refund` / `payout`. Every balance change writes
  one, so a balance always reconciles against the sum of its transactions
  (`TokenBalance#reconciles?` asserts exactly that).
- **`ProposalBacking`** — one row per investment, so top-ups accumulate.
- **`Kronk::Tokens`** (`app/lib/`) — the only sanctioned mutation path.
  Takes a row lock and writes the balance change and its transaction in
  one database transaction, so two concurrent backings cannot overspend.
  `refund_all!` and `pay_author!` are **idempotent** — a retried
  transition cannot pay twice.
- **`Kronk::ProposalStates`** (`app/lib/`) — the transition machine.

Still to build: the **backing UI**. Backing is currently only reachable
from a console, so the loop cannot yet be dogfooded from the app. Token
display (total + backer count with a glyph) is specified below but
unbuilt.

`ProposalVote` is unchanged and still carries support / question /
challenge as response counts — it was not superseded by tokens.

### Voting / seconding UX polish

The "second a proposal" interaction ships but is rough. Needs an
aesthetic pass in line with 2.0 tokens: cleaner visualisation of
support levels (how many seconds), a better animation moment when you
second, mate/Krew affinity signals ("3 of your mates have seconded
this").

### Kommons feed projection

Proposals surface in Home feeds via the existing `kommons_card`
projection — but the _social triggers_ need shaping. Feed appearance
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
meta-mechanism for platform growth: a proposal could be _"a new
korner for [purpose]"_, and the Kommons workflow gates its transition
from idea → prototype → shipped korner. Out of scope for 2.0.0;
noted here for direction.

### Aesthetic

Rebuild the governance + Skeleton UI polish in line with current Kronk
aesthetic tokens (post-planet-metaphor). Coordinating on visual
mockups with Claude web.

## Open decisions

_Resolved 2026-07-18: **bootstrap** — every account starts with 10
tokens, backfilled by migration and granted on create. **Dev-signoff** —
`tootctl kommons deliver <id>` / `annul <id>`, back-end only._

- **Reflection prompt corner + visual** — Claude web track will
  design; capture spec here once landed.
- **User-designed spaces roadmap** — even though out of scope for
  2.0, capture the shape (what does a "propose a korner" proposal
  look like? What state moves it from proposal to prototype?).
- _Resolved:_ **`ChallengeCondition`** (the model this doc once called
  `ProposalChallengeCondition`) **is** in active use — created on every block
  vote in `ProposalsController#vote` and serialized into a proposal's
  `challenges`. It stays.
- **Token icon/glyph** — a specific glyph for the tokens (something
  Kronk-native, not a generic coin)?

## Related drafts

- `docs/rebuild/implementation_plan.md` (no dedicated phase — Kommons Skeleton shipped in an early rebuild slice)
- `docs/kronk_korner_spec.md` §Kommons
- Related korners: `docs/spaces/groups.md` (no Krew-scoped Kommons in 2.0); all korners' `nodes:` blocks feed the Skeleton.
