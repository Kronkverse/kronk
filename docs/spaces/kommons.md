# Kommons (`kommons`, rendered ₭ommons)

**Manifest:** `config/korners/kommons.yaml` · **Mount:** `/hub/kommons`

Kommons is where Kronk is decided in the open. It has two jobs:

- **Show how Kronk fits together.** The Directory is a map of every space a
  user can reach.
- **Let people shape it.** Anyone can open a proposal about a space, back it
  with Koin (₭), add design docs and comment. When the work is built and the
  proposer signs it off, backers get their Koin back and the author is paid.

Kommons is Kronk-wide only. There is no Krew-scoped Kommons; a Krew
coordinates in its own posts and Huddle.

This doc describes what is built as of 2026-10-05. Earlier designs are in git
history (see [History](#history)).

## The space

The Kommons page is a rotator over five faces, declared as `views:` in the
manifest and matched by URL segment in `features/kommons/index.tsx`:

| Face          | URL                     | Shows                                                     |
| ------------- | ----------------------- | --------------------------------------------------------- |
| **Directory** | `/hub/kommons`          | The Lattice map (default face)                            |
| **Open**      | `/hub/kommons/open`     | Open proposals                                            |
| **Involved**  | `/hub/kommons/involved` | Proposals you backed, commented on or (legacy) voted on   |
| **Drafts**    | `/hub/kommons/drafts`   | Always empty: drafts are not modelled (see [Open](#open)) |
| **Closed**    | `/hub/kommons/closed`   | Closed proposals                                          |

Lists sort by **most backed** (default) or **newest**, 40 per page. On the
default list, your own actioned proposals are pinned to the top so a
proposal waiting for your sign-off never gets lost. Annulled proposals have no
face but are reachable with `?filter=annulled`.

Other routes (all in `features/ui/index.jsx`, signed-in only):

- `/hub/kommons/p/:id`: one proposal ([Proposal page](#proposal-page)).
- `/hub/kommons/space/:slug`: a **Space page**. What a korner or pillar is
  for, and every proposal about it (any node `<slug>` or `<slug>.*`).
- `/hub/kommons/node/:nodeId`: a **node page**. The proposals about one page,
  and a button to propose about it.
- `/hub/kommons/pick`: the target picker (the Lattice in `pick` mode). This
  is the manifest `compose.route`, so the Ж menu's "Open a Proposal" lands here.
- `/hub/kommons/composer` (and the older `/hub/kommons/propose`): the
  composer overlay. It takes `?node=<id>`, `?space=<slug>` or
  `?kind=new_korner`. Steps you add become tasks; staged files upload as
  attachments.
- `/hub/kommons/settings`: per-user settings (below).
- Redirects: `/governance` and `/governance/*` → `/hub/kommons` (Rails,
  301); `/hub/kommons/tree` → `/hub/kommons/lattice` (Rails);
  `/hub/kommons/lattice` and `/hub/kommons/skeleton` → `/hub/kommons` (SPA).

**Settings** (manifest `settings:`): `preferred_proposal_types` filters the
board lists by size (small/medium/large; not applied on node or Space pages),
and `notify_on_status_change` (off by default) nudges you when a proposal you
backed completes or is annulled.

**Feed:** creating a proposal also posts a Status (`post_type: proposal`,
`source_korner: kommons`, the author's default visibility). It renders as
`kommons_card` (`components/status_kommons_card.tsx`).

**Search:** proposals are indexed as `kommons_proposals` (`Proposal` includes
`Searchable`).

## The Directory

The Directory is the map of Kronk. The Lattice draws it (see
[Lattice](#lattice)).

- **`Kronk::NodeRegistry`** (`app/lib/kronk/node_registry.rb`) loads nodes
  from `config/kronk_nodes.yaml` (cross-cutting pages) and from each korner
  manifest's `nodes:` block.
- **Seven buckets:** `feed profile hub nudges settings kronk search`
  (`NodeRegistry::BUCKETS`). A node with any other bucket is dropped at boot
  with a warning. The frontend's `LIMBS` (`kommons_tree/data/layout.ts`) must
  match; a test asserts it.
- **A node's `id` is stable** and independent of its URL. Proposals key on it
  (`proposals.node_id`), so they follow a page across URL changes.
  `Proposal#node_id_registered` rejects an id the registry doesn't know.
- **API:** `GET /api/v1/kommons/nodes` serves the nodes with their open
  proposal counts.
- **`kommons_tree/data/layout.ts`** builds the tree from the nodes: the core
  (Ӂ), the seven limbs, Hub's korners under Hub. Search, Settings and Kronk
  hang to the left of the core; the rest to the right.
- **Drift check:** `bin/tootctl korners doctor` checks manifests, including
  their nodes.

### What earns a node

The Directory is how you navigate the spaces of Kronk, and every end node is a
page you can make a proposal about. That gives one rule and two consequences.

- **One node per space a user can reach.** If someone can get to it, it must
  be on the tree. Otherwise there is no way to propose a change to it.
- **A view is not a space.** A korner with `views:` gets one node, not one per
  face. A proposal about Kommunity's Discover view is a proposal about
  Kommunity. (`kommunity.discover`, `kommons.directory`, `kommons.propose`
  and `kommons.new_korner` were removed on this rule.)
- **A settings page belongs to the `settings` bucket**, even when its URL sits
  under a korner (`settings.hub` at `/hub/settings`, `settings.moments` at
  `/hub/moments/settings`).

When a node is removed, its proposals must be moved, not orphaned:
`node_id` is a plain string, so nothing stops a dangling one. Migration
`ReanchorProposalsToSpaceNodes` did this for the removals above, and
`bin/rails kommons:proposals:remap_stale_nodes` (with `DRY_RUN=1`) does it on
demand.

## Proposals

**Model:** `Proposal` (`app/models/proposal.rb`), tables under the
`proposal_` namespace:

- `proposals`: `title`, `body`, `summary`, `status`, `proposal_type`
  (small/medium/large), `node_id`, `parent_proposal_id` (nesting),
  `status_id` (the feed Status, Ruby association `discussion`),
  `created_by_account_id`.
- `tasks`: a proposal's steps. Each has a `status` of open, in progress or
  done, and an optional assignee.
- `proposal_backings`, `proposal_attachments` (mockup / brief / reference,
  15 MB max, any signed-in user can attach; only the uploader can remove),
  `proposal_comments` (one level of threading).
- `proposal_votes` with `challenge_conditions` / `challenge_responses`:
  legacy, see [Votes are retired](#votes-are-retired).

Who can do what:

- **Edit a proposal, add or change its tasks:** the proposer, or a steward
  (a role with `administrator` or `manage_reports`).
- **Back, comment, attach:** any signed-in user.

### Lifecycle

`Proposal.status` has five states:

- **open:** accepting backing. Nobody is on it yet.
- **claimed:** a dev has claimed it (`claimed_by_account`). Still on the board
  and still accepting backing. The claimant can unclaim it back to open.
- **actioned:** the work is built. Backing closes. The proposer is notified
  and is the only person who can move it on.
- **closed:** the proposer confirmed it. Backers are refunded and the author is
  paid. Terminal.
- **annulled:** released without the work. Backers are refunded, the author is
  paid nothing. Terminal.

```
open ──anyone claims──> claimed ──claimant──> actioned ──proposer──> closed   refund + payout
 │  <──claimant unclaims──┘ │
 │                         │
 └──dev──> annulled <──dev─┘                                            refund, no payout
```

`open` can also go straight to actioned from the back end (the shell, or a
steward's last-task tick), with no claim. `Kronk::ProposalStates`
(`app/lib/kronk/proposal_states.rb`) is the only sanctioned way to change
state: `claim!`, `unclaim!`, `action!`, `close!`, `annul!`, `backable?`.

The integers are unchanged from before the 2026-10-07 rename: 3 was
`delivered` and 5 `completed`. The API still accepts `filter=delivered` /
`completed` and `POST /complete`, and `tootctl kommons deliver` still works,
for anything cached or scripted before the rename.

How each transition happens:

- **Claim:** any signed-in member, proposer included, with the Claim button on
  the proposal page (`POST /api/v1/proposals/:id/claim`). One claimant at a
  time. Nudges the proposer (`kommons.proposal.claimed`, directed, so no Mate
  gate).
- **Unclaim:** the claimant only (`POST /api/v1/proposals/:id/unclaim`).
  Back to open, claim cleared.
- **Action:** the claimant, with **Mark actioned** once their work has merged
  to `main` (`POST /api/v1/proposals/:id/action`), but **never the proposer**,
  even when they claimed it themselves. Also `tootctl kommons action <id>` from
  a server shell, **or** automatically when a steward (not the proposer) marks
  the last open task done (`TasksController#action_proposal_if_work_complete`).
- **Close:** the proposer, in the app (`POST /api/v1/proposals/:id/close`, the
  "Close proposal" button), with optional outcome notes, which are saved.
- **Annul:** `tootctl kommons annul <id>` only. There is no in-app annul.

**There is no actioned → annulled edge.** Once actioned, the only way out is
the proposer closing it. A problem found afterwards is a new proposal.

Notifications: every transition from actioned on notifies the proposer
(`proposal_status_changed`). Closed and annulled also publish
`kommons.proposal.closed` / `.annulled` on the korner event bus, which
notifies backers who opted in (`config/initializers/nudges_event_bus.rb`).

`vetoed` and `in_progress` were retired (migration `CollapseProposalStates`
remapped them to open). `vetoed` was only ever a cached "has a block vote"
flag; `in_progress` had no producer.

### Dev workflow (v0)

> **Status:** built (2026-10-07): the `claimed` state, Claim/Unclaim, the
> rename (`delivered` → `actioned`, `completed` → `closed`) and Mark actioned
> in the app. The mechanics are in [Lifecycle](#lifecycle) above.

The workflow for building a proposal:

1. **Read it as a member.** Ask anything unclear in the proposal's comments.
2. **Claim it** so the proposer and other devs know you're on it.
3. **Build it.** Branch off `shadow`, PR, merge, check it on shadow, mark the
   PR ready to ship.
4. **Mark it actioned** once it's merged and released to `main`. The proposer
   is asked to close it.
5. **The proposer closes it,** which returns backers' stakes and pays the
   author.

**Clarity before claiming is the culture.** A dev reading an open proposal
engages first as a regular Kronk user — a comment on the proposal thread
asking anything unclear before claiming. This keeps the proposer accountable
for the shape of their proposal and avoids claim/unclaim churn.

**Mirror export:** `kommons:proposals:export` carries `claimed_by` (the
claimant's username) in `proposals.json`, and `proposals.md` lists claimed
proposals in their own group with "claimed by @…".

**Deliberately deferred for v1:**

- Auto-wiring a merged PR to flip the proposal to `actioned` — needs a
  parseable PR-body convention plus a Kronk-side webhook endpoint.
- Unhappy-proposer path, likely via `parent_proposal_id` child proposals.
- Duplicate-proposal dedup.
- Clarity-coaching mechanisms on the composer side.

### Anti-gaming

Without a third party in the loop, someone could propose something trivial,
get a friend to back it, mark it done and collect the payout. So actioning is
never the proposer's: it comes from the claimant (who can't be the proposer),
a shell, or a steward ticking the last task. That is why the auto-action
deliberately does nothing when the proposer ticks their own last task, and why
a proposer who claims their own proposal needs a steward to action it.

This doesn't stop a proposer's friend claiming and actioning. What limits
that is the payout: a tenth of the total backed, with stakes returned, and
everyone starts with ₭10. A pair gaming it between them earns ₭1–2 a round,
and anyone can see who claimed and actioned it.

### Koin and backing

The currency is **Koin**, shown as **₭** before amounts (`₭3 staked`). Code
and tables say `token_*`.

- **Everyone starts with ₭10** (`TokenBalance::STARTING_BALANCE`), granted on
  account creation and backfilled for older accounts.
- **Backing** stakes any amount from 1 up to your balance on an open proposal
  (`POST /api/v1/proposals/:id/back`). You can top up; each top-up is its own
  row. There is no un-back.
- **Stakes come back** in full when the proposal completes or is annulled.
- **The author is paid** on completion, from a Kronk pool, not from the
  backers: `max(1, floor(total_backed / 10))`. ₭80 backed pays ₭8.

Why Koin instead of a count: it is scarce, so backing means choosing. A stake
is a commitment, not a click.

**Ledger:**

- `TokenBalance`: one row per account, stored. `#reconciles?` checks it
  against the sum of its transactions.
- `TokenTransaction`: append-only, signed amounts, kinds `grant`, `backing`,
  `refund`, `payout`.
- `ProposalBacking`: one row per stake.
- `Kronk::Tokens` (`app/lib/kronk/tokens.rb`) is the only mutation path. It
  row-locks the balance and writes the change and its transaction together,
  so concurrent backings can't overspend. `refund_all!` and `pay_author!` are
  idempotent.
- `GET /api/v1/token_balance` returns your balance. The UI shows it in
  `KoinWallet` / `KoinGlance` (`features/kommons/components/`).

`token_balances` and `token_transactions` are platform-level tables, not
`proposal_*`, because a balance isn't Kommons-specific.

Backing publishes `kommons.proposal.backed`, which Nudges routes to the author
(`config/korners/nudges.yaml` `listens:`). Comments
(`kommons.proposal.commented`) and froths on the feed Status
(`kommons.proposal.frothed`) route the same way.

### Votes are retired

Support is backing. The agree / abstain / block votes are gone from the UI.
The API still has `POST /vote` and `DELETE /unvote`: a block vote records
`ChallengeCondition` rows and sends `proposal_challenged`, and votes still
count toward the Involved face. Nothing in the app calls them (see
[Open](#open)).

## Proposal page

`/hub/kommons/p/:id` (`proposal_page.tsx` wrapping
`components/proposal_detail.tsx`) is one scroll, no tabs. It replaced the old
Seed / Kontribute tabs, which hid a proposal's progress one tab away. In
order:

1. **Hero:** status pill, size, title, summary, proposer, and a chip linking
   to the node page. Edit (proposer or steward); **Claim** / **Unclaim**;
   **Mark actioned** (claimant); and, when actioned, **Close proposal**
   (proposer).
2. **Support** (`proposal_backing.tsx`): total ₭ backed, backer count,
   `#N most-backed`, your stake, and **Back this** with your balance. Shows
   "Backing is closed" once the proposal leaves open.
3. **Steps** (`proposal_steps.tsx`): `N of M done` with a progress bar. The
   proposer or a steward can tick a step done or untick it.
4. **Description:** the body.
5. **Design docs** (`proposal_attachments.tsx`).
6. **Comments** (`proposal_comments.tsx`): threaded, one level.

Colours come from `tokens.yaml`, including the `decision-*` tokens
(`decision-agree` for done steps). Both themes are first-class.

## Lattice

The Lattice is the Directory's view
(`app/javascript/mastodon/features/kommons_lattice/`). It reads the tree from
`kommons_tree/data/`. The old radial Skeleton view is gone.

> **Structure is fixed and orthogonal. Branches sprout on demand and fold
> away when you leave them.**

Two rules, and the view degrades into a normal tree widget without them:

- **Only one branch is open per level.** Opening a sibling folds the current
  one with its whole subtree.
- **Growth is drawn, not revealed.** New wires draw themselves and rows arrive
  at their ends.

The section numbers below are cited from code comments.

### 1. Layout

`layoutLattice` (`data/layout.ts`) is a tidy tree over the visible subtree,
recomputed on every open or fold. Leaves stack one pitch apart; a parent sits
at the midpoint of its first and last child.

|              | Desktop (`DEFAULT_METRICS`) | Phone ≤640px (`COMPACT_METRICS`) |
| ------------ | --------------------------- | -------------------------------- |
| row height   | 40                          | 56                               |
| row pitch    | 56                          | 72                               |
| column width | 214                         | 56 (icon only)                   |
| column pitch | 290                         | 100                              |
| plane pad    | 40 × 40                     | 20 × 24                          |

- **Two sides.** Limbs in `LEFT_LIMBS` (search, settings, kronk) grow left of
  the core, the rest right. The two stacks are centred against each other.
- **Hub split.** At 15 or more korners (`HUB_SPLIT_THRESHOLD`), Hub's kids
  split alphabetically into two columns (depth +1 and +2). Hub sits **below**
  the block and its wires rise up a shared trunk between the columns. Hub
  returns the block midpoint to its parent so the core stays level.
- **Invariants** (`data/layout.test.ts`): no two rows in a column collide, and
  every parent is centred on its visible children. The test pins reference
  figures on a fixed 14-korner tree: 4 rows at boot; Hub open → 18 rows, Hub
  at y 476, korners 112–840; Hub + Booth → 24 rows over 4 columns.

### 2. Wires

SVG paths, stroked, uniform width (`data/wires.ts`). Each is an orthogonal
elbow from the parent's right edge to the child's left edge, turning in the
middle of the column gap, corner radius `min(11, |dy|/2, COL_GAP × 0.4)`. A
near-flat wire is a straight line. In the Hub split, every Hub wire runs
through the trunk at the middle of the gap between the two columns.

Default stroke is muted at 1.5px; wires on the open path are
`kronk-purple-bright` at 2px.

### 3. Sprouting

Only genuinely new nodes animate; existing ones reflow (§4). Getting this
wrong makes the whole map flicker on every click.

- A new wire draws itself over **340ms** (`stroke-dashoffset` animation).
- New rows fade in over **260ms**, staggered `min(i × 26, 340)ms`.
- Folding is quick: rows fade and go. No reverse-draw.

### 4. Reflow

Existing rows glide to their new place over **380ms** using `transform`, never
`left`/`top`. Reflow (380) ≈ wire draw (340) > row fade (260), so the change
reads as one motion.

### 5. Scrolling, zoom and pan

There is no camera. The plane is an ordinary scrolling container.

- **Zoom is a scale on the plane**, range 0.38–1.6. The plane's box is sized
  `content × zoom` so the scrollbars stay honest.
- **Auto-fit:** when the tree overflows the viewport, zoom shrinks to fit. It
  never zooms in past what the user chose.
- **Wheel zoom** only on ctrl/⌘ + wheel, anchored on the cursor, no
  transition. A bare wheel scrolls.
- **Pinch zoom** on touch, anchored on the pinch midpoint.
- **Buttons:** − and +, bottom right, with a 220ms transition.
- **Detail shedding:** below 0.62 labels fade, so a zoomed-out map reads as
  shape.
- **Drag to pan:** left button on empty canvas only, 4px dead zone, sets
  `scrollLeft` / `scrollTop` directly. A drag that ends on a row doesn't click
  it.
- **Focus after a click:** the view eases so the clicked node and its newly
  shown kids are centred. When Hub opens, Hub itself is left out of the box so
  the korners are what you see.

### 6. Rows

A fixed-size pill: icon, name (a hover label in compact mode), open-proposal
count if non-zero (a branch shows the sum of its subtree), and a chevron that rotates 90° when open. The chevron is what
tells you a row is a branch, not a destination. States (default, hover, open,
on path, core) are in `_kommons_lattice.scss`.

### 7. Reduced motion

Under `prefers-reduced-motion` every duration drops to 0.01ms. The state model
must stay correct with all animation removed.

### 8. Clicking a node

Open/fold state is `data/state.ts`: `toggleBranch` enforces one branch per
level and prunes recursively, so a closed branch leaves no orphans to reappear
later. Clicking the core folds everything back to the limbs.

What a click does (`handleClick` in `components/lattice.tsx`):

| Node                                     | Browse                                | Pick mode                |
| ---------------------------------------- | ------------------------------------- | ------------------------ |
| Aggregator limb (Hub, Kronk)             | Toggles open; closing steps back out  | Same                     |
| Korner or space pillar (Feed, Nudges, …) | Space page `/hub/kommons/space/:slug` | Composer `?space=<slug>` |
| Page with a URL                          | Node page `/hub/kommons/node/:id`     | Composer `?node=<id>`    |
| Anything else with kids                  | Toggles open                          | Same                     |

The tree is a governance surface, not a launcher: it never jumps straight to
the product page. There is no panel inside the map; proposing happens on the
node or Space page, where you can read what has already been said.

### 9. Deliberately absent

- **No camera, no auto-framing** beyond the ease after a click.
- **No curves.** Every wire is horizontal, vertical or a fixed-radius corner.
- **No multi-branch expansion.** It destroys the tidiness that is the point.
- **No randomness.** The view's virtue is that it is predictable.
- **No reverse-draw on fold.**

## Build tracker

`config/kommons_tracker.yaml` plus `bin/rails kommons:tracker:seed`
(`lib/tasks/kommons_tracker.rake`) seed a set of proposals with task
checklists, all children of one root proposal, "Kronk rebuild — build
tracker". The seeder is idempotent, keyed on title. Run it with
`ACCOUNT=<username>`, and `DRY=1` to preview. Track tags go in the body, not
`categories`.

**The YAML is the pre-2.0 backlog** (from the 2026-07-20 phase audit) and has
not been updated since. Much of it shipped with 2.0, and two anchors
(`groups.index`, `profile.edit`) are no longer registered nodes, so those
entries would fail validation. See [Open](#open).

**Exports** for the mainframe shared folder:

- `bin/rails kommons:proposals:export DEST=<dir>` writes `proposals.md` and
  `proposals.json` (title, status, backing, task progress, proposer handle).
- `bin/rails kommons:attachments:export DEST=<dir>` writes each proposal's
  attachments to `DEST/<proposal>/<filename>`.
- `tootctl kommons show <id>` and `tootctl kommons attachments <id> [--dump DIR]`
  inspect one proposal from a shell.

## Open

- **Build tracker is stale.** Either rewrite `config/kommons_tracker.yaml` as
  the post-2.0 backlog (and fix the `groups.index` / `profile.edit` anchors)
  or retire it and its seeder.
- **Drafts** are not modelled. The Drafts face always shows "Drafts land here
  once the writer stage ships."
- **Votes API.** `vote` / `unvote`, `ChallengeCondition`, `ChallengeResponse`
  and the `proposal_challenged` notification have no caller in the app.
  Decide whether challenges come back (as comments?) or the endpoints go.
- **Parameterised routes** (`/hub/kuestions/:id`, `/@:user`) are registered
  nodes but left out of the drawn tree (`url.includes(':')` in
  `kommons_tree/data/layout.ts`). They are real proposal targets with no way
  to reach them from the map. Either make them reachable or stop making them
  nodes.
- **Legacy columns** due for a cleanup migration: `categories` (with
  `CATEGORY_VALUES` and its validator; `node_id` replaced it),
  `discussion_status_id` (dual-written with `status_id`), and unused
  `archived_at`, `decision_type`, `closes_at`, `outcome`.
- **Koin economy.** ₭10 at signup and no other income than completion
  payouts. If backing is the only support signal, liquidity may be too tight
  to feel usable.
- **"Reflect on this page" button.** A quiet, always-present corner button
  that opens a proposal about the current page. Not built.
- **Feed triggers.** Proposals reach the feed only as their own post.
  Undecided: should a Mate raising or backing a proposal, or a wave of
  proposals on a node, show up?
- **Limb labels.** The seven limb names are hardcoded (`LIMB_LABEL` in
  `kommons_tree/data/layout.ts`) rather than read from the manifests. Icons
  already come from the manifests.
- **Keyboard navigation** of the Lattice (↑↓ within a column, → open, ← fold)
  and pan momentum are not built.
- **Deep links into the map.** Open/selected state isn't in the URL, so a
  proposal can't link to its place in the tree.
- **Dead CSS.** `.lattice-panel` styles remain for the retired in-map panel.
- **Manifest copy.** `notify_on_status_change`'s description still mentions
  "gets vetoed".
- **User-designed spaces** (long term): a proposal for a new korner that
  Kommons carries from idea to prototype to shipped. Only the composer's
  `?kind=new_korner` entry exists.

## History

Rewritten 2026-10-05 to describe what is built. Earlier designs and notes
(including the full Lattice motion spec and the Skeleton comparison):
`git show 231cca937a00bf7bdbee9db6f25b6cbc541a8565:docs/spaces/kommons.md`
