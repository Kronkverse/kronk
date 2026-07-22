# Standard korner page — zonal layout

The Kronk chrome resolves into three named layers. Every korner page
sits inside them and reserves the same slots so the shape is
predictable across spaces.

## Layers

- **Frame** — the invariant chrome that surrounds every page. Fixed to
  the viewport; identical on every korner. Never re-implemented per
  space.
- **Stage** — the well-defined rectangle inside the Frame where the
  space renders. One per route; owns its own scrollbar; sits
  underneath the Frame's fade bands.
- **Space content** — everything the korner itself draws inside its
  Stage. Panels, cards, feeds, etc.

## Desktop layout (≥890px)

```
 Frame layer ────────────────────────────────────────────────────
┌───────────────────────────────────────────────────────────────┐
│  Ж KRONK              Me   Home   Hub   Nudges                │
│  .kronk-wordmark      .hub-switcher (top membrane)            │
│  (top-left, fixed)    ── ── ═════ ── ──   ← gliding pool wire │
├───────────────────────────────────────────────────────────┬───┤
│                                                           │🎧│ │
│ ┌────────┐                          ┌───────────────┐     │🎯│ │
│ │ ← Hub  │                          │ Today  Deck A │     │✦│ │
│ └────────┘                          └───────────────┘     │⚙│ │
│ .korner-exit                        .space-tabs           │  │ │
│ (top-left, floating)                (top-right,           │  │ │
│                                      floating)            │.k│ │
│                                                           │or│ │
│                 ┌────────────────────┐                    │ne│ │
│                 │    Kuestions       │  ← .space-title    │r-│ │
│                 │  (serif, centred)  │    (regular        │si│ │
│                 └────────────────────┘     position)      │de│ │
│                                                           │ba│ │
│               Ask and answer, unlock. ← .space-subtitle   │r │ │
│                                                           │  │ │
│        ┌────────────────────────────────────┐             │  │ │
│        │                                    │             │  │ │
│        │       Panel content                │             │  │ │
│        │       (deck / today / answered /   │             │  │ │
│        │        ask / settings)             │             │  │ │
│        │                                    │             │  │ │
│        │      ✦ ambient stars ✦             │             │  │ │
│        │        fill Stage                  │             │  │ │
│        │                                    │             │  │ │
│        └────────────────────────────────────┘             │  │ │
│                                                           │  │ │
├───────────────────────────────────────────────────────────┴───┤
│  ↑ .kronk-stage — butts against .korner-sidebar's inner edge  │
└───────────────────────────────────────────────────────────────┘
```

## Mobile layout (≤629px)

```
┌──────────────────────────────────────┐
│  Ж KRONK                             │  ← wordmark (fixed top-left)
├──────────────────────────────────────┤
│ ┌────┐             ┌───────────────┐ │
│ │←Hub│             │Today Deck Ans │ │  ← reserved zones on Stage
│ └────┘             └───────────────┘ │
│                                      │
│         ┌──────────────┐             │
│         │  Kuestions   │             │
│         └──────────────┘             │  ← .space-title (regular position)
│                                      │
│       Ask and answer, unlock.        │  ← .space-subtitle
│                                      │
│    ┌────────────────────────────┐    │
│    │                            │    │
│    │      Panel content         │    │
│    │                            │    │
│    │      ✦ stars fill Stage ✦  │    │
│    │                            │    │
│    └────────────────────────────┘    │
│                                      │
├──────────────────────────────────────┤
│   Me     Home     Hub     Nudges     │  ← .hub-switcher (bottom tab bar)
└──────────────────────────────────────┘
```

## Reserved slots — the contract

Every Stage-based korner uses these classes so the shape stays
consistent. Nothing else lives in the reserved slots; nothing new
should be added at the Stage level without asking whether it belongs
inside a slot.

| Slot              | Class             | Position                                       | Owned by                                         |
| ----------------- | ----------------- | ---------------------------------------------- | ------------------------------------------------ |
| Exit affordance   | `.korner-exit`    | top-left, floating, `position: absolute`       | `<KornerExit>` (shared component)                |
| Sub-nav           | `.space-tabs`     | top-right, floating, `position: absolute`      | per korner (Kuestions ships `<SpaceTabs>`)       |
| Space title       | `.space-title`    | regular position, centred, top of content flow | per panel                                        |
| Space description | `.space-subtitle` | regular position, centred, under title         | per panel                                        |
| Backdrop          | (per-space)       | absolute, `inset: 0` inside the shell          | per korner (Kuestions ships `<StarsBackground>`) |
| Content           | (per-panel)       | regular flow, under the title/description      | per panel                                        |

## Rules

1. **Frame layer is untouchable per-space.** The wordmark, membrane,
   sidebar, fade bands, and Ӂ menu are the same on every page. If a
   korner needs a new persistent affordance, propose it as a Frame
   change, not a per-space add-on.
2. **Stage fills to the frame edges.** No max-width, no side gutters
   inside the Stage — reading columns live _inside_ the space's
   content (`.kuestions-panels` caps at 560px, other spaces choose
   their own).
3. **Floating slots don't push content.** `.korner-exit` and
   `.space-tabs` are `position: absolute` so panel content flows
   underneath them. The shell reserves `padding-top: 3.75rem` so the
   title/subtitle clear the floats without being covered.
4. **`.space-title` and `.space-subtitle` are the only "hero" copy.**
   Panels don't re-invent a wordmark; they use the standard classes.
   The two lines can change per panel (Deck's subtitle differs from
   Today's) but the position and typography are fixed.
5. **Never render a KornerSubBar breadcrumb on a Stage route.**
   The exit affordance replaces `← Hub`; the space's own title
   replaces the pill's glyph+name; the settings gear lives on the
   sub-bar for `<Column>` routes but on Stage routes it will land in
   its own reserved slot when needed.

## Related files

- `app/javascript/mastodon/components/stage.tsx` — the Stage component.
- `app/javascript/mastodon/components/korner_exit.tsx` — the shared
  exit affordance.
- `app/javascript/styles/mastodon/_kronk_stage.scss` — Stage geometry
  - the reusable `.korner-exit`, `.space-tabs`, `.space-title`,
    `.space-subtitle` styles.
- `docs/kronk_kuestions_prototype.html` — visual reference for the
  first korner on Stage.
