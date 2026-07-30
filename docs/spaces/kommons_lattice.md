# Kommons Lattice

The Kommons map (`/hub/kommons/lattice`) — an operable, orthogonal dendrogram,
branded the **Directory** in the UI. It is _the_ map: the old radial Skeleton
view has been retired, and `/hub/kommons/skeleton` now 301-redirects to
`/hub/kommons/lattice`. There is no longer a two-view toggle; the Frame's
Proposals ⇄ Directory picker switches between the proposals list and this map,
not between two rival maps.

Implemented against the spec below (from the Kommons Rebuild proposal filed
through Kommons itself). Shipped: the tidy-tree layout with its invariants, one
branch open per level with recursive prune, the sprout choreography (wires draw,
rows stagger, existing rows reflow), the leaf panel with _Plant feedback here_
wired to the composer, zoom (scale-not-camera, fit, anchored ctrl+wheel,
detail-shedding), drag-to-pan, scroll-into-view on open, and the reduced-motion
pass. **The composer/picker also shipped** (previously deferred): the Directory
has a `pick` mode (`Lattice pick` prop) that scopes selection to a target node,
`features/governance/propose_page.tsx` + `propose_picker.tsx` provide the
Proposer, routed at `/hub/kommons/pick` and `/hub/kommons/propose`, and the
Directory carries a "+ Propose a new Korner" affordance
(`kommons_lattice/components/lattice.tsx`).

**Deferred follow-ups / tidy-up:**

- **Manifest names + icons consolidation** — the Directory still hardcodes some
  limb labels; its Hub icon and a couple of korners fall back until the manifest
  `name`/`icon` become the single source it reads.
- **Leaf panel** — the cross-branch _wired to_ list (§7).
- **Pan momentum** (§6c) and **keyboard navigation** (open question 4: ↑↓ within
  a column, → to open, ← to fold).
- General visual tidy-up once the feel settles on shadow.

Code: `app/javascript/mastodon/features/kommons_lattice/` (view) and the shared
data layer in `app/javascript/mastodon/features/kommons_tree/data/` (`nodes.ts`,
`layout.ts`). The `KRONK_KOMMONS_MOTION.md` referenced below (the retired
Skeleton's motion spec) was not part of this fold-in.

---

# Ӂommons — Lattice: Motion & Interaction Spec

Companion to `kronk_kommons_lattice.html` and its screenshots.
Sibling document to `KRONK_KOMMONS_MOTION.md` (the Skeleton view).

**Read this first.** Screenshots of the Lattice look like an org chart. They are not wrong, they are
just missing the entire design, which lives in _how branches arrive and leave_. A static render of
this view is a picture of a filing cabinet. The built version should feel like watching something
grow on command.

All values below are lifted verbatim from the prototype. Where a token exists, use the token.

---

## 0. The one idea

> **Structure is fixed and orthogonal. Branches sprout on demand and fold away when you leave them.**

Where the Skeleton is a body you travel through with a camera, the Lattice is a mechanism you
operate. Nothing is organic, nothing drifts, nothing is placed by feel. Every row sits on a grid
pitch, every parent is centred exactly on its children, and every connector is a right angle with a
fixed corner radius.

Two rules make it work, and both must be honoured or the view degrades into a normal tree widget:

1. **Only one branch is open per level.** Opening a sibling folds the current one, with its whole
   subtree. The lattice can therefore never sprawl — it is always a single readable path plus its
   immediate options.
2. **Growth is drawn, not revealed.** New connectors animate themselves into existence and the rows
   arrive at the end of them. You never fade in a finished branch.

---

## 1. Layout — tidy lateral dendrogram

Recomputed on every open/fold. Cheap; do not try to cache it.

### Constants

|                  | value   |
| ---------------- | ------- |
| row height       | 40      |
| row gap          | 16      |
| **row pitch**    | **56**  |
| column width     | 214     |
| column gap       | 76      |
| **column pitch** | **290** |
| plane padding    | 40 × 40 |

### Algorithm

Classic tidy-tree over the _visible_ subtree, where a node's visible children are
`open.has(id) ? node.kids : []`:

```
y = 0
walk(id, depth):
    kids = visibleChildren(id)
    if kids is empty:
        POS[id] = { x: depth * COLPITCH, y: y, depth }
        y += PITCH
        return POS[id].y
    ys = kids.map(k => walk(k, depth + 1))
    POS[id] = { x: depth * COLPITCH, y: (ys[0] + ys[last]) / 2, depth }
    return POS[id].y
```

Leaves stack sequentially; a parent takes the **midpoint of its first and last child**. This is what
produces the characteristic look — Kronk centred on its three limbs, Hub centred on its fourteen
korners.

**Invariants to test.** Both hold in the prototype at every expansion state:

- no two rows in the same column are within `ROWH` of each other (zero collisions)
- every parent's `y` equals the midpoint of its visible children's `y` range

Reference figures: at boot, 4 rows (1 + 3). Hub open → 18 rows, Hub centred at y 476 with korners
spanning 112–840. Hub + Booth open → 24 rows across 4 columns.

---

## 2. Connectors (wires)

SVG `<path>`, **stroked, not filled** — the opposite of the Skeleton's tapered bones. Uniform width;
no taper anywhere.

### Geometry — orthogonal elbow

From parent right edge to child left edge, turning at the horizontal midpoint of the column gap:

```
x1 = parent.x + COLW,  y1 = parent.y + ROWH/2
x2 = child.x,          y2 = child.y  + ROWH/2
mx = x1 + COLGAP * 0.5
r  = min(11, |y2 - y1| / 2, COLGAP * 0.4)
s  = y2 > y1 ? 1 : -1

M x1,y1  L mx-r,y1  Q mx,y1 mx,y1+s·r
         L mx,y2-s·r  Q mx,y2 mx+r,y2  L x2,y2
```

If `|y2 - y1| < 1`, emit a straight horizontal line instead — the quadratics degenerate otherwise.
The `r` clamp matters: without it, closely-stacked siblings produce corners that overshoot and read
as wobble.

`stroke-linecap: round`, `stroke-linejoin: round`.

### States

| state                     | stroke                    | width |
| ------------------------- | ------------------------- | ----- |
| default                   | `text-muted @ 34%`        | 1.5   |
| `on` (on the active path) | **`kronk-purple-bright`** | 2     |

Colour transitions at `--dur-medium` `--ease-out`.

---

## 3. Sprouting — the signature choreography

This is the thing the screenshots cannot show. When a branch opens:

**Step 1 — the wire draws itself.** For each _newly appearing_ child, measure the path with
`getTotalLength()`, set `stroke-dasharray` and `stroke-dashoffset` to that length, then on the next
animation frame add the `.draw` class and set `stroke-dashoffset: 0`.

```
transition: stroke-dashoffset 340ms var(--ease-out)
```

The line grows outward from the parent toward where the child will be.

**Step 2 — rows arrive at the end of the wires.** New rows start at `opacity: 0` and fade in with a
per-index stagger:

```
transition-delay: min(i * 26, 340) ms
transition: opacity 260ms var(--ease-out)
```

The delay cap at 340ms keeps a 14-child fan (Hub) from taking a full second to populate. Clear the
inline `transition-delay` after 600ms so it doesn't poison later reflows.

**Only genuinely new nodes animate.** Track the previous frame's id set; nodes that already existed
must _reflow_, not re-enter (see §4). Getting this wrong makes the whole lattice flicker on every
click, which is the most likely bug in a rebuild.

**Folding** is plain: rows fade to `opacity: 0` and are removed after 260ms. No reverse-draw on the
wires — retraction should be quick and unceremonious, in contrast to the deliberate growth.

---

## 4. Reflow

Opening a branch pushes everything below it down. Existing rows **must glide**, never jump:

```
transition: transform 380ms var(--ease-out)
```

Position is applied as `transform: translate(x + PAD.x, y + PAD.y)` — never `left`/`top`, which
won't composite smoothly.

The relationship between the three timings is deliberate:
**reflow (380ms) ≈ wire draw (340ms) > row fade (260ms)**. Existing structure settles into its new
shape at roughly the same rate as the new branch draws, so the whole thing reads as one motion
rather than three.

---

## 5. Scrolling and zoom — still no camera

The Lattice explicitly does **not** have a camera. The plane is a normal scrolling container and
sizes itself to content (`maxX + PAD.x*2` by `maxY + PAD.y*2 + 40`).

After any open/fold/select, ease the container to bring the new column into view:

```
targetX = POS[id].x + PAD.x - 60
wantX   = (isOpen || isSelected) ? targetX + COLPITCH * 0.35 : targetX
scrollTo({
  left: max(0, wantX - clientWidth * 0.35),
  top:  max(0, POS[id].y + PAD.y - clientHeight / 2),
  behavior: "smooth"
})
```

The `COLPITCH * 0.35` nudge biases the viewport toward the _newly grown_ column rather than centring
the node you clicked — you want to see what appeared, not what you pressed. **Multiply all scroll
targets by the current zoom** (see below); forgetting this is why scroll-to lands in the wrong place
when zoomed.

### Zoom

Zoom here is a **scale on the plane**, not a camera. The distinction is load-bearing: layout is
untouched, scrolling remains ordinary scrolling, and the user is only choosing how much lattice fits
on screen. It is Figma's zoom, not the Skeleton's camera.

```
#plane { transform: scale(Z); transform-origin: 0 0; }
```

**The scrollbars must stay honest.** A CSS transform does not change an element's layout box, so the
plane's `width`/`height` are set to `CONTENT × Z` while its children stay in unscaled coordinates.
Get this wrong and you can zoom out but not scroll to what you revealed.

- range `0.38 – 1.6`, default `1`
- **Anchored zoom.** Wheel-zoom must keep the point under the cursor fixed. Convert cursor position
  to world space at the old scale, apply the new scale, then correct scroll:
  `wx = (scrollLeft + ax) / Z_old` → `scrollLeft = wx * Z_new - ax`. Without this, zooming feels
  like the content is fleeing the pointer.
- **Transition only for discrete steps.** Buttons/keys get `transform 220ms var(--ease-out)`
  (class added, removed after 260ms); wheel zoom gets **no transition** so it tracks the gesture 1:1.
  Same principle as drag-panning in the Skeleton.
- **Plain scroll stays plain scroll.** Only zoom on `ctrl`/`⌘ + wheel`; a bare wheel must scroll the
  lattice. On trackpads, pinch arrives as ctrl+wheel, so pinch works for free.
- Controls: `−` / percentage / `+` / fit, bottom-right. The percentage is a button that resets to
  100%. Keys: `+` `-` `0` `f`.
- **Fit** solves `min((vw - 24) / CONTENT.w, (vh - 24) / CONTENT.h)`, clamped, then scrolls to origin.

### Drag to pan

Dragging the canvas is an alternative to the scrollbars, not a camera — it sets `scrollLeft` /
`scrollTop` directly and nothing else moves.

- **Left button on empty canvas only**, or **middle button anywhere**. Pressing on a row, the panel,
  or the zoom controls must not start a pan, or the lattice becomes impossible to operate.
- **4px threshold.** Below it, the gesture is still a click. Above it, add a `dragging` class which
  sets `cursor: grabbing`, disables text selection, and sets `pointer-events: none` on rows so the
  pointer can't snag mid-drag.
- **Suppress the trailing click.** A drag that happens to end over a row would otherwise fire that
  row's click handler and expand a branch the user never chose. Capture-phase `click` listener,
  `stopPropagation` + `preventDefault` when a drag just completed.
- **Momentum.** Track pointer velocity; on release, carry `v * 16` px and decay by `0.92` per frame,
  stopping below `0.4px`. Cancel any in-flight glide on the next `pointerdown`. Skip momentum
  entirely under `prefers-reduced-motion`.
- Cursor is `grab` at rest, `grabbing` while dragging.
- Cancel on `pointercancel` and `pointerleave` as well as `pointerup`, or a drag that leaves the
  window will stick.

### Detail shedding

Below `Z = 0.62` the plane gains a `tiny` class that fades row **labels** out and dims counts and
chevrons, leaving icons centred in their rows. Zoomed out, the lattice should read as _shape_ — the
silhouette of which branches are open and how deep they run — not as unreadable four-pixel type.
This is the Lattice's equivalent of the Skeleton's distance-based presence model.

---

## 6. Rows

Fixed 214 × 40, `--radius-medium`. Contents left to right: icon (22px, `kronk-purple-bright`), name
(`--font-display`, `--font-size-sm`, ellipsised), open-proposal count pill if non-zero, and a
chevron if the node has children.

| state                 | treatment                                                                           |
| --------------------- | ----------------------------------------------------------------------------------- |
| default               | `surface-elevated @ 62%`, `border-subtle`                                           |
| hover                 | `surface-elevated @ 92%`, `border-strong`, icon `scale(1.1)`                        |
| `open`                | `surface-elevated @ 96%`, `border-strong`, **chevron rotates 90°** (`--dur-medium`) |
| `sel` (leaf selected) | `purple-bright @ 16%` fill, `purple-bright` border + 1px ring                       |
| `core` (Ӂ)            | `purple-bright @ 22%` fill, `purple-bright @ 46%` border, centred content           |

The rotating chevron is the affordance that tells you a row is a branch rather than a destination.
Keep it.

---

## 7. The leaf panel

Selecting a node **with a URL** (a real page, not a branch) opens a panel in the next column,
attached by its own lit wire — so content sits in the lattice rather than in a modal or a side rail.

- 360px wide, `--radius-large`, `max-height: 520px`, scrolls internally
- positioned at `x = POS[sel].x + COLPITCH`, `y = max(PAD.y, POS[sel].y - 90)` — offset upward so a
  tall panel doesn't hang off the bottom from a low row
- enters by fading in; **follows the leaf's row when the lattice reflows** (same 380ms transform)

Contents: title, URL chip, lifecycle badge, description, an Open / Agreeing / Blocked stat row, a
_Plant feedback here_ button, proposals sorted by agreement, and a _Wired to_ list of cross-branch
connections. Clicking a connection re-opens the lattice along that node's path and selects it.

---

## 8. Interactions

| action                              | result                                                              |
| ----------------------------------- | ------------------------------------------------------------------- |
| drag empty canvas                   | pans the viewport, with momentum on release                         |
| click row **with children**, closed | opens it; siblings at that level fold; wires draw; rows stagger in  |
| click row **with children**, open   | folds it and its entire subtree                                     |
| click row **with a URL**            | selects it; panel opens in the next column                          |
| click selected leaf again           | deselects; panel closes                                             |
| click a **Wired to** entry          | opens the lattice along that node's path, selects it, scrolls to it |
| click **Ӂ**                         | the core row; folds everything back to the three limbs              |

Folding must **prune recursively** — closing Hub has to remove Booth and Booth's pages from the open
set, and clear the selection if the selected leaf lived inside. Leaving orphans in the open set
causes branches to reappear unexpectedly later.

---

## 9. Deliberately absent

- **No camera.** Zoom (§5) is a scale on a scrolling plane — layout never changes and there is no
  auto-framing. If you find yourself computing a transform _to frame a node_, you are rebuilding the
  Skeleton. That view already exists.
- **No auto-framing.** Drag, scroll and zoom are all user-driven. The view must never decide on its
  own where to look — the one exception is the gentle scroll-into-view after an open/fold (§5), which
  follows an explicit user action.
- **No curves.** Every connector is horizontal, vertical, or a fixed-radius corner.
- **No multi-branch expansion.** Tempting, and it destroys the tidiness that is this view's entire
  reason to exist.
- **No jitter, no randomness, no organic anything.** This view's virtue is that it is predictable.
- **No reverse-draw on fold.** Growth is ceremonial; retraction is not.

---

## 10. Relationship to the Skeleton view

The two views are **the same data, the same tokens, and the same node ids** — deliberately. They
differ only in spatial model and motion language:

|                  | Skeleton                           | Lattice                                     |
| ---------------- | ---------------------------------- | ------------------------------------------- |
| space            | radial, organic, laid out once     | orthogonal grid, recomputed per state       |
| movement         | camera pans and zooms, auto-framed | content reflows; user drags, scrolls, zooms |
| connectors       | tapered filled bones, curved       | uniform strokes, right angles               |
| everything else  | always present, dimmed by distance | folded away unless open                     |
| signature timing | 720ms camera glide                 | 340ms wire draw                             |
| feels like       | being inside something             | operating something                         |

**Build them against one shared source of truth** — the same route-table/manifest-derived tree, the
same node ids, the same proposal store. A user should be able to switch views mid-task and land on
the same node. If the two views ever disagree about what exists, the bug is upstream of both.

Recommendation: ship both and let it be a preference. They serve genuinely different moods —
Skeleton for exploring and getting a feel for the shape of Kronk, Lattice for finding a specific
page quickly and filing something against it.

---

## 11. Open questions for the real build

1. **Hub's column height.** 14 korners produce an 840px column that requires vertical scrolling at
   that level. Zoom mitigates this (fit drops to ~0.53× on a fully expanded lattice, which shows
   everything at once), but does not solve it at 100%. Options if it still grates: group korners into
   sub-limbs, paginate, or accept the scroll.
2. **Composer.** The panel's _Plant feedback here_ button is currently inert — the composer was left
   out of this prototype to keep it focused on the view model. Wire it to the same composer the
   Skeleton view uses; do not build a second one.
3. **Deep-linking.** Open/selected state should be URL-addressable
   (`/hub/kommons/skeleton?at=<node_id>`) so a proposal can link to its place in the map, and so
   switching views preserves position.
4. **Keyboard.** Not implemented. The lattice is the more natural of the two views for arrow-key
   navigation (↑↓ within a column, → to open, ← to fold) and should probably get it first.
5. **Shared route rename.** Both views currently live under `/hub/kommons/skeleton`. If they ship
   together, decide the URL structure before either goes in.

---

## 12. Build order

1. Layout function + the two invariants as tests (no collisions, parents centred). Verify against
   the reference figures in §1.
2. Static render — rows and elbow wires, no animation, no interaction. Will already resemble the
   screenshots.
3. Open/fold state with recursive pruning, and single-branch-per-level enforcement.
4. Reflow transitions (§4). The view becomes usable here.
5. Sprout choreography (§3) — wire draw, then staggered row entry, with correct new-vs-existing
   detection.
6. Leaf panel, cross-branch jumps, scroll easing.
   6b. Zoom: plane scale, honest scroll box, anchored wheel zoom, fit, and the `tiny` detail-shedding
   threshold. Verify scroll-to still lands correctly at 0.5× and 1.5×.
   6c. Drag-to-pan with threshold, trailing-click suppression, and momentum. Test that dragging _from_
   a row does nothing and that a drag ending _on_ a row does not expand it.
7. Reduced-motion pass: all durations to 0.01ms; the state model must still be correct with every
   animation removed.

Step 5 is the design. Steps 1–4 produce a competent tree view that nobody will remember.
