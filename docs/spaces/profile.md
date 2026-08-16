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
- **`profile.connections`** — followers/following (moving to _mates_
  vocabulary; see memory `reference_kronk_vocab_mates.md`).

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
