# Profile

**Node bucket:** `profile` (Kronk::NodeRegistry) · **Cross-cutting** — not owned by a single korner manifest.

## Purpose

Profile is the surface for **a person on Kronk** — their public
identity, their sections (per-korner projections + curated
kategories + timeline), and, for the owner, the edit + connections
management flows.

In Kronk 2.0 the profile is _sectioned_ — content is organised by
korner projection + kategory pillar rather than a flat status stream.
The owner picks section order via the `profile_section_order`
column.

## Nodes in the Skeleton

Declared in `config/kronk_nodes.yaml` under the `profile` bucket:

- **`profile.view`** — public profile view (`/@:acct`).
- **`profile.edit`** — profile editor (owner only). Editing is Arrange mode
  on the shelved profile; the `/@:acct/edit` URL redirects to `/@:acct/shelves`
  (the standalone composer was retired).
- **`profile.sections`** — sectioned-profile / shelved-profile surface.
- **`profile.media`** — media gallery (`/@:acct/media`).
- **`profile.mates`** — the mutual-follow list at `/@:acct/mates`, and the only
  relationship surface. Replaced `profile.connections` on 2026-09-04.

## Anthemos direction

Self-shaped data (name, bio, avatar, verification, credentials) is
Anthemos-hosted once the membrane ships — projected through the
membrane on demand. Kronk stores the DID + routing pointer, not the
underlying identity data. See
`docs/rebuild/implementation_plan.md` and the profile prototype at
`docs/prototypes/kronk-profile-redesign.html` (already shows
"✓ Anthemos" chips).

## The profile creator (decided 2026-08-16)

The owner builds their profile in **Arrange mode** from two kinds of building
block. There is **no freeform "told card" authoring** — the old
About/Interests/Values-as-a-textbox cards are **retired** in favour of
structured fields.

1. **Fields** — structured facts chosen from a **pop-up grid** (reusing the
   composer modal shell). Each option is a checkbox; ticking it adds the field.
   Every field has a **structured answer** (not a freeform blob) — e.g.
   _Pronouns_ → `she / her`. The grid ends with a **`+`** to create a custom
   field (own label + answer). Selected fields render under **Profile fields**
   as a grid. This replaces the told-card options in the section selector.
2. **Korner connections** — projections of what you've shared in korners
   (albums, treks, short films, …). These are the existing "drawn" sections and
   become the other building block once fields absorb the told cards.

### Answer types

Each field declares one answer shape so the pop-up + grid know how to render it:

| Type       | Renders as                       | Example                     |
| ---------- | -------------------------------- | --------------------------- |
| `text`     | single line                      | Location → `Sydney`         |
| `pair`     | two slots joined by `/`          | Pronouns → `she / her`      |
| `chips`    | tag list                         | Interests → `cars, welding` |
| `longtext` | a short paragraph                | About me → `…`              |
| `link`     | a URL (earns ✓ if it links back) | Website → `talitamoss.info` |

### Starter catalog (~30, PROPOSED — edit this list freely)

Basics: **Pronouns** (pair) · **Location** (text) · **Languages** (chips) ·
**Birthday / age** (text) · **Star sign** (text) · **Height** (text)

Character: **About me** (longtext) · **Values** (chips) · **Personality**
(text) · **What drives me** (longtext) · **Fun fact** (text) · **Currently
exploring** (longtext)

Tastes: **Interests** (chips) · **In rotation** — music/media (chips) ·
**Favourite…** (text) · **Recent highlights** (longtext)

Doing: **Work / role** (text) · **Skills** (chips) · **Status** — what I'm up
to (text) · **Open to** (chips) · **Availability** (text)

Links: **Website** (link) · **Collected work** (link) · **Other profile**
(link) · **Pod credentials** — Anthemos (link)

Place / logistics: **Timezone** (text) · **Where I've been** (chips) ·
**Home base** (text)

_(~29 above; the `+` custom option makes it open-ended.)_

### Storage (to confirm during build)

Backed by the existing **`profile_cards`** model (the told-card model,
reframed): each field is a card whose `card_type` is the field key and whose
answer lives in a structured `body`/`settings`. Custom fields carry a
user-defined key + label. This is deliberately **not** Mastodon's 4-item
`fields_attributes` metadata (capped at 4) — that stays as-is for federation,
separate from this richer surface.

### Build order

1. Field catalog + answer types (backend `profile_cards` reshape / seed).
2. The pop-up grid (checkbox select + `+` custom) — composer modal shell.
3. The **Profile fields** grid render (view + arrange), with per-type answer
   inputs.
4. Retire the told-card options from the section selector; keep drawn/korner
   options as **Korner connections**.
5. Read-side render of fields on the public profile.

## Status

Sectioned profile shipping incrementally. Identity editing + a simple section
selector (toggle/reorder) shipped in the profile-creator thread (2026-08-15/16).
The structured-fields reframe above is the next chunk — catalog first.

## Mates replaces followers/following — the navigation plan (2026-09-03)

> **Status: decided 2026-09-04; Stages 1, 2 and 5 shipped.** Written after a 2026-09-03 audit of the
> `/@:acct/*` routes found sub-pages that are reachable only by URL, two
> routes nothing links to at all, and two different destinations both called
> "Mates". Tal's direction in the same session: rather than `followers` and
> `following`, "maybe just `mates`". Everything below is scoped so each stage
> ships on its own.

### What the audit found

The profile is currently two surfaces wearing different chrome:

- `/@:acct` renders the shelved profile (`features/profile_shelves`) with its
  own three-icon pillar strip — the person/article/globe row, which links to
  the shelved view, `/posts` and `/mates`.
- `/posts`, `/featured`, `/with_replies`, `/media`, `/nudges`, `/mates`
  render the **legacy Mastodon** account chrome (`account_header.tsx`) with a
  tab row: Sections · Posts · Featured · Posts and replies · Media · Mates.

The tab row exists only on the legacy pages. So the route into Featured is:
open a profile, tap an unlabelled middle icon, land on Posts, and only then
find a tab row that was not there a moment before. Nothing is broken — it is
undiscoverable, and the chrome changes underfoot when a person crosses
between the halves.

Concrete defects the audit turned up:

- **`/@:acct/following` has no inbound link anywhere in the client.**
- **`/@:acct/connections` likewise**, and it is the surface showing pending
  follow requests. Accounts are `locked: true` by default on Kronk, so
  requests are the normal path — but `/follow_requests` already covers that,
  leaving `connections` a duplicate that lost its entry. `config/kronk_nodes.yaml`
  still declares `profile.connections` as `lifecycle: live`.
- **"Mates" resolves to two different pages.** The `N Mates` counter in the
  legacy header links to `/followers` (an `account_header.tsx` comment admits
  this: "Links to the followers list (the mutual graph) for now"), while the
  globe pillar and the Mates tab link to `/mates` — a different component on
  different chrome. The followers list is also a dead end: it renders the
  header with `hideTabs`, so there is no way onward.
- **Three URLs render the shelved profile** — `/@:acct`, `/@:acct/shelves`
  and `/@:acct/profile`. The pillar links to `/shelves`, the Skeleton node
  `profile.sections` declares `/profile`, and the canonical URL a person
  actually arrives on is `/@:acct`. Because the pillar is an `exact` match on
  `/shelves`, **no pillar highlights on the canonical URL.**
- **Eight of the nine profile routes still render in the legacy `Column`.**
  Only `/mates` uses `Stage`. This is the same drift the Korner Standard's
  L12 closed for settings.

### The vocabulary this rests on

`mates = mutual follows` is already decided and load-bearing: it is a rung of
the reach ladder (`public` / `mates` / `orbit` / `self_only`) that gates post
visibility (`docs/rebuild/decisions.md`). The model backs it —
`Account#mates` is a chainable relation of accounts followed who follow back,
and `accounts.mates_count` is a denormalised mutual-follow counter maintained
by `Follow` callbacks.

So "just mates" is not a rename of followers. It is a decision to make the
**mutual** graph the only relationship Kronk shows a person, and to treat the
one-way edges as plumbing.

**What must not change.** `followers`/`following` stay as substrate in three
places, and retiring the _words_ must not touch them:

- the **ActivityPub collections** (`config/routes.rb` — the `followers` /
  `following` resources and `followers_synchronization`). Breaking these
  breaks federation, which the repo's code rules forbid outright;
- the **REST API** (`/api/v1/accounts/:id/followers` and `/following`) — the
  Android app and third-party clients call these;
- `hide_collections`, the per-account privacy flag governing whether the
  collections are exposed at all.

Only the human-facing SPA routes retire.

### DECIDED 2026-09-04 — a one-way connection has no surface

Asked where one-way connections should live once the followers and following
pages retire, Tal's answer was: **nowhere.** A Mate — a mutual follow — is the
only relationship Kronk shows, to anyone, the account's owner included. No
private list of "people who follow me but aren't Mates", and no count of them
either.

Pending follow requests are a different thing and keep their own page at
`/follow_requests`. With accounts locked by default, approving a request is how
a Mate bond begins, so that surface stays.

This simplifies Stage 2, which was written assuming an owner-only home for the
asymmetric edges. It doesn't need one — retiring `/connections` is the whole of
it.

**Shipped in this change (Stages 1 and 2):**

- The `N Mates` counter points at `/@:acct/mates`. It used to point at the
  followers list, which was the wrong set to begin with.
- `/@:acct/followers`, `/@:acct/following` and `/@:acct/connections` redirect to
  `/@:acct/mates`, as do the `/users/…` and `/accounts/…` spellings. Redirects
  rather than removals, because links to those paths exist in the wild.
- The `followers`, `following` and `connections` client views are deleted.
- `profile.connections` in the Skeleton becomes `profile.mates`.
- **Untouched:** the ActivityPub `followers`/`following` collections and the
  REST API. This retires the pages, not the graph — the underlying follow
  records are what Mates is computed from, and federation depends on them.
  `hide_collections` governs the Mates list the way it governed the followers
  list.

Stage 5 (the mates list itself) shipped on 2026-09-03. Stages 3 and 4 — folding
the sub-pages into the profile's own navigation, and moving the profile routes
onto `Stage` — are still open.

### Stage 1 — one destination called Mates

- Point the `N Mates` counter at `/@:acct/mates` instead of `/followers`.
- Redirect the SPA routes `/@:acct/followers` and `/@:acct/following` to
  `/@:acct/mates`, and delete `features/followers/` and `features/following/`
  once the redirect has settled.
- Leave the AP collections, the REST API and `hide_collections` alone.
- `hide_collections` should now govern the **mates** list the way it governed
  the followers list; confirm that read path.

**Verify first:** the audit screenshot shows a `5 Mates` counter above a
followers list of three. Mates are a subset of followers, so a mates count
larger than the follower count should be impossible — either the list lazy-
loads beyond what was visible, or `mates_count` has drifted (it is a
denormalised counter, so pre-counter follows and callback-skipping deletes
both drift it). Check before building on the number. Do not query member data
to do it — a count check on a test account is enough.

### Stage 2 — one home for the asymmetric edges

Locked-by-default means requests are normal, and approving a request does not
create a Mate — the approver must follow back. Those in-between states need
one owner-only home instead of two half-homes:

- Retire `/@:acct/connections` and redirect it to the existing
  `/follow_requests`.
- Update the Skeleton: `profile.connections` is declared `lifecycle: live`
  while nothing links to it. Either repoint it at the requests surface or mark
  it `deprecated`.
- Decide (open question) whether a person can still see _who follows them but
  is not a Mate_. Today that is the followers list; after Stage 1 it has no
  surface. Options: fold it into the requests inbox as a second bin, or drop
  it deliberately and say so here.

### Stage 3 — one profile chrome

Fold the legacy tab row into the profile's own pillar strip so every
sub-page is reachable from `/@:acct` itself, and the chrome stops changing
between halves:

- The pillar strip (`profile-shelves__pillars`) becomes the single navigation
  for the profile space: Profile · Posts · Media · Featured · Mates, plus
  Nudges when signed in and viewing someone else.
- Delete the `account__section-headline` tab row from `account_header.tsx`
  once the pillars carry it, so there is one row, not two.
- Fix the active state: the profile pillar must match `/@:acct` as well as
  `/@:acct/shelves`.
- Collapse the aliases — make `/@:acct` canonical, keep `/shelves` as a
  redirect, retire `/profile`, and repoint the `profile.sections` Skeleton
  node so code and Skeleton agree.
- Icon-only remains the direction (Tal 2026-08-04), but five to six unlabelled
  glyphs is a bigger ask than three. Worth revisiting labels here.

### Stage 4 — chrome parity

Move the profile routes from `Column` onto `Stage` + `<SpaceHeader slug='profile' />`,
matching what `/welcome` did on 2026-09-03 (PR #1674). The `profile` manifest
already exists and is `core: true`, so the header is a drop-in. One route per
PR; `account_timeline` is the risky one and should go last.

### Stage 5 — the mates list endpoint

`/@:acct/mates` currently renders the mates **timeline graph** off
`/api/v1/mates/timeline`. Once it is also the redirect target for
`/followers`, it needs a plain paginated list. `Account#mates` is already a
chainable relation, so the controller is thin — but note there is no such
endpoint today, and `/api/v1/accounts/:id/matuals` is a different thing
(mates-in-common, capped preview).

### Open questions for Tal

1. Does `/@:acct/mates` lead with the graph (as now) or a list, with the other
   behind a toggle?
2. After Stage 1, do one-way followers stay visible to the owner anywhere, or
   go away entirely?
3. On someone else's profile, should Mates lead with mates-in-common
   (`matuals`) rather than their full list?

## The profile board (REVISED 2026-09-05)

> **Status: proposal**, replacing the tile-board design written earlier the
> same day. Direction from Tal, after the first two steps of that design
> shipped: a profile is not one grid of mixed tiles. It is an identity block
> over a **stack of korner screens**, each screen swiped sideways through the
> work you chose to show from that korner.
>
> "If I select albums, the Booth and the Map, my profile shows my posts from
> these, but not in timeline order… under [the identity block] a screen-sized
> space filled with a card showing an album I've posted; swipe right and I
> scroll the other albums I've posted (I get to choose which albums appear
> here). Scroll further down and the next one is the same rendering but of the
> music I've posted… scroll further down and come across the recorded treks I
> want people to see."

### What this changes, and what it keeps

Keeps: **korner projection is the content model**. A profile shows what you
made in korners, drawn live from your posts, never copied — that is what
`profile_sections` (drawn shelves) already does, and it is right.

Keeps: **structured fields for the identity half.** The 29-field catalog, the
picker and the field grid stay as they are.

Changes: **korner content leaves the grid.** A shelf is not a tile competing
for column span with Pronouns. It gets a screen. The four-size vocabulary
(`s`/`m`/`l`/`xl`) narrows to field tiles, where a size genuinely varies; a
shelf is always full width, because a korner that is worth putting on your
profile is worth more than a quarter of a row.

Changes: **the arrangement is a sequence, not a plane.** There is no
two-dimensional placement to design, on a phone or anywhere. What an owner
arranges is three orderings (below), all of which are lists.

### The shape

Phone first — this is a phone design that a wide screen also has to serve, not
the other way round.

```
┌───────────────────────────┐
│  avatar · name · handle   │   Identity
│  bio · actions            │   + fields
│  ┌────┐ ┌────┐ ┌────────┐ │   ≈ the first screen
│  │Pron│ │Loc │ │About me│ │
│  └────┘ └────┘ └────────┘ │
├───────────────────────────┤ ← scroll
│ ALBUTTS            1 / 6  │
│ ┌───────────────────────┐ │   One korner shelf,
│ │                       │ │   ≈ 80% of the Stage,
│ │   album card          │▌│   swipe → for the next
│ │                       │ │   album you chose
│ └───────────────────────┘ │
├───────────────────────────┤ ← scroll
│ THE BOOTH          1 / 4  │
│ ┌───────────────────────┐ │
│ │   track card          │▌│
│ └───────────────────────┘ │
└───────────────────────────┘
```

Each shelf occupies about **80% of the Stage height** rather than all of it,
so the top of the next korner is always visible. A full-height band reads as
the end of the page; a band with the next one peeking under it reads as a
stack, and people keep scrolling.

### Two axes, two meanings

- **Vertical scroll moves between korners.** Free scroll, no snap. Snapping
  the vertical axis on a long profile fights the reader — a flick that would
  travel three korners gets caught by the first.
- **Horizontal swipe moves within one korner.** Scroll-snap per card, so a
  swipe always lands on a whole card and never half of two. The rail already
  does this; what changes is that a card now fills the band instead of sitting
  in a short strip. The next card peeks about 8% in, which is what tells a
  first-time viewer the shelf is swipeable at all — a counter (`1 / 6`) in the
  header says how far it goes.

One axis for "what kind of thing", one for "which one". That holds on every
shelf, so learning one shelf teaches all of them.

### The three orders an owner controls

All three already exist in the data; none of them are reachable in the UI
today, which is what the creator work is.

| What                                              | Where it lives                                                                  | UI today                   |
| ------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------- |
| **Which korners are on my profile**               | `profile_sections.visible`                                                      | Yes — the section selector |
| **What order the korners come in**                | `profile_sections.position`                                                     | Yes — move up / move down  |
| **Which posts show in one korner, in what order** | `settings.order = 'chosen'` + `settings.order_ids`, with `hides` for exclusions | **No — this is the gap**   |

The third one is the whole of "I get to choose which albums appear here". It
is a per-shelf picker: the owner's posts for that korner as a grid of cards,
each with a checkbox, drag or arrows to order the chosen ones. `PostPicker`
and `LibraryGrid` were written for this and then orphaned — `ArrangeStage`,
which mounted them, stopped being rendered in #1524 when the simple mobile
section selector replaced it. The size control added in #1727 went into that
same orphan and has never been on screen. So this is mostly a mounting and
trimming job, not a from-scratch build.

Default when an owner has never picked: `order: 'newest'`, everything shown.
Choosing turns the shelf to `chosen` and the picked ids become `order_ids`.

### What fills a card

Unchanged — the korner card components the rail already dispatches to
(`shelf_drawn.tsx`): album, track, trek, listing, answers, longform, photo,
excerpt fallback. What changes is the space they get. At band size a card can
lead with its art at a size worth looking at, which is the point of the
redesign; each card component needs a large presentation, not a scaled-up
small one.

A shelf with nothing in it is not rendered on the public view at all. The
owner sees it in Arrange with an empty state, because that is where knowing
"this is on but empty" matters.

### Wide screens

The vertical rhythm is the same. Two things relax:

- The band caps its height (about 640px) instead of tracking the viewport, so
  a tall desktop window does not produce one enormous album cover.
- The rail shows **2–3 cards per view** rather than one, still snapping per
  card. A single card floating in a 1400px band is a poster, not a profile.

The identity block keeps the existing field grid, which already goes to four
columns in a roomy Stage.

### Sizes, after this

`profile_cards.settings.size` stays and keeps its four values: a field grid is
where a size genuinely changes the page. `profile_sections.settings.size`
becomes inert — a shelf is always full-bleed. The validation stays on the
model (harmless, and it costs a migration to remove), but nothing reads it and
no control offers it.

### Storage

Still no new tables. Everything above is `position`, `visible`, and the
existing `settings` JSON on the two models.

### Build order

1. **The band read-side.** Shelves leave the tile grid and render as
   full-width bands with a filling card, the peek, and the counter. The
   identity block keeps the field grid. This is the step that makes the page
   look like the description above.
2. **Cards at band size.** Each korner card component gets a large
   presentation — art-led, legible from a metre away.
3. **The per-shelf picker.** Mount a picker from the section selector: choose
   which posts appear in this korner and their order. Salvage `PostPicker` +
   `LibraryGrid`; delete the rest of `ArrangeStage` rather than leave 700
   orphaned lines with live-looking controls in them.
4. **Wide-screen relaxation** — height cap, 2–3 cards per view.
5. **A pinned post band**, if it still seems wanted once the rest is real.

### Open questions

- **Does the identity block scroll away, or does the first korner start below
  a fixed identity?** Scrolling away is simpler and is assumed here.
- **Kategory shelves.** A shelf can be bound to a kategory tag rather than a
  korner (`settings.tag_name`). Same band treatment, or do those belong in the
  identity half? Untested with real content.
- **Empty-but-chosen.** If someone picks four albums and later deletes three,
  the band holds one card. Fall back to newest, or show what remains?
