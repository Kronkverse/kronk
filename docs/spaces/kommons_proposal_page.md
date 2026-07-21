# Kommons proposal page — build spec

**Surface:** a single proposal, at `/hub/kommons/p/:id` · **Replaces:** the
tabbed `ProposalDetail` (Seed / Kontribute tabs) · **Status:** spec — mockup
locked, build pending.

> **Companion:** [`kommons.md`](./kommons.md) (the space),
> [`../kronk_aesthetic_system.md`](../kronk_aesthetic_system.md) (the tokens this
> page is built from). Interactive reference mockup rendered from this spec;
> colours are snapped to `app/javascript/mastodon/tokens/tokens.yaml`.

## Why this exists

The current proposal view (`app/javascript/mastodon/features/governance/components/proposal_detail.tsx`)
splits the proposal across two tabs — **Seed** (body, votes, backing) and
**Kontribute** (tasks, budget). That buries the two things a reader most wants:
what's being proposed, and **how far along it is**. A proposal's steps (its
`tasks`) — the checklist that tells you what's done and what's left — sit one
tab away, so a glance at a proposal tells you almost nothing about its progress.

This spec replaces the tabs with **one scroll**, and pulls the **steps
checklist to the front** as the page's centrepiece.

## Layout — one scroll, in order

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
3. **Action bar** — `Support` / `Question` / `Challenge`, each with its live
   count, in a raised card. These map to the existing `ProposalVote` positions.
4. **Steps** _(the centrepiece)_ — a card titled `Steps · N of M done` with a
   **progress bar** and the checklist. Each row: a checkbox, the step text, and a
   state tag (`Done` / `In progress` / To-do). This is `proposal.tasks` surfaced
   directly — no longer inside a Kontribute tab.
5. **Description** — the proposal body (the "why").
6. **Design docs** — `proposal_attachments` as thumbnail cards (kind + size),
   with an inline `＋ Attach a doc` tile.
7. **Backing** — the `₭` token stake: amount, backer count, a one-line
   explanation, and a `Back this` button.
8. **Discussion** — the comment thread, with an inline reply box.

## Design tokens

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

## What's built vs. what this needs

The spec assumes surfaces in three states — build accordingly, don't fake the
gaps:

- **Ready now** — title, summary (now settable), status, votes, and **steps**
  (`tasks`, open→in_progress→done) all have live APIs. The steps checklist and
  the hero can be built against real data today; the reader can tick a task via
  the existing `tasks_controller`.
- **Backing UI is the last mile** — the token ledger + `back!` service ship
  (`kommons.md`), but backing has no UI yet (console-only). This page is where
  it lands.
- **Discussion is a future model** — there is **no** proposal-comments model
  today (the current "Discussion" list is really the vote-responses). A
  dedicated proposal-comments model + API is a prerequisite for the Discussion
  section; until it ships, that section renders the reply thread on the
  proposal's discussion `Status`, or is omitted — do not stub a fake comments
  store.

## Build order

1. Hero + one-scroll shell (retire the Seed/Kontribute tabs).
2. Steps checklist with progress + done-count, wired to `tasks`.
3. Action bar (votes) + design-doc cards (both already have APIs).
4. Backing UI.
5. Discussion — after the comments model exists.
