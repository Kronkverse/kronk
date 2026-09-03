# Kronk Aesthetic System

> **What this is.** A single, self-contained reference for Kronk's visual identity as of the 2.0.0 rebuild: the design tokens (with real values), the aesthetic principles that govern how anything is built, the shared component kit, and the korner-manifest framework that new spaces are authored against. It's written to be dropped into a Claude Project as knowledge so korner rebuilds can be planned consistently without re-reading the whole codebase.
>
> **Provenance.** Compiled from the live repo (`app/javascript/mastodon/tokens/tokens.yaml`, the SCSS partials, the korner registry, `features/styleguide/`) plus the 2.0.0 rebuild design decisions. Where the older `docs/kronk_korner_spec.md` still describes the retired "planet metaphor" (v0.5), **this document supersedes it** for anything visual.

---

## 1. Identity in one paragraph

Kronk is **one platform, one palette**. Every space — profile, hub, kommons, events, settings, each korner — wears the same **Kronk-purple** identity on a **dark-first** surface. Differentiation between spaces comes from **icon, name, and content**, never from a bespoke colour. The look is calm, deep, and slightly luminous: dark purple-tinted surfaces, a bright indigo accent, generous corner-rounding, and a signature layered purple **cover-glow** at the top of feature surfaces. Serif display type over a sans body gives it a considered, editorial feel rather than a generic-app feel.

### Principles (the rules that don't bend)

1. **Everything through tokens.** No raw hex, rgb, or hard-coded spacing/motion values in feature CSS. Colours, radii, elevation, and motion all come from CSS custom properties generated from `tokens.yaml`. This is **enforced by stylelint** on governed feature CSS — a raw hex in a governed file fails the build. (Coverage is being extended to the korner-card partials.)
2. **Kronk-purple is platform-wide.** The palette applies everywhere. Per-space colour identity is retired. When you need an accent, use `var(--accent)`; do not introduce a new brand colour for a korner.
3. **Dark is the default; light is a first-class mirror.** Every themed token has both a `dark` and a `light` value. Build against the semantic aliases and both themes come for free — never branch on theme in feature code.
4. **The planet metaphor is gone.** Pre-2.0.0, each space "orbited" a coloured planet and cards themed from a `--space-color` custom property. That was retired to consolidate identity. `--space-color`, its transitional alias, and `planets.tsx` itself have all been removed from the code — no shim survives (`find app/javascript -iname '*planet*'` returns nothing).
5. **Radius has a language.** Small for controls, medium for cards, large for feature surfaces/sheets, round for pills and avatars. Use the named radius tokens, not pixel values.
6. **Semantic over literal.** Reference `--accent`, `--surface-elevated`, `--decision-agree` — not the raw palette token behind them. The consumer aliases are the contract; the palette can shift underneath.

---

## 2. Design tokens

### 2.1 The pipeline

```
app/javascript/mastodon/tokens/tokens.yaml     ← the single source of truth (edit this)
        │  bin/generate-tokens
        ▼
app/javascript/styles/mastodon/_tokens.scss    ← GENERATED — never hand-edit
```

- `tokens.yaml` declares every token. Colours that differ by theme are authored as `{ dark: …, light: … }`; theme-invariant tokens (radius, motion, fonts) are authored as a single value.
- `bin/generate-tokens` emits `_tokens.scss` with a `:root` block (theme-invariant + dark values) and a `[data-theme='light']` block (light overrides). It emits **single-quoted** selectors so prettier doesn't reformat and re-break the CI check.
- CI runs `bin/generate-tokens --check` — if the committed `_tokens.scss` doesn't match what the generator would produce, the build fails. **Always regenerate after editing `tokens.yaml`; never edit the SCSS directly.**

### 2.2 Palette (raw brand colours)

These are the underlying brand ramp. **Feature code should almost never reference these directly** — use the semantic aliases in §2.3. Listed here so the palette is legible.

| Token                    | Dark      | Light     | Role                       |
| ------------------------ | --------- | --------- | -------------------------- |
| `--kronk-purple-primary` | `#32237c` | `#3034a0` | Core brand purple          |
| `--kronk-purple-bright`  | `#7241ff` | `#6364ff` | Luminous highlight (glows) |
| `--kronk-purple-deep`    | `#3a218b` | `#36248c` | Deep shadow purple         |
| `--kronk-purple-muted`   | `#413c8c` | `#45455f` | Desaturated support purple |
| `--kronk-purple-accent`  | `#4414cc` | `#6364ff` | Interactive indigo accent  |

### 2.3 Semantic tokens (the contract — build against these)

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

### 2.4 Typography

| Token            | Value                                                 |
| ---------------- | ----------------------------------------------------- |
| `--font-display` | `'Liberation Serif', Georgia, serif`                  |
| `--font-body`    | `mastodon-font-sans-serif, sans-serif`                |
| `--font-mono`    | `'Roboto Mono', 'Fira Mono', ui-monospace, monospace` |

Display serif is used for headings and feature titles; body sans for everything else. The serif is what gives Kronk its editorial character — reach for `--font-display` on titles rather than bolding the sans.

### 2.5 Radius

Kronk's **universal corner language** — everything rounds; there are no sharp corners in the shell. If a surface can't fit a radius, it becomes a hairline divider (a `--border-default` line, not a box).

| Token             | Value   | Use                                                                      |
| ----------------- | ------- | ------------------------------------------------------------------------ |
| `--radius-small`  | `6px`   | Inline chips, small icon buttons, focus rings, dropdown items            |
| `--radius-medium` | `10px`  | Cards, panels, dropdowns, sidebar korner tiles, menu items               |
| `--radius-large`  | `16px`  | Hero surfaces — top strip, sidebar, hub korner cards, menu panel, modals |
| `--radius-round`  | `999px` | Pills — hub switcher, tags, badges, capsule buttons, avatars, toggles    |

Buttons follow the same rules: primary CTAs are `round` pills; secondary/tertiary are `small` or `medium`; chip picks are `round`. Borders on interactive surfaces are always **1–1.5px** in `--border-default` or a semantic-accent tint — never thicker.

### 2.6 Elevation

Four levels, each a token defining a box-shadow: `--elevation-subtle`, `--elevation-card`, `--elevation-floating`, `--elevation-menu`. Use the named level for the role (a dropdown menu uses `--elevation-menu`, a resting card uses `--elevation-card`) rather than composing shadows by hand.

### 2.7 Motion

| Token                  | Value             | Use                         |
| ---------------------- | ----------------- | --------------------------- |
| `--motion-dur-fast`    | `120ms`           | Hovers, small state changes |
| `--motion-dur-medium`  | `200ms`           | Most transitions            |
| `--motion-dur-slow`    | `400ms`           | Sheets, large reveals       |
| `--motion-ease-out`    | ease-out curve    | Enter transitions           |
| `--motion-ease-in-out` | ease-in-out curve | Move/resize                 |
| `--motion-ease-spring` | spring curve      | Playful/emphasis            |

---

### 2.8 The per-user layer — Personal Appearance

The tokens above are **brand defaults**. Kronk also lets each person tune a constrained slice of the aesthetic (Personal Appearance): a **purple-locked accent** (the hue is held to the Kronk range, so it can never leave the identity), theme (dark/light), display + body font, UI scale, and reduced motion. These are applied client-side by `utils/personal_appearance.ts`, which writes the choices as CSS custom properties onto `:root` (e.g. `root.style.setProperty('--accent', …)`), **layering over** the generated defaults.

**Consequence for everything you build:** referencing `var(--accent)` and the semantic tokens isn't only about brand consistency — it's what makes per-user theming work. A component that hard-codes a hex, or reaches past a semantic alias to a raw palette token, silently opts the user out of their chosen accent/theme/scale. This is the deeper reason "everything through tokens" (§1) is non-negotiable: the token layer is the single seam where **both** platform identity and personalisation live.

(The accent is hue-locked to purple server-side — `purple_accent?`, `Api::V1::Settings::AppearanceController`. Explore accents in the token studio at `talitamoss.info/kronk-chooser.html`.)

## 3. Signature treatments

### 3.1 The cover-glow

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

### 3.2 color-mix for tints

Translucent variants of any token (hover states, chip backgrounds, selection highlights) are built with `color-mix(in srgb, var(--token) N%, transparent)` — never a parallel hard-coded rgba. This keeps tints locked to the token they derive from.

---

## 4. The component kit

Shared primitives live under `app/javascript/mastodon/features/` and are styled with the tokens above. Reuse these before building anything new — consistency across spaces comes from everyone drawing on the same kit.

### 4.1 Settings widgets (`features/settings/setting_widgets.tsx`)

The row-based settings vocabulary. Every settings control is a `SettingRow` (label + hint + control) wrapping one of the typed widgets:

- **`SettingRow`** — label, optional hint, and a control slot. The layout primitive for any settings-style form.
- **`BooleanWidget`** — a toggle.
- **`EnumWidget`** — single-choice (radio/select semantics).
- **`MultiEnumWidget`** — multi-choice.
- **`DurationWidget`** — a duration picker.

Class namespace: `korner-settings__*`. These back the Notifications, Privacy, and Appearance settings sections and are the template for any per-korner §K settings space.

### 4.2 List manager (`features/settings/list_manager.tsx`)

A generic `ListManager<T>` — fetches a collection from an endpoint and renders each entry as a row with a remove button (optimistic removal, re-adds on failure). Hooks-based, no Redux coupling. Callers supply `primary` / `secondary` / `avatar` accessors and a `removeItem` callback, so the same shell serves mutes, blocks, domain blocks, and later filters. Class namespace: `settings-list-manager__*`.

Use this for any "managed list of things the user can remove" surface rather than hand-rolling a list.

### 4.3 Navigation & chrome

- **`hub_switcher.tsx`** — the four-way platform nav (Me / Home / Hub / Nudges). The **top variant** renders the **Membrane** (spec: `KRONK_MEMBRANE_NAV.md`): flat text pillars + a 1px wire + a purple pool of light that glides under the active pillar, styled via `.hub-switcher--top` in `_kronk_chrome.scss`. The **bottom variant** renders the mobile tab-bar: icon+label tabs, styled via `.hub-switcher--bottom`.
- **`kronk_menu.tsx` / settings `nav.tsx`** — the "K" menu and settings navigation. Section rows route to their destination; the profile section routes to `/@:acct/shelves` (editing is Arrange mode on the shelved profile — the standalone `/@:acct/edit` composer was retired).

**Back navigation — one pattern, no exceptions.** Two primitives cover every legitimate case:

1. **`SpaceBadge`** (auto). Every korner surface mounted through `<Stage>` gets the top-left "< Korner" pill for free — one tap back to `/hub`. Nothing to opt in to.
2. **`<BackToKorner>`** (explicit). For a detail page that needs a chip pointing at a specific parent (e.g. an album back to `/hub/albutts`), drop `<BackToKorner href='…' label='…' />` in. Renders `.kronk-back-chip` — the standard purple pill.

Hand-rolling a `<Link>` or `<button>` labelled "← Back" / "← Albums" / "← Cancel" is **banned**. Stylelint enforces this as a `lint:css` error: any class matching `*__back`, `*__back-link`, `*__back-button`, `*__back-chip`, or `*__back-to-*` fails the build. See `stylelint.config.js` → `selector-disallowed-list`. If a surface has genuinely different semantics (a wizard step-back inside a composer, a cancel action inside a form), express it as a wizard-nav using the shared `<KornerPill>` primitive — the ban is on **naming/shape**, not on the underlying flow.

Breadcrumbs (`__crumb` / `__breadcrumb`) are a different pattern (path from root, not go-back). Not banned; if Kronk later standardises breadcrumbs it gets its own primitive + rule.

Retired 2026-09-03 — three live offenders + eight orphan SCSS blocks: `.albutts-detail__crumb`, `.wachuneed__compose-back`, `.kuestions-composer__back`, plus dead-code sweeps of `.booth-artist-detail__back`, `.group-detail__back`, `.kommons-plant__back`, `.korner-settings __back`, `.krew-detail__back`, `.kronk-attachment __back`, `.map __back`, `.kronk-org-page__back-to-app`.

### 4.4 Governance / kommons cards

`_status_kommons_card.scss` and `_governance.scss` render proposal/decision surfaces using the `--decision-*` tokens with `color-mix()` tints. These are the reference for any voting/decision UI.

### 4.5 The live styleguide

There is a running styleguide at **`/styleguide`** (`features/styleguide/index.tsx`, styled by `_styleguide.scss`). It renders the tokens and primitives as live swatches/components. **Use it as the visual source of truth** — when planning a korner, check the styleguide to see what the kit already offers before proposing new components.

---

## 5. The korner framework

New spaces are **korners**, declared by a manifest — not bespoke wiring. This is what keeps every space consistent and discoverable.

### 5.1 What a korner is

- One manifest per korner: `config/korners/<slug>.yaml`.
- Every korner mounts under **`/hub/<slug>`**.
- Reserved slugs live in `config/korners/reserved_slugs.yaml`.
- `config/initializers/kronk_korner_registry.rb` → `Kronk::KornerRegistry` loads all manifests at boot and warns on drift.
- `bin/tootctl korners doctor` surfaces mismatches between manifest and reality.

### 5.2 Manifest shape

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

### 5.3 Feed projection

A korner declares `feed_projection.card` naming a card component (e.g. `StatusKornerCard` / `StatusKommonsCard`). The framework's card registry picks up that adapter and renders the korner's items inline in feeds — consistently styled via tokens, no per-korner feed code.

### 5.4 Per-korner settings (§K)

Each korner gets a settings space at `/hub/<slug>/settings`, built from the settings widget kit (§4.1). Declaring settings in the manifest is how a korner exposes user-configurable options without a bespoke settings page.

### 5.5 Theming a korner

Reference `var(--accent)` and the semantic tokens. **Do not** add a colour to the manifest or a `--space-color`. Use `@include kronk-cover-glow()` for the header. The result inherits the platform identity automatically — which is the point.

---

## 6. Building a korner to spec — checklist

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

## 7. Quick reference — files

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

_Supersedes the visual sections of the older `docs/kronk_korner_spec.md` (v0.5, planet-metaphor era). For the korner manifest field-by-field schema and the "adding a korner" walkthrough, see `docs/korners/adding_a_korner.md` alongside this document._
