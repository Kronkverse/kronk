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
