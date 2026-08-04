# Kronk — Membrane Navigation

_Aesthetic documentation addition · nav chrome specification_
_Applies to: platform top bar (Feed / Profile / Hub / Nudges) and every in-korner sub-nav (e.g. Kuestions: Today / Ƙuestions / Answered)._

---

## 1. Concept

The **Membrane** is Kronk's single navigation idiom. It replaces pills, filled tabs, boxes, and underlines with **one moving element**: a pool of light that glides along a thin wire beneath a row of flat text labels.

The wire does three jobs so nothing else has to:

1. **Position** — the pool sits under the label you're on.
2. **Motion** — it _glides_ between labels when you switch, so the transition itself tells you where you came from and where you landed.
3. **Signal** — a glint can race along the wire to a label when something arrives there (reserved for the platform bar's Nudges pillar; see §6).

Because the wire carries all of this, the labels stay flat: no borders, no background fills, no dots. The active label is simply brighter text; every other label is muted. This is "bold by subtraction" — the bar recedes and lets content lead.

The same idiom scales down unchanged from the four platform pillars to a two- or three-item korner sub-nav. **Any tabbed navigation in Kronk uses the Membrane.** No korner invents its own tab style.

---

## 2. Anatomy

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

## 3. Tokens

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

## 4. Pool behaviour

- **On mount**, the pool is measured against the active pillar and placed with no animation (measure after first paint / `requestAnimationFrame`).
- **On pillar change**, update the pool's `left` (centre of the target pillar) and `width` (target width − 20px). The CSS transition does the glide; do not animate via JS timers.
- **On resize**, re-measure and reposition the active pillar's pool with the transition suppressed (or accept a single glide — implementer's call; suppression is cleaner).
- **Glint** — on every successful pillar change, fire a one-shot `700ms` brightness pulse on the pool (`filter: brightness` 1 → 1.8 → 1). This is the "landed" acknowledgement, distinct from the arrival signal in §6.

Positioning is measured (`getBoundingClientRect`), not hard-coded per label, so the pool stays correct as label text, count badges, or locale width change.

---

## 5. Utilities and non-pillar views

Settings, compose/ask, and any surface reached from a utility button are **not pillars**. When the user is in one of these:

- **Default (chosen) behaviour:** the pool _parks_ under the nearest conceptual peer pillar rather than disappearing — e.g. an Ask/compose surface parks the pool under the first pillar; a Settings surface parks it under the last. The wire never goes blank, and returning to a real pillar glides the pool back.
- **Alternative (open decision):** the pool fades out entirely in non-pillar views, so the wire goes dark and reads as "you have stepped off the three." Cleaner conceptually, emptier visually.

**Decision needed:** park vs. fade. The prototype ships _park_.

---

## 6. Arrival signal (platform bar only)

On the **platform top bar**, the wire is also the delivery mechanism for notifications. When a Nudge arrives, a glint travels along the wire toward the **Nudges** pillar and its count updates. This is the argument for keeping Nudges on the bar rather than in the `Ж` menu — the membrane literally carries the signal to where it lives.

Resting liveness is **calm**: the pool sits still under the active pillar. The travelling glint fires **only on genuine arrival**, never on a timer. (An earlier exploration offered `still / current / pulse` characters; the resolved default is _calm at rest, glint on real arrival_.)

In-korner sub-navs (Kuestions, etc.) **do not** carry the arrival signal — there is no per-korner inbox on the wire. They use position + glide + the landing glint only.

---

## 7. Accessibility & motion

- The pillar row is a `role="tablist"`; each pillar is `role="tab"` with `aria-selected`. Panels are the corresponding `tabpanel`s.
- Active state must be conveyed by **text colour**, not the pool alone — the pool is decorative reinforcement, and colour-contrast between muted and primary label states must remain legible for users who can't perceive the glow.
- `prefers-reduced-motion: reduce` → suppress the glide, the glint, and the arrival travel. The pool jumps to position; label colour still changes. Nothing about wayfinding depends on motion.
- Keyboard: arrow keys move between tabs within the row; the pool follows focus-driven selection the same as pointer selection.

---

## 8. Responsive

- The bar is a single horizontal row at all widths used by the current shell (max container 640px). Glyph left, pillars left-of-centre, utilities right.
- If a future korner needs more pillars than fit, pillars may scroll horizontally with the wire; the pool still tracks the active pillar. Do **not** wrap pillars to a second line or collapse them into a menu — the wire must remain a single continuous line.
- On the platform bar's mobile treatment, the core spaces already collapse to a bottom bar per the shell spec; the Membrane wire idiom is the **desktop/tablet and in-korner** treatment and is not duplicated on the mobile bottom bar.

---

## 9. Scope of this spec

- **In scope:** the visual and behavioural definition of the nav idiom — flat pillars, wire, pool, glide, glint, arrival signal, park-vs-fade, a11y, responsive rules.
- **Out of scope:** which pillars exist in a given surface (that's each korner's own spec), routing, and panel contents. The platform pillar set (Feed / Profile / Hub / Nudges) and the `Ж` action menu (Post / Search / Settings) are defined in the shell redesign spec, not here.

---

## 10. Open decisions to resolve before build

1. **Park vs. fade** for the pool in non-pillar (utility) views — §5. Prototype ships _park_.
2. **Thread edge** — pool sits _on_ the bar's bottom border (current), or floats a few px below it, detached, reading more as a membrane _between_ chrome and content than as an underline. Prototype ships _on the border_.
3. **Resize handling** — suppress the glide on resize (clean) vs. allow a single glide (playful). Prototype suppresses.

---

_Reference prototype: `kronk-kuestions-prototype.html` — the Kuestions sub-nav (Today / Ƙuestions / Answered) is the canonical in-korner implementation of this spec._
