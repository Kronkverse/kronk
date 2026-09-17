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
├─────────────────────────────────────────────────────┬──────────┤
│  [← Ƙ space]                        [Today ▾]      │          │
│                                                     │RightBand │
│              Stage (per-korner content)             │ (korner  │
│                                                     │  tiles)  │
│                                                     │          │
└─────────────────────────────────────────────────────┴──────────┘

                    OVERLAY: Kronk menu (position: fixed, draggable)

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
  (centre, desktop only). The InviteButton sits in the far-right corner
  (a standalone fixed pill so it survives mobile, where the top rail hides).
- **Background:** none of its own. The top rail's dark fade is painted by
  the single `.kronk-frame__chrome` element (see **The L-shaped chrome**
  below); TopBand is a transparent positioning zone over it.
- **Mobile:** wordmark only; the HubSwitcher moves to BottomBand.

### The L-shaped chrome

As of the 2026-07 chrome unification, the top rail and right rail are one
continuous surface, painted by a single `position: fixed` element
`.kronk-frame__chrome` (`inset: 0`, `pointer-events: none`): a top-fade +
a right-fade + a curved corner fillet where they meet, all as one
background. This **replaced** the earlier two-strip approach where each
band painted its own fade and the TopBand faked the merged corner by
overpainting the RightBand (`z-index: 25` over `24`). Consequences:

- There is no longer a second piece or a faked corner; TopBand and
  RightBand are transparent zones that only position their children.
- The InviteButton no longer covers the first korner icon — the right
  rail now starts at `4.75rem` (below the reserved corner).
- The stale note about a `mask-image` corner (which never existed) is
  retired; the corner is the chrome's radial fillet.

### SpaceNav

- **Contents:** the space badge/back pill and the view picker, both
  rendered inline via `<SpaceHeaderRow>` at the top of Stage. The
  `KronkFrame.SpaceNav` grid slot is retained in the layout for
  backwards compat but renders empty — the pills now live in the
  Stage's scroll flow, not as a fixed overlay.
- **Layout (all widths):** `<SpaceHeaderRow>` is a CSS grid
  `[left auto] [center 1fr, capped] [right auto]` — badge on the
  left, title + tagline in the centered column, view picker on the
  right. The whole row scrolls with the Stage content.
- **The space badge pattern:** one pill that carries three jobs — a
  back arrow (tap to exit to Hub), the space glyph (Ƙ, ◉, ✦, etc.),
  and the space name. Replaces the old separate "← Hub" affordance
  and the old large centred serif hero title.
- **The view picker:** a segmented switch-pill — every declared
  manifest view is a button, the active one is `aria-pressed` and
  gets the purple fill. One-tap switching, no dropdown. Modelled on
  the Booth "Compact / Standard / Large" segmented control. Populates
  automatically for every korner from the manifest's `views:` list
  (via `<AutoSpaceViewPicker>`), so a new korner picks it up without
  wiring anything.
- **Mobile:** the row collapses to a single column so the pills
  stack above the title.

### Stage

- **Contents:** everything the korner itself renders. Panels, cards,
  feeds, composers, calendars, wide 3-column layouts.
- **Owns:** its scrollbar. `overflow-y: auto`, `overflow-x: hidden`.
- **Desktop:** spans the full width inside the RightBand. The
  in-content `<SpaceHeaderRow>` (badge + title + view picker) is
  Stage's first child; it scrolls with everything else.
- **Mobile:** spans the full width; the SpaceHeaderRow collapses to
  a single column and the pills stack above the title.
- **Wide screens (≥ 1400px, opt-in per korner):** may render as a
  horizontal deck of columns (multiple views side by side). This is a
  **Stage-layer decision**, not a Frame one — Kuestions can opt in,
  Kalendar can't (it renders its own calendar grid).

### RightBand

- **Contents:** `<KornerSidebar>` — the vertical rail of korner tiles,
  starting `4.75rem` down so it clears the reserved top-right corner.
- **Background:** none of its own. The right rail's dark fade is painted
  by `.kronk-frame__chrome` (see **The L-shaped chrome** above); RightBand
  is a transparent positioning zone over it.
- **Desktop only.** Hidden below the 890px container breakpoint.

### BottomBand

- **Mobile only.**
- **Contents:** `<HubSwitcher variant="bottom">` — the Me / Home / Hub
  / Nudges tab-bar.
- **Owns:** solid black background with a purple accent top-border.

### OVERLAY (not a grid cell)

- **Contents:** `<KronkMenu>` (Ж) — the draggable floating action
  button that opens Post / New / Search.
- **Position:** `fixed`, deliberately outside the grid. The user can
  drag it anywhere on the viewport; the parked position is
  bottom-left desktop, bottom-right mobile (clear of the tab-bar).
- **Why outside the grid:** the Kronk menu belongs to the viewport, not
  to any single layout cell. Anything else that needs to float
  independently of the grid (modals, dropdowns, snackbars) goes here.

### Kosmos (background canvas)

- **Contents:** `<KronkKosmos>` — the ambient projection of the Mates
  orb's cross-section, painted as a threshold-of-perception night sky
  behind every Kronk chrome. Each visible star is a real chord
  crossing between two community members at the current sweep depth;
  the sky is the graph, seen from inside. A full crown→floor→crown
  breath takes ~10 minutes; the naked eye should not catch it moving.
- **Position:** a single full-viewport canvas fixed at `inset: 0`,
  `z-index: 0`, `pointer-events: none`. Sits behind every Frame slot
  and the Overlay layer.
- **Why outside the grid:** the sky belongs to the viewport, not to
  any single layout cell — the whole app rides on it. This is the one
  deliberate Frame-external chrome layer (Standard L11 documents the
  exception). The layer never competes with content: a self-contained
  vignette keeps the corners dark so text always wins.
- **Data source:** the same account + follow payload the future Orb
  view consumes (Kommons proposal "Mates", `KRONK_ORB_DATA_BRIEF.md`).
  Ships with a bundled synthesised edge assignment against the real
  degree sequence from production 2026-07-19; swaps to a live
  endpoint (`useMatesOrb()` hook) when the Mates endpoint lands.
- **Reveal knob:** exports a scalar via `features/kosmos/brightness`.
  Ambient default is 0. The Inflow veil (later) tweens it during the
  daily moment to lift the alpha ceiling — one canvas, one knob, no
  second render pass.
- **Reduced motion:** freezes on the core frame (middle of the orb,
  fully lit) — an anchored, still, readable sky rather than an
  arbitrary phase-at-load-time slice.
- **Files:** `features/kosmos/kronk_kosmos.tsx` (mount + lifecycle),
  `features/kosmos/renderer.ts` (pure geometry + per-frame paint),
  `styles/mastodon/_kronk_kosmos.scss` (positioning only), tokens
  under the `kosmos-*` prefix in `tokens.yaml`.

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
  the `<SpaceHeaderRow>` collapses to a single-column stack).

Wider breakpoints (deck mode, etc.) are the korner's business, not
the Frame's.

## Reserved-slot contract

Every Stage-based korner renders these classes so the shape stays
consistent:

| Slot         | Class                   | Owned by                                     |
| ------------ | ----------------------- | -------------------------------------------- |
| Space badge  | `.space-badge`          | shared `<SpaceBadge>` component              |
| View picker  | `.space-view-picker`    | shared `<SpaceViewPicker>` component         |
| Stage        | `.kronk-stage`          | shared `<Stage>` component (per-korner body) |
| Sidebar tile | `.korner-sidebar__tile` | `<KornerSidebar>` (Frame-owned)              |
| Kronk menu   | `.kronk-menu`           | `<KronkMenu>` (Frame-owned)                  |

(The Frame grid cells themselves are `.kronk-frame__stage`,
`.kronk-frame__space-nav`, `.kronk-frame__top-band`,
`.kronk-frame__right-band`, `.kronk-frame__bottom-band` — Frame-owned;
a korner renders its content into the Stage cell via the shared
`<Stage>` component.)

The shared components are the source of truth. A korner **should not**
reimplement its own back-out pill or view tabs.

## Rules

1. **Frame is untouchable per-space.** The Wordmark, HubSwitcher,
   RightBand fade, and Kronk menu are the same on every page. New
   persistent affordances propose a Frame change, not a per-space
   add-on.

2. **Chrome is a grid child, not a fixed overlay — the target.** The
   goal is that no chrome uses `position: fixed`; each lays out as a
   flow child of its grid slot. This is **not yet fully true.** The
   inner chrome (wordmark, HubSwitcher, sidebar) was un-fixed, but the
   slot strips themselves are still `position: fixed` fade bands
   (~5 `fixed` declarations remain across the Frame/chrome SCSS),
   because the real geometry is still owned by Mastodon's classic
   `.columns-area` until every page migrates off `<Column>`. The strips
   become true grid children once `.columns-area` retires. New chrome
   added meanwhile still targets the grid, never a fresh fixed overlay.

3. **Stage owns its content, not its geometry.** The Frame gives
   Stage a rectangle. What Stage renders inside it is the korner's
   call — but reserved-slot classes must be used for the space badge,
   view picker, and sidebar tiles.

4. **No korner-level breadcrumb pill.** The
   `<SpaceBadge>` handles back-to-Hub; the KornerSubBar breadcrumb
   pill was retired 2026-08-13 (last web korner still had it and it
   flashed in before Stage-mounted korners loaded — Tal). The
   SubBand row from earlier iterations is also retired.

5. **Space title and tagline are Frame-owned, not korner-owned.**
   Two slots carry them: the top-left `<SpaceBadge>` pill (SpaceNav,
   fixed chrome — the persistent back affordance), and the
   `<SpaceHeader>` at the top of the Stage scroll region
   (in-content — a proper `<h1>{name}</h1>` above the manifest
   tagline, scrolls with the korner's content). A korner MUST NOT
   emit its own `<h1>` or duplicate the tagline copy — the header
   already renders both. Landing-view lede paragraphs and
   getting-started copy that _aren't_ the tagline are fine; they're
   content, not chrome.

## Current state (migration status)

The Frame is a two-part rollout: the **scaffolding** (done) and the
**per-page migration** (well underway). Read the rules above as the
_target_; this section is the _current_ reality (as of alpha.196).

**Landed (scaffolding):** the Frame and all five slots are mounted
platform-wide in `ui/index.jsx`; the shared components exist and are
wired — `<SpaceBadge>`/`<AutoSpaceBadge>`, `<SpaceViewPicker>`,
`<KornerSidebar>`, `<KronkMenu>`. This came in the four-PR series
(#587 / #589 / #592 / #594) plus badge/picker/sidebar follow-ons
(#597 / #599 / #602), spanning roughly alpha.176 → alpha.183.

**In progress (per-page):** the Kronk-native surfaces have largely
migrated. **21 files** across ~13 feature areas import
`components/stage` — all the `/hub` korner pages (Hub, Booth, Kalendar,
Groups, InFlow, Wachuneed, Kronk Search, You, plus korner settings and
stubs), the whole **Kommons** governance suite (proposal / space / node
/ propose / picker), and **Kuestions**. What remains on classic chrome
is the upstream Mastodon layer — timelines, account/status pages, and
settings — plus a shrinking set of Kronk pages not yet moved: **~39
files import `ColumnHeader`, ~55 use `<Column>`**. Until each of those
migrates:

- the slot strips stay `position: fixed` (rule 2 target unmet), though
  only ~5 such declarations remain across the Frame/chrome SCSS;
- the `.columns-area` padding dance is reshaped, not gone — its
  `padding-top` used to clear the fixed `KornerSubBar` breadcrumb,
  which was retired 2026-08-13; the padding itself may follow when
  the remaining Column routes migrate;
- `_kronk_stage.scss` uses a `:has(.kronk-stage) { container-type:
normal }` escape hatch so a Stage's fixed children anchor to the
  viewport rather than the classic columns-area containing block.

The end state (fixed retired, `.columns-area` gone) is reachable
only once the remaining Column-based pages are migrated.

## Historical

- `docs/kronk_stage_zones.md` — Stage-only precursor spec. Retired
  when the Frame layer was formalized.

## Related files

- `app/javascript/mastodon/features/ui/index.jsx` — the Frame mounts here.
- `app/javascript/mastodon/components/kronk_frame.tsx` — the Frame component.
- `app/javascript/mastodon/components/stage.tsx` — the shared `<Stage>` content component.
- `app/javascript/styles/mastodon/_kronk_frame.scss` — the grid CSS.
- `app/javascript/styles/mastodon/_kronk_chrome.scss` — the chrome components inside the slots.
