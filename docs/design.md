# Kronk design

The visual and layout reference for Kronk: tokens and aesthetic rules, the
Frame every page renders inside, the card standard, the Membrane navigation,
the index of shared platform primitives, signup, and the first-run
walkthrough. It describes what is built. Earlier designs are in git history
(see [History](#history)).

The rules you need day to day are summarised in `CLAUDE.md` under **Aesthetic —
the rules**. This file is the detail behind them.

---

## Aesthetic system

### 1. Identity in one paragraph

Kronk is **one platform, one palette**. Every space wears the same
**Kronk-purple** on a **dark-first** surface. Spaces differ by **icon, name and
content**, never by colour. The look is dark purple-tinted surfaces, an indigo
accent, generous rounding, and a layered purple **cover-glow** on the profile
cover. Titles use a serif display face over a sans body.

#### Principles

1. **Everything through tokens.** Colours, radii, elevation and motion come
   from CSS custom properties generated from `tokens.yaml`. Stylelint checks
   the Kronk-owned SCSS files listed in `stylelint.config.js` (see
   [§2.1](#21-the-pipeline) for what it actually blocks).
2. **Kronk-purple is platform-wide.** Use `var(--accent)`. Don't add a brand
   colour for a korner. There is no colour field in a manifest.
3. **Dark is the default; light is a mirror.** Every themed token has a `dark`
   and a `light` value. Build against the semantic aliases and both themes work.
   Never branch on theme in feature code.
4. **No planet colours.** The pre-2.0 per-space `--space-color` and
   `planets.tsx` are gone from the code.
5. **Radius by role.** Small for controls, medium for cards, large for hero
   surfaces and sheets, round for pills and avatars.
6. **Semantic over literal.** Use `--accent`, `--surface-elevated`,
   `--decision-agree`, not the palette token behind them. That is also what
   makes Personal Appearance work ([§2.8](#28-the-per-user-layer--personal-appearance)).

---

### 2. Design tokens

#### 2.1 The pipeline

```
app/javascript/mastodon/tokens/tokens.yaml     ← the source (edit this)
        │  bin/generate-tokens
        ▼
app/javascript/styles/mastodon/_tokens.scss    ← GENERATED, never hand-edit
```

- Themed tokens are `{ dark: …, light: … }`. Theme-invariant ones (fonts,
  radius, elevation, motion) are a single value.
- The generator writes `--<section>-<token>` on `:root` (dark) with overrides
  under `:root[data-theme='light']`. The `semantic` section also gets short
  aliases (`--accent: var(--semantic-accent)` and so on). Feature SCSS uses the
  short names.
- Palette entries are OKLCH triples. The generator writes a hex fallback and
  an `@supports (color: oklch(…))` block with the native value.
- CI (`test-js.yml`) runs `bin/generate-tokens --check` and fails on drift.
  Always regenerate after editing `tokens.yaml`.

**What stylelint enforces** on the governed files: a bespoke back-link class
is an **error** and fails `lint` (see [§4.3](#43-navigation--chrome)). Raw hex
(`color-no-hex`) and pixel or rem `border-radius` values are **warnings**. They
show up in the lint output but do not fail the build. Files outside the
governed list aren't checked for either.

#### 2.2 Palette

The raw purple ramp, `--kronk-purple-{primary,bright,deep,muted,accent}`. All
five sit on one anchor hue, **285°** (violet), and differ in lightness and
chroma. The values are in `tokens.yaml`. Feature code should rarely use these
directly. The exceptions are glows and tints that want the palette itself (the
cover-glow, the Membrane focus ring).

#### 2.3 Semantic tokens (the contract)

Build against these. Values are in `tokens.yaml`; the table shows the dark
theme.

| Token                                                   | Dark                        | Use                                   |
| ------------------------------------------------------- | --------------------------- | ------------------------------------- |
| `--accent`                                              | `#4414cc`                   | CTAs, active states                   |
| `--text-on-accent`                                      | `#ffffff`                   | Text on the accent                    |
| `--surface-primary`                                     | `#191b22`                   | Page background                       |
| `--surface-elevated`                                    | `#292938`                   | Cards, menus, raised panels           |
| `--border-default`                                      | `#47368b`                   | Borders on interactive surfaces       |
| `--border-subtle`                                       | `#2a2740`                   | Hairlines, the Membrane wire          |
| `--text-primary` / `--text-secondary` / `--text-muted`  | `#ece9f5` / … / …           | Text, strongest to faintest           |
| `--warning-red`                                         | `#ef4444`                   | Alerts                                |
| `--destructive`                                         | `#c75d6e`                   | Delete / leave CTAs (a softer rose)   |
| `--success-green`                                       | `#4b9160`                   | Success                               |
| `--decision-agree` / `-abstain` / `-block` / `-pending` | green / slate / red / amber | Kommons votes and outcomes            |
| `--tile-glyph-on` / `--tile-glyph-off`                  | `#8c7dff` / `#4e4a72`       | Hub tile glyphs, live and coming-soon |

Kosmos has its own `--kosmos-*` tokens (the background canvas, see
[Frame](#frame)). They are theme-invariant on purpose.

#### 2.4 Typography

| Token            | Value                                                 |
| ---------------- | ----------------------------------------------------- |
| `--font-display` | `'Liberation Serif', Georgia, serif`                  |
| `--font-body`    | `mastodon-font-sans-serif, sans-serif`                |
| `--font-mono`    | `'Roboto Mono', 'Fira Mono', ui-monospace, monospace` |

Use the serif for headings and titles, rather than bolding the sans.

#### 2.5 Radius

Everything rounds. If a surface can't take a radius, it becomes a hairline
divider, not a box.

| Token             | Value   | Use                                                    |
| ----------------- | ------- | ------------------------------------------------------ |
| `--radius-small`  | `6px`   | Chips, small icon buttons, focus rings, dropdown items |
| `--radius-medium` | `10px`  | Cards, panels, dropdowns, sidebar tiles, menu items    |
| `--radius-large`  | `16px`  | Hero surfaces, the sidebar, hub cards, menus, modals   |
| `--radius-round`  | `999px` | Pills, tags, badges, capsule buttons, avatars, toggles |

Primary CTAs are round pills. Secondary buttons are small or medium. Borders on
interactive surfaces are 1–1.5px in `--border-default` or an accent tint.

#### 2.6 Elevation

`--elevation-subtle`, `--elevation-card`, `--elevation-floating`,
`--elevation-menu`. Pick the level by role; don't compose shadows by hand.

#### 2.7 Motion

| Token           | Value                               | Use                         |
| --------------- | ----------------------------------- | --------------------------- |
| `--dur-fast`    | `120ms`                             | Hovers, small state changes |
| `--dur-medium`  | `200ms`                             | Most transitions            |
| `--dur-slow`    | `400ms`                             | Sheets, large reveals       |
| `--ease-out`    | `cubic-bezier(0.16, 1, 0.3, 1)`     | Enter transitions           |
| `--ease-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)`    | Move and resize             |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Emphasis                    |

The section in `tokens.yaml` is `motion`, but the generated names are
`--dur-*` and `--ease-*`. There are no `--motion-*` properties.

#### 2.8 The per-user layer — Personal Appearance

Members can tune a slice of the look (Settings → Appearance). The client
applies it in `utils/personal_appearance.ts` by setting properties on `:root`,
over the generated defaults:

- **Purple hue** (`web.personal_purple_hue`): rotates all five
  `--kronk-purple-*` tokens and `--accent` around a new hue, clamped to
  260–350° so it stays purple.
- **Accent** (`web.personal_accent`): a hex override for `--accent`. The server
  rejects anything outside the purple band (`purple_accent?` in
  `Api::V1::Settings::AppearanceController`).
- **Display and body font**, from fixed lists.
- **UI scale** (small / default / large / xl), applied as `zoom` on `<html>`.
- **Theme** and **reduce motion**, which are the Mastodon settings.

**Why this matters for everything you build:** a component that hard-codes a
hex, or reaches past a semantic alias to a raw value, silently opts the member
out of their chosen accent, theme or scale.

---

### 3. Signature treatments

#### 3.1 The cover-glow

The layered radial purple glow on the profile cover, as a mixin in
`_mixins.scss`:

```scss
@include kronk-cover-glow($radius: 24px);
```

The bright layer is tokenised to `--kronk-purple-bright`. The deep and base
layers (`rgb(86 58 204 / 40%)`, `#241a44`, `#0d0a1c`) are the glow's own
gradient and the one sanctioned set of raw values. Today only the profile
(`_kprofile.scss`) uses it. Reach for it before writing a new header gradient.

#### 3.2 color-mix for tints

Translucent variants (hover states, chip fills, selection) are
`color-mix(in srgb | oklab, var(--token) N%, transparent)`, never a parallel
hard-coded rgba. The tint then follows the token, including a member's own
accent.

---

### 4. The component kit

Reuse these before building anything new. The full index is
[Platform primitives](#platform-primitives).

#### 4.1 Settings widgets (`features/settings/setting_widgets.tsx`)

Every settings control is a `SettingRow` (label, hint, control) wrapping a typed
widget: `BooleanWidget`, `EnumWidget`, `MultiEnumWidget`, `DurationWidget`, and
the appearance-only `AccentWidget` and `HueWidget`. Classes are
`korner-settings__*`. Personal settings and each korner's settings space use
them.

#### 4.2 List manager (`features/settings/list_manager.tsx`)

`ListManager<T>` fetches a collection and renders each entry as a row with a
remove button (optimistic, restored on failure). Callers pass accessors and a
`removeItem` callback. Used for mutes, blocks and domain blocks (privacy
settings) and in feed settings. Classes are `settings-list-manager__*`.

#### 4.3 Navigation & chrome

- **`HubSwitcher`** (`features/ui/components/hub_switcher.tsx`): the platform
  nav. The top variant is the Membrane (see
  [Membrane navigation](#membrane-navigation)). The bottom variant is the
  phone tab-bar.
- **`KronkMenu`** (`features/ui/components/kronk_menu.tsx`): the floating Ж
  button. See [Frame](#frame) (OVERLAY).
- **Settings navigation** (`features/settings/nav.tsx`). The profile entry
  goes to `/@:acct/shelves`. Editing a profile is Arrange mode on the shelves;
  the old `/@:acct/edit` composer is gone.

**Back navigation: one pattern.** Two primitives cover it:

1. **`SpaceBadge`** (automatic). Every `/hub/<slug>` page gets the top-left
   `← <name>` pill from the Frame. It steps one level up the URL: a korner root
   or one of its views goes to `/hub`, and a deeper page goes to the korner
   root (`auto_space_badge.tsx`). On settings pages `SettingsBadge` takes the
   slot and returns to the space you came from.
2. **`<BackToKorner>`** (explicit), for a detail page that needs a chip to a
   specific parent. Renders `.kronk-back-chip`.

A hand-rolled "← Back" link or button is banned. On the governed files,
stylelint fails any class matching `__back`, `__back-link`, `__back-button`,
`__back-chip` or `__back-to-*` (`selector-disallowed-list`). Words like
`__back-btn` (Kommons "back a proposal") and `__backdrop` are deliberately not
matched. A real step-back inside a flow (a wizard, a form's cancel) uses
`<KornerPill>`; the ban is on the shape, not the flow. Breadcrumbs (`__crumb`)
are a different pattern and aren't banned.

**The Ж menu owns the platform verbs.** Post (or New chat in Nudges), Search
and Settings live on the Ж menu on every signed-in page. Don't add a page-level
`+`, `New X`, `Settings` or gear chip.

- **Post** comes from the manifest's `compose:` block. Inside a korner without
  one, the Post entry hides. On home and profile it is the plain status
  composer.
- **Settings** is context-aware: it opens the settings for the space you're in
  (a korner, a Krew, a chat, feed, profile, Hub).

Controls that act on the page itself (edit a description, save a form, toggle a
mode) are fine. The rule is only about duplicating the platform verbs.

#### 4.4 Kommons cards

`_status_kommons_card.scss` and `_kommons.scss` draw proposals and decisions
with the `--decision-*` tokens and `color-mix()` tints. Use them as the
reference for any voting UI.

#### 4.5 The live styleguide

`/styleguide` (`features/styleguide/index.tsx`, `_styleguide.scss`) renders the
tokens and primitives live. Check it before proposing a new component.

---

### 5. The korner framework

Korners are declared by a manifest, `config/korners/<slug>.yaml`, mounted at
`/hub/<slug>`, and held to `docs/korners/korner_standard.md`. The field
reference and the build walkthrough are in `docs/korners/adding_a_korner.md`.
The visual points:

- **No colour field.** Identity is name and icon.
- **Feed projection.** `feed_projection.card` names the korner's feed card
  (for example `kommons_card`, rendered by `StatusKommonsCard`). Every feed card
  sits on `<StatusKornerCard>` and the [Card standard](#card-standard).
- **Settings.** `/hub/<slug>/settings`, built from the widget kit (§4.1).
- **Header.** The Frame draws the badge, title, tagline and view switch from the
  manifest (`views:`, `header:`). See [Frame](#frame).
- **Theming.** `var(--accent)` and the semantic tokens. Nothing else.

---

### 6. Building a korner to spec — checklist

- [ ] **Manifest first.** Slug not in `config/korners/reserved_slugs.yaml`.
- [ ] **No new colours.** Accent is `var(--accent)`; no manifest colour, no raw
      hex.
- [ ] **Tokens only.** Colour, radius, elevation and motion are tokens. Add the
      korner's SCSS files to the governed list in `stylelint.config.js`.
- [ ] **Both themes.** Semantic aliases only, no theme branching.
- [ ] **Radius by role.**
- [ ] **Reuse the kit.** `<KornerShell>`, the settings widgets, `ListManager`,
      the primitives index. Check `/styleguide` first.
- [ ] **Let the Frame draw the chrome.** No own badge, `<h1>`, tagline or tab
      row.
- [ ] **Feed projection** declared if the korner's items reach feeds.
- [ ] **Doctor clean.** `bin/tootctl korners doctor`.
- [ ] **Regenerate tokens** if `tokens.yaml` changed.

---

### 7. Quick reference — files

| Concern             | File                                                                       |
| ------------------- | -------------------------------------------------------------------------- |
| Token source        | `app/javascript/mastodon/tokens/tokens.yaml`                               |
| Token generator     | `bin/generate-tokens` (`--check` in CI)                                    |
| Generated tokens    | `app/javascript/styles/mastodon/_tokens.scss` (don't edit)                 |
| Lint rules          | `stylelint.config.js` (governed file list + rules)                         |
| Personal Appearance | `utils/personal_appearance.ts`, `api/v1/settings/appearance_controller.rb` |
| Cover-glow mixin    | `styles/mastodon/_mixins.scss`                                             |
| Settings widgets    | `features/settings/setting_widgets.tsx`                                    |
| List manager        | `features/settings/list_manager.tsx`                                       |
| Hub switcher        | `features/ui/components/hub_switcher.tsx`, `_kronk_chrome.scss`            |
| Ж menu              | `features/ui/components/kronk_menu.tsx`                                    |
| Live styleguide     | `features/styleguide/index.tsx`, `_styleguide.scss`                        |
| Korner manifests    | `config/korners/*.yaml`                                                    |
| Korner registry     | `config/initializers/kronk_korner_registry.rb`                             |
| Korner doctor       | `bin/tootctl korners doctor`                                               |

---

## Frame

The **Frame** is the layout every Kronk page renders inside: a CSS grid that
owns the shape of the viewport, the same on every route. It mounts in
`features/ui/index.jsx`.

### The five slots + one overlay

```
Desktop (≥ 890px)
┌────────────────────────────────────────────────────────────────┐
│                          TopBand                               │
│              (wordmark + Membrane HubSwitcher)                 │
├─────────────────────────────────────────────────────┬──────────┤
│  [← Space]       Title / tagline         [views]    │          │
│                                                     │RightBand │
│              Stage (per-korner content)             │ (korner  │
│                                                     │  tiles)  │
└─────────────────────────────────────────────────────┴──────────┘

                    OVERLAY: Ж menu (fixed, draggable)
                    Background: Kosmos canvas

Phone (≤ 889px)
┌────────────────────────────────────────────────────────────────┐
│                     TopBand (wordmark)                         │
├────────────────────────────────────────────────────────────────┤
│  [← Space]  Title  [views]   (stacked)                         │
│                       Stage                                    │
├────────────────────────────────────────────────────────────────┤
│                       BottomBand                               │
│           (tab-bar: Me / Home / AWAWB / Hub / Nudges)          │
└────────────────────────────────────────────────────────────────┘
```

#### TopBand

- **Contents:** `<KronkWordmark>` and, for signed-in desktop users,
  `<HubSwitcher variant="top">`. Signed out, the switcher is hidden and the
  wordmark centres.
- **Background:** none of its own; see the L-shaped chrome.
- **Phone:** wordmark only. Below 630px the top rail is hidden entirely.

#### The L-shaped chrome

The top rail and right rail are one surface: a single fixed element,
`.kronk-frame__chrome` (`inset: 0`, `pointer-events: none`), paints the top fade,
the right fade and the curved corner between them. TopBand and RightBand are
transparent zones that only position their children. The korner rail starts
`4.75rem` down, below the corner.

#### SpaceNav

- **Contents:** `<SpaceHeaderRow>`, rendered as Stage's first child, so it
  scrolls with the page. The `KronkFrame.SpaceNav` grid cell is still emitted
  but is empty.
- **Layout:** a grid of `[left auto] [centre 1fr] [right auto]`:
  - **Left:** `<AutoSpaceBadge>` (`← <name>`, steps one level up), or
    `<AutoSettingsBadge>` on settings pages.
  - **Centre:** `<AutoSpaceHeader>`: the space's `<h1>` and tagline from the
    manifest.
  - **Right:** `<AutoSpaceViewPicker>`.
- **Switching views.** Views come from the manifest's `views:` list. The first
  is the bare `/hub/<slug>`; the rest are `/hub/<slug>/<key>`. There are three
  shapes:
  - **The rotator** (`header.rotator: true`, most korners). The title itself
    is the switch (`<ScopeTitle>`): chevrons either side, a tap on the left or
    right half steps back or forward, and a position strip under it marks the
    current face. The view picker then renders nothing. `/home` uses the same
    rotator for Mates / Orbit / Kronkverse, with `<FeedDrum>` turning the
    content.
  - **Pills** (default): a segmented row, one button per view, the active one
    `aria-pressed`.
  - **Menu** (`header.picker: menu`): a dropdown.
- **Phone:** the row collapses to one column.

#### SpaceHeader override

A route that needs its own title in the centre slot (Art, every settings page)
calls `useSpaceHeaderOverride(node)` (`components/space_header_override.tsx`)
instead of rendering a header in its body. The provider lives on `<Stage>`. When
the route unmounts, the slot falls back to the manifest title.

#### Stage

- **Contents:** everything the korner renders.
- **Owns:** its scrollbar (`overflow-y: auto`, `overflow-x: hidden`).
- **Shapes:** `.stage-fill`, `.stage-column` and `.stage-grid` are the three
  shared archetypes for a Stage child (`_kronk_stage.scss`; decisions.md,
  2026-08-13).
- Wide multi-column layouts are the korner's decision, not the Frame's.

#### RightBand

`<KornerSidebar>`, the vertical rail of korner tiles, for signed-in users.
Hidden below 890px.

#### BottomBand

Phone only. `<HubSwitcher variant="bottom">`, the tab-bar, fixed to the bottom
of the viewport.

#### OVERLAY (not a grid cell)

- **Contents:** `<KronkMenu>`, the Ж button (Post / Search / Settings).
- **Position:** `fixed`, outside the grid. The member can drag it anywhere; the
  position is saved in `localStorage` and snaps to the nearest edge. Default
  park is bottom-left on desktop and bottom-right on phones, above the tab-bar.
- **Why outside the grid:** it belongs to the viewport, not a cell. Modals,
  toasts and the walkthrough also sit here.

#### Kosmos (background canvas)

- **Contents:** `<KronkKosmos>`, a faint night sky behind everything. Each star
  is a real Mates connection crossing the current depth of the community orb,
  which sweeps crown to floor and back about every ten minutes. It should never
  visibly move.
- **Data:** the live orb from `GET /api/v1/kommunity/orb` (`use_mates_orb.ts`),
  the same data the Kommunity orb draws.
- **Position:** one canvas, `position: fixed; inset: 0; z-index: 0;
pointer-events: none`, with its own vignette so text always wins. This is the
  one deliberate exception to "chrome lives in the grid"; Standard L11 and the
  doctor allow it.
- **Brightness:** a single knob in `features/kosmos/brightness.ts`, default 0.
  `useKosmosPresence()` lifts it on `/me`, `/settings` and `/kronk`; the Inflow
  veil animates it.
- **Reduced motion:** freezes on the middle of the orb, fully lit.
- **Files:** `features/kosmos/`, `styles/mastodon/_kronk_kosmos.scss`, the
  `--kosmos-*` tokens.

### Responsive strategy

`.kronk-frame` has `container-type: inline-size; container-name: frame`. It is
on the Frame, not `body`, because putting it on `body` would change the
containing block for `position: fixed` descendants.

- **≤ 889px** is the phone shape: BottomBand shows, RightBand hides, the header
  row stacks. The rule on `.kronk-frame` itself has to be a media query (an
  element can't query its own container); descendants use
  `@container frame (width <= 889px)`. Some band rules are still plain `@media`.
- **≤ 629px** also hides the top rail.

Wider breakpoints are the korner's business.

### Reserved-slot contract

| Slot         | Class                   | Owned by                              |
| ------------ | ----------------------- | ------------------------------------- |
| Space badge  | `.space-badge`          | `<SpaceBadge>` via `<AutoSpaceBadge>` |
| View picker  | `.space-view-picker`    | `<SpaceViewPicker>`                   |
| Stage        | `.kronk-stage`          | `<Stage>`                             |
| Sidebar tile | `.korner-sidebar__tile` | `<KornerSidebar>`                     |
| Ж menu       | `.kronk-menu`           | `<KronkMenu>`                         |

The grid cells are `.kronk-frame__{top-band,space-nav,stage,right-band,bottom-band}`.
A korner never reimplements the badge or the view switch. In development,
`<Stage>` logs a "Frame parasite" warning when a korner draws its own, and the
doctor checks for it (Standard L11).

### Rules

1. **The Frame is the same on every page.** Wordmark, switcher, rail and Ж menu
   don't vary per space. A new persistent affordance is a Frame change, not a
   per-space add-on.
2. **Chrome should be a grid child, not a fixed overlay.** The inner chrome
   (wordmark, switcher, sidebar) lays out in its slot. The slot strips, the
   chrome surface and the BottomBand are still `position: fixed`, because many
   pages still render through Mastodon's classic `<Column>` and
   `.columns-area` (see [Open](#open)). Don't add a new fixed overlay.
3. **Stage owns its content, not its geometry.** The Frame gives Stage a
   rectangle; the korner fills it.
4. **No korner-level breadcrumb pill.** `<SpaceBadge>` is the way back. The old
   `KornerSubBar` and SubBand are gone.
5. **The title and tagline belong to the Frame.** `<AutoSpaceHeader>` renders
   the `<h1>` and tagline. A korner must not emit its own `<h1>` or repeat the
   tagline. Other lede copy is content and is fine.

### Related files

- `features/ui/index.jsx`: where the Frame mounts.
- `components/kronk_frame.tsx`: the Frame.
- `components/stage.tsx`: `<Stage>`.
- `components/space_header_row.tsx` and the `auto_space_*` components.
- `styles/mastodon/_kronk_frame.scss` (grid), `_kronk_chrome.scss` (chrome),
  `_kronk_stage.scss` (Stage).

---

## Card standard

**Primitive:** `<StandardCard>`, `components/standard_card.tsx`, styled in
`_standard_card.scss`.

### What a card is for

> "What I want from this is basically a wrapper for content from all sorts of
> spaces to fit a mould so they can slip into other spaces… rather than
> building the infrastructure of each page to show specialty and different
> content, I want to be able to build them to take the standard card, then any
> content fits within the card and the navigation and layout can become
> familiar across spaces to a user." — Tal, 2026-09-12

A card is the **unit of content that travels**. An album belongs to Albutts but
can appear in a feed, on a profile shelf or in a grid. A space builds against
the card, not the content. A korner describes its content once and it can show
up anywhere.

### The contract: six slots

Every card is made of the same six slots: `CardBadge`, `CardMedia`,
`CardTitle`, `CardMeta`, `CardBody` and `CardActions`. A korner fills the ones
it has; the arrangement decides which are drawn and how large.

| Slot      | What it holds                          | Example (Albutts)           |
| --------- | -------------------------------------- | --------------------------- |
| `media`   | the visual: image, map glimpse, avatar | the album cover             |
| `badge`   | which korner this came from            | `ALBUM`                     |
| `title`   | one line, the name of the thing        | "27th Birthday"             |
| `meta`    | a short run of facts                   | "14 photos · 1 contributor" |
| `body`    | prose, clamped                         | the album description       |
| `actions` | what you can do without opening it     | contributor avatars, froth  |

1. **A slot is optional, never re-purposed.** No image means `media` stays
   empty; the title doesn't move into it.
2. **The arrangement decides size, the content never does.**

`meta` may appear twice where a card has two runs of facts around a divider
(Booth's feed card). The others appear at most once.

**Slot styles are defaults.** They are written through `:where()`, which adds
no specificity, so any korner rule beats them. Arrangement rules are not, since
what a grid tile draws is a decision.

**Prose** (`body`) is two lines, `0.875rem`, secondary colour, everywhere.

### Three arrangements

The same card three ways (`variant`):

- **`flow`** (feed): badge, media, title, meta, body, actions. Height follows
  the content. `<StatusKornerCard>` and every feed card, and Kommons proposal
  cards, use it.
- **`portrait`**: fixed 9:19.5, media dominant, sized so it can never exceed
  the viewport. For content that is uniform and seen one at a time. Today:
  `<ProfileCard>` in the Kommunity deck.
- **`grid`**: media and title, at most one meta line. Two across on a phone,
  four from 720px (`<SpaceGrid>` / `<SpaceCard>` in `space_grid.tsx`). Used by
  Albutts, Booth, Kalendar events and Wachuneed.

### Decisions, and why

**The home feed stays flow, not portrait.** Horizontal swipe on the feed
already steps the scope (Mates / Orbit / Kronkverse), and portrait would need
the same gesture for next-item. The feed is also a scanning surface, and its
content varies too much in length for one-per-screen.

**The badge is a pill everywhere except the feed.** On a single-korner board
the badge is a quiet label. In the home feed, consecutive cards come from
different korners and the badge tells them apart, so it is a full-width bar
across the top (an override in `_status_korner_card.scss`). If you want the bar
somewhere else, that surface is mixing korners and should say so.

**No separate wide-screen card.** Wider screens get more grid columns, not a
second card.

**The korner describes its content once.** `feed_projection.card` fills slots;
it does not draw a card. Adding a korner should never mean editing a space that
shows it.

### What deliberately stays bespoke

- **The Kuestions deck card.** A deck: stacked, drag-to-skip, sized by the
  deck. A Kuestion that travels uses the feed card.
- **The Map pin card.** A dialog anchored to a pin, never in a collection.
- **The Explore suggestions card.** Upstream Mastodon, and an account rather
  than korner content; changing it would cost every upstream merge.

---

## Membrane navigation

The **Membrane** is the platform nav in the TopBand on desktop
(`HubSwitcher variant="top"`, styled as `.hub-switcher--top` in
`_kronk_chrome.scss`).

### Anatomy

```
   [Me]   [Home]   [AWAWB]   [Hub]   [Nudges•]
  ─────────────────────────────────────────────  ← the wire
```

- **Pillars:** five, in order: **Me** (`/me`), **Home** (`/home`), **AWAWB**
  (`/awawb`, an Aboriginal-flag glyph), **Hub** (`/hub`), **Nudges**
  (`/nudges`). It is a `role="tablist"`; each pillar is a `role="tab"` with
  `aria-selected`.
- **Icons, not words.** Each pillar shows the icon from its manifest
  (`profile`, `feed`, `hub`, `nudges`); Me shows your avatar. The text label is
  visually hidden but still announced.
- **Selection** is the active pillar itself: a tinted tile (`--kronk-purple-accent`
  mixed at 28%, inset ring). It's the same treatment as the active korner in the
  sidebar, so both navs speak one language. Resting pillars are `--text-muted`,
  hovered ones `--text-secondary`. Focus is a 3px `--kronk-purple-bright`
  outline.
- **Nudges** carries the unread count badge.
- **The wire** is a hairline in `--border-subtle` along the bottom.

### The wire carries arrivals

When the unread Nudges count goes up, a glint travels along the wire towards
Nudges (`.is-arriving`, about 0.9s). It fires only on a real increase, never on
a timer. With `prefers-reduced-motion`, the glint is off; the badge still
updates.

### What changed from the original design

The first design had a pool of light gliding along the wire under the active
pillar, flat text labels, and the same idiom on every in-korner sub-nav. As
built:

- The top bar marks selection with the tile, not a pool (Tal, 2026-08-13).
- The pool survives in one place: the position strip under the rotating title
  (`.scope-title__progress`), which uses the same wire and glow.
- In-korner navigation is the Frame's view switch (rotator, pills or menu, see
  [Frame](#frame) SpaceNav), not a Membrane row.

### Phones

The phone tab-bar (`HubSwitcher variant="bottom"`) has the same five pillars as
icon tabs. It has no wire and no arrival glint.

---

## Platform primitives

The index to `git grep` before you write something new. Shared pieces are
spread by kind (`components/`, `hooks/`, `config/`), which keeps upstream
merges tractable but means there's no single folder to browse. **Index only**:
read the file for how it works.

**When you add a shared primitive, add a row. When a row is wrong, fix it in
the same PR.** Paths are under `app/javascript/mastodon/` unless they start
with `app/`, `config/` or `styles/`.

### Layout & Chrome

| Primitive                                                                               | What it does                                                                                                            | Where                                                                                   |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `<KronkFrame>`                                                                          | The grid every route mounts inside. See [Frame](#frame).                                                                | `components/kronk_frame.tsx`, `styles/mastodon/_kronk_frame.scss`, `_kronk_chrome.scss` |
| `<Stage>`                                                                               | The rectangle every korner paints into. Owns scroll; hosts the header override.                                         | `components/stage.tsx`, `styles/mastodon/_kronk_stage.scss`                             |
| `.stage-fill` / `.stage-column` / `.stage-grid`                                         | The three shared shapes for a Stage child. Vertical scroll only.                                                        | `styles/mastodon/_kronk_stage.scss`. decisions.md, 2026-08-13                           |
| `<KornerShell>`                                                                         | The wrapper a korner's root renders: owns `<Stage>` and URL-to-view routing from a `views` map. Use it for new korners. | `components/korner_shell.tsx`; template in `docs/korners/template/`                     |
| `<SpaceHeaderRow>` + `<AutoSpaceBadge>` + `<AutoSpaceHeader>` + `<AutoSpaceViewPicker>` | The header row: back badge, title and tagline, view switch. Manifest-driven.                                            | `components/space_header_row.tsx`, `auto_space_*.tsx`, `space_badge.tsx`                |
| `useSpaceHeaderOverride`                                                                | Put a route's own title in the header slot.                                                                             | `components/space_header_override.tsx`                                                  |
| `<ScopeTitle>`                                                                          | The rotating title (chevrons, tap halves, position strip) for `header.rotator: true` and `/home`.                       | `components/scope_title.tsx`                                                            |
| `<FeedDrum>`                                                                            | The quarter-turn animation when the rotator changes face (home and most korners).                                       | `components/feed_drum.tsx`                                                              |
| `<SettingsSpaceHeader>`                                                                 | A settings page's title, pushed into the header slot.                                                                   | `features/settings/space_header.tsx`                                                    |
| `<StandardCard>` + slot components                                                      | The card shell: six slots, three arrangements. See [Card standard](#card-standard).                                     | `components/standard_card.tsx`                                                          |
| `<SpaceGrid>` + `<SpaceCard>`                                                           | The grid arrangement as a ready-made tile grid.                                                                         | `components/space_grid.tsx`                                                             |
| `<KronkStarfield>`                                                                      | Ambient starfield backdrop for individual surfaces.                                                                     | `components/kronk_starfield.tsx`, `styles/mastodon/_stars.scss`                         |

### Compose + confirmation

| Primitive                                | What it does                                                                                                                            | Where                                                                                                |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `<ComposeShell>`                         | The floating composer overlay every korner's composer renders inside: portal, dim backdrop, korner-icon header, Cancel + Submit footer. | `components/compose_shell.tsx`, `styles/mastodon/_compose_shell.scss`. decisions.md, 2026-08-12      |
| `<KronkMenu>` (the Ж button)             | The one entry point for composing. Reads `compose:` from the current korner's manifest; no per-page FABs.                               | `features/ui/components/kronk_menu.tsx`                                                              |
| `<ConfirmDialog>` + `useConfirmDialog()` | The "are you sure?" modal, with a destructive variant. The hook returns `[dialog, confirm]`; `confirm(opts)` is a Promise.              | `components/confirm_dialog.tsx`, `hooks/useConfirmDialog.tsx`, `styles/mastodon/_kronk_confirm.scss` |

### Audience / Reach

| Primitive                                         | What it does                                                                                                | Where                                                                          |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `<ReachDropdown>`                                 | "Who sees this?" Values `self_only` / `mates` / `orbit` / `public`, plus krews. Same vocabulary everywhere. | `components/reach_dropdown.tsx`. Spec: [`docs/spaces/feed.md`](spaces/feed.md) |
| `<ScopeMark>`                                     | The reach-ring glyph on feed cards and composers.                                                           | `components/scope_mark.tsx`                                                    |
| `useAvailableKrews`                               | Loads your Krews for the krew axis on composers.                                                            | `hooks/useAvailableKrews.ts`                                                   |
| `<KornerVisibilityPicker>` + `<KornerKrewPicker>` | Korner-scoped audience controls.                                                                            | `components/korner_visibility_picker.tsx`, `korner_krew_picker.tsx`            |

### Feed & status projection

| Primitive                                                                                       | What it does                                                                                                                      | Where                                                                           |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `<StatusKornerCard>`                                                                            | The shared feed card frame on `<StandardCard variant='flow'>`: container, badge bar, whole-card click-through, keyboard handling. | `components/status_korner_card.tsx`, `styles/mastodon/_status_korner_card.scss` |
| `Status{Albutts,Art,Booth,Cinema,Event,Karporn,Kommons,Kronikles,Kuestions,Trek,Wachuneed}Card` | Per-korner card bodies. All eleven wrap `<StatusKornerCard>`.                                                                     | `components/status_*_card.tsx`                                                  |
| `<KornerCards>`, `<StatusSpaceBar>`, `<StatusKrewBadge>`                                        | Sub-parts of status and feed chrome.                                                                                              | `components/korner_cards.tsx`, `status_space_bar.tsx`, `status_krew_badge.tsx`  |

### Korner framework

| Primitive                                 | What it does                                                                                           | Where                                                                                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Korner registry                           | Loads every manifest at boot, warns on drift, powers `Kronk::Korner.for(slug)`.                        | `config/initializers/kronk_korner_registry.rb`. Reference: [`docs/korners/adding_a_korner.md`](korners/adding_a_korner.md) |
| Korner manifests                          | One file per korner: identity, resources, security, feed projection, settings, views, header, compose. | `config/korners/*.yaml`                                                                                                    |
| Reserved slugs                            | Slugs a korner can't claim.                                                                            | `config/korners/reserved_slugs.yaml`                                                                                       |
| `useKorner(slug)` + `useKornerIcon(slug)` | Read manifest data (name, icon, tagline, views) in React.                                              | `hooks/useKorner.ts`, `hooks/useKornerIcon.tsx`                                                                            |
| The Korner Standard                       | The conformance spec every korner meets. Read it before touching a manifest.                           | [`docs/korners/korner_standard.md`](korners/korner_standard.md)                                                            |
| `bin/tootctl korners doctor`              | Checks manifests against the Standard.                                                                 | `lib/mastodon/cli/korners.rb`, `.github/workflows/korners-doctor.yml` (non-blocking, `continue-on-error: true`)            |
| `<KornerIframe>`                          | Wrapper for korners still mounted as an iframe.                                                        | `components/korner_iframe.tsx`                                                                                             |
| `<KornerGlyph>`                           | Thin line-art glyph per korner for Hub tiles; the manifest's `icon.glyph_path` wins.                   | `components/korner_glyph.tsx`                                                                                              |

### Design tokens & aesthetic system

| Primitive                      | What it does                                                                       | Where                                                                 |
| ------------------------------ | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `tokens.yaml` → `_tokens.scss` | The design-token source, generated into SCSS. Never hand-edit the SCSS.            | `app/javascript/mastodon/tokens/tokens.yaml`, `bin/generate-tokens`   |
| Stylelint rules                | Back-link ban (error); raw hex and pixel radius (warnings), on the governed files. | `stylelint.config.js`. See [Aesthetic system](#aesthetic-system) §2.1 |

### Krew primitive (the audience axis)

| Primitive                        | What it does                                          | Where                                                                                 |
| -------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `Krew` model + `KrewKorner` join | The user-facing group primitive, separate from reach. | `app/models/krew.rb`, `krew_korner.rb`. Spec: [`docs/spaces/krew.md`](spaces/krew.md) |
| `useAvailableKrews`              | Composer-side hook (see Audience above).              | `hooks/useAvailableKrews.ts`                                                          |
| `<KornerKrewPicker>`             | Scope a post to specific Krews.                       | `components/korner_krew_picker.tsx`                                                   |

### Detail pages

| Primitive        | What it does                                                                                                                                         | Where                                                                |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `<KornerDetail>` | The shell for a korner's detail page. Slots: `hero`, `banner`, `title` + `titleIcon`, `subtitle`, `meta`, `actions`, `children`. On `.stage-column`. | `components/korner_detail.tsx`, `styles/mastodon/_kronk_detail.scss` |
| `<KornerMeta>`   | The middle-dot facts line under a title. Falsy items drop out, so conditionals can be inline.                                                        | `components/korner_meta.tsx`, `styles/mastodon/_kronk_meta.scss`     |
| `<BackToKorner>` | An explicit back chip to a named parent (`.kronk-back-chip`).                                                                                        | `components/back_to_korner.tsx`                                      |

### Actions

| Primitive           | What it does                                                                                                    | Where                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `<KornerActionBar>` | The row of pill actions under content. Wraps on narrow phones. `align`: `start` / `end` / `center` / `between`. | `components/korner_action_bar.tsx`, `styles/mastodon/_kronk_action_bar.scss` |
| `<KornerPill>`      | Rounded pill button: icon, label, `default` / `primary` / `destructive`, and an `active` state.                 | `components/korner_pill.tsx`                                                 |

### State indicators

| Primitive        | What it does                                                                                          | Where                                                                |
| ---------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `<EmptyState>`   | The "nothing here yet" pattern: muted title, optional body, optional CTA. No icon (the badge has it). | `components/empty_state.tsx`, `styles/mastodon/_kronk_states.scss`   |
| `<LoadingState>` | Mastodon's `<LoadingIndicator>` in Kronk layout, with an optional label, inline.                      | `components/loading_state.tsx`, `styles/mastodon/_kronk_states.scss` |

### Inter-korner communication

| Primitive                          | What it does                                                                                                             | Where                                                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `emits:` / `listens:` in manifests | Declared signals between korners, loaded by the registry.                                                                | `config/initializers/kronk_korner_registry.rb`. Contract: `docs/korners/adding_a_korner.md`                   |
| Nudges pipeline                    | The notification path every korner sends alerts through.                                                                 | `features/nudges_messenger/`, `app/models/notification.rb`. Spec: [`docs/spaces/nudges.md`](spaces/nudges.md) |
| `useAttachments(slug, id)`         | Read, create and remove cross-korner attachments (`spawn` / `link` / `reference`) for a record.                          | `hooks/useAttachments.ts`, `api/attachments.ts`                                                               |
| `<AttachmentSection>`              | The "Attached" block on a detail page; owner-only remove; silent when empty.                                             | `components/attachment_section.tsx`, `styles/mastodon/_kronk_attachment.scss`                                 |
| `<AttachmentPicker>`               | Modal to attach: target korner (from the manifest's `attaches:`), search of `/api/v1/attachments/candidates`, one click. | `components/attachment_picker.tsx`                                                                            |

### Where the spread bites

1. **Header pieces are split.** `<KronkFrame>` and the space-header pieces are
   in `components/`; the switcher and Ж menu are in `features/ui/components/`.
2. **Compose SCSS is split.** `_compose_shell.scss` holds the shell; each
   composer body's styles live in that korner's partial.
3. **Docs.** Cross-cutting design is here; korner rules are in
   `docs/korners/korner_standard.md`.

None of these is worth reorganising the tree over (upstream-merge cost), which
is why this index exists.

## Signup and the thresholds

How someone becomes a member. Rails-served under the `kronk_void` layout
(starfield, vignette, content) at `/auth/sign_up` and `/invite/:code`.
Existing members re-cross at `/auth/thresholds`. The first-run walkthrough
below picks up where this ends.

The thresholds are three vows, the membership statement. They are not a
terms-of-service click-through.

**The flow.** One form, two sections (`auth/registrations/new.html.haml`,
driven by `entrypoints/signup.ts`):

1. **Account.** Optional avatar, username, email, password. There's no
   password confirmation; agreement is implicit (hidden input). The username
   is checked live against `GET /auth/username_available`, which is
   throttled to 20 per minute per IP and is only a courtesy: the model
   decides on submit. **Continue** moves to the ceremony; it doesn't submit.
2. **The thresholds.** Three rings around Ж, crossed in order. Each has one
   vow, a checkbox and _Tell me more_. Crossing is one-way once begun.
   **Enter** on the arrival panel submits everything in one POST, with
   `user[thresholds][ownership|custodianship|trajectory]` set by the
   ceremony.

`Auth::RegistrationsController#create` refuses the whole signup (422, no
user created) unless all three vows are present. On success it records the
crossing in the same transaction as the account, turns on follower approval
for the new account, and lands the member on `/`. Email confirmation is a
reminder nudge, not a gate (`decisions.md`, 2026-08-16).

**Existing members.** Anyone whose `thresholds_version` is nil or below the
current version is redirected to `/auth/thresholds` on any signed-in HTML
request (`ApplicationController#require_crossed_thresholds!`). That page is
the same ceremony, standalone. API and OAuth paths are not gated, so clients
keep working.

**The vows.** The copy lives only in `config/locales/en.yml` under
`kronk.thresholds` (`vow.<key>.vow` and `vow.<key>.more`). The version is
`Kronk::Thresholds::CURRENT_VERSION` (currently 3). **Bump it when a vow
line changes materially**, and everyone below it re-crosses on their next
visit. Edits to _Tell me more_ don't bump it.

**The record** is two columns on `users`: `thresholds_agreed_at` and
`thresholds_version`. That's all on purpose. There's no per-vow row, no
audit trail, no IP or user agent, and no record of whether anyone opened
_Tell me more_. The password meter and avatar preview never leave the
browser.

## First-run walkthrough

A short tour of the platform shape: Home, Me, Hub, Nudges and the Ж menu. It
fires for any signed-in member who hasn't dismissed it, so it picks up where
[signup](#signup-and-the-thresholds) ends.

### The steps

Seven bubbles, defined in `components/walkthrough/steps.tsx` (`INTRO_STEPS`).
Each names a `route` (the runner navigates there first), an `anchor` (or none,
for a centred bubble) and its copy.

| #   | id              | Route     | Anchor                    | Title                |
| --- | --------------- | --------- | ------------------------- | -------------------- |
| 1   | `intro/welcome` | `/home`   | none (centred, rose mark) | Welcome Home!        |
| 2   | `intro/home`    | `/home`   | `nav-home`                | Your feed, your home |
| 3   | `intro/profile` | `/me`     | `nav-me`                  | You and your Kronk   |
| 4   | `intro/hub`     | `/hub`    | `nav-hub`                 | Hub                  |
| 5   | `intro/nudges`  | `/nudges` | `nav-nudges`              | Nudges               |
| 6   | `intro/zh`      | `/home`   | `zh-menu`                 | Ж                    |
| 7   | `intro/done`    | `/home`   | none (centred)            | Kronk is all yours!  |

Anchors are `data-walkthrough-anchor` attributes: one per pillar on both
`HubSwitcher` variants (`nav-<key>`), and `zh-menu` on the Ж button. On step 6
the runner forces the Ж menu open (`openZhMenu`, read by `kronk_menu.tsx`
through `selectWalkthroughForceZhOpen`) and parks it mid-screen so the bubble
and the open ring don't overlap.

### The bubble

`<WalkthroughStep>` (`components/walkthrough/step.tsx`), styled in
`_walkthrough.scss`:

- Title, close (×), body, progress dots with `n / total`, **Back** and **Next**
  (**Finish** on the last step), and a **Don't show this again** checkbox on
  every step.
- `role="dialog"`, `aria-live="polite"`, with an `aria-label` naming the step.
  Focus moves to Next on each step. Keys: → next, ← back, Esc close.
- **Anchored steps** get a spotlight: a purple ring around the target and the
  rest of the screen dimmed. The anchor is scrolled into view and measured;
  on desktop the bubble goes on the side with the most room, with an arrow
  (`use_anchor_position.ts`). Below 768px the bubble docks to the bottom as a
  sheet with no arrow.
- **Centred steps** blur and lightly wash the whole page.
- The backdrop takes all pointer input, so the app can't be used behind an
  open bubble.
- Reduced motion turns off the fade and rise animations.
- If an anchor isn't on the page, the bubble shows centred with no spotlight.

The chrome labels are translated (`walkthrough.*` in the locale files). The
step titles and bodies are English strings in `steps.tsx`.

### When it fires, and how it stops

- **Auto-start.** `<WalkthroughRunner>` (`components/walkthrough/runner.tsx`)
  mounts in `features/ui/index.jsx` for signed-in users. Unless the account has
  dismissed the tour, it starts once per page load, half a second after first
  paint.
- **Close (×), or Finish without the box ticked**, ends this run only. The
  tour comes back on the next full page load.
- **Don't show this again**, then Close or Finish, dismisses it for the
  account: the runner sends `PUT /api/v1/settings/walkthrough` with
  `{ dismissed: true }`.
- **Restart.** The settings hub (`/settings`) has a **Restart the walkthrough
  tour** button. It clears the flag on the server and in the client and goes to
  `/home`, where the tour starts again.

### Where state lives

- **Server (authoritative, per account):** the user setting
  `web.walkthrough_dismissed` (`UserSettings`, default false). It reaches the
  client as `initial_state.walkthrough_dismissed`, and
  `Api::V1::Settings::WalkthroughController` reads and writes it
  (`GET` / `PUT /api/v1/settings/walkthrough`, `{ dismissed: bool }`). Dismissing
  on one device dismisses it everywhere.
- **Browser (per device):** the Redux slice `walkthrough`
  (`reducers/walkthrough.ts`) keeps the current step, the checkbox and the
  steps seen in `localStorage["kronk.walkthrough.seen.v1"]`, so a reload
  mid-tour resumes. When signed in, the server flag always wins over the stored
  one, so switching accounts in one browser doesn't leak a dismissal.

## Open

- **Raw hex isn't blocked.** `color-no-hex` and the radius rule are warnings,
  so they don't fail CI. The repo `CLAUDE.md` says stylelint fails the build,
  and also names `--motion-*` tokens, which don't exist (they're `--dur-*` and
  `--ease-*`). Decide whether to make the warnings errors or change the wording.
- **Chrome still uses fixed positioning.** Many pages still render through
  Mastodon's `<Column>` and `.columns-area`. Among them are home, profile,
  `/me`, status pages, Nudges threads and the org pages. Until they move to
  `<Stage>`, the slot strips stay `position: fixed`.
- **The cover-glow is used in one place.** The aesthetic calls it the korner
  header treatment, but only the profile uses it.
- **`<KornerShell>` adoption.** The Standard and `CLAUDE.md` say every korner
  uses it. Five do (Klot, Kommunity, Moments, Rose, Wachuneed); the rest render
  `<Stage>` directly.
- **`<ScopeCarousel>`** (`components/scope_carousel.tsx`, the 3D barrel) is
  only used in Storybook. Keep it or delete it.
- **The badge differs by surface.** A bar in the feed, a pill elsewhere. The
  reasoning holds, but revisit when there are more grid surfaces.
- **No `<KornerTile>` / `<KornerListRow>`.** Hub tiles, Krew cards, Mate rows
  and Kalendar list rows are each their own rectangle. A shared tile was
  deferred because Hub's tile carries too much of its own chrome. Shipped
  korners that still write their own `-empty` / `-loading` / `-meta` /
  `-detail` blocks can move to the primitives one per PR.
- **`--destructive` and `--warning-red`** are two reds. Decide whether they
  merge.
- **Walkthrough:**
  - The step copy isn't translatable yet; it lives in `steps.tsx`.
  - There are no per-korner introductions. The original design had a
    just-in-time bubble on each korner's first visit and a delta tour by
    version; neither is built.
  - Auto-advance when the member does the thing the bubble describes: not
    built, and the leaning was never to.
  - The header comment in `WalkthroughController` still calls restart "a
    future PR"; it shipped.
- **Signup:** see the review questions on PR #1975 (API-created accounts never
  cross the thresholds; no `decisions.md` entries yet).

## History

Rewritten 2026-10-05 to describe what is built. Until 2026-10-04 this file was
six separate docs: the aesthetic system, the Frame, the card standard, the
Membrane nav spec, the platform primitives index and the walkthrough design.
Their earlier designs, migration status and build orders are in git:
`git show 231cca937:docs/design.md`.
