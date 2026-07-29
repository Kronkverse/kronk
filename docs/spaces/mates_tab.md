# Mates tab (`/@user/mates`)

**Location:** profile sub-route · **Status:** live (bundled data) — endpoint + polish pending

> The subject's community drawn as a chronological line rather than an
> alphabetical list. Their own membership runs from join date to today
> as a weighted track; mates sit above the line at bond date, invitees
> below at their join date, and the inviter sits at the head of the
> line. Clicking any tile makes that member the new subject.

## Design source

`KRONK_KOMMUNITY.md` attached to Kommons proposal "Mates"
(#116990859270976043). The doc filename is misleading — its content
describes what in-app becomes the **Mates tab**, not the Kommunity
korner (which is the whole-graph orb). See
`reference_kronk_vocab_kommunity_mates.md` in Claude memory.

## What this pass ships

- Main **line + two rows + inviter head** — track from subject.joined_at
  → today with rounded caps, head tile at the leftmost cap, mate tiles
  above at bond dates, invitee tiles below at their own join dates,
  inviter tile linked to the head via a cubic curve.
- **Branches** — every base-row tile carries a **pip** (small circle
  on the outer edge) with a glyph that hints at what opens: **`↑`**
  above the line opens the mate's/inviter's full invite chain in one
  action; a **number** below the line opens one generation of that
  invitee's own invitees (each of those can then be opened in turn).
  Cascade-close on the downward side. Merging: shared ancestors
  render once with a link arriving from each descendant; layer position
  is longest-path-from-base per the brief.
- **Sub-lane packing** — when two tiles on the same row/layer would
  collide horizontally, the later one drops into the next sub-lane
  (offset outward from the line). Applied to base mates row, base
  invitees row, and every non-base branch layer. Branch layers stack
  above/below the max base-row sub-lane so a fully-packed base row
  and a deep branch never share pixels.
- **Subject switching** — clicking any tile (not its pip) makes that
  member the subject; the view rebuilds and every opened branch
  closes.
- **Hover tooltip** on tiles — display name, handle, bond/join date,
  click-hint.
- **Viewer reference marker** — a dashed vertical line at the viewer's
  join date, drawn across the whole SVG so it stays visible while the
  subject changes. Only shown when subject ≠ viewer.
- **Return-to-my-line button** in the subject bar.
- **Contacts rail** — right-hand list of the subject's mates +
  invitees, newest first, with Both / Mates / Invited filters.
- **Detail panel** — subject stats (joined, inviter, mate count,
  invited count, korners chips, vouch count) plus relationship line
  (mate since / not a direct mate) when viewing someone else.
- **Axis marks** — quarterly ticks with year-and-month labels.

## What this pass does not ship (deferred to a follow-up)

Called out in the brief but out of scope:

- **Lineage trace** — hover-highlighting every node + link on the
  paths through the hovered member, with everything else dropped
  back.
- **Search + trail** — instance-wide search on the rail, and the
  breadcrumb trail of visited subjects.
- **Pitch compression** — the brief specifies layer pitch of 42px
  compressing to 26–34px as layers accumulate. MVP keeps a fixed
  42px; the SVG viewBox grows vertically to fit rather than
  compressing layers.
- **Show-labels toggle** — labels on opened-branch tiles appear only
  at close zoom per the brief. MVP hides them by default; a zoom
  control that reveals them lands in a follow-up.

## Data

- **Hook:** `useMatesTimeline()` at `features/mates_tab/use_mates_timeline.ts`.
- **Payload shape:** `{ generated_at, provenance, anchor_date, members[], mates[] }`.
- **Current source:** bundled synthesised invite tree + mate bonds
  derived from the orb's follow graph (99 members, 374 mate bonds).
  Handles are invented; join dates + inviter chain are synthesised so
  the timeline has a coherent shape.
- **Future source:** live endpoint (proposed
  `/api/v1/kronk/mates/timeline?subject=<acct>` — pending the Mates
  endpoint decisions in the brief's Unresolved section).

Field shapes:

**Member** — `id`, `rank`, `handle`, `display_name`, `joined_at` (ISO
date, day-precision), `inviter_id` (nullable for root), `connections`,
`korners`, `vouch_count`.

**Mate bond** — `member_a`, `member_b` (symmetric — one row per pair),
`mates_since` (ISO date). Derived from mutual follows in the orb.

## Interaction

- **Click a tile** — switch subject. Every opened branch closes.
- **Click a pip** — toggle the branch: `↑` on a mate/inviter opens
  the full invite chain upward; a numeric pip below on an invitee
  opens their direct invitees (one generation). Click again to
  close. Downward close cascades to descendants.
- **Hover a tile** — tooltip.
- **Return-to-my-line** button in the subject bar — jumps back to the
  viewer's own line.
- **Rail filters** — Both / Mates / Invited toggles the rail list.
- **Rail row click** — same as clicking the corresponding tile.
- **Horizontal scroll** — the SVG is fixed at 1.2 px/day for MVP; on
  narrow viewports the canvas scrolls horizontally. Vertical space
  auto-adjusts as branches open (viewBox grows top and bottom).

## Frame adherence

- The tab lives inside `Column` + `ColumnBackButton` from the classic
  timeline layout (not `KornerShell`, because this is a profile
  sub-route, not a korner).
- No local `<h1>` — the subject bar carries the display name at
  display-serif scale but does not use an h1.
- Kronk tokens throughout — no raw hex colours.

## Open (from the brief)

- **Visibility scope** — the timeline reconstructs inviter
  relationships for members the viewer may have no relationship with.
  Opening a branch is the natural disclosure event. Needs settling
  server-side before real data lands.
- **Mate model** — is a mate a mutual follow, or an explicitly
  accepted symmetric relation? The whole above-line row depends on
  which. Current synthesised data assumes mutual-follow.
- **Tombstoned members** — deleted members stay structural links in
  other members' chains; what renders in place of a deleted member is
  undecided.
- **Date semantics** — mates are positioned at bond date, everyone
  else at join date. The mixed axis is explained by the tooltip; the
  design decision to split rather than unify is deferred.
- **Empty states** — a member with no mates, no invitees, or both.
  MVP shows the track and head only; polish deferred.

## Files

- `app/javascript/mastodon/features/mates_tab/index.tsx` — route mount.
- `app/javascript/mastodon/features/mates_tab/timeline.tsx` — SVG timeline.
- `app/javascript/mastodon/features/mates_tab/contacts_rail.tsx` — right rail.
- `app/javascript/mastodon/features/mates_tab/detail_panel.tsx` — subject detail.
- `app/javascript/mastodon/features/mates_tab/use_mates_timeline.ts` — hook.
- `app/javascript/mastodon/features/mates_tab/data/timeline_synthesised.json` — bundled data.
- `app/javascript/styles/mastodon/_mates_tab.scss` — chrome (Kronk tokens only).
