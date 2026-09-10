# Kronk walkthrough — first-run tour

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

## 1. What a bubble is

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

### Fields

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

### Kronk aesthetic

Same smoked-glass family as `SpaceBadge` and the compose FAB (see
`docs/kronk_aesthetic_system.md` § Floating chrome).

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

## 2. Navigation & controls

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

### Accessibility

- Bubble is announced via `aria-live="polite"` on first render.
- Anchor's spotlight ring is `aria-hidden`; the anchor keeps its own
  label.
- We do **not** trap focus inside the bubble — that would break screen
  readers navigating the surface behind. The bubble is one focusable
  region; Tab moves through its controls, then out to the page.
- `prefers-reduced-motion`: skip the enter/exit animation, drop the
  spotlight glow, keep the ring solid.

---

## 3. Cross-device adaptations

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

## 4. When it fires

### First linear run

Fires **once per user**, on first visit to `/hub` after the 2.0.0 rebuild
lands. The tour starts with a centred welcome bubble; if the user accepts
"Start tour", the runner walks through the intro sequence (§ 5). If the
user closes the welcome bubble, we consider the tour attempted — it won't
fire automatically again, but their per-korner just-in-time bubbles still
will.

### Just-in-time (per korner)

Fires **once per korner**, the first time the user opens the korner's
Stage. Each korner owns one intro bubble (occasionally two — one on the
overview, one on the primary action). The bubble is anchored to the
korner's most-important affordance (the compose CTA for a posting korner,
the primary view mode for a browsing one).

### Restart / redo

- Settings → Help → **Restart tour** clears the seen flags and re-fires
  the linear run from the top on next `/hub` visit.
- Settings → Help → **Restart korner intros** re-arms every just-in-time
  bubble.

---

## 5. The bubbles

### 5a. Linear intro (fires on first `/hub` visit)

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

### 5b. Just-in-time (per korner)

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

## 6. Persistence & versioning

### Storage

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

### API

Two endpoints (deferred detail — mentioned so the client design is honest
about round-trips):

- `GET /api/v1/settings/walkthrough` → the object above.
- `PATCH /api/v1/settings/walkthrough` → merge-patches `seen_ids` or
  sets `dismissed_at`. Idempotent.

### First-shipping scope

v1 = the intro sequence + korner just-in-time bubbles above. No versioning
UI, no per-user bubble-visit dashboards. The delta-walkthrough mechanism
is baked in from day one because retro-fitting it is painful, but we
don't need any UI for it until v2 ships.

---

## 7. Implementation notes (deferred)

For the eventual PR. Left here so the shape is agreed before code lands.

### Components (proposed)

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

### Config

- Bubbles live in `config/walkthrough/*.yaml` — one file per
  logical group (`intro.yaml`, `albutts.yaml`, etc.). Manifest fields
  match the tables above. Loaded at boot via a small registry mirror of
  `Kronk::KornerRegistry`.
- Copy is in i18n so localisation isn't a rewrite.

### Persistence wiring

- Server: extend `settings/walkthrough_controller.rb` on top of the
  existing `settings_store` scaffold (Kalendar / Nudges already use it —
  see `docs/kronk_settings_ia.md`).
- Client: Redux slice `walkthrough` — `{ status, activeStepId, seenIds,
dismissedAt, version }`. Hydrated from `initial_state`.

### Placement math

Use Popper.js / Floating UI (both already in the tree — check
`package.json` before adding). Placement `auto`, boundary is the viewport
minus the membrane + sidebar / bottom nav.

### Runner interaction with modals

- Ж menu — the runner opens it before showing bubble #2 (anchor is
  inside), then closes it on Next.
- Compose modal — same for bubble #7.
- Anything the runner opens on the user's behalf, it closes on step
  advance.

---

## 8. Open questions

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
