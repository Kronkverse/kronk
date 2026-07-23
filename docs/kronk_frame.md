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

**The Frame uses container queries, not media queries.**

Body has `container-type: inline-size; container-name: frame`. All
responsive rules fire as `@container frame (width <= 889px)` /
`@container frame (width >= 1400px)`, so the Frame responds to its
own width — not the viewport's.

The one breakpoint the Frame owns:

- **≤ 889px** — mobile shape (BottomBand appears, RightBand hides,
  SpaceNav flips to the horizontal top-corners pattern).

Wider breakpoints (deck mode, etc.) are the korner's business, not
the Frame's.

## Reserved-slot contract

Every Stage-based korner renders these classes so the shape stays
consistent:

| Slot         | Class                     | Owned by                             |
| ------------ | ------------------------- | ------------------------------------ |
| Space badge  | `.space-badge`            | shared `<SpaceBadge>` component      |
| View picker  | `.space-nav__picker`      | shared `<SpaceViewPicker>` component |
| Stage        | `.frame-stage` (or child) | per korner                           |
| Sidebar tile | `.korner-sidebar__tile`   | `<KornerSidebar>` (Frame-owned)      |
| Ӂ menu       | `.kronk-menu`             | `<KronkMenu>` (Frame-owned)          |

The shared components are the source of truth. A korner **should not**
reimplement its own back-out pill or view tabs.

## Rules

1. **Frame is untouchable per-space.** The Wordmark, HubSwitcher,
   RightBand fade, and Ӂ menu are the same on every page. New
   persistent affordances propose a Frame change, not a per-space
   add-on.

2. **Chrome is a grid child, not a fixed overlay.** `position: fixed`
   in chrome components is retired. If it comes back for a specific
   reason (e.g., a scroll-following element), document why.

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

## Historical

- `docs/kronk_stage_zones.md` — Stage-only precursor spec. Retired
  when the Frame layer was formalized.
- The `body::before` and `body::after` fade bands, the classic
  `.columns-area` padding-top / centring dance, and each chrome
  component's `position: fixed` self-anchoring are all retired
  incrementally in the KronkFrame migration PRs (v2.0.0-alpha.176 →
  alpha.180 range).

## Related files

- `app/javascript/mastodon/features/ui/index.jsx` — the Frame mounts here.
- `app/javascript/mastodon/components/kronk_frame.tsx` — the Frame component.
- `app/javascript/styles/mastodon/_kronk_frame.scss` — the grid CSS.
- `app/javascript/styles/mastodon/_kronk_chrome.scss` — the chrome components inside the slots.
- `docs/kronk_frame_prototype_v12.html` — visual reference (pre-implementation).
