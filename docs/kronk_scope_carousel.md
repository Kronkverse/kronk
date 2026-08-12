# The Scope Carousel — delivery brief

_How we'd build the "rotating stand" selector for **what you see** and **who sees you**, site-wide — and its twin, a standardised **composer frame** the selector slots into. Grounded in the actual codebase (2026-08-06)._

> **Status:** delivery investigation — not yet built. The visual design is being
> prototyped separately ("The Prism"). Related: [Scope Picker](kronk_scope_picker.md),
> [Feed & Reach](kronk_feed_and_reach.md).
>
> **Fragmentation partly fixed since this was written (2026-08-12).** The
> "who-can-see" row below counts krew as one option among the reach tiers and
> the composers as four separate UIs. Both have moved: **krew is now an
> orthogonal additive axis**, not a reach option
> ([Feed & Reach §2.2](kronk_feed_and_reach.md)), and the main composer,
> Moments and Albutts were unified onto the shared `reach_dropdown.tsx`
> (with a `krewSingleSelect` mode) in #1331/#1332/#1343. The carousel's case
> still stands, but the "before" picture it argues against is out of date.

## The one-line answer

Build **one shared `<ScopeCarousel>`** component — a horizontal, swipe/arrow "rotating stand" — used in **two sizes**: LARGE for choosing a feed/content view, SMALL for choosing a post's reach. Build it with the stack we already use (`@react-spring/web` + `@use-gesture/react`), by lifting the engine out of the carousel we already ship. **No new dependencies, no three.js, no true-3D.**

## What the carousel selects — the real prize

It's not just UI polish; it's the forcing function to **unify a fragmented model.** Today there are **three axes** and they're scattered:

| Axis                           | Options                                       | Where it lives now                                                                    |
| ------------------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------- |
| **See** (feed width)           | mates / orbit / kommunity                     | one place: feed-settings cards                                                        |
| **Who-can-see** (post reach)   | public / orbit / mates / self_only **+ krew** | **four** different UIs (status modal, moments strip, kuestions "dial", albutts chips) |
| **Who-can-add** (contribution) | open / closed / invited / krew / event        | chris's new ScopePicker (albutts only)                                                |

Two facts the docs are firm on: **"See" and "Who-can-see" are the _same distance ladder_** (Mates → Orbit → Kronk) used for viewing vs radiating — yet they share no UI today. And **Krew is a separate group-target**, not a ladder rung. Also flagged: the widest tier is named three different things (`kronk` in docs / `kommunity` in feed_scope / `public` in visibility), and Album re-numbers the visibility enum vs Status. **The carousel is the moment to converge on one canonical ladder + vocabulary.**

## How to build it (delivery)

**Engine:** copy `components/featured_carousel.tsx` almost verbatim — it's the only real carousel in the app and already does the whole thing: a flex track animated by `useSpring` to `-{index*100}%`, `useDrag({swipe})` for flick-to-next, chevron arrow buttons, wraparound, and carousel a11y. It's just welded to post content today; we swap the slides for option "faces."

**The "stand turning" feel** without literal 3D: wrap the flat translate track in `perspective: 1200px` and give each face a react-spring-interpolated `rotateY` based on its distance from center (incoming ~35°→0°, outgoing 0°→−35°). Reads as a rotating stand, keeps flat DOM (hit-testing, scroll, a11y all sane). True CSS-3D prism was considered and rejected — fights `overflow`, janky on mobile, no precedent. _(Note: the "Prism" design prototype does commit to true CSS-3D and makes it work — if that direction wins, the engine is a barrel rather than a flat track, but the option model, a11y, and reduced-motion contract below are unchanged.)_

**Reduced motion is free:** the app already does `Globals.assign({skipAnimation: true})` when the user prefers reduced motion (`main.tsx:36`), so every react-spring animation snaps instantly. The rotation collapses to a clean instant swap automatically.

**Option model** — one shared shape (widen the existing `SelectItem`):

```ts
interface ScopeOption {
  key: string;
  label: string;
  icon?: string /* +gating */;
}
```

Icons resolve from a manifest string via the existing `kornerIcon()` resolver, so each korner can name the faces it supports. Labels via `defineMessages` (static ids — house rule). Selection colour is a token concern (`--accent` / `--kronk-purple-*`), not option data.

**Accessibility** (it's a real selector, not a toy): `role="radiogroup"` with `role="radio"` + `aria-checked` faces (lift from ScopePicker's `ChipRow`); roving arrow keys + Home/End; swipe AND click-arrows both call one `rotateTo()`; `aria-live` announces the selected view; off-centre faces get `inert`. Keep `touch-action: pan-y` so horizontal swipe never eats vertical feed scroll.

**Large vs small:** same component, `size` prop. LARGE (feed header) shows the rotation flourish and is manifest-driven off each korner's `views:`. SMALL (compose bar) sits in the `dropdown-button` footprint, arrows + swipe, rotation optional — crisp over showy in a dense row. Both are **pure controlled inputs** (`value` / `onChange`); all side effects (change the feed route vs set a compose field) live in the two call sites.

## What we reuse vs replace

- **Lift the engine** from `featured_carousel.tsx` (drag + spring + index + a11y).
- **Lift selection/gating/keyboard** from `components/scope_picker.tsx` `ChipRow` (chris's) — already a generic radiogroup with per-option gating.
- **Feed the large one** the manifest `views:` mechanism that `space_view_picker.tsx` already reads.
- **Keep `ScopePicker`** as the two-axis _wrapper_ (Who's this for? / Who can add?) that stacks two carousels and owns cross-axis constraints (e.g. suppress `open` when `self_only`; mirror Krew across axes).
- **Absorb & retire** over time: the status `visibility_modal`, moments' `korner_visibility_picker`, kuestions' bespoke `visibility_dial`, Trek's map reach picker, and the feed-settings scope cards — all become one carousel.
- **Krew** = a face that reveals a small sub-picker (not a ladder rung). **Tune-in / subscription** is a _separate fourth gate_ — do NOT fold it into reach.

## Phasing

1. **Storybook-first** — build/tune `ScopeCarousel` in isolation (Storybook is set up; `scope_picker.stories.tsx` is the template). This is where the design + rotation feel get nailed before any wiring.
2. **Consolidate the option lists** — one exported canonical ladder (`SelectItem[]`), reconcile the naming drift + the Album-vs-Status enum divergence.
3. **LARGE first** — replace `SpaceViewPicker`'s internals + the feed-settings cards. Manifest-driven, lower blast radius.
4. **SMALL next** — swap it in behind/for compose `VisibilityButton` (isolate compose-flow regressions).
5. **Migrate the stragglers** — moments / kuestions / trek onto the shared primitive; retire the bespoke UIs.

## Top risks

- **Enum reconciliation** — Status vs Album use different integer mappings for the same tier names; the unified selector needs one canonical vocabulary + a backend adapter or alignment.
- **Gesture vs scroll contention** — verify `touch-action: pan-y` end-to-end so the swipe doesn't fight vertical feed scroll or the edge-drag nav-open.
- **react-spring string interpolation** — keep translate (`%`) and rotation (`deg`) as separate animated props, don't concatenate into one transform string.
- **Migration surface** — this replaces visible affordances; land LARGE behind the manifest first, keep SMALL/compose as a separate step.

## For the design work (what the visuals must respect)

- It's semantically a **single-select radiogroup** (screen-reader + keyboard), presented as a rotating stand.
- The **See** and **Who-can-see** faces are the _same ladder_ — visually rhyme them so people learn it once.
- **Krew** is a distinct kind of face (reveals a sub-picker), not a ladder tier — give it its own visual note.
- Design a **reduced-motion** resting state (the instant-swap look), since the rotation disappears for those users.
- Two sizes, one language: LARGE (feed) can be lush; SMALL (compose) must fit a dense toolbar.

## Key files to copy from

`components/featured_carousel.tsx` (engine + a11y) · `features/navigation_panel/index.tsx:466-518` (velocity/rubberband drag) · `components/scope_picker.tsx:207-254` (radiogroup semantics) · `components/space_view_picker.tsx` (manifest view model) · `hooks/useKornerIcon.tsx` (icon resolver) · `main.tsx:36-40` (reduced-motion) · `styles/mastodon/components.scss:11963-12009` (carousel CSS) · `components/scope_picker.stories.tsx` (Storybook harness).

---

# The Composer Frame — the twin

The carousel is one _slot_ in a bigger coherence play: **standardising the post-creation frame.** Kronk has ~6 hand-rolled composers, each reinventing the chrome around genuinely different bodies. The scope carousel is the frame's reach slot, so it lands first — but the frame is where the familiarity payoff compounds.

## Verdict

Worth it — but the target is a shared **frame**, not one composer. There are ~6 hand-rolled composers (`album_composer`, `contribute_composer`, moments `composer`, `kommons_tree/composer`, `tell_composer`, nudges `composer`) plus the main status composer, each reinventing the chrome around genuinely different bodies.

## The key finding: coherence lives on TWO levers, and they only meet at one seam

You **cannot** unify posting behind a single write endpoint — the backend intake genuinely differs per korner, and **four surfaces mint no `Status` at all** (Moments, profile "tell"/`ProfileSection`, nudges, Kuestions answers). So there is no "one endpoint with a discriminator." Instead there are two real convergence levers:

1. **Frontend — a shared `<ComposerFrame>`** = the common chrome, with a korner-specific body slot and an `onSubmit(payload)` that dispatches to each korner's **own** create endpoint.
2. **Backend — the already-shared `PostStatusService` + a `source_korner` stamp.** The Status-minting korners (albutts, kommons, kuestions, kalendar, map/trek-on-publish, booth) each keep their own domain model + endpoint + lifecycle, then delegate to the one shared `PostStatusService` and stamp `source_korner` (`albutts`/`kommons`/`kuestions`/`kalendar`/`map`/`booth`) on the resulting Status.

They meet **only at the `source_korner` discriminator**, not at a shared write path. So: standardise the _frame_ and lean on `PostStatusService` — don't try to merge the create endpoints.

## The ComposerFrame contract (the standardised chrome)

One `<ComposerFrame>` primitive (next to `scope_picker.tsx` / `scope_carousel.tsx`), pure and controlled — all side effects in the call site:

- **Identity** — who's posting (avatar + handle) + the account-switcher hook.
- **Scope slot** — the **scope carousel** (who-can-see / who-can-add). _This is why the carousel lands first — it's a frame slot._
- **Body slot** — the korner-specific content (photos, a date+place, answer options, a map). The frame owns everything around it, not this.
- **Media** — attach + preview (reuse the compose store's uploader).
- **Kategory tagger** — the cross-cutting taxonomy at compose time.
- **Primary action** — Post / Publish / Send, with the korner's verb; wired to `onSubmit(payload)`.
- **Validation / char-count / error display** — one shared surface.
- **Drafts / autosave**, **title/header**, **cancel/close**.

Each korner supplies: the body component, the `onSubmit` (→ its own endpoint), the allowed scope options (manifest), and the action verb.

## What to build on vs replace (frame)

- **Reuse:** the main `features/compose` redux store's shared sub-pieces (media uploader, char counter) where they generalise; `ScopePicker`/the carousel; `PostStatusService` + a small `source_korner` projection helper server-side.
- **Watch:** each korner composer keeps _local_ state today rather than the compose store — the frame should be state-agnostic (controlled) rather than force everything through the redux compose store.
- **New:** `<ComposerFrame>` (frontend). No new backend intake — the frame delegates.

## Migration order (each independently shippable)

1. **Carousel first** (it's the scope slot).
2. **The main status composer** onto the frame — highest familiarity payoff, the reference implementation.
3. **The Status-minting korners** that already share `PostStatusService` — **albutts album, kommons proposal, kuestions question, kalendar event** — lowest friction (backend already converged; just adopt the frame + delegate).
4. **The no-Status / bespoke oddballs last** — Moments, profile "tell", nudges — adopt the frame purely as chrome with a custom `onSubmit`, since they mint no Status. Treks/map (kommons tree) may stay bespoke behind an escape hatch.

## Risks (frame)

- **Over-standardising bespoke korners** — treks/map and kommons-tree have genuinely unusual flows; keep an escape hatch (use the frame or not).
- **The no-Status surfaces** — the frame must NOT assume it's minting a Status (4 surfaces don't); it's chrome + delegate, persistence-agnostic.
- **Redux-store vs local-state split** — keep `<ComposerFrame>` a controlled input; don't force every korner through the compose store.
- **Doc/code drift found en route:** Moments' controller comments reference a `post_status_service!` that doesn't exist — Moments is effectively standalone (no Status). Worth a cleanup PR regardless.

## The through-line

Carousel → generalise the frame around it (status composer first) → migrate the Status-minting korners → mop up the no-Status oddballs. Each step is small and shippable; coherence compounds as korners adopt the frame.
