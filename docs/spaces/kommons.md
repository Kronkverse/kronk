# Kommons (`kommons` — rendered ₭ommons)

**Manifest:** `config/korners/kommons.yaml` · **Mount:** `/hub/kommons` · **Status:** shipped-2.0 (Directory, backend, token ledger, lifecycle, backing UI)

> **Companion:** [`the Lattice part of this file`](kommons.md) (the operable second
> view of the map), [`the Build tracker part of this file`](kommons.md) (the plan to
> run the rebuild's own backlog as Kommons proposals + task-checklists), and
> [`the Proposal page part of this file`](kommons.md) (the build spec for a
> single proposal's page — one scroll, steps checklist up front).

## Purpose

Kommons is **Kronk's transparency + participation space**. It's where
users can:

- **See how Kronk fits together** — the Kommons Directory maps every
  user-facing page, feature, and connection between korners. It makes
  the platform's structure legible.
- **Participate in guiding Kronk's development** — proposals and
  feedback land here, tagged to a specific Directory node so they attach
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

## What earns a node (decided 2026-09-10)

The Directory is how you navigate the spaces of Kronk, and every end node is a
page you can make a proposal about. That gives one rule and two consequences.

**One node per space a user can reach.** If someone can get to it, it must be on
the tree — otherwise there is no way to propose a change to it, and the map is
lying about what Kronk contains.

**A view is not a space.** Kommunity has two views, Orb and Discover; that is one
node, because a proposal about Discover is a proposal about Kommunity. Any korner
declaring `views:` in its manifest gets one node for the korner, not one per
face. (`kommunity.discover` was removed on this rule.)

**A settings page belongs to the settings bucket**, even when its URL sits under
a korner — `settings.hub` at `/hub/settings` is the precedent, and
`settings.moments` at `/hub/moments/settings` follows it. A bucket that is not
one of `NodeRegistry::BUCKETS` is dropped at boot with a warning, so the page
silently disappears from the map.

**Still open:** parameterised routes (`/hub/kuestions/:id`, `/@:user`) are
registered as nodes but deliberately excluded from the drawn tree — the layout
treats them as internal templates rather than fingers. They are real proposal
targets (“the question page should show the asker’s avatar” is a coherent
proposal) with no way to reach them from the map. Either they become reachable
or they should not be nodes.

## Current shape (2.0 already shipped)

Substantial 2.0 work has already landed in the Kommons Directory series
(PRs #287, #292, #295, #297, #300):

### Kommons Directory — the transparency layer

The transparency map is the **Directory**, rendered by the **Lattice**
view. (The earlier "Skeleton" naming and its `/hub/kommons/skeleton`
route are retired — that route now 301-redirects to
`/hub/kommons/lattice`.)

- **`Kronk::NodeRegistry`** at `app/lib/kronk/node_registry.rb`. Boots
  from two sources:
  1. `config/kronk_nodes.yaml` — cross-cutting nodes (Home timeline,
     Nudges activity, profiles, settings pages).
  2. Per-korner `nodes:` blocks in `config/korners/<slug>.yaml`.
- **Every node has a stable `node_id`** independent of URL; feedback
  proposals key on `node_id` so they follow a page across URL changes.
- **Three-bucket drilldown**: `feed`, `profile`, `hub` — organises
  the Directory at the top level.
- **Backend-derived connections** — the Directory shows cross-korner
  links (which pages relate to which).
- **`bin/tootctl korners doctor`** — anti-drift check ensures nodes
  declared in manifests match reality.
- **Live composer** — replaces the old stub; users can compose a real
  Kommons proposal from any node.
- **Frontend at `app/javascript/mastodon/features/kommons_lattice/`**;
  route `/hub/kommons/lattice` (the legacy `/hub/kommons/skeleton`
  redirects here).
- **API**: `GET /api/v1/kommons/nodes` serves the tree JSON.

### Proposal model + governance UI

- **`Proposal`** model (`app/models/proposal.rb`) — `title`, `body`,
  `summary`, `created_by_account`, `status`, `parent_proposal`
  (hierarchy), optional discussion Status linkage (pre-2.0
  `discussion_status_id` dual-writes during transition).
- Sibling models: **`ProposalVote`**, **`ProposalBacking`**,
  **`ProposalAttachment`**, **`ProposalComment`**, **`Task`**,
  **`BudgetItem`**, **`ChallengeCondition`**, **`ChallengeResponse`**,
  **`TokenBalance`**, **`TokenTransaction`**. (There is no
  `ProposalCompletionSuggestion` or
  `ProposalChallengeCondition` model — challenge data lives in
  `ChallengeCondition`/`ChallengeResponse`.)
- **Node-keyed proposals** — `Proposal.node_id` associates a proposal
  with a Directory node.
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

Rationale for retirement: proposals key on `node_id`, so the Directory
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
 └──dev──> annulled                               refund, no payout
```

There is no archive code path. `Kronk::ProposalStates`
(`app/lib/kronk/proposal_states.rb`) exposes only `deliver!`,
`complete!`, `annul!` and `backable?` — the `archived_at` column on the
`proposals` table is vestigial and is not read or written by any
transition.

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

**User-facing name: Koin** (the currency is called **Koin** in the UI, shown
with the **₭** glyph before amounts — e.g. `₭3 staked`; code/DB stay `token_*`).
Decided 2026-07-22 with Tal, from the Kommons home mockup.

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

- **Total tokens + icon** (e.g., `₭247`)
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

The **backing UI has shipped** — the loop is dogfoodable from the app.
`ProposalBacking` (`features/governance/components/proposal_backing.tsx`)
is the stake control, `KoinWallet`
(`features/governance/components/koin_wallet.tsx`) shows a user's
balance, and both post to `POST /api/v1/proposals/:id/back`
(`Api::V1::ProposalsController#back`).

`ProposalVote` still exists in code (`position` enum: agree / abstain /
block), but it is **no longer the support signal** — token backing is.
Its remaining live role is challenge data (block votes create
`ChallengeCondition` rows); see below.

### Voting / seconding — retired as a support mechanism

Voting/seconding is **no longer how a proposal gathers support** — that
is now **token backing** (above). The old "second a proposal"
interaction is legacy being removed, not a surface to polish. The
`ProposalVote` machinery survives in code only for **challenge** data
(a block vote still creates a `ChallengeCondition` via
`ProposalsController#vote`); it is not a support signal and gets no
aesthetic pass.

### Kommons feed projection

Proposals surface in Home feeds via the existing `kommons_card`
projection — but the _social triggers_ need shaping. Feed appearance
scenarios to design:

- Someone in your network raises a proposal
- Someone in your network backs a proposal
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

Rebuild the governance + Directory UI polish in line with current Kronk
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

- `docs/decisions.md` (no dedicated phase — the Kommons Directory shipped in an early rebuild slice)
- `docs/korners/adding_a_korner.md (Framework spec (v0.5))` §Kommons
- Related korners: `docs/spaces/groups.md` (no Krew-scoped Kommons in 2.0); all korners' `nodes:` blocks feed the Directory.

---

## Proposal page

_Merged into this file on 2026-10-04 from `docs/spaces/kommons_proposal_page.md` (since deleted); its own status notes and dates are kept as written._

**Surface:** a single proposal, at `/hub/kommons/p/:id` · **Replaces:** the
tabbed `ProposalDetail` (Seed / Kontribute tabs) · **Status:** spec — mockup
locked, build pending.

> **Companion:** [`kommons.md`](kommons.md) (the space),
> [`docs/design.md (Aesthetic system)`](../design.md) (the tokens this
> page is built from). Interactive reference mockup rendered from this spec;
> colours are snapped to `app/javascript/mastodon/tokens/tokens.yaml`.

### Why this exists

The current proposal view (`app/javascript/mastodon/features/governance/components/proposal_detail.tsx`)
splits the proposal across two tabs — **Seed** (body, votes, backing) and
**Kontribute** (tasks, budget). That buries the two things a reader most wants:
what's being proposed, and **how far along it is**. A proposal's steps (its
`tasks`) — the checklist that tells you what's done and what's left — sit one
tab away, so a glance at a proposal tells you almost nothing about its progress.

This spec replaces the tabs with **one scroll**, and pulls the **steps
checklist to the front** as the page's centrepiece.

### Layout — one scroll, in order

A single reading column, `max-width: 760px`. No tabs. Sections top to bottom:

1. **Top bar** — a `← Back to the map` link (returns to the skeleton/lattice the
   reader came from, per the nav already shipped), a quiet breadcrumb
   (`Kommons › <node label>`), and — on this page only, since it is the theme
   authority for the mockup — a theme toggle. In-app the toggle is global chrome,
   not part of this page.
2. **Hero** — status pill (`Open` / `Delivered` / `Completed` / `Annulled`),
   a `⚖️ Kommons proposal` kind label, the **title**, the one-line **summary**,
   and a meta row: seeder avatar + handle, age, and a **node chip** linking to
   the page the proposal is about (`/hub/kommons/node/:nodeId`).
3. **Support (backing)** _(the primary action)_ — a raised, accent-tinted card:
   the `₭` total backed, backer count, rank (`#N most-backed`), your stake, and a
   **`Back this`** input + button with your balance. **Support = token backing.**
   ₭ is scarce (10 at signup, earned only via completion payouts, no recurring
   income), so a stake is real commitment, not a free click. Locked until the
   proposal is delivered or annulled, then returned (`Kronk::Tokens.back!`).
4. **Steps** — a card titled `Steps · N of M done` with a **progress bar** and
   the checklist (a checkbox, the step text, and a state tag). This is
   `proposal.tasks` surfaced directly — no longer inside a Kontribute tab.
5. **Description** — the proposal body (the "why").
6. **Design docs** — `proposal_attachments` as thumbnail cards (kind + size),
   with an inline `＋ Attach a doc` tile.
7. **Comments** — a threaded discussion, with an inline reply box.

**Retired: the Support/Question/Challenge votes.** The old `ProposalVote`
(agree/abstain/block) model is gone from the page — support is now token backing,
and Question/Challenge become comments. (Challenge was already declawed — a
response count, not a veto — so this removes teeth that were already gone.)

### Design tokens

Everything themes through `tokens.yaml`; no hard-coded colours. The governance
palette is used verbatim for the interactive states — this is what makes the
page read as Kommons:

| Role                    | Token                                                  |
| ----------------------- | ------------------------------------------------------ |
| Accent (buttons, links) | `--accent` (`#6364ff` / `#4414cc`)                     |
| Support / step done     | `--decision-agree` (`#22c55e`)                         |
| Question                | `--decision-pending` (`#f59e0b`)                       |
| Challenge / block       | `--decision-block` (`#ef4444`)                         |
| Surfaces                | `--surface-primary` / `--surface-elevated`             |
| Borders                 | `--border-default` (purple-tinted in dark)             |
| Text                    | `--text-primary` / `--text-secondary` / `--text-muted` |

Font: `mastodon-font-sans-serif`. Card radius: `large` (16px). Interactive
borders 1–1.5px. Both dark and light themes are first-class (dark shows the
purple-tinted borders + deep accent that read distinctly Kronk).

### What's built vs. what this needs

Build accordingly, don't fake the gaps:

- **Shipped** — the one-scroll shell (tabs retired), the hero, the steps
  checklist (`tasks`), design-doc cards, and the **support/backing panel** (the
  `backing` payload + `POST /back` were already live; the panel surfaces them).
  Votes have been **removed** from the page.
- **Comments shipped** — the dedicated `proposal_comments` model
  (`app/models/proposal_comment.rb`, one level of threading), its migration
  (`db/migrate/20260722150000_create_proposal_comments.rb`), the API
  (`app/controllers/api/v1/proposals/comments_controller.rb`, routed at
  `config/routes/api.rb` — `resources :comments, module: :proposals`), and the
  threaded UI (`features/governance/components/proposal_comments.tsx`) all
  landed. The old "Discussion" (vote-responses) stays retired. **Pending:** the
  `db/schema.rb` dump has not been regenerated, so `proposal_comments` is absent
  from the committed schema despite the migration — re-dump before release.
- **Economy caveat** — ₭ is tight (10 at signup, no recurring income, earned
  only via completion payouts). If backing is the only support signal, token
  liquidity may need revisiting for the model to feel usable — flagged, not yet
  decided.

### Build order

1. ✅ Hero + one-scroll shell (retire the Seed/Kontribute tabs).
2. ✅ Steps checklist with progress + done-count, wired to `tasks`.
3. ✅ Hero restyle (mockup) + design-doc cards.
4. ✅ Support = backing panel (primary action); **votes retired**.
5. ✅ **Comments** — `proposal_comments` model + migration + API + threaded UI
   shipped; only the `db/schema.rb` re-dump is outstanding.

---

## Lattice

_Merged into this file on 2026-10-04 from `docs/spaces/kommons_lattice.md` (since deleted); its own status notes and dates are kept as written._

The Kommons map (`/hub/kommons/lattice`) — an operable, orthogonal dendrogram,
branded the **Directory** in the UI. It is _the_ map: the old radial Skeleton
view has been retired, and `/hub/kommons/skeleton` now 301-redirects to
`/hub/kommons/lattice`. There is no longer a two-view toggle; the Frame's
Proposals ⇄ Directory picker switches between the proposals list and this map,
not between two rival maps.

Implemented against the spec below (from the Kommons Rebuild proposal filed
through Kommons itself). Shipped: the tidy-tree layout with its invariants, one
branch open per level with recursive prune, the sprout choreography (wires draw,
rows stagger, existing rows reflow), the leaf panel with _Plant feedback here_
wired to the composer, zoom (scale-not-camera, fit, anchored ctrl+wheel,
detail-shedding), drag-to-pan, scroll-into-view on open, and the reduced-motion
pass. **The composer/picker also shipped** (previously deferred): the Directory
has a `pick` mode (`Lattice pick` prop) that scopes selection to a target node,
`features/governance/propose_page.tsx` + `propose_picker.tsx` provide the
Proposer, routed at `/hub/kommons/pick` and `/hub/kommons/propose`, and the
Directory carries a "+ Propose a new Korner" affordance
(`kommons_lattice/components/lattice.tsx`).

**Deferred follow-ups / tidy-up:**

- **Manifest names + icons consolidation** — the Directory still hardcodes some
  limb labels; its Hub icon and a couple of korners fall back until the manifest
  `name`/`icon` become the single source it reads.
- **Leaf panel** — the cross-branch _wired to_ list (§7).
- **Pan momentum** (§6c) and **keyboard navigation** (open question 4: ↑↓ within
  a column, → to open, ← to fold).
- General visual tidy-up once the feel settles on shadow.

Code: `app/javascript/mastodon/features/kommons_lattice/` (view) and the shared
data layer in `app/javascript/mastodon/features/kommons_tree/data/` (`nodes.ts`,
`layout.ts`). The `KRONK_KOMMONS_MOTION.md` referenced below (the retired
Skeleton's motion spec) was not part of this fold-in.

---

### Kommons — Lattice: Motion & Interaction Spec

Companion to `kronk_kommons_lattice.html` and its screenshots.
Sibling document to `KRONK_KOMMONS_MOTION.md` (the Skeleton view).

**Read this first.** Screenshots of the Lattice look like an org chart. They are not wrong, they are
just missing the entire design, which lives in _how branches arrive and leave_. A static render of
this view is a picture of a filing cabinet. The built version should feel like watching something
grow on command.

All values below are lifted verbatim from the prototype. Where a token exists, use the token.

---

#### 0. The one idea

> **Structure is fixed and orthogonal. Branches sprout on demand and fold away when you leave them.**

Where the Skeleton is a body you travel through with a camera, the Lattice is a mechanism you
operate. Nothing is organic, nothing drifts, nothing is placed by feel. Every row sits on a grid
pitch, every parent is centred exactly on its children, and every connector is a right angle with a
fixed corner radius.

Two rules make it work, and both must be honoured or the view degrades into a normal tree widget:

1. **Only one branch is open per level.** Opening a sibling folds the current one, with its whole
   subtree. The lattice can therefore never sprawl — it is always a single readable path plus its
   immediate options.
2. **Growth is drawn, not revealed.** New connectors animate themselves into existence and the rows
   arrive at the end of them. You never fade in a finished branch.

---

#### 1. Layout — tidy lateral dendrogram

Recomputed on every open/fold. Cheap; do not try to cache it.

##### Constants

|                  | value   |
| ---------------- | ------- |
| row height       | 40      |
| row gap          | 16      |
| **row pitch**    | **56**  |
| column width     | 214     |
| column gap       | 76      |
| **column pitch** | **290** |
| plane padding    | 40 × 40 |

##### Algorithm

Classic tidy-tree over the _visible_ subtree, where a node's visible children are
`open.has(id) ? node.kids : []`:

```
y = 0
walk(id, depth):
    kids = visibleChildren(id)
    if kids is empty:
        POS[id] = { x: depth * COLPITCH, y: y, depth }
        y += PITCH
        return POS[id].y
    ys = kids.map(k => walk(k, depth + 1))
    POS[id] = { x: depth * COLPITCH, y: (ys[0] + ys[last]) / 2, depth }
    return POS[id].y
```

Leaves stack sequentially; a parent takes the **midpoint of its first and last child**. This is what
produces the characteristic look — Kronk centred on its three limbs, Hub centred on its fourteen
korners.

**Invariants to test.** Both hold in the prototype at every expansion state:

- no two rows in the same column are within `ROWH` of each other (zero collisions)
- every parent's `y` equals the midpoint of its visible children's `y` range

Reference figures: at boot, 4 rows (1 + 3). Hub open → 18 rows, Hub centred at y 476 with korners
spanning 112–840. Hub + Booth open → 24 rows across 4 columns.

##### Hub two-column split (once the kid list is long enough)

Under the tidy-tree rule Hub's kids stack in a single column at `depth+1`. Beyond a threshold
(currently 15 kids — production has ~17), that block gets tall enough to force the viewport to zoom
out just to fit it in view, at which point the cards read as text-too-small (Tal 2026-08-12
screenshot). At that point Hub's kids split across two adjacent columns, alphabetically arranged
column-major (first half top-to-bottom in the left column, second half top-to-bottom in the right)
so a reader scanning A→Z can follow one column then the other. Left column stays at `depth+1`; the
right column sits at `depth+2` (2026-08-13 — was `depth+3` briefly during initial prototyping;
brought closer per Tal to keep both columns and the trunk inside a sensible viewport horizontal
budget). Trade-off: a Hand in the left half (Kommons, Huddle) that expands its Fingers will drop
them at `depth+2` too, i.e. on top of the right column — rare because users typically navigate to
a Hand's Space page rather than expand it inline from the Directory.

**Hub itself sits below the whole block** (2026-08-13 refinement — Tal: "come out the right hand
side of the pill, then turn 90° up, then split into left and right sides"). The trunk visually
rises upward from Hub's right edge past every card; wires branch off to each side to reach cards on
the left or right of the trunk. To keep parents that consume Hub's midpoint (Kronk) visually sane
even though Hub itself is at the block bottom, `walk('hub')` returns the block centre — not
`pos.hub.y` — for the parent's midpoint calc.

**Focus-on-tap centres the bounding box of Hub + its kids.** The standard scroll-to-focus (§5)
biases the acted-on node toward 35% from the viewport's left edge — appropriate when the node's
kids grow into the next column. Hub with the split layout puts kids on both sides of the trunk, so
biasing on Hub itself leaves the right column off-screen. Hub's focus handler instead computes the
bounding box of Hub **and** all its visible kids, and scrolls the viewport so that box's centre
sits in the middle. Including Hub in the box keeps the Hub pill on screen — the tap-again-to-
collapse affordance needs Hub to be reachable (Tal 2026-08-13: "I can hardly actually see the hub
to tap it").

**Tap toggles drill-down / step-out.** An aggregator limb (Hub, Kronk — no Space page of its own)
tap flips between:

- **closed → open + focus this limb**: drill down. Focus effect centres on the kid block per the
  paragraph above.
- **open → close + focus its parent**: step back out (2026-08-13 — Tal: "no way to return to the
  previous level of the tree if I decide the space I want to propose about isn't on the hub, but
  on nudges"). Focus effect scrolls to the parent so its sibling limbs come back into view.

Wires route through a shared vertical trunk in the middle of the gap between the two columns, with
horizontal branches to each card on either side — the visual is a spine, not a fan of independent
elbows (see §2, "Hub trunk branch").

---

#### 2. Connectors (wires)

SVG `<path>`, **stroked, not filled** — the opposite of the Skeleton's tapered bones. Uniform width;
no taper anywhere.

##### Geometry — orthogonal elbow

From parent right edge to child left edge, turning at the horizontal midpoint of the column gap:

```
x1 = parent.x + COLW,  y1 = parent.y + ROWH/2
x2 = child.x,          y2 = child.y  + ROWH/2
mx = x1 + COLGAP * 0.5
r  = min(11, |y2 - y1| / 2, COLGAP * 0.4)
s  = y2 > y1 ? 1 : -1

M x1,y1  L mx-r,y1  Q mx,y1 mx,y1+s·r
         L mx,y2-s·r  Q mx,y2 mx+r,y2  L x2,y2
```

If `|y2 - y1| < 1`, emit a straight horizontal line instead — the quadratics degenerate otherwise.
The `r` clamp matters: without it, closely-stacked siblings produce corners that overshoot and read
as wobble.

`stroke-linecap: round`, `stroke-linejoin: round`.

##### Hub trunk branch (split-column mode)

When Hub is in the two-column split (see §1), every hub-kid wire routes through a single vertical
trunk at `trunkX = (nearCol.right + farCol.left) / 2` — the middle of the gap between the two card
columns. Each wire is `Hub → right to trunk → up/down along trunk → left/right to card`:

```
x1     = parent.x + COLW,  y1 = parent.y + ROWH/2
y2     = child.y + ROWH/2
isLeft = child.x < trunkX
x2     = isLeft ? child.x + COLW : child.x        # right edge for left-col, left edge for right-col
r      = min(11, |y2 - y1| / 2, COLGAP * 0.4)
s      = y2 > y1 ? 1 : -1
dir    = isLeft ? -1 : +1                         # side of the trunk the final segment exits

M x1,y1  L trunkX-r,y1  Q trunkX,y1 trunkX,y1+s·r
         L trunkX,y2-s·r  Q trunkX,y2 trunkX+dir·r,y2  L x2,y2
```

All hub-kid wires overlap on the trunk portion, so visually they read as one vertical spine with
cards fanning out to both sides — the "branch goes up from the hub and splits into two" shape from
Tal's design sketch (2026-08-12).

##### States

| state                     | stroke                    | width |
| ------------------------- | ------------------------- | ----- |
| default                   | `text-muted @ 34%`        | 1.5   |
| `on` (on the active path) | **`kronk-purple-bright`** | 2     |

Colour transitions at `--dur-medium` `--ease-out`.

---

#### 3. Sprouting — the signature choreography

This is the thing the screenshots cannot show. When a branch opens:

**Step 1 — the wire draws itself.** For each _newly appearing_ child, measure the path with
`getTotalLength()`, set `stroke-dasharray` and `stroke-dashoffset` to that length, then on the next
animation frame add the `.draw` class and set `stroke-dashoffset: 0`.

```
transition: stroke-dashoffset 340ms var(--ease-out)
```

The line grows outward from the parent toward where the child will be.

**Step 2 — rows arrive at the end of the wires.** New rows start at `opacity: 0` and fade in with a
per-index stagger:

```
transition-delay: min(i * 26, 340) ms
transition: opacity 260ms var(--ease-out)
```

The delay cap at 340ms keeps a 14-child fan (Hub) from taking a full second to populate. Clear the
inline `transition-delay` after 600ms so it doesn't poison later reflows.

**Only genuinely new nodes animate.** Track the previous frame's id set; nodes that already existed
must _reflow_, not re-enter (see §4). Getting this wrong makes the whole lattice flicker on every
click, which is the most likely bug in a rebuild.

**Folding** is plain: rows fade to `opacity: 0` and are removed after 260ms. No reverse-draw on the
wires — retraction should be quick and unceremonious, in contrast to the deliberate growth.

---

#### 4. Reflow

Opening a branch pushes everything below it down. Existing rows **must glide**, never jump:

```
transition: transform 380ms var(--ease-out)
```

Position is applied as `transform: translate(x + PAD.x, y + PAD.y)` — never `left`/`top`, which
won't composite smoothly.

The relationship between the three timings is deliberate:
**reflow (380ms) ≈ wire draw (340ms) > row fade (260ms)**. Existing structure settles into its new
shape at roughly the same rate as the new branch draws, so the whole thing reads as one motion
rather than three.

---

#### 5. Scrolling and zoom — still no camera

The Lattice explicitly does **not** have a camera. The plane is a normal scrolling container and
sizes itself to content (`maxX + PAD.x*2` by `maxY + PAD.y*2 + 40`).

After any open/fold/select, ease the container to bring the new column into view:

```
targetX = POS[id].x + PAD.x - 60
wantX   = (isOpen || isSelected) ? targetX + COLPITCH * 0.35 : targetX
scrollTo({
  left: max(0, wantX - clientWidth * 0.35),
  top:  max(0, POS[id].y + PAD.y - clientHeight / 2),
  behavior: "smooth"
})
```

The `COLPITCH * 0.35` nudge biases the viewport toward the _newly grown_ column rather than centring
the node you clicked — you want to see what appeared, not what you pressed. **Multiply all scroll
targets by the current zoom** (see below); forgetting this is why scroll-to lands in the wrong place
when zoomed.

##### Zoom

Zoom here is a **scale on the plane**, not a camera. The distinction is load-bearing: layout is
untouched, scrolling remains ordinary scrolling, and the user is only choosing how much lattice fits
on screen. It is Figma's zoom, not the Skeleton's camera.

```
#plane { transform: scale(Z); transform-origin: 0 0; }
```

**The scrollbars must stay honest.** A CSS transform does not change an element's layout box, so the
plane's `width`/`height` are set to `CONTENT × Z` while its children stay in unscaled coordinates.
Get this wrong and you can zoom out but not scroll to what you revealed.

- range `0.38 – 1.6`, default `1`
- **Anchored zoom.** Wheel-zoom must keep the point under the cursor fixed. Convert cursor position
  to world space at the old scale, apply the new scale, then correct scroll:
  `wx = (scrollLeft + ax) / Z_old` → `scrollLeft = wx * Z_new - ax`. Without this, zooming feels
  like the content is fleeing the pointer.
- **Transition only for discrete steps.** Buttons/keys get `transform 220ms var(--ease-out)`
  (class added, removed after 260ms); wheel zoom gets **no transition** so it tracks the gesture 1:1.
  Same principle as drag-panning in the Skeleton.
- **Plain scroll stays plain scroll.** Only zoom on `ctrl`/`⌘ + wheel`; a bare wheel must scroll the
  lattice. On trackpads, pinch arrives as ctrl+wheel, so pinch works for free.
- Controls: `−` / percentage / `+` / fit, bottom-right. The percentage is a button that resets to
  100%. Keys: `+` `-` `0` `f`.
- **Fit** solves `min((vw - 24) / CONTENT.w, (vh - 24) / CONTENT.h)`, clamped, then scrolls to origin.

##### Drag to pan

Dragging the canvas is an alternative to the scrollbars, not a camera — it sets `scrollLeft` /
`scrollTop` directly and nothing else moves.

- **Left button on empty canvas only**, or **middle button anywhere**. Pressing on a row, the panel,
  or the zoom controls must not start a pan, or the lattice becomes impossible to operate.
- **4px threshold.** Below it, the gesture is still a click. Above it, add a `dragging` class which
  sets `cursor: grabbing`, disables text selection, and sets `pointer-events: none` on rows so the
  pointer can't snag mid-drag.
- **Suppress the trailing click.** A drag that happens to end over a row would otherwise fire that
  row's click handler and expand a branch the user never chose. Capture-phase `click` listener,
  `stopPropagation` + `preventDefault` when a drag just completed.
- **Momentum.** Track pointer velocity; on release, carry `v * 16` px and decay by `0.92` per frame,
  stopping below `0.4px`. Cancel any in-flight glide on the next `pointerdown`. Skip momentum
  entirely under `prefers-reduced-motion`.
- Cursor is `grab` at rest, `grabbing` while dragging.
- Cancel on `pointercancel` and `pointerleave` as well as `pointerup`, or a drag that leaves the
  window will stick.

##### Detail shedding

Below `Z = 0.62` the plane gains a `tiny` class that fades row **labels** out and dims counts and
chevrons, leaving icons centred in their rows. Zoomed out, the lattice should read as _shape_ — the
silhouette of which branches are open and how deep they run — not as unreadable four-pixel type.
This is the Lattice's equivalent of the Skeleton's distance-based presence model.

---

#### 6. Rows

Fixed 214 × 40, `--radius-medium`. Contents left to right: icon (22px, `kronk-purple-bright`), name
(`--font-display`, `--font-size-sm`, ellipsised), open-proposal count pill if non-zero, and a
chevron if the node has children.

| state                 | treatment                                                                           |
| --------------------- | ----------------------------------------------------------------------------------- |
| default               | `surface-elevated @ 62%`, `border-subtle`                                           |
| hover                 | `surface-elevated @ 92%`, `border-strong`, icon `scale(1.1)`                        |
| `open`                | `surface-elevated @ 96%`, `border-strong`, **chevron rotates 90°** (`--dur-medium`) |
| `sel` (leaf selected) | `purple-bright @ 16%` fill, `purple-bright` border + 1px ring                       |
| `core` (Ж)            | `purple-bright @ 22%` fill, `purple-bright @ 46%` border, centred content           |

The rotating chevron is the affordance that tells you a row is a branch rather than a destination.
Keep it.

---

#### 7. The leaf panel

Selecting a node **with a URL** (a real page, not a branch) opens a panel in the next column,
attached by its own lit wire — so content sits in the lattice rather than in a modal or a side rail.

- 360px wide, `--radius-large`, `max-height: 520px`, scrolls internally
- positioned at `x = POS[sel].x + COLPITCH`, `y = max(PAD.y, POS[sel].y - 90)` — offset upward so a
  tall panel doesn't hang off the bottom from a low row
- enters by fading in; **follows the leaf's row when the lattice reflows** (same 380ms transform)

Contents: title, URL chip, lifecycle badge, description, an Open / Agreeing / Blocked stat row, a
_Plant feedback here_ button, proposals sorted by agreement, and a _Wired to_ list of cross-branch
connections. Clicking a connection re-opens the lattice along that node's path and selects it.

---

#### 8. Interactions

| action                              | result                                                              |
| ----------------------------------- | ------------------------------------------------------------------- |
| drag empty canvas                   | pans the viewport, with momentum on release                         |
| click row **with children**, closed | opens it; siblings at that level fold; wires draw; rows stagger in  |
| click row **with children**, open   | folds it and its entire subtree                                     |
| click row **with a URL**            | selects it; panel opens in the next column                          |
| click selected leaf again           | deselects; panel closes                                             |
| click a **Wired to** entry          | opens the lattice along that node's path, selects it, scrolls to it |
| click **Ж**                         | the core row; folds everything back to the three limbs              |

Folding must **prune recursively** — closing Hub has to remove Booth and Booth's pages from the open
set, and clear the selection if the selected leaf lived inside. Leaving orphans in the open set
causes branches to reappear unexpectedly later.

---

#### 9. Deliberately absent

- **No camera.** Zoom (§5) is a scale on a scrolling plane — layout never changes and there is no
  auto-framing. If you find yourself computing a transform _to frame a node_, you are rebuilding the
  Skeleton. That view already exists.
- **No auto-framing.** Drag, scroll and zoom are all user-driven. The view must never decide on its
  own where to look — the one exception is the gentle scroll-into-view after an open/fold (§5), which
  follows an explicit user action.
- **No curves.** Every connector is horizontal, vertical, or a fixed-radius corner.
- **No multi-branch expansion.** Tempting, and it destroys the tidiness that is this view's entire
  reason to exist.
- **No jitter, no randomness, no organic anything.** This view's virtue is that it is predictable.
- **No reverse-draw on fold.** Growth is ceremonial; retraction is not.

---

#### 10. Relationship to the Skeleton view

The two views are **the same data, the same tokens, and the same node ids** — deliberately. They
differ only in spatial model and motion language:

|                  | Skeleton                           | Lattice                                     |
| ---------------- | ---------------------------------- | ------------------------------------------- |
| space            | radial, organic, laid out once     | orthogonal grid, recomputed per state       |
| movement         | camera pans and zooms, auto-framed | content reflows; user drags, scrolls, zooms |
| connectors       | tapered filled bones, curved       | uniform strokes, right angles               |
| everything else  | always present, dimmed by distance | folded away unless open                     |
| signature timing | 720ms camera glide                 | 340ms wire draw                             |
| feels like       | being inside something             | operating something                         |

**Build them against one shared source of truth** — the same route-table/manifest-derived tree, the
same node ids, the same proposal store. A user should be able to switch views mid-task and land on
the same node. If the two views ever disagree about what exists, the bug is upstream of both.

Recommendation: ship both and let it be a preference. They serve genuinely different moods —
Skeleton for exploring and getting a feel for the shape of Kronk, Lattice for finding a specific
page quickly and filing something against it.

---

#### 11. Open questions for the real build

1. **Hub's column height.** 14 korners produce an 840px column that requires vertical scrolling at
   that level. Zoom mitigates this (fit drops to ~0.53× on a fully expanded lattice, which shows
   everything at once), but does not solve it at 100%. Options if it still grates: group korners into
   sub-limbs, paginate, or accept the scroll.
2. **Composer.** The panel's _Plant feedback here_ button is currently inert — the composer was left
   out of this prototype to keep it focused on the view model. Wire it to the same composer the
   Skeleton view uses; do not build a second one.
3. **Deep-linking.** Open/selected state should be URL-addressable
   (`/hub/kommons/skeleton?at=<node_id>`) so a proposal can link to its place in the map, and so
   switching views preserves position.
4. **Keyboard.** Not implemented. The lattice is the more natural of the two views for arrow-key
   navigation (↑↓ within a column, → to open, ← to fold) and should probably get it first.
5. **Shared route rename.** Both views currently live under `/hub/kommons/skeleton`. If they ship
   together, decide the URL structure before either goes in.

---

#### 12. Build order

1. Layout function + the two invariants as tests (no collisions, parents centred). Verify against
   the reference figures in §1.
2. Static render — rows and elbow wires, no animation, no interaction. Will already resemble the
   screenshots.
3. Open/fold state with recursive pruning, and single-branch-per-level enforcement.
4. Reflow transitions (§4). The view becomes usable here.
5. Sprout choreography (§3) — wire draw, then staggered row entry, with correct new-vs-existing
   detection.
6. Leaf panel, cross-branch jumps, scroll easing.
   6b. Zoom: plane scale, honest scroll box, anchored wheel zoom, fit, and the `tiny` detail-shedding
   threshold. Verify scroll-to still lands correctly at 0.5× and 1.5×.
   6c. Drag-to-pan with threshold, trailing-click suppression, and momentum. Test that dragging _from_
   a row does nothing and that a drag ending _on_ a row does not expand it.
7. Reduced-motion pass: all durations to 0.01ms; the state model must still be correct with every
   animation removed.

Step 5 is the design. Steps 1–4 produce a competent tree view that nobody will remember.

---

## Build tracker

_Merged into this file on 2026-10-04 from `docs/spaces/kommons_tracker.md` (since deleted); its own status notes and dates are kept as written._

Turn every remaining piece of the 2.0 build into a Kommons proposal, so the
platform tracks its own construction — and we harden Kommons by living in it.

> Status: **plan, not yet built.** Sources: the 2026-07-20 phase audit,
> the 2026-07-20 remaining-work list (both in git history), and the Kommons schema
> (`proposals`, `tasks`, `proposal_backings`, `token_*`).

### The insight: the primitives already exist

Kommons is further along than "console-only" suggests, and — crucially — **the
checklist is already a model.**

A `Proposal` already carries: `title`, `body`, `summary`, a `status` lifecycle
(`open` → `delivered` → `completed` / `annulled`), a **`node_id`** that pins it
to a Directory node, a **`categories`** tag array (GIN-indexed), a
`proposal_type` (small/medium/large), and `parent_proposal_id` for nesting.

And a `Proposal` **has many `tasks`** — each a row with a `title`,
`description`, and a `status` of `open` / `in_progress` / `done`. **That is the
checklist.** There is already an `api/v1/tasks_controller`.

So this is not "build a tracker." It is two moves: **populate the model** from
the docs, and **surface it** in the UI. And the second fit is the payoff: every
proposal's `node_id` means the **Directory already draws the count of
open proposals on each node**. Anchor the build items to nodes and the map
_becomes_ the build-status view for free — a glance shows which limb has the
most left to do.

### How the work maps onto proposals

One **proposal per theme** (a phase, a korner's UI, a track), not one per
micro-item, so the board stays readable. Inside each, the concrete steps become
**tasks** (the checklist). Fields do the organising:

- **`node_id`** — anchor to the Directory node the work lives on
  (`nudges.index`, `booth.index`, `kommons.index`…). Drives the map badges.
- **`categories`** — filter tags: `rebuild` on every tracker proposal, plus
  `phase-5`, `release`, `korner:booth`, `framework`, `settings`, so a lens can
  show one slice.
- **`tasks`** — the checklist. A proposal's progress is `done ÷ total`.
- **`proposal_type`** — small/medium/large, a rough size signal.
- **`status`** — the proposal's own lifecycle; a theme flips to `completed`
  when its tasks are done.

### The proposal set

Drawn from `phase_audit_2026-07-20.md` and `remaining_work_2026-07-20.md`.
Each row is one proposal, its anchor node, and its checklist. This is the full
backlog — the tracker's initial content.

#### ① Release track — the path to 2.0.0 (critical)

| Proposal                         | Anchor               | Tasks                                                                                                                                          |
| -------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Phase 5 — Nudges cutover**     | `nudges.index`       | remove the bell (nav); unify the Nudges UI (retire `notifications_v2`); generic korner-notification service (§5.7); fold notification prefs in |
| **Phase 14 — Release hardening** | `kronk.how_it_works` | bump `version.rb` → 2.0.0; flip `tune_in_enforced` + `SEARCH_BACKEND`; spec v0.5 → v1.0; finalise CHANGELOG; cut rebuild→main PR + DNS         |
| **Green the base CI**            | `kronk.how_it_works` | clear pre-existing lint/format/i18n offenses so release CI is clean                                                                            |

#### ② Feature gaps — backend shipped, piece missing

| Proposal                                | Anchor            | Tasks                                                                                                          |
| --------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------- |
| **10.1 — Real Kosmic feed projection**  | `inflow.index`    | build `Inflow::PublishKosmicUpdate`; scheduler creates a Status, not just a row; retire the client-side banner |
| **8.3 — Kuestions card from the model** | `kuestions.index` | render the feed card off the `Question` model, not `post_type`; make `status_association` optional             |
| **7.5 — group_moderation_events**       | `groups.index`    | create the table, or drop it from the plan                                                                     |
| **3.3 — Adopt hub_path in links**       | `hub.landing`     | `Kronk::Url.hub_path` has no callers; sweep mailers + share-links onto it                                      |

#### ③ Framework gaps — the korner platform

| Proposal                                                              | Anchor               | Tasks                                                                                                                                                                      |
| --------------------------------------------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Launch card producer (§8.7)**                                       | `kronk.how_it_works` | declared in 10 manifests, parsed, but nothing emits it — build the producer/service                                                                                        |
| **Korner tombstones / 410 Gone (§5.6)**                               | `kronk.how_it_works` | `deleted_at` + 410 resolution for korner objects, not just AP Statuses                                                                                                     |
| **Complete "every space gets a manifest"**                            | `kronk.how_it_works` | core-space manifests done; finish node-ownership migration off `kronk_nodes.yaml`                                                                                          |
| ~~**L7 stylelint-governance doctor check**~~ — **closed, don't seed** | `kronk.how_it_works` | Shipped: `detect_conformance_issues` gates L7 (korner-owned SCSS must be in the stylelint governance list). Doctor coverage is now L1/L2/L3/L4/L5/L6/L7/L10 + L11 warnings |
| **Make `render_target` live (§9.1)**                                  | `kronk.how_it_works` | inert today; app-shell path unbuilt — also open decision §13.2                                                                                                             |

#### ④ Per-korner UI — backend shipped, surface unbuilt

| Proposal                       | Anchor            | Tasks                                                                                                                               |
| ------------------------------ | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Groups → Krew**              | `groups.index`    | audience-scoping (the central promise); Krew badge; listed/unlisted + invite links; Event↔Krew; the `groups→krew` vocab/URL rename |
| **Wachuneed UI**               | `wachuneed.index` | listing detail + composer; the 5 interaction modes; "or trade" flag; mate-affinity signals                                          |
| **Kommons backing / token UI** | `kommons.index`   | backing is console-only; token display glyph; "reflect on this page" button                                                         |
| **Kuestions UI**               | `kuestions.index` | swipe deck; answer-format field; daily-prompt post-box; answer edit history                                                         |
| **Kalendar**                   | `kalendar.index`  | birthdays; event visibility scopes; Krew-spawn-from-event; playful RSVP labels; spiral view                                         |
| **Huddle**                     | `huddle.index`    | Main + per-Krew Huddle model; flat moderation; capacity cap                                                                         |
| **Booth**                      | `booth.index`     | `kind` taxonomy; BoothSeries; save/library + live listener count; storage migration                                                 |
| **Inflow**                     | `inflow.index`    | unified dashboard (retire 4 strand tabs); observations response UI; Kosmic subscribe toggle                                         |

#### ⑤ Settings retirement — blocks killing classic `/settings`

| Proposal                                   | Anchor             | Tasks                                                                                                         |
| ------------------------------------------ | ------------------ | ------------------------------------------------------------------------------------------------------------- |
| **Account & Security rehome**              | `settings.account` | 2FA, sessions, apps, migration, delete, export/import — still classic-only, must move to SPA                  |
| **Notifications → Nudges** (decided 07-20) | `nudges.index`     | fold notification prefs into Nudges; retire the standalone Notifications page + `settings.notifications` node |
| **Privacy → Profile** (decided 07-20)      | `profile.edit`     | fold Privacy into "Me"; retire `settings.privacy` node                                                        |
| **Profile composer completeness**          | `profile.edit`     | can't yet edit avatar/header/display-name but advertises `lifecycle: live`                                    |

#### ⑥ Quick correctness fixes (Tier 0) — one proposal, a task each

Anchor `kronk.how_it_works`:

- `settings.account` / `settings.data` nav nodes lead nowhere (URLs, no route)
- `default_quote_policy` absent from the posting-settings API
- dead `features/market` "Coming Soon" placeholder
- `fetch_link_card` allow-list uses legacy korner paths, not `/hub/<slug>`
- dead `interactions.must_be_follower/following` settings keys
- Wachuneed `subcategory` column removal (doc says retired; still persists)

### Kommons building Kommons

The loop: putting the backlog _into_ Kommons immediately surfaces what Kommons
needs to be usable — and each becomes its own tracked proposal, anchored to
`kommons.index`. The data is there; these are the surfaces.

- **Task checklist on the proposal page** — render `proposal.tasks` as a
  checkable list; toggling a task hits `tasks_controller`. The single
  highest-value piece: without it, the checklists are invisible.
- **Progress on the card + the map** — a proposal card shows `done ÷ total`;
  the Directory node badge (already drawing open-proposal counts) reads
  the same, so the map shows build progress.
- **Browse by node and by category** — a node's detail lists its proposals
  ("what's left here"); a `category: rebuild` lens is the whole board. Both are
  query filters on data that already exists.
- **Backing / token UI** — surface the token ledger + backing that's
  console-only today, so we can weight what to build next by backing proposals.

None of these need new tables — they render `tasks`, `categories`, `node_id`,
and the token models that already ship. The act of loading the tracker _is_ the
spec for the next Kommons UI proposals.

### How the proposals get created

~30 proposals and ~90 tasks — too many to hand-type well, and we want them
reproducible.

- **Source of truth = a data file in the repo** — a `config/kommons_tracker.yaml`
  (or seed) listing each proposal: title, body, node, categories, type, and its
  tasks. Version-controlled, reviewable, and the tracker can be re-synced from it.
- **An idempotent seeder** — a rails task that upserts proposals + tasks from
  that file (keyed by a stable slug in `categories` or the title), run on
  shadow's rebuild DB. Safe to re-run as the backlog shifts.
- **A handful via the composer** — deliberately create two or three through the
  actual UI first, to dogfood the compose flow before bulk-seeding the rest.

Change the YAML, re-seed, the tracker updates — and the file doubles as a
human-readable backlog in the repo.

### Sequence

1. **Make the tracker viewable.** Build the task-checklist on the proposal page
   - node/category filtering (minus backing). Small, and everything else depends
     on being able to _see_ it.
2. **Author & seed the backlog.** Write `kommons_tracker.yaml` from this plan,
   create 2–3 via the composer, seed the rest. Now the Directory shows
   live build progress.
3. **Use it, and let it drive the next round.** Work items off it, tick tasks,
   and file the friction (backing UI, sorting, whatever's missing) as fresh
   Kommons proposals. Kommons hardens by carrying its own build.

### Decisions (resolved 2026-07-20)

1. **Granularity** — one proposal per theme, its steps as a task-checklist
   (~30 proposals).
2. **Anchor to the map** — yes; each proposal pins to a Directory `node_id`, so
   the Directory node badges read as live build status.
3. **Order** — **seed first.** The map lights up with build-status badges the
   moment the proposals land (the badges already render); the task-checklist UI
   follows so the checklists themselves become visible.
4. **Open decisions** — tracked as their own `decision`-category proposals on
   the board, so blockers stay visible.

Implemented as `config/kommons_tracker.yaml` (the backlog, source of truth) plus
`bin/rails kommons:tracker:seed` (idempotent, keyed on proposal title). Every
theme hangs off one root proposal, `Kronk rebuild — build tracker`, via
`parent_proposal` — so the board is `root.child_proposals` and each theme still
anchors to its own `node_id`. (Track/phase tags live in the proposal body, not
the `categories` column, which is a validated legacy taxonomy slated for
retirement.) Run on shadow's rebuild DB with `ACCOUNT=<username>`.

The reverse direction ships too: `lib/tasks/kommons_proposals.rake` exports the
live proposal list (title, status, backing totals, task progress, seeder handle)
via `bin/rails kommons:proposals:export DEST=<dir>` — a read-only snapshot of the
tracker as it actually stands.
