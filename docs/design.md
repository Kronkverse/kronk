# Kronk design

The visual and layout reference for Kronk: tokens and aesthetic rules, the
Frame every page renders inside, the card standard, the Membrane navigation
idiom, the index of shared platform primitives, and the first-run walkthrough.

The rules you need day to day are summarised in `CLAUDE.md` under **Aesthetic —
the rules**. This file is the detail behind them. Each part below was a
separate doc until 2026-10-04; their own status notes and dates are kept.

---

## Aesthetic system

_Merged into this file on 2026-10-04 from `docs/kronk_aesthetic_system.md`; its own status notes and dates are kept as written._

> **What this is.** A single, self-contained reference for Kronk's visual identity as of the 2.0.0 rebuild: the design tokens (with real values), the aesthetic principles that govern how anything is built, the shared component kit, and the korner-manifest framework that new spaces are authored against. It's written to be dropped into a Claude Project as knowledge so korner rebuilds can be planned consistently without re-reading the whole codebase.
>
> **Provenance.** Compiled from the live repo (`app/javascript/mastodon/tokens/tokens.yaml`, the SCSS partials, the korner registry, `features/styleguide/`) plus the 2.0.0 rebuild design decisions. Where the older `docs/korners/adding_a_korner.md (Framework spec (v0.5))` still describes the retired "planet metaphor" (v0.5), **this document supersedes it** for anything visual.

---

### 1. Identity in one paragraph

Kronk is **one platform, one palette**. Every space — profile, hub, kommons, events, settings, each korner — wears the same **Kronk-purple** identity on a **dark-first** surface. Differentiation between spaces comes from **icon, name, and content**, never from a bespoke colour. The look is calm, deep, and slightly luminous: dark purple-tinted surfaces, a bright indigo accent, generous corner-rounding, and a signature layered purple **cover-glow** at the top of feature surfaces. Serif display type over a sans body gives it a considered, editorial feel rather than a generic-app feel.

#### Principles (the rules that don't bend)

1. **Everything through tokens.** No raw hex, rgb, or hard-coded spacing/motion values in feature CSS. Colours, radii, elevation, and motion all come from CSS custom properties generated from `tokens.yaml`. This is **enforced by stylelint** on governed feature CSS — a raw hex in a governed file fails the build. (Coverage is being extended to the korner-card partials.)
2. **Kronk-purple is platform-wide.** The palette applies everywhere. Per-space colour identity is retired. When you need an accent, use `var(--accent)`; do not introduce a new brand colour for a korner.
3. **Dark is the default; light is a first-class mirror.** Every themed token has both a `dark` and a `light` value. Build against the semantic aliases and both themes come for free — never branch on theme in feature code.
4. **The planet metaphor is gone.** Pre-2.0.0, each space "orbited" a coloured planet and cards themed from a `--space-color` custom property. That was retired to consolidate identity. `--space-color`, its transitional alias, and `planets.tsx` itself have all been removed from the code — no shim survives (`find app/javascript -iname '*planet*'` returns nothing).
5. **Radius has a language.** Small for controls, medium for cards, large for feature surfaces/sheets, round for pills and avatars. Use the named radius tokens, not pixel values.
6. **Semantic over literal.** Reference `--accent`, `--surface-elevated`, `--decision-agree` — not the raw palette token behind them. The consumer aliases are the contract; the palette can shift underneath.

---

### 2. Design tokens

#### 2.1 The pipeline

```
app/javascript/mastodon/tokens/tokens.yaml     ← the single source of truth (edit this)
        │  bin/generate-tokens
        ▼
app/javascript/styles/mastodon/_tokens.scss    ← GENERATED — never hand-edit
```

- `tokens.yaml` declares every token. Colours that differ by theme are authored as `{ dark: …, light: … }`; theme-invariant tokens (radius, motion, fonts) are authored as a single value.
- `bin/generate-tokens` emits `_tokens.scss` with a `:root` block (theme-invariant + dark values) and a `[data-theme='light']` block (light overrides). It emits **single-quoted** selectors so prettier doesn't reformat and re-break the CI check.
- CI runs `bin/generate-tokens --check` — if the committed `_tokens.scss` doesn't match what the generator would produce, the build fails. **Always regenerate after editing `tokens.yaml`; never edit the SCSS directly.**

#### 2.2 Palette (raw brand colours)

These are the underlying brand ramp. **Feature code should almost never reference these directly** — use the semantic aliases in §2.3. Listed here so the palette is legible.

| Token                    | Dark      | Light     | Role                       |
| ------------------------ | --------- | --------- | -------------------------- |
| `--kronk-purple-primary` | `#32237c` | `#3034a0` | Core brand purple          |
| `--kronk-purple-bright`  | `#7241ff` | `#6364ff` | Luminous highlight (glows) |
| `--kronk-purple-deep`    | `#3a218b` | `#36248c` | Deep shadow purple         |
| `--kronk-purple-muted`   | `#413c8c` | `#45455f` | Desaturated support purple |
| `--kronk-purple-accent`  | `#4414cc` | `#6364ff` | Interactive indigo accent  |

#### 2.3 Semantic tokens (the contract — build against these)

**Accent**

| Token      | Dark      | Light     |
| ---------- | --------- | --------- |
| `--accent` | `#4414cc` | `#6364ff` |

**Surfaces**

| Token                | Dark      | Light     | Use                         |
| -------------------- | --------- | --------- | --------------------------- |
| `--surface-primary`  | `#191b22` | `#ffffff` | Page background             |
| `--surface-elevated` | `#292938` | `#f5f4f9` | Cards, menus, raised panels |

**Borders & text**

| Token              | Dark      | Light     |
| ------------------ | --------- | --------- |
| `--border-default` | `#47368b` | `#ddd9e8` |
| `--text-primary`   | (light)   | (dark)    |
| `--text-secondary` | muted     | muted     |
| `--text-muted`     | faint     | faint     |

**Status**

| Token             | Dark      | Light     |
| ----------------- | --------- | --------- |
| `--warning-red`   | `#ef4444` | `#c53030` |
| `--success-green` | `#4b9160` | `#276749` |

**Decision colours** (governance / voting — agree / abstain / block / pending)

| Token                | Dark      | Light     |
| -------------------- | --------- | --------- |
| `--decision-agree`   | `#22c55e` | `#16a34a` |
| `--decision-abstain` | `#94a3b8` | `#64748b` |
| `--decision-block`   | `#ef4444` | `#c53030` |
| `--decision-pending` | `#f59e0b` | `#c2410c` |

Consumers that need a translucent tint of a decision colour use `color-mix()` against the token rather than a second hard-coded rgba (e.g. governance chips, kommons card backgrounds).

#### 2.4 Typography

| Token            | Value                                                 |
| ---------------- | ----------------------------------------------------- |
| `--font-display` | `'Liberation Serif', Georgia, serif`                  |
| `--font-body`    | `mastodon-font-sans-serif, sans-serif`                |
| `--font-mono`    | `'Roboto Mono', 'Fira Mono', ui-monospace, monospace` |

Display serif is used for headings and feature titles; body sans for everything else. The serif is what gives Kronk its editorial character — reach for `--font-display` on titles rather than bolding the sans.

#### 2.5 Radius

Kronk's **universal corner language** — everything rounds; there are no sharp corners in the shell. If a surface can't fit a radius, it becomes a hairline divider (a `--border-default` line, not a box).

| Token             | Value   | Use                                                                      |
| ----------------- | ------- | ------------------------------------------------------------------------ |
| `--radius-small`  | `6px`   | Inline chips, small icon buttons, focus rings, dropdown items            |
| `--radius-medium` | `10px`  | Cards, panels, dropdowns, sidebar korner tiles, menu items               |
| `--radius-large`  | `16px`  | Hero surfaces — top strip, sidebar, hub korner cards, menu panel, modals |
| `--radius-round`  | `999px` | Pills — hub switcher, tags, badges, capsule buttons, avatars, toggles    |

Buttons follow the same rules: primary CTAs are `round` pills; secondary/tertiary are `small` or `medium`; chip picks are `round`. Borders on interactive surfaces are always **1–1.5px** in `--border-default` or a semantic-accent tint — never thicker.

#### 2.6 Elevation

Four levels, each a token defining a box-shadow: `--elevation-subtle`, `--elevation-card`, `--elevation-floating`, `--elevation-menu`. Use the named level for the role (a dropdown menu uses `--elevation-menu`, a resting card uses `--elevation-card`) rather than composing shadows by hand.

#### 2.7 Motion

| Token                  | Value             | Use                         |
| ---------------------- | ----------------- | --------------------------- |
| `--motion-dur-fast`    | `120ms`           | Hovers, small state changes |
| `--motion-dur-medium`  | `200ms`           | Most transitions            |
| `--motion-dur-slow`    | `400ms`           | Sheets, large reveals       |
| `--motion-ease-out`    | ease-out curve    | Enter transitions           |
| `--motion-ease-in-out` | ease-in-out curve | Move/resize                 |
| `--motion-ease-spring` | spring curve      | Playful/emphasis            |

---

#### 2.8 The per-user layer — Personal Appearance

The tokens above are **brand defaults**. Kronk also lets each person tune a constrained slice of the aesthetic (Personal Appearance): a **purple-locked accent** (the hue is held to the Kronk range, so it can never leave the identity), theme (dark/light), display + body font, UI scale, and reduced motion. These are applied client-side by `utils/personal_appearance.ts`, which writes the choices as CSS custom properties onto `:root` (e.g. `root.style.setProperty('--accent', …)`), **layering over** the generated defaults.

**Consequence for everything you build:** referencing `var(--accent)` and the semantic tokens isn't only about brand consistency — it's what makes per-user theming work. A component that hard-codes a hex, or reaches past a semantic alias to a raw palette token, silently opts the user out of their chosen accent/theme/scale. This is the deeper reason "everything through tokens" (§1) is non-negotiable: the token layer is the single seam where **both** platform identity and personalisation live.

(The accent is hue-locked to purple server-side — `purple_accent?`, `Api::V1::Settings::AppearanceController`. Explore accents in the token studio at `talitamoss.info/kronk-chooser.html`.)

### 3. Signature treatments

#### 3.1 The cover-glow

The recognisable "Kronk glow" — a layered radial purple luminance at the top of feature surfaces (profile cover, korner headers). Implemented as a reusable SCSS mixin:

```scss
@mixin kronk-cover-glow($radius: 24px) {
  // Layered radial gradients: a bright luminous top layer tokenized to
  // --kronk-purple-bright, over a deep purple mid-layer, over a near-black base.
  // Applied to the header/cover region of feature surfaces.
}
```

- The **bright layer is tokenized** to `--kronk-purple-bright` so it tracks the palette.
- The deep and base layers are bespoke to the glow (`rgb(86 58 204 / 40%)` deep over `#241a44`/`#0d0a1c` base) — these are the one sanctioned exception to no-raw-values because they define the glow's own gradient rather than a reusable colour.
- Call it with a radius argument to match the surface's corner-rounding.

When designing a korner header, reach for `@include kronk-cover-glow()` rather than reinventing a gradient.

#### 3.2 color-mix for tints

Translucent variants of any token (hover states, chip backgrounds, selection highlights) are built with `color-mix(in srgb, var(--token) N%, transparent)` — never a parallel hard-coded rgba. This keeps tints locked to the token they derive from.

---

### 4. The component kit

Shared primitives live under `app/javascript/mastodon/features/` and are styled with the tokens above. Reuse these before building anything new — consistency across spaces comes from everyone drawing on the same kit.

#### 4.1 Settings widgets (`features/settings/setting_widgets.tsx`)

The row-based settings vocabulary. Every settings control is a `SettingRow` (label + hint + control) wrapping one of the typed widgets:

- **`SettingRow`** — label, optional hint, and a control slot. The layout primitive for any settings-style form.
- **`BooleanWidget`** — a toggle.
- **`EnumWidget`** — single-choice (radio/select semantics).
- **`MultiEnumWidget`** — multi-choice.
- **`DurationWidget`** — a duration picker.

Class namespace: `korner-settings__*`. These back the Notifications, Privacy, and Appearance settings sections and are the template for any per-korner §K settings space.

#### 4.2 List manager (`features/settings/list_manager.tsx`)

A generic `ListManager<T>` — fetches a collection from an endpoint and renders each entry as a row with a remove button (optimistic removal, re-adds on failure). Hooks-based, no Redux coupling. Callers supply `primary` / `secondary` / `avatar` accessors and a `removeItem` callback, so the same shell serves mutes, blocks, domain blocks, and later filters. Class namespace: `settings-list-manager__*`.

Use this for any "managed list of things the user can remove" surface rather than hand-rolling a list.

#### 4.3 Navigation & chrome

- **`hub_switcher.tsx`** — the four-way platform nav (Me / Home / Hub / Nudges). The **top variant** renders the **Membrane** (spec: the **Membrane navigation** section below): flat text pillars + a 1px wire + a purple pool of light that glides under the active pillar, styled via `.hub-switcher--top` in `_kronk_chrome.scss`. The **bottom variant** renders the mobile tab-bar: icon+label tabs, styled via `.hub-switcher--bottom`.
- **`kronk_menu.tsx` / settings `nav.tsx`** — the "K" menu and settings navigation. Section rows route to their destination; the profile section routes to `/@:acct/shelves` (editing is Arrange mode on the shelved profile — the standalone `/@:acct/edit` composer was retired).

**Back navigation — one pattern, no exceptions.** Two primitives cover every legitimate case:

1. **`SpaceBadge`** (auto). Every korner surface mounted through `<Stage>` gets the top-left "< Korner" pill for free — one tap back to `/hub`. Nothing to opt in to.
2. **`<BackToKorner>`** (explicit). For a detail page that needs a chip pointing at a specific parent (e.g. an album back to `/hub/albutts`), drop `<BackToKorner href='…' label='…' />` in. Renders `.kronk-back-chip` — the standard purple pill.

Hand-rolling a `<Link>` or `<button>` labelled "← Back" / "← Albums" / "← Cancel" is **banned**. Stylelint enforces this as a `lint:css` error: any class matching `*__back`, `*__back-link`, `*__back-button`, `*__back-chip`, or `*__back-to-*` fails the build. See `stylelint.config.js` → `selector-disallowed-list`. If a surface has genuinely different semantics (a wizard step-back inside a composer, a cancel action inside a form), express it as a wizard-nav using the shared `<KornerPill>` primitive — the ban is on **naming/shape**, not on the underlying flow.

Breadcrumbs (`__crumb` / `__breadcrumb`) are a different pattern (path from root, not go-back). Not banned; if Kronk later standardises breadcrumbs it gets its own primitive + rule.

Retired 2026-09-03 — three live offenders + eight orphan SCSS blocks: `.albutts-detail__crumb`, `.wachuneed__compose-back`, `.kuestions-composer__back`, plus dead-code sweeps of `.booth-artist-detail__back`, `.group-detail__back`, `.kommons-plant__back`, `.korner-settings __back`, `.krew-detail__back`, `.kronk-attachment __back`, `.map __back`, `.kronk-org-page__back-to-app`.

**The Ж menu owns the platform-wide action verbs.** Compose ("Post / New event / Upload set / …") and Settings are routed from the floating Ж bubble on every `/hub/...` surface. **Do not** add a per-page `+`, `New X`, `Add`, `Create`, `Settings`, `Manage`, or gear-icon chip in the page body — the menu already covers it, and a duplicate chip drifts out of sync when routing changes.

- **Compose** is declared per korner via `compose:` in `config/korners/<slug>.yaml`; the menu renders the CTA. Docs: `docs/korners/adding_a_korner.md (Framework spec (v0.5))`.
- **Settings** is available on the Ж bubble for every space and detail page. If a settings surface itself needs internal navigation (between settings sub-sections), that's a different pattern — hand-roll a wizard-style `<KornerPill>` row rather than a top-of-page Settings chip.

The rule is on **naming and shape**: don't build an in-page link/button whose label or icon reads as "go compose" or "go to settings". Body-level affordances that manipulate on-page state (edit a description, save a form, toggle a mode) are fine — they're not calling the platform verbs.

Retired 2026-09-04: `.krew-detail__btn` "Settings" chip on the Krew detail page (Tal: "Settings already has a link button, in the floating bubble, this should be standard knowledge by now"). PR #1696.

#### 4.4 Governance / kommons cards

`_status_kommons_card.scss` and `_governance.scss` render proposal/decision surfaces using the `--decision-*` tokens with `color-mix()` tints. These are the reference for any voting/decision UI.

#### 4.5 The live styleguide

There is a running styleguide at **`/styleguide`** (`features/styleguide/index.tsx`, styled by `_styleguide.scss`). It renders the tokens and primitives as live swatches/components. **Use it as the visual source of truth** — when planning a korner, check the styleguide to see what the kit already offers before proposing new components.

---

### 5. The korner framework

New spaces are **korners**, declared by a manifest — not bespoke wiring. This is what keeps every space consistent and discoverable.

#### 5.1 What a korner is

- One manifest per korner: `config/korners/<slug>.yaml`.
- Every korner mounts under **`/hub/<slug>`**.
- Reserved slugs live in `config/korners/reserved_slugs.yaml`.
- `config/initializers/kronk_korner_registry.rb` → `Kronk::KornerRegistry` loads all manifests at boot and warns on drift.
- `bin/tootctl korners doctor` surfaces mismatches between manifest and reality.

#### 5.2 Manifest shape

A manifest declares the korner's **identity, resources, storage, security, feed projection, and settings**. Shape (illustrative, from `kommons.yaml`):

```yaml
slug: kommons
name: Kommons
icon: <icon-name>
# identity — name + icon differentiate; NO colour field (palette is platform-wide)

resources:
  # the models/records this korner owns

storage:
  # persistence config

security:
  # access/permission rules

feed_projection:
  card: StatusKommonsCard # component that renders this korner's items in feeds

settings:
  # §K — the per-korner settings space, rendered with the settings widget kit (§4.1)
```

#### 5.3 Feed projection

A korner declares `feed_projection.card` naming a card component (e.g. `StatusKornerCard` / `StatusKommonsCard`). The framework's card registry picks up that adapter and renders the korner's items inline in feeds — consistently styled via tokens, no per-korner feed code.

#### 5.4 Per-korner settings (§K)

Each korner gets a settings space at `/hub/<slug>/settings`, built from the settings widget kit (§4.1). Declaring settings in the manifest is how a korner exposes user-configurable options without a bespoke settings page.

#### 5.5 Theming a korner

Reference `var(--accent)` and the semantic tokens. **Do not** add a colour to the manifest or a `--space-color`. Use `@include kronk-cover-glow()` for the header. The result inherits the platform identity automatically — which is the point.

---

### 6. Building a korner to spec — checklist

When planning or building a korner rebuild, confirm each:

- [ ] **Manifest first** — `config/korners/<slug>.yaml` declares identity, resources, storage, security, feed projection, settings. Slug not in `reserved_slugs.yaml`.
- [ ] **No new colours** — accent is `var(--accent)`; no `--space-color`, no manifest colour field, no raw hex.
- [ ] **Tokens only** — every colour/radius/elevation/motion value is a token. Raw hex fails stylelint on governed files.
- [ ] **Both themes** — built against semantic aliases, so dark + light both work with no theme branching.
- [ ] **Radius language** — small/medium/large/round applied by role.
- [ ] **Cover-glow** — header uses `@include kronk-cover-glow()`, not a bespoke gradient.
- [ ] **Reuse the kit** — settings via the widget kit; managed lists via `ListManager`; check `/styleguide` before adding a component.
- [ ] **Feed projection** — `feed_projection.card` declared if the korner surfaces items in feeds.
- [ ] **Settings space** — §K declared in the manifest if the korner needs user options.
- [ ] **Doctor clean** — `bin/tootctl korners doctor` reports no drift.
- [ ] **Regenerate tokens** — if `tokens.yaml` changed, run `bin/generate-tokens` and commit the regenerated `_tokens.scss` (CI runs `--check`).

---

### 7. Quick reference — files

| Concern                 | File                                                                |
| ----------------------- | ------------------------------------------------------------------- |
| Token source of truth   | `app/javascript/mastodon/tokens/tokens.yaml`                        |
| Token generator         | `bin/generate-tokens` (`--check` in CI)                             |
| Generated tokens (SCSS) | `app/javascript/styles/mastodon/_tokens.scss` (don't edit)          |
| Cover-glow mixin        | `_mixins.scss` → `@mixin kronk-cover-glow`                          |
| Settings widgets        | `features/settings/setting_widgets.tsx`                             |
| List manager            | `features/settings/list_manager.tsx`                                |
| Hub switcher / tab-bar  | `features/.../hub_switcher.tsx`, `_kronk_chrome.scss`               |
| Governance / kommons    | `_status_kommons_card.scss`, `_governance.scss`                     |
| Live styleguide         | `features/styleguide/index.tsx`, `_styleguide.scss` → `/styleguide` |
| Korner manifests        | `config/korners/*.yaml`                                             |
| Reserved slugs          | `config/korners/reserved_slugs.yaml`                                |
| Korner registry         | `config/initializers/kronk_korner_registry.rb`                      |
| Korner doctor           | `bin/tootctl korners doctor`                                        |

---

_Supersedes the visual sections of the older `docs/korners/adding_a_korner.md (Framework spec (v0.5))` (v0.5, planet-metaphor era). For the korner manifest field-by-field schema and the "adding a korner" walkthrough, see `docs/korners/adding_a_korner.md` alongside this document._

---

## Frame

_Merged into this file on 2026-10-04 from `docs/kronk_frame.md`; its own status notes and dates are kept as written._

The **Frame** is the foundational layout of every Kronk page. It's a
CSS grid that owns the shape of the viewport, and it's the same on
every route. Every korner renders inside it.

### The five slots + one overlay

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

#### TopBand

- **Contents:** `<KronkWordmark>` (left), `<HubSwitcher variant="top">`
  (centre, desktop only). The InviteButton sits in the far-right corner
  (a standalone fixed pill so it survives mobile, where the top rail hides).
- **Background:** none of its own. The top rail's dark fade is painted by
  the single `.kronk-frame__chrome` element (see **The L-shaped chrome**
  below); TopBand is a transparent positioning zone over it.
- **Mobile:** wordmark only; the HubSwitcher moves to BottomBand.

#### The L-shaped chrome

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

#### SpaceNav

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

#### Stage

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

#### RightBand

- **Contents:** `<KornerSidebar>` — the vertical rail of korner tiles,
  starting `4.75rem` down so it clears the reserved top-right corner.
- **Background:** none of its own. The right rail's dark fade is painted
  by `.kronk-frame__chrome` (see **The L-shaped chrome** above); RightBand
  is a transparent positioning zone over it.
- **Desktop only.** Hidden below the 890px container breakpoint.

#### BottomBand

- **Mobile only.**
- **Contents:** `<HubSwitcher variant="bottom">` — the Me / Home / Hub
  / Nudges tab-bar.
- **Owns:** solid black background with a purple accent top-border.

#### OVERLAY (not a grid cell)

- **Contents:** `<KronkMenu>` (Ж) — the draggable floating action
  button that opens Post / New / Search.
- **Position:** `fixed`, deliberately outside the grid. The user can
  drag it anywhere on the viewport; the parked position is
  bottom-left desktop, bottom-right mobile (clear of the tab-bar).
- **Why outside the grid:** the Kronk menu belongs to the viewport, not
  to any single layout cell. Anything else that needs to float
  independently of the grid (modals, dropdowns, snackbars) goes here.

#### Kosmos (background canvas)

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

### Responsive strategy

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

### Reserved-slot contract

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

### Rules

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

### Current state (migration status)

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

### Related files

- `app/javascript/mastodon/features/ui/index.jsx` — the Frame mounts here.
- `app/javascript/mastodon/components/kronk_frame.tsx` — the Frame component.
- `app/javascript/mastodon/components/stage.tsx` — the shared `<Stage>` content component.
- `app/javascript/styles/mastodon/_kronk_frame.scss` — the grid CSS.
- `app/javascript/styles/mastodon/_kronk_chrome.scss` — the chrome components inside the slots.

---

## Card standard

_Merged into this file on 2026-10-04 from `docs/kronk_card_standard.md`; its own status notes and dates are kept as written._

**Status:** agreed 2026-09-12 (Tal). Being built — see _Where we are_ at the
foot. **Primitive:** `<StandardCard>` ·
`app/javascript/mastodon/components/standard_card.tsx`

### What a card is for

> "What I want from this is basically a wrapper for content from all sorts of
> spaces to fit a mould so they can slip into other spaces… rather than
> building the infrastructure of each page to show specialty and different
> content, I want to be able to build them to take the standard card, then any
> content fits within the card and the navigation and layout can become
> familiar across spaces to a user." — Tal, 2026-09-12

A card is the **unit of content that travels**. An album belongs to Albutts, but
it can appear in a feed, on a profile shelf, in a Map space, in a grid of
things somebody made. If each of those surfaces builds its own way of drawing an
album, then adding a korner means editing every surface that might show it — and
a reader learns a new layout in every space.

One card fixes both ends of that: a space builds against the card, not against
the content; a korner describes its content once, and it can appear anywhere.

### The contract: six slots

Every card, of every kind, in every arrangement, is made of the same six slots.
A korner's projection fills the ones it has; the arrangement decides which are
drawn and how large.

| Slot      | What it holds                               | Example (Albutts)           |
| --------- | ------------------------------------------- | --------------------------- |
| `media`   | the visual — image, map glimpse, avatar     | the album cover             |
| `badge`   | which korner this came from                 | `ALBUM`, in korner purple   |
| `title`   | one line, the name of the thing             | "27th Birthday"             |
| `meta`    | a short run of facts — author, date, counts | "14 photos · 1 contributor" |
| `body`    | prose, clamped                              | the album description       |
| `actions` | what you can do without opening it          | contributor avatars, froth  |

Two rules keep this honest:

1. **A slot is optional, never re-purposed.** A korner with no image leaves
   `media` empty and the arrangement handles it; it does not put its title
   there because the space looked empty. Booth's feed card was doing exactly
   that — the artist's name was living in the prose region — which is how the
   rule earned its keep.
2. **The arrangement decides size, the content never does.** A card does not
   ask to be bigger because its album has more photos.

`meta` may appear twice where a card has two runs of facts either side of a
divider — Booth's feed card names the artist above and the genre and length
below. The other five appear at most once.

**The slot styles are defaults, not decisions.** They are written through
`:where()`, which costs nothing in specificity, so any korner rule beats them
by simply existing. That matters where a card uses the slots for their names
rather than their looks: a feed card has its own type scale and supplies its
own padding, and should not have to out-specify the standard to keep them.
Arrangement rules are not written that way — what a grid tile draws is a
decision.

### Three arrangements

The same card, three ways. These are not three cards.

#### Feed — flows to content

Badge, media, title, meta, body, actions. Height follows the content. This is
the timeline shape, and the one most korners already draw
(`<StatusKornerCard>`).

#### Portrait — 9:19.5, one at a time

Media dominant, title and meta over it, actions at the foot. Fixed aspect, sized
so it can never exceed the viewport (the sizing maths already lives in
`<StandardCard variant='portrait'>`). For content that is **uniform in shape and
considered one at a time**: Kommunity Discover, the Kuestions deck, Moments.

#### Grid — the same card, smaller, many at once

Media and title, one meta line at most. Two up on a phone, four from 720px. For
browsing a collection: Wachuneed listings, Kalendar events, a profile's shelf.

### Decisions taken, and why

**The home feed stays flow, it does not become portrait.** Asked directly, and
the reason is mechanical rather than aesthetic: the feed already binds
horizontal swipe to stepping scope (`FeedDrum` — Friends / Friends-of-friends /
Kommunity). Portrait needs that same gesture for next-item, and scope-stepping
is worth more — it is what makes the feed yours rather than a river.

Two supporting reasons. A feed is a **scanning** surface: you skim eight things
to decide what to open, and one-per-screen turns one scroll into eight swipes.
And feed content varies wildly in length — a two-word post and a fourteen-photo
album would each take a full screen, one looking empty and the other cropped.
Portrait works in the Kuestions deck precisely because every card is the same
shape and each one demands an answer: a task queue, not a browse.

**The badge is a pill everywhere except the feed.** A badge says which korner
a card came from. On a board of proposals or a grid of albums, every card is
from the same korner and the badge is a quiet label — a pill, sitting beside
the content. In the home feed, consecutive cards come from different korners
and the badge is the thing telling them apart, so it stays the full-width bar
across the top of the card. The difference is a surface override in
`_status_korner_card.scss`, deliberately not a second standard: if you find
yourself wanting the bar somewhere else, that is a sign the surface is mixing
korners and should say so.

**No separate wide-screen card.** Two feed layouts means two things to maintain
and two mental models for one piece of content. The flow card already works at
both widths; the wide-screen answer is the **grid** arrangement showing more per
row.

**The korner describes its content once.** Manifests already name a card per
korner (`feed_projection.card`). That projection fills slots — it does not draw
a card. Adding a korner should never mean editing a space that might display it.

### Where we are (2026-09-12, end of the migration)

Started at **19 card components**, three de-facto families, and a
`<StandardCard>` that described itself as "the primitive every Kronk card is
built on" while having one consumer. Now:

| Was                                  | Now                                                     |
| ------------------------------------ | ------------------------------------------------------- |
| `<StatusKornerCard>` + 10 feed cards | on `<StandardCard variant='flow'>`, badge slot          |
| `<SpaceCard>` (Wachuneed, Kalendar)  | on `<StandardCard variant='grid'>`                      |
| Albutts directory tiles              | on `<SpaceGrid>` / `<SpaceCard>` — own grid deleted     |
| Kommons proposal card                | on `<StandardCard variant='flow'>`                      |
| Booth gallery tile                   | on `<StandardCard variant='grid'>`, in the shared grid  |
| `<ProfileCard>` (Kommunity deck)     | already portrait — the deck needed nothing              |
| `booth_set_card.tsx`                 | deleted; nothing had imported it since the grid shipped |
| The insides of the ten feed cards    | title / meta / prose are slots (2026-09-13)             |

#### What deliberately stays bespoke

Not everything called a card is one. These were looked at and left, with the
reason, so nobody re-opens them as unfinished business:

- **The Kuestions deck card.** A deck, not a card: absolutely positioned,
  stacked, drag-to-skip, sized by the deck rather than by its content. The
  standard's portrait arrangement sizes a card from its own aspect, which is
  the opposite. A Kuestion that travels already has a standard card — the feed
  one.
- **The Map pin card.** A `role="dialog"` anchored to a pin, with an inline
  edit form. It never appears in a collection, so there is nothing for the
  contract to buy.
- **The Explore suggestions card.** Upstream Mastodon, and an account
  suggestion rather than korner content. Putting it on the standard would mean
  carrying a conflict in every Mastodon merge for no gain.

#### Known, not fixed

Nothing outstanding from the migration itself. `_booth.scss`'s `.booth-card`
family — which had been half-dressing the live tile from a deleted
component — was removed on 2026-09-13 when Booth's tile joined the shared
grid.

### Build order

Deliberately sequenced so it could stop between any two steps without leaving
the codebase half-converted. All five are done (#1803, #1810, #1823, #1828,
#1829 and the Booth tile).

1. ~~**The contract.**~~ Slots on `<StandardCard>`, nothing migrated.
2. ~~**Two korners, opposite shapes.**~~ Albutts (image-led) and Kommons
   proposals (text-led).
3. ~~**The `<StatusKornerCard>` family**~~ — ten feed cards on one shell.
4. ~~**`<SpaceCard>` becomes the grid arrangement**~~, and Albutts joins the
   shared grid.
5. ~~**The tail**~~ — Booth's tile migrated; the deck, the map pin and the
   Explore suggestion left bespoke for the reasons above.

#### Prose, settled

The prose slot had four answers to "how long is it" and one of them was
nothing: the feed frame clamped to two lines, the standard said three, and
Kommons' and Kuestions' rules pointed at a class their markup never carried,
so their prose rendered unstyled and uncut. It is **two lines, 0.875rem,
secondary colour, everywhere** now, said once in `_standard_card.scss`. The
visible effect is that Kommons and Kuestions feed cards finally look like the
others.

#### What is still open

- **The badge in the feed is a bar, everywhere else a pill.** Stated as a rule
  above, and the reasoning holds, but it is the one place two surfaces draw the
  same slot differently. Worth revisiting once there are more grid surfaces.

A row in [`the Platform primitives part of this file`](design.md) points
here.

---

## Membrane navigation

_Merged into this file on 2026-10-04 from `docs/kronk_membrane_nav.md`; its own status notes and dates are kept as written._

_Aesthetic documentation addition · nav chrome specification_
_Applies to: platform top bar (Feed / Profile / Hub / Nudges) and every in-korner sub-nav (e.g. Kuestions: Today / Ƙuestions / Answered)._

---

### 1. Concept

The **Membrane** is Kronk's single navigation idiom. It replaces pills, filled tabs, boxes, and underlines with **one moving element**: a pool of light that glides along a thin wire beneath a row of flat text labels.

The wire does three jobs so nothing else has to:

1. **Position** — the pool sits under the label you're on.
2. **Motion** — it _glides_ between labels when you switch, so the transition itself tells you where you came from and where you landed.
3. **Signal** — a glint can race along the wire to a label when something arrives there (reserved for the platform bar's Nudges pillar; see §6).

Because the wire carries all of this, the labels stay flat: no borders, no background fills, no dots. The active label is simply brighter text; every other label is muted. This is "bold by subtraction" — the bar recedes and lets content lead.

The same idiom scales down unchanged from the four platform pillars to a two- or three-item korner sub-nav. **Any tabbed navigation in Kronk uses the Membrane.** No korner invents its own tab style.

---

### 2. Anatomy

```
  [ Ƙ ]   Today    Ƙuestions    Answered                        [ ⚙ ]
  ───────────────────●──────────────────────────────────────────────
   glyph   ← flat text pillars →        (utility)         (utility)
                     └ light pool on the wire, under the active pillar
```

Left → right:

- **Leading glyph** — the korner's Unicode letter (platform bar uses the `ЖЯѺƝ₭` wordmark instead). Display serif, `--purple-bright`. Non-interactive here; on the platform bar the wordmark links to Kronk/About spaces.
- **Pillars** — flat text labels in a row. This is the `tablist`.
- **Utilities** — pushed to the right edge (settings gear, and on the platform bar the `Ж` action button). Utilities are **not** pillars and get no pool position of their own (see §5).
- **Wire** — a 1px line spanning the full width of the bar, sitting on its bottom edge, coloured `--border-subtle`.
- **Pool** — the light indicator riding on the wire.

---

### 3. Tokens

All values reference the locked `2026-07-14` token set. No new tokens are introduced.

| Element        | Property                      | Token / value                                                        |
| -------------- | ----------------------------- | -------------------------------------------------------------------- |
| Leading glyph  | font                          | `--font-display`                                                     |
|                | colour                        | `--purple-bright` `#7241ff`                                          |
|                | size                          | 22px                                                                 |
| Pillar label   | font                          | `--font-body`, weight `500`                                          |
|                | size                          | `--font-size-base` 15px                                              |
|                | colour — resting              | `--text-muted` `#606085`                                             |
|                | colour — hover                | `--text-secondary` `#9c9cc9`                                         |
|                | colour — active               | `--text-primary` `#ece9f5`                                           |
|                | padding                       | `11px 16px 14px` (extra bottom pad seats the wire)                   |
|                | colour transition             | `--dur-medium` `200ms` `--ease-out`                                  |
| Wire           | height                        | 1px                                                                  |
|                | colour                        | `--border-subtle` `#2a2740`                                          |
|                | position                      | bottom edge of bar, full-bleed                                       |
| Pool           | height                        | 2px, radius 2px                                                      |
|                | width                         | active label width minus ~20px (clamped ≥ 40px)                      |
|                | core colour                   | `--purple-bright` `#7241ff`                                          |
|                | glow                          | `0 0 10px 1px --purple-bright`, `0 0 20px 3px rgba(114,65,255,.5)`   |
|                | halo                          | radial `rgba(114,65,255,.28)` → transparent, ellipse behind the core |
|                | glide transition              | `left` + `width` over `--dur-slow` `400ms` `--ease-out`              |
| Utility button | see existing gear / `Ж` specs | —                                                                    |

Focus: pillars take a `--focus-ring` `#7241ff` outline, `3px`, inset offset, on `:focus-visible`.

---

### 4. Pool behaviour

- **On mount**, the pool is measured against the active pillar and placed with no animation (measure after first paint / `requestAnimationFrame`).
- **On pillar change**, update the pool's `left` (centre of the target pillar) and `width` (target width − 20px). The CSS transition does the glide; do not animate via JS timers.
- **On resize**, re-measure and reposition the active pillar's pool with the transition suppressed (or accept a single glide — implementer's call; suppression is cleaner).
- **Glint** — on every successful pillar change, fire a one-shot `700ms` brightness pulse on the pool (`filter: brightness` 1 → 1.8 → 1). This is the "landed" acknowledgement, distinct from the arrival signal in §6.

Positioning is measured (`getBoundingClientRect`), not hard-coded per label, so the pool stays correct as label text, count badges, or locale width change.

---

### 5. Utilities and non-pillar views

Settings, compose/ask, and any surface reached from a utility button are **not pillars**. When the user is in one of these:

- **Default (chosen) behaviour:** the pool _parks_ under the nearest conceptual peer pillar rather than disappearing — e.g. an Ask/compose surface parks the pool under the first pillar; a Settings surface parks it under the last. The wire never goes blank, and returning to a real pillar glides the pool back.
- **Alternative (open decision):** the pool fades out entirely in non-pillar views, so the wire goes dark and reads as "you have stepped off the three." Cleaner conceptually, emptier visually.

**Decision needed:** park vs. fade. The prototype ships _park_.

---

### 6. Arrival signal (platform bar only)

On the **platform top bar**, the wire is also the delivery mechanism for notifications. When a Nudge arrives, a glint travels along the wire toward the **Nudges** pillar and its count updates. This is the argument for keeping Nudges on the bar rather than in the `Ж` menu — the membrane literally carries the signal to where it lives.

Resting liveness is **calm**: the pool sits still under the active pillar. The travelling glint fires **only on genuine arrival**, never on a timer. (An earlier exploration offered `still / current / pulse` characters; the resolved default is _calm at rest, glint on real arrival_.)

In-korner sub-navs (Kuestions, etc.) **do not** carry the arrival signal — there is no per-korner inbox on the wire. They use position + glide + the landing glint only.

---

### 7. Accessibility & motion

- The pillar row is a `role="tablist"`; each pillar is `role="tab"` with `aria-selected`. Panels are the corresponding `tabpanel`s.
- Active state must be conveyed by **text colour**, not the pool alone — the pool is decorative reinforcement, and colour-contrast between muted and primary label states must remain legible for users who can't perceive the glow.
- `prefers-reduced-motion: reduce` → suppress the glide, the glint, and the arrival travel. The pool jumps to position; label colour still changes. Nothing about wayfinding depends on motion.
- Keyboard: arrow keys move between tabs within the row; the pool follows focus-driven selection the same as pointer selection.

---

### 8. Responsive

- The bar is a single horizontal row at all widths used by the current shell (max container 640px). Glyph left, pillars left-of-centre, utilities right.
- If a future korner needs more pillars than fit, pillars may scroll horizontally with the wire; the pool still tracks the active pillar. Do **not** wrap pillars to a second line or collapse them into a menu — the wire must remain a single continuous line.
- On the platform bar's mobile treatment, the core spaces already collapse to a bottom bar per the shell spec; the Membrane wire idiom is the **desktop/tablet and in-korner** treatment and is not duplicated on the mobile bottom bar.

---

### 9. Scope of this spec

- **In scope:** the visual and behavioural definition of the nav idiom — flat pillars, wire, pool, glide, glint, arrival signal, park-vs-fade, a11y, responsive rules.
- **Out of scope:** which pillars exist in a given surface (that's each korner's own spec), routing, and panel contents. The platform pillar set (Feed / Profile / Hub / Nudges) and the `Ж` action menu (Post / Search / Settings) are defined in the shell redesign spec, not here.

---

### 10. Open decisions to resolve before build

1. **Park vs. fade** for the pool in non-pillar (utility) views — §5. Prototype ships _park_.
2. **Thread edge** — pool sits _on_ the bar's bottom border (current), or floats a few px below it, detached, reading more as a membrane _between_ chrome and content than as an underline. Prototype ships _on the border_.
3. **Resize handling** — suppress the glide on resize (clean) vs. allow a single glide (playful). Prototype suppresses.

---

_Reference prototype: `kronk-kuestions-prototype.html` — the Kuestions sub-nav (Today / Ƙuestions / Answered) is the canonical in-korner implementation of this spec._

---

## Platform primitives

_Merged into this file on 2026-10-04 from `docs/kronk_platform_primitives.md`; its own status notes and dates are kept as written._

The one file to `git grep` when you're about to write something new and want to
know if the platform already has a shared version.

Kronk's standardised pieces are spread by **kind**, not by "standards" bucket
— shared components live in `app/javascript/mastodon/components/`, hooks in
`hooks/`, framework config in `config/`, docs in `docs/`. That layout keeps
upstream Mastodon merges tractable (nothing lives in Kronk-only folders that
Mastodon might collide with) but it also means there is no single directory
you can eyeball to see "what have we already built?"

This doc is that directory. **Index only** — for how each primitive works,
read the file itself; for the norms, read the linked spec.

**When you add a new shared primitive, add a row here.** When you notice a
row that no longer matches reality, fix the row _and_ the primitive in the
same PR.

---

### Layout & Chrome

| Primitive                                                                           | What it does                                                                                                                  | Where                                                                                                                                                                |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<KronkFrame>`                                                                      | The invariant grid every route mounts inside — top membrane, right sidebar (desktop) / bottom nav (phone), Stage cell.        | `app/javascript/mastodon/components/kronk_frame.tsx` + `styles/mastodon/_kronk_frame.scss` + `_kronk_chrome.scss`. Spec: [`the Frame part of this file`](design.md). |
| `<Stage>`                                                                           | The single well-defined rectangle every korner paints into. Owns scroll, border-box for children, kills body scrollbar.       | `components/stage.tsx` + `styles/mastodon/_kronk_stage.scss`.                                                                                                        |
| Stage archetypes — `.stage-fill` / `.stage-column` / `.stage-grid`                  | Three shared shapes for a Stage-child so korners stop each writing their own `-shell` wrapper. Vertical scroll only.          | `styles/mastodon/_kronk_stage.scss`. Decision: `docs/decisions.md` 2026-08-13.                                                                                       |
| `<SpaceHeaderRow>` + `<SpaceBadge>` + `<AutoSpaceHeader>` + `<AutoSpaceViewPicker>` | The header row at the top of every korner — back badge (left), rotating title (centre), view picker (right). Manifest-driven. | `components/space_header_row.tsx`, `space_badge.tsx`, `auto_space_header.tsx`, `auto_space_view_picker.tsx`.                                                         |
| `<StandardCard>`                                                                    | The one shell every Kronk card is built on — six named slots, three arrangements (feed / portrait / grid).                    | `components/standard_card.tsx`. Spec: [`the Card standard part of this file`](design.md).                                                                            |
| `<FeedDrum>`                                                                        | The quarter-turn spindle animation for face-switching (used by `/home` and Kalendar).                                         | `features/home_timeline/components/feed_drum.tsx`.                                                                                                                   |
| `<KornerShell>` (legacy)                                                            | Older per-korner wrapper. Retires as each korner moves onto Stage + archetypes.                                               | `components/korner_shell.tsx`. **Do not use for new korners.**                                                                                                       |
| `<KronkStarfield>`                                                                  | Shared ambient purple starfield backdrop.                                                                                     | `components/kronk_starfield.tsx` + `styles/mastodon/_stars.scss`.                                                                                                    |

### Compose + confirmation

| Primitive                                     | What it does                                                                                                                                                                                                                                                                                               | Where                                                                                                             |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `<ComposeShell>`                              | The floating composer overlay every korner's `/hub/<slug>/composer` renders inside. Portal, dim backdrop, korner-icon header, Cancel + Submit footer.                                                                                                                                                      | `components/compose_shell.tsx` + `styles/mastodon/_compose_shell.scss`. Decision: `docs/decisions.md` 2026-08-12. |
| `<ComposeFab>` (the Ж bubble)                 | The single site-chrome entry point for any composer. Reads `compose.route` from manifests — no local FABs.                                                                                                                                                                                                 | `components/compose_fab.tsx`.                                                                                     |
| `<ConfirmDialog>` + `useConfirmDialog()` hook | The "are you sure?" primitive — delete / leave / cancel flows. Portal-mounted with a dim backdrop and destructive-CTA variant so the visual grammar matches `<ComposeShell>` (make vs confirm are variants of the same modal system). Hook returns `[dialog, confirm]` — `confirm(opts)` is Promise-based. | `components/confirm_dialog.tsx` + `hooks/useConfirmDialog.tsx` + `styles/mastodon/_kronk_confirm.scss`.           |

### Audience / Reach

| Primitive                                                            | What it does                                                                                                  | Where                                                                                           |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `<ReachDropdown>`                                                    | The "who sees this?" control. Values: `self_only` / `mates` / `orbit` / `public`. Same vocabulary everywhere. | `components/reach_dropdown.tsx`. Spec: [`docs/spaces/feed.md (Who sees what)`](spaces/feed.md). |
| `<ScopeMark>` + `<ScopeTitle>` + `<ScopeCarousel>` + `<ScopePicker>` | Reach-ring glyphs + scoping widgets that appear on feed cards and composers.                                  | `components/scope_*.tsx`.                                                                       |
| `useAvailableKrews`                                                  | Loads the user's Krews for the additive-krew axis on composers.                                               | `hooks/useAvailableKrews.ts`.                                                                   |
| `<KornerVisibilityPicker>` + `<KornerKrewPicker>`                    | Korner-scoped variants for narrower audience controls.                                                        | `components/korner_visibility_picker.tsx`, `korner_krew_picker.tsx`.                            |

### Feed & status projection

| Primitive                                                                                    | What it does                                                                                                                                                                                             | Where                                                                             |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `<StatusKornerCard>`                                                                         | The shared per-korner feed card frame. Every korner-projected status renders inside this — outer container, badge row, whole-card click-through, keyboard handling.                                      | `components/status_korner_card.tsx` + `styles/mastodon/_status_korner_card.scss`. |
| Per-korner status cards — `Status{Albutts,Booth,Event,Kommons,Kuestions,Trek,Wachuneed}Card` | Per-korner card bodies. **All seven wrap `<StatusKornerCard>` today** — the shell owns the badge + outer chrome, each card body handles korner-specific layout (RSVP buttons, vote counts, media grids). | `components/status_*_card.tsx`.                                                   |
| `<KornerCards>`, `<StatusSpaceBar>`, `<StatusKrewBadge>`                                     | Sub-parts of status/feed chrome.                                                                                                                                                                         | `components/korner_cards.tsx`, `status_space_bar.tsx`, `status_krew_badge.tsx`.   |

### Korner framework

| Primitive                                 | What it does                                                                                                   | Where                                                                                                                                                   |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Korner Registry                           | Loads every `config/korners/*.yaml` at boot, warns on drift, powers `Kronk::Korner.for(slug)`.                 | `config/initializers/kronk_korner_registry.rb`. Spec: [`docs/korners/adding_a_korner.md (Framework spec (v0.5))`](korners/adding_a_korner.md).          |
| Korner manifests                          | Single source of truth for a korner's identity, resources, security, feed projection, settings, compose, tree. | `config/korners/*.yaml`. Reference: [`docs/korners/adding_a_korner.md`](korners/adding_a_korner.md).                                                    |
| Reserved slugs                            | Slugs a korner cannot claim.                                                                                   | `config/korners/reserved_slugs.yaml`.                                                                                                                   |
| `useKorner(slug)` + `useKornerIcon(slug)` | Read manifest data (icon, name, tagline, colour) from React.                                                   | `hooks/useKorner.ts`, `hooks/useKornerIcon.tsx`.                                                                                                        |
| The Korner Standard (L1–L10 conformance)  | Normative spec every korner must satisfy.                                                                      | [`docs/korners/korner_standard.md`](korners/korner_standard.md). **Read before touching a manifest.**                                                   |
| `bin/tootctl korners doctor`              | Boot validator + CI check enforcing the ⚙︎-marked Standard layers.                                            | `bin/tootctl` + `.github/workflows/korners-doctor.yml`. `continue-on-error: true` today; graduates to a required gate when the debt on `shadow` clears. |
| `<KornerIframe>`                          | Wrapper for legacy/HTML korners still mounted via iframes.                                                     | `components/korner_iframe.tsx`.                                                                                                                         |
| `<KornerGlyph>`                           | The `material:` icon lookup that resolves per-manifest to a shared icon.                                       | `components/korner_glyph.tsx`.                                                                                                                          |

### Design tokens & aesthetic system

| Primitive                      | What it does                                                                                                                     | Where                                                                               |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `tokens.yaml` → `_tokens.scss` | Single design-token source; generated into SCSS by `bin/generate-tokens`. Never hand-edit the SCSS.                              | `app/javascript/mastodon/tokens/tokens.yaml` → `styles/mastodon/_tokens.scss`.      |
| Stylelint custom rules         | Enforce no raw hex (use `--kronk-*` / `--semantic-*` / `color-mix()`), `border-radius` must reference a `--radius-*` token, etc. | `stylelint.config.js`. Spec: [`the Aesthetic system part of this file`](design.md). |

### Krew primitive (the audience axis)

| Primitive                        | What it does                                          | Where                                                                                  |
| -------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `Krew` model + `KrewKorner` join | The user-facing group primitive, orthogonal to reach. | `app/models/krew.rb`, `krew_korner.rb`. Spec: [`docs/spaces/krew.md`](spaces/krew.md). |
| `useAvailableKrews`              | Composer-side hook (see Audience above).              | `hooks/useAvailableKrews.ts`.                                                          |
| `<KornerKrewPicker>`             | Korner-scoped picker for scoping to specific Krews.   | `components/korner_krew_picker.tsx`.                                                   |

### Detail pages

| Primitive        | What it does                                                                                                                                                                                                               | Where                                                                  |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `<KornerDetail>` | The shell every korner's detail page mounts inside. Slots: `hero`, `banner`, `title` + `titleIcon`, `subtitle`, `meta`, `actions`, `children`. Mounts inside the `.stage-column` archetype with a detail-scoped 42rem cap. | `components/korner_detail.tsx` + `styles/mastodon/_kronk_detail.scss`. |
| `<KornerMeta>`   | The middle-dot metadata line under a title (`Tue 7pm · The Pier · 4 going · by @jane`). Falsy items filtered so conditionals can be inlined; owns the layout + separator + muted colour + `<strong>` emphasis.             | `components/korner_meta.tsx` + `styles/mastodon/_kronk_meta.scss`.     |

### Actions

| Primitive           | What it does                                                                                                                                                                                                     | Where                                                                          |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `<KornerActionBar>` | Flex-row layout for the row of pill actions under content (Invite / Edit / Delete on event detail, Join / Leave on Krew). Wraps on narrow phones. `align`: `start` / `end` / `center` / `between`.               | `components/korner_action_bar.tsx` + `styles/mastodon/_kronk_action_bar.scss`. |
| `<KornerPill>`      | Rounded pill button, icon slot + label + `default` / `primary` / `destructive` variants + `active` toggle state. Destructive matches `<ConfirmDialog>`'s warn-red so a delete-then-confirm reads as one gesture. | `components/korner_pill.tsx`.                                                  |

### State indicators

| Primitive        | What it does                                                                                                                                                                                                    | Where                                                                  |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `<EmptyState>`   | The rest-state pattern for a korner surface with no content ("Nothing coming up yet."). Muted centred title + optional body + optional trailing CTA. No icon slot (SpaceBadge already carries the korner icon). | `components/empty_state.tsx` + `styles/mastodon/_kronk_states.scss`.   |
| `<LoadingState>` | The transient counterpart. Wraps Mastodon's `<LoadingIndicator>` with Kronk-standard layout + an optional label; spinner sits inline (not absolute-centred) so the primitive drops into any container.          | `components/loading_state.tsx` + `styles/mastodon/_kronk_states.scss`. |

### Inter-korner communication

| Primitive                                      | What it does                                                                                                                                                                                                                                          | Where                                                                                                                                                                     |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Event bus (`emits:` / `listens:` in manifests) | Manifest declares outbound signals; other korners subscribe by name.                                                                                                                                                                                  | Framework loader in `config/initializers/kronk_korner_registry.rb`. Contract: [`docs/korners/adding_a_korner.md (Framework spec (v0.5))`](korners/adding_a_korner.md) §6. |
| Nudges pipeline                                | The shared notification substrate every korner sends alerts through.                                                                                                                                                                                  | `features/nudges_messenger/*` + `app/models/notification.rb`. Spec: [`docs/spaces/nudges.md (Nudges spec)`](spaces/nudges.md).                                            |
| `useAttachments(slug, id)`                     | Read/create/remove cross-korner attachments (`spawn` / `link` / `reference`) for a source record. Hand-rolled state + `apiGet/Create/DeleteAttachment` under the hood; drives `<AttachmentSection>` and any composer that toggles a spawn attachment. | `hooks/useAttachments.ts` + `api/attachments.ts`. Spec: [`docs/korners/adding_a_korner.md (Korner attachments)`](korners/adding_a_korner.md) §4.1.                        |
| `<AttachmentSection>`                          | Renders the "Attached" block on a detail page — list rows with the target korner's icon + a link, optional owner-only remove. Silent when the list is empty.                                                                                          | `components/attachment_section.tsx` + `styles/mastodon/_kronk_attachment.scss`. Spec §4.2.                                                                                |
| `<AttachmentPicker>`                           | Portal-mounted modal — target korner dropdown (from source manifest's `attaches:`) + debounced search of `/api/v1/attachments/candidates?korner=<slug>&q=<query>` + one-click attach. Piggybacks on the ComposeShell modal grammar.                   | `components/attachment_picker.tsx` + `styles/mastodon/_kronk_attachment.scss`. Spec §4.3.                                                                                 |

---

### Where the spread bites

Three places you'll feel it when navigating:

1. **Header pieces are split** — `<KronkFrame>` in `components/`, its Membrane switcher in `features/ui/components/`, space-header pills in `components/`, some backup chrome still in `features/ui/`. Reading the header layer takes hopping between two directories.
2. **Compose primitives are together in `components/`, but the SCSS is split** — `_compose_shell.scss` is dedicated, each composer body's SCSS lives in that korner's `_<korner>.scss`. A full "how does compose work" read spans four files across three folders.
3. **Docs vs code split** — `docs/kronk_*.md` are cross-cutting; the normative korner doc is `docs/korners/korner_standard.md`. Easy to miss on a first pass.

None of these are worth reorganising the tree over (upstream-merge cost), but they are the reason this index doc exists.

---

### Candidates for future standardisation

The 2026-08-13 primitives sweep shipped five of the seven originally
listed here (`<EmptyState>` + `<LoadingState>`, `<KornerMeta>`,
`<ConfirmDialog>`, `<KornerActionBar>` + `<KornerPill>`,
`<KornerDetail>`) — each with a reference adopter in Kalendar or
event_detail. **StatusKornerCard sweep** turned out to be
already-done on inspection (all seven per-korner cards wrap the shell
today; the Kalendar manifest comment implying otherwise was stale and
was fixed in the same sweep). What's left:

| Candidate                              | What each korner writes today                                                                                                        | Roughly what the shared version looks like                                                                                                                                                                | Status                                                                                                                      |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **`<KornerTile>` / `<KornerListRow>`** | Booth tiles, Albutts covers, Hub tiles, Krew cards, Mate rows, Kalendar list rows — very similar rectangles, each with its own SCSS. | Two archetype-scoped card primitives: `<KornerTile>` for `.stage-grid` children, `<KornerListRow>` for `.stage-column` children. Body-content slot; padding, radius, hover state come from the primitive. | **Deferred** — Hub's tile has too much hub-specific chrome to be a clean reference adopter; revisit when a second surfaces. |

Backfill migrations that _could_ happen but aren't urgent: shipped
korners still writing their own `-shell` / `-actions` / `-empty` /
`-loading` / `-meta` / `-detail` blocks (Krew, Kommons, Albutts,
Booth, Kuestions, etc.) can adopt the corresponding primitive one
korner per PR, same pattern this sweep used.

---

## First-run walkthrough

_Merged into this file on 2026-10-04 from `docs/kronk_walkthrough.md`; its own status notes and dates are kept as written._

> **Status: DESIGN — not yet implemented (Tal 2026-09-10).** This doc is the
> template + catalogue + device strategy. When work starts, land it as its
> own PR against this spec.

Kronk 2.0.0 changes almost everything about the shape of the app. This tour is
what a first-time user sees when they log in after the rebuild lands, so the
new primitives (Ж, Hub, korners, SpaceBadge, Reach, Mates) are not a puzzle
they have to solve alone.

The tour is: **a short linear intro** for the platform-wide primitives; then
**just-in-time bubbles** that fire on the first visit to each korner. Users
can dismiss the whole thing at any point with a "Don't show this again"
checkbox; they can restart it from **Settings → Help → Restart tour**.

---

### 1. What a bubble is

A **walkthrough bubble** is a small floating card that appears near — or, on
mobile, above — the surface it's describing. It carries one idea, no more.
Each bubble has the same anatomy:

```
┌──────────────────────────────────────────╮
│  Ж — Your compass              [ × ]     │  ← title + close
│                                          │
│  Everything you do in Kronk — posting,   │
│  settings, jumping between korners —     │  ← body (1–3 short sentences)
│  starts from the Ж menu.                 │
│                                          │
│  ● ● ○ ○ ○ ○ ○ ○                 2 / 8   │  ← progress dots + counter
│                                          │
│  [ ← Back ]              [   Next   →   ]│  ← nav
│                                          │
│  ☐ Don't show this again                 │  ← permanent-dismiss checkbox
╰──────────────────────────────────────────╯
                 ▼   (arrow to anchor)
             ┌─────┐
             │  Ж  │  ← spotlighted target with purple ring
             └─────┘
```

#### Fields

| Field                     | Notes                                                                                                       |
| ------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `id`                      | Stable slug, e.g. `intro/ж-menu`. Used for skip-forward / restart.                                          |
| `title`                   | One line, `--font-display`. Wear the Kronk voice — cheeky, not corporate.                                   |
| `body`                    | 1–3 short sentences. Plain `--font-body`.                                                                   |
| `anchor`                  | CSS selector or ref token for the target element. `null` = centred, no arrow.                               |
| `placement`               | `auto` (default) \| `top` \| `right` \| `bottom` \| `left`. Auto picks the side with the most room.         |
| `spotlight`               | `true` (default) — dim the rest of the viewport, draw a purple ring around the anchor. `false` = no ring.   |
| `prevLabel` / `nextLabel` | Default `Back` / `Next`; last step is `Finish`.                                                             |
| `showDontShowAgain`       | Default `true` on the first bubble of the linear tour and on every just-in-time bubble; `false` in between. |

#### Kronk aesthetic

Same smoked-glass family as `SpaceBadge` and the compose FAB (see
`the Aesthetic system part of this file` § Floating chrome).

- Background: `color-mix(in oklab, var(--surface-elevated) 92%, transparent)`
  with `backdrop-filter: blur(14px)`.
- Border: `1px solid color-mix(in oklab, var(--kronk-purple-accent) 55%, transparent)`.
- Shadow: `var(--elevation-floating)` + a soft purple glow
  (`0 0 32px -8px color-mix(in oklab, var(--kronk-purple-bright) 40%, transparent)`).
- Radius: `var(--radius-large)`.
- Title: `var(--font-display)`, 15–16px, weight 500.
- Body: `var(--font-body)`, 14px, line-height 1.45.
- Arrow: 12px triangle, same border + fill as the bubble; positioned via
  CSS `clip-path` or an inline SVG.
- Enter: `fadeIn` on the bubble + `slideUp` (4px) — same easing as the
  album lightbox (`var(--dur-medium) var(--ease-out)`). Exit is symmetric.
- The spotlight ring around the anchor: 2px `var(--kronk-purple-bright)`
  with a 6px glow. The rest of the viewport gets a `rgb(0 0 0 / 45%)`
  dim overlay that lets pointer events through to the anchor **only** —
  everything else is blocked.

---

### 2. Navigation & controls

- **Next / Back** advance/rewind by one step within the current run.
- **Close (×)** dismisses **just this run**. Bubbles the user hasn't seen
  yet will fire on their next visit if they're just-in-time; the linear
  intro is considered "attempted" and will not auto-fire again on next
  login unless the "Don't show again" box is _not_ ticked and the user
  has seen fewer than 3 bubbles (below the threshold, we assume they
  wanted to come back to it).
- **Don't show this again** ticks a persistent flag (see § 6) and dismisses
  the run. Any future runs — linear or just-in-time — are suppressed.
- **Keyboard**:
  - `→` / `←` = Next / Back.
  - `Esc` = Close.
  - `Enter` on the Next button = advance.
  - The bubble is `role="dialog"` with `aria-modal="false"` (the app stays
    reachable in the background), focus is moved into the bubble on show,
    focus-trap is _not_ used — see accessibility note below.
- **Skip to end**: no "Skip tour" button in v1. "Don't show again" covers
  the same intent and is more honest.

#### Accessibility

- Bubble is announced via `aria-live="polite"` on first render.
- Anchor's spotlight ring is `aria-hidden`; the anchor keeps its own
  label.
- We do **not** trap focus inside the bubble — that would break screen
  readers navigating the surface behind. The bubble is one focusable
  region; Tab moves through its controls, then out to the page.
- `prefers-reduced-motion`: skip the enter/exit animation, drop the
  spotlight glow, keep the ring solid.

---

### 3. Cross-device adaptations

The template above is the desktop shape. Mobile is a different form-factor
and needs a different layout — a small floating tooltip on a 390px viewport
covers the thing it's describing.

| Viewport                                               | Layout                                                                                                                                                                                                                           |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Desktop ≥ 1024px**                                   | Floating tooltip anchored to target with 12px arrow. Bubble max-width 360px; positioned on the side with the most room. Full spotlight + ring.                                                                                   |
| **Tablet 768–1023px**                                  | Same as desktop, but touch targets (Back / Next / close / checkbox) grow to 44×44px min. Bubble max-width 340px.                                                                                                                 |
| **Mobile portrait < 768px**                            | Bubble docks to the **bottom** as a fixed sheet, full-width minus 12px inset, `--radius-large` on the top corners only. Anchor still gets the spotlight ring above the sheet. No arrow. Drag the top edge down > 100px to close. |
| **Mobile landscape / short viewport (height < 480px)** | Bubble docks to the **right** as a fixed side pane (max 320px wide). Same behaviour otherwise. If neither anchor nor pane fits, fall back to centred modal.                                                                      |
| **Anchor scrolled off-screen**                         | The runner scrolls the anchor into view before showing the bubble. If the anchor is inside a modal that isn't open (e.g. Ж menu), the runner opens the modal first, then shows the bubble against the now-visible target.        |
| **Anchor missing entirely**                            | (Feature-flagged off, upgrade removed target, etc.) The step is skipped silently. The runner logs the skip so we can prune stale bubbles.                                                                                        |

The mobile bottom-sheet variant is the same primitive the album lightbox
caption-edit and the day-details overlay already use; reuse those SCSS
tokens for consistency.

---

### 4. When it fires

#### First linear run

Fires **once per user**, on first visit to `/hub` after the 2.0.0 rebuild
lands. The tour starts with a centred welcome bubble; if the user accepts
"Start tour", the runner walks through the intro sequence (§ 5). If the
user closes the welcome bubble, we consider the tour attempted — it won't
fire automatically again, but their per-korner just-in-time bubbles still
will.

#### Just-in-time (per korner)

Fires **once per korner**, the first time the user opens the korner's
Stage. Each korner owns one intro bubble (occasionally two — one on the
overview, one on the primary action). The bubble is anchored to the
korner's most-important affordance (the compose CTA for a posting korner,
the primary view mode for a browsing one).

#### Restart / redo

- Settings → Help → **Restart tour** clears the seen flags and re-fires
  the linear run from the top on next `/hub` visit.
- Settings → Help → **Restart korner intros** re-arms every just-in-time
  bubble.

---

### 5. The bubbles

#### 5a. Linear intro (fires on first `/hub` visit)

8 bubbles. Deliberately short — the linear tour is orientation, not a
manual. Every korner has its own just-in-time bubble that goes deeper.

| #   | id                      | Anchor                         | Title                   | Body (draft copy)                                                                                                                                            |
| --- | ----------------------- | ------------------------------ | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `intro/welcome`         | _centred_                      | Welcome to Kronk 2.0    | This is a place for real people sharing real things with real people. Take the quick tour, or skip and explore.                                              |
| 2   | `intro/ж-menu`          | `Ж` button in the top membrane | Ж is your compass       | Everything you do — post, browse settings, jump between korners — starts here. Give it a tap when you're done with the tour.                                 |
| 3   | `intro/hub`             | Hub tile / hexagon lattice     | Korners live in the Hub | Each hexagon is a korner: a purpose-built space. Kalendar for events, Kommons for decisions, Albutts for shared albums, Kuestions for asks. Tap one to open. |
| 4   | `intro/space-badge`     | SpaceBadge (top-left crumb)    | Back up, any time       | The badge in the top-left always steps you one level up. There are no bespoke back buttons in Kronk — this is the way.                                       |
| 5   | `intro/reach-and-mates` | _centred_                      | Mates, not follows      | Kronk has no follower counts. You have **Mates** (mutual) and an **Orbit** (people who've flown near your posts). Reach expands outward from there.          |
| 6   | `intro/nudges`          | Nudges tab in the membrane     | Nudges is what changed  | One place for what happened — replies, invites, per-korner pings. No inbox zero pressure; it's a feed, not a to-do list.                                     |
| 7   | `intro/compose`         | Ж menu → Compose               | Every post has a Reach  | When you post, pick who can see it — Kronk (everyone), Orbit, Mates, or just you. Replies inherit their parent's reach; you don't pick it twice.             |
| 8   | `intro/done`            | _centred_                      | You're ready            | Explore. Each korner introduces itself when you first visit. Tick "Don't show again" any time to send the tour to bed.                                       |

#### 5b. Just-in-time (per korner)

One bubble per korner, fires on the korner's Stage the first time it
opens. Anchor to the affordance the korner is _about_.

| Korner        | Anchor                            | Title                            | Body (draft copy)                                                                                                            |
| ------------- | --------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Albutts**   | Album cover in the directory grid | Shared albums, real contributors | Anyone with reach on an album can add a photo. Tap a photo to see it big; froth, reply, share — same as a post.              |
| **Kalendar**  | The spiral                        | Time as a spiral                 | Today's at the head. Tap a day to open it; drag to scrub. Events you're going to show as a Ж in the ring.                    |
| **Kommons**   | Proposals face                    | Propose, vote, decide            | Proposals become cards. Vote from the card, discuss in-thread, watch the lattice fill up as decisions land.                  |
| **Kuestions** | Deck card                         | Ask, answer, learn               | Tap a card to answer. Swipe left to skip. Ask your own from Ж → Compose → Kuestion.                                          |
| **Nudges**    | Any nudge item                    | Threads live inside              | Tap a nudge to open the thing it's about — reply, react, or just glance. Kronk pings are quiet; no counters bouncing at you. |
| **Booth**     | A set thumbnail                   | Sets you can carry               | Save an assembly, revive it later, share it as a link. Sets are yours; no algorithm decides what's in them.                  |
| **Map**       | Map canvas                        | Where things are                 | See your Mates' presence (opt-in), find nearby events, plan a Trek. Zoom + drag as you'd expect.                             |
| **Trek**      | Trek header                       | Group treks, shared plans        | A Trek is a group route + who's coming. Invite Mates, comment inline, roll it out on the day.                                |
| **Moments**   | First moment card                 | Time-capsuled moments            | A Moment auto-publishes on the day it's for. Perfect for anniversaries, launches, next year's you.                           |
| **InFlow**    | Observation entry                 | Notes on your habits             | Private by default — nobody else sees your InFlow unless you say so. Rhythms, streaks, gentle reminders.                     |
| **Groups**    | Group directory                   | Where small circles live         | Groups are small, invite-only rooms with their own feed and korners scoped to the group. They don't leak to Kronk-at-large.  |

Krews and other sub-primitives don't get their own bubble; they're
mentioned in-flow inside the relevant korner's bubble (e.g. Groups covers
Krew semantics).

---

### 6. Persistence & versioning

#### Storage

- **Server-side** (authoritative): `settings_store["walkthrough_seen"]` —
  an object like:

  ```json
  {
    "version": 1,
    "dismissed_at": "2026-09-10T14:32:00Z",
    "seen_ids": ["intro/welcome", "intro/ж-menu", "albutts", "kalendar"]
  }
  ```

  - `dismissed_at` is only set when the user ticks "Don't show again".
  - `seen_ids` accumulates as bubbles are viewed (either as Next-past or
    as opened just-in-time).
  - `version` lets us re-fire the tour on major changes without wiping
    every user's flag. When we bump to `version: 2`, users who saw v1
    see the **delta** — the new bubbles only.

- **Local fallback**: `localStorage["kronk.walkthrough.seen.v1"]` mirrors
  the server value so a logged-out preview + a brief flicker of the
  logged-in dashboard don't cause a double-show. Server value wins on
  next sync.

#### API

Two endpoints (deferred detail — mentioned so the client design is honest
about round-trips):

- `GET /api/v1/settings/walkthrough` → the object above.
- `PATCH /api/v1/settings/walkthrough` → merge-patches `seen_ids` or
  sets `dismissed_at`. Idempotent.

#### First-shipping scope

v1 = the intro sequence + korner just-in-time bubbles above. No versioning
UI, no per-user bubble-visit dashboards. The delta-walkthrough mechanism
is baked in from day one because retro-fitting it is painful, but we
don't need any UI for it until v2 ships.

---

### 7. Implementation notes (deferred)

For the eventual PR. Left here so the shape is agreed before code lands.

#### Components (proposed)

- `<WalkthroughRunner>` — mounts at the Frame level (like `<KronkFrame>`
  already does for chrome). Owns the queue, the current step, and the
  overlay. Only one instance per app.
- `<WalkthroughStep>` — the bubble itself. Presentational. Takes
  `{ step, index, total, onNext, onPrev, onClose, onDontShowAgain }`.
- `<WalkthroughAnchor>` — thin wrapper any component can use to declare
  itself a target: `<WalkthroughAnchor id='ж-menu'>...</WalkthroughAnchor>`.
  Registers a ref with the runner. Alternative: the runner queries by
  CSS selector on show; refs are cleaner but require every anchor site
  to wrap.
- `useWalkthrough(korner: string)` — hook a korner root calls to
  auto-fire its just-in-time bubble when the Stage mounts.

#### Config

- Bubbles live in `config/walkthrough/*.yaml` — one file per
  logical group (`intro.yaml`, `albutts.yaml`, etc.). Manifest fields
  match the tables above. Loaded at boot via a small registry mirror of
  `Kronk::KornerRegistry`.
- Copy is in i18n so localisation isn't a rewrite.

#### Persistence wiring

- Server: extend `settings/walkthrough_controller.rb` on top of the
  existing `settings_store` scaffold (Kalendar / Nudges already use it —
  see `docs/spaces/settings.md`).
- Client: Redux slice `walkthrough` — `{ status, activeStepId, seenIds,
dismissedAt, version }`. Hydrated from `initial_state`.

#### Placement math

Use Popper.js / Floating UI (both already in the tree — check
`package.json` before adding). Placement `auto`, boundary is the viewport
minus the membrane + sidebar / bottom nav.

#### Runner interaction with modals

- Ж menu — the runner opens it before showing bubble #2 (anchor is
  inside), then closes it on Next.
- Compose modal — same for bubble #7.
- Anything the runner opens on the user's behalf, it closes on step
  advance.

---

### 8. Open questions

- **Auto-advance timing.** Do we auto-advance if the user takes the
  action the bubble describes (e.g. taps Ж)? Or always wait for Next?
  Leaning: never auto-advance — feels magical the first time, patronising
  the second.
- **Krew-scoped bubbles.** A Krew admin might want to introduce their
  Krew's own conventions. Out of scope for v1; note it as a v2 idea.
- **Empty-Hub case.** If the user has no korners visible (all filtered
  out by permissions / feature flags), bubble #3 (Hub) is meaningless.
  Runner should detect an empty Hub and swap the copy — or skip the
  bubble.
- **Rebuild-returning-user case.** A user who's used pre-2.0 Kronk isn't
  really "new" — should they see a shorter, "what changed" tour instead?
  Leaning: no separate tour. The full intro is short enough that a
  returning user can Next through it fast, and calling out "what
  changed" would require us to maintain a churn ledger.
- **Localisation-first copy.** Draft copy above is English-first. Before
  wiring, run past someone whose first language isn't English — the
  cheeky voice doesn't always translate.
