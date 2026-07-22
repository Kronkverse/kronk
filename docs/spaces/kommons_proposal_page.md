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

Build accordingly, don't fake the gaps:

- **Shipped** — the one-scroll shell (tabs retired), the hero, the steps
  checklist (`tasks`), design-doc cards, and the **support/backing panel** (the
  `backing` payload + `POST /back` were already live; the panel surfaces them).
  Votes have been **removed** from the page.
- **Comments are a future model** — there is **no** proposal-comments model
  today (the old "Discussion" was really the vote-responses, now retired). A
  **dedicated `proposal_comments` model + API + threaded UI** is the next build
  — do not stub a fake comments store or reuse the vote-responses.
- **Economy caveat** — ₭ is tight (10 at signup, no recurring income, earned
  only via completion payouts). If backing is the only support signal, token
  liquidity may need revisiting for the model to feel usable — flagged, not yet
  decided.

## Build order

1. ✅ Hero + one-scroll shell (retire the Seed/Kontribute tabs).
2. ✅ Steps checklist with progress + done-count, wired to `tasks`.
3. ✅ Hero restyle (mockup) + design-doc cards.
4. ✅ Support = backing panel (primary action); **votes retired**.
5. **Comments** — build the `proposal_comments` model + API + threaded UI.
