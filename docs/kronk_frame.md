# Kronk Frame — normative page layout spec

The **Frame** is the foundational layout of every Kronk page. It's a
CSS grid that owns the shape of the viewport, and it's the same on
every route. Every korner renders inside it.

This document supersedes `docs/kronk_stage_zones.md`, which described
Stage as one layer of what the Frame now covers.

## The five slots + one overlay

The Frame is a grid with **five named cells** and one **overlay layer**
that sits outside the grid.

```
Desktop (container ≥ 890px)
┌────────────────────────────────────────────────────────────────┐
│                          TopBand                                │
│              (wordmark + Membrane HubSwitcher)                  │
├──────────┬─────────────────────────────────────────┬───────────┤
│          │                                         │           │
│ SpaceNav │                 Stage                   │ RightBand │
│          │           (per-korner content)          │  (korner  │
│  (space  │                                         │   tiles)  │
│   nav)   │                                         │           │
│          │                                         │           │
└──────────┴─────────────────────────────────────────┴───────────┘

                    OVERLAY: Ӂ menu (position: fixed, draggable)

Mobile (container ≤ 889px)
┌────────────────────────────────────────────────────────────────┐
│                          TopBand                                │
│                        (wordmark)                               │
├────────────────────────────────────────────────────────────────┤
│  [← Ƙ space]                                    [Today ▾]      │
│                       Stage                                     │
│                (per-korner content)                             │
├────────────────────────────────────────────────────────────────┤
│                       BottomBand                                │
│              (Membrane: Me / Home / Hub / Nudges)               │
└────────────────────────────────────────────────────────────────┘
```

### TopBand

- **Contents:** `<KronkWordmark>` (left), `<HubSwitcher variant="top">`
  (centre, desktop only).
- **Owns:** its own dark fade background (was `body::before` before
  the Frame migration).
- **Mobile:** wordmark only; the HubSwitcher moves to BottomBand.

### SpaceNav

- **Contents:** the space badge/back pill, the view picker dropdown.
- **Owns:** its layout position. No background — it's a transparent
  cell. Pills float over Stage content via `pointer-events: none` on
  the container and `auto` on the pills.
- **Desktop:** ~11rem left column, pills stacked vertically.
- **Mobile:** flips to a horizontal row inside Stage's cell; badge
  top-left, view picker top-right (`justify-content: space-between`).
- **The space badge pattern:** one pill that carries three jobs — a
  back arrow (tap to exit to Hub), the space glyph (Ƙ, ◉, ✦, etc.),
  and the space name. Replaces the old separate "← Hub" affordance
  and the old large centred serif hero title.
- **The view picker:** current view visible as a pill; tap to reveal
  other views as a dropdown. Auto-closes on outside-click or Escape.

### Stage

- **Contents:** everything the korner itself renders. Panels, cards,
  feeds, composers, calendars, wide 3-column layouts.
- **Owns:** its scrollbar. `overflow-y: auto`, `overflow-x: hidden`.
- **Desktop:** spans SpaceNav's column and its own, so content reaches
  the left edge of the viewport (inside the right rail). Pills from
  SpaceNav float over the top-left corner.
- **Mobile:** spans the full width; pills float over the top-left and
  top-right corners.
- **Wide screens (≥ 1400px, opt-in per korner):** may render as a
  horizontal deck of columns (multiple views side by side). This is a
  **Stage-layer decision**, not a Frame one — Kuestions can opt in,
  Kalendar can't (it renders its own calendar grid).

### RightBand

- **Contents:** `<KornerSidebar>` — the vertical rail of korner tiles.
- **Owns:** its own dark fade background (was `body::after`), fading
  inward toward Stage.
- **Desktop only.** Hidden below the 890px container breakpoint.

### BottomBand

- **Mobile only.**
- **Contents:** `<HubSwitcher variant="bottom">` — the Me / Home / Hub
  / Nudges tab-bar.
- **Owns:** solid black background with a purple accent top-border.

### OVERLAY (not a grid cell)

- **Contents:** `<KronkMenu>` (Ӂ) — the draggable floating action
  button that opens Post / New / Search.
- **Position:** `fixed`, deliberately outside the grid. The user can
  drag it anywhere on the viewport; the parked position is
  bottom-left desktop, bottom-right mobile (clear of the tab-bar).
- **Why outside the grid:** the Ӂ menu belongs to the viewport, not
  to any single layout cell. Anything else that needs to float
  independently of the grid (modals, dropdowns, snackbars) goes here.

## Responsive strategy

**The Frame prefers container queries over media queries.**

The `.kronk-frame` element carries `container-type: inline-size;
container-name: frame` — scoped to the Frame, **not `body`**, on
purpose: putting it on `body` would change the containing block for
`position: fixed` descendants, which the classic chrome still relies
on during the migration. Container rules fire as
`@container frame (width <= 889px)`, so the Frame responds to its own
width, not the viewport's. A few band breakpoints still use plain
`@media` today; those convert to `@container` as the classic chrome
retires (see Current state).

The one breakpoint the Frame owns:

- **≤ 889px** — mobile shape (BottomBand appears, RightBand hides,
  SpaceNav flips to the horizontal top-corners pattern).

Wider breakpoints (deck mode, etc.) are the korner's business, not
the Frame's.

## Reserved-slot contract

Every Stage-based korner renders these classes so the shape stays
consistent:

| Slot         | Class                     | Owned by                                    |
| ------------ | ------------------------- | ------------------------------------------- |
| Space badge  | `.space-badge`            | shared `<SpaceBadge>` component             |
| View picker  | `.space-view-picker`      | shared `<SpaceViewPicker>` component        |
| Stage        | `.kronk-stage`            | shared `<Stage>` component (per-korner body) |
| Sidebar tile | `.korner-sidebar__tile`   | `<KornerSidebar>` (Frame-owned)             |
| Ӂ menu       | `.kronk-menu`             | `<KronkMenu>` (Frame-owned)                 |

(The Frame grid cells themselves are `.kronk-frame__stage`,
`.kronk-frame__space-nav`, `.kronk-frame__top-band`,
`.kronk-frame__right-band`, `.kronk-frame__bottom-band` — Frame-owned;
a korner renders its content into the Stage cell via the shared
`<Stage>` component.)

The shared components are the source of truth. A korner **should not**
reimplement its own back-out pill or view tabs.

## Rules

1. **Frame is untouchable per-space.** The Wordmark, HubSwitcher,
   RightBand fade, and Ӂ menu are the same on every page. New
   persistent affordances propose a Frame change, not a per-space
   add-on.

2. **Chrome is a grid child, not a fixed overlay — the target.** The
   goal is that no chrome uses `position: fixed`; each lays out as a
   flow child of its grid slot. This is **not yet fully true.** The
   inner chrome (wordmark, HubSwitcher, sidebar) was un-fixed, but the
   slot strips themselves are still `position: fixed` fade bands
   (~16 `fixed` declarations remain across the Frame/chrome SCSS),
   because the real geometry is still owned by Mastodon's classic
   `.columns-area` until every page migrates off `<Column>`. The strips
   become true grid children once `.columns-area` retires. New chrome
   added meanwhile still targets the grid, never a fresh fixed overlay.

3. **Stage owns its content, not its geometry.** The Frame gives
   Stage a rectangle. What Stage renders inside it is the korner's
   call — but reserved-slot classes must be used for the space badge,
   view picker, and sidebar tiles.

4. **Never render a KornerSubBar breadcrumb on a Stage route.** The
   space badge replaces it; the SubBand row from earlier iterations
   is retired.

5. **Never render a hero title/subtitle inside Stage.** The space
   name is carried by the space badge in SpaceNav. Tagline copy, if
   any, is inline panel copy on the landing view only — not a
   reserved band.

## Current state (migration status)

The Frame is a two-part rollout: the **scaffolding** (done) and the
**per-page migration** (barely started). Read the rules above as the
*target*; this section is the *current* reality (as of alpha.183).

**Landed (scaffolding):** the Frame and all five slots are mounted
platform-wide in `ui/index.jsx`; the shared components exist and are
wired — `<SpaceBadge>`/`<AutoSpaceBadge>`, `<SpaceViewPicker>`,
`<KornerSidebar>`, `<KronkMenu>`. This came in the four-PR series
(#587 / #589 / #592 / #594) plus badge/picker/sidebar follow-ons
(#597 / #599 / #602), spanning roughly alpha.176 → alpha.183.

**Not yet done (per-page):** only **Kuestions** renders through the
shared `<Stage>`. Every other page — Kommons, Nudges, Booth, Feed,
InFlow, Groups, and the upstream Mastodon timelines/settings — still
renders classic `<Column>` + `<ColumnHeader>` chrome *inside* the Stage
cell (~68 files import `ColumnHeader`, ~94 use `<Column>`). Until a
page migrates:

- the slot strips stay `position: fixed` (rule 2 target unmet);
- the `.columns-area` padding dance is reshaped, not gone — a
  `padding-top` remains to clear the still-fixed `KornerSubBar`;
- `KornerSubBar` is still rendered (as a Frame sibling) on non-Stage
  routes, so rule 4 only holds per-migrated-route;
- `_kronk_stage.scss` uses a `:has(.kronk-stage) { container-type:
  normal }` escape hatch so a Stage's fixed children anchor to the
  viewport rather than the classic columns-area containing block.

The end state (fixed retired, `.columns-area` gone, SubBar gone) is
reachable only once the pages are migrated.

## Historical

- `docs/kronk_stage_zones.md` — Stage-only precursor spec. Retired
  when the Frame layer was formalized.

## Related files

- `app/javascript/mastodon/features/ui/index.jsx` — the Frame mounts here.
- `app/javascript/mastodon/components/kronk_frame.tsx` — the Frame component.
- `app/javascript/mastodon/components/stage.tsx` — the shared `<Stage>` content component.
- `app/javascript/styles/mastodon/_kronk_frame.scss` — the grid CSS.
- `app/javascript/styles/mastodon/_kronk_chrome.scss` — the chrome components inside the slots.
