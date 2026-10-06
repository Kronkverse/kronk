# The Korner Standard

What a korner must do to fit into Kronk. This is normative: a korner that
doesn't meet the layers its stage requires is not done. The build steps are in
[`adding_a_korner.md`](adding_a_korner.md); the manifest field reference is its
[Framework spec (v0.5)](adding_a_korner.md#framework-spec-v05) section.

- **§1** says what each lifecycle stage requires.
- **§2** is the layers, L1 to L12: the checklist.
- **§3** says which checks `bin/tootctl korners doctor` runs, and what a human
  must sign off.

**`⚙︎`** = the doctor checks it. **`◇`** = a human checks it.

## 0. Why this exists

The first guardrails checked slugs and associations, not whether a korner
worked. In July 2026 an audit found korners marked `enforced: true` (Wachuneed,
In Flow) that passed every check yet had no serializer, no card and a dead
`/hub/<slug>`. This standard names every layer a korner must meet, so "it
passes" means "it works", and §3 turns the checkable layers into doctor checks
so the gap can't reopen.

## 1. The lifecycle gate

A korner's manifest `enforced` flag and its index node's `lifecycle` are
promises. Don't promise more than the korner does.

| Stage                  | `enforced` | Hub                 | Feed | Required layers                                                                   |
| ---------------------- | ---------- | ------------------- | ---- | --------------------------------------------------------------------------------- |
| **soon** (stub)        | `false`    | "Coming soon" tile  | no   | L1 identity, L5 mount (a stub is fine), L6 node (`lifecycle: soon`), L7 aesthetic |
| **building** (partial) | `false`    | "Coming soon" tile  | no   | + L2 data                                                                         |
| **live** (complete)    | `true`     | live tile + sidebar | yes  | **every layer**                                                                   |

> **The golden rule.** `enforced: true` means this korner mounts, serialises,
> projects and renders, now. Don't set it until every layer passes. A korner
> under construction stays `enforced: false` with its node at `soon`, which
> keeps it off the sidebar and shows it as "Coming soon" on the Hub.

**Core spaces** (`core: true`: feed, hub, nudges, profile, settings, welcome)
are platform surfaces with manifests, not korners. They declare their own
`mount:`, have no Hub tile, can't be tuned out of, and the korner layers below
don't apply to them (the doctor skips them, apart from a header check). A
**portal** korner (`portal: { url: … }`, YOU) is a live landing page for an
external app; it owns nothing the layers gate, so it stays `enforced: false`
and the Hub still shows it as live.

## 2. The layers

### L1 — Identity and manifest

- ⚙︎ The manifest is at `config/korners/<slug>.yaml`.
- ⚙︎ The **slug** is one lowercase word (`a-z0-9`, no hyphens or underscores),
  equals the filename, isn't in `reserved_slugs.yaml`, and is unique.
- ⚙︎ A **space doc** exists at `docs/spaces/<slug>.md` once `enforced: true`.
  Checked twice: by the doctor, and by `bin/lint-korner-docs` in the required
  `lint` job, which is what actually blocks a merge. Stubs are exempt.
- ⚙︎ `icon.material` is present and is a key in `MATERIAL_TO_ICON` in
  `hooks/useKornerIcon.tsx`. (The rspec suite checks the same thing in
  `spec/lib/kronk/korner_registry_icons_spec.rb`.)
- ⚙︎ The manifest has a nested **`security:`** block. The doctor fails the
  old root-level shape (`permissions:` and friends at the top level).
- ◇ `name` is present. The manifest carries identity, `resources`, `storage`,
  `security`, `feed_projection` (if it projects), `settings` (if it has any)
  and `nodes`.
- ◇ **No colour field.** No per-korner hex, hue or `--space-color`. Korners
  differ by icon, name and content.

**Accepted exception** (deliberate, don't "fix" it): **Klot**'s
`klot_phase_viewer` scope is enforced by an ownership check plus the
`PhaseShare` allowlist, not a shared policy layer, because none exists. It
moves onto one if one is built.

### L2 — Data

- ⚙︎ If `storage.db_namespace` is set, some table equals its plural or starts
  with it.
- ⚙︎ If `feed_projection.status_association` is set, `Status` has that
  association.
- ◇ Every resource in `resources:` has a real model, table and migration, and
  the tables are in `db/schema.rb` so `db:schema:load` builds a working
  database. The doctor's check above is narrower than this: one matching
  table passes it.

### L3 — API and serialisation

- ◇ API controllers exist for the korner's resources under
  `app/controllers/api/v1/<slug>/`, with routes in `config/routes/api.rb`.
- ⚙︎ If the korner projects, `REST::StatusSerializer` exposes its
  `status_association`, through a summary serializer the card can read.

### L4 — Feed projection

- ⚙︎ A declared `feed_projection.card` has an entry with the korner's `slug:`
  in `components/korner_cards.tsx` (`KORNER_CARDS`), and its card component
  renders inside the shared `StatusKornerCard` frame.
- ⚙︎ **Built or planned.** This is checked for every korner that declares a
  card, enforced or not, so a stub can't promise a phantom card. A card not
  built yet is declared `feed_projection.planned: true`, which the doctor
  reports as a warning. Today only Huddle's card is planned. A korner that
  doesn't project declares no card.
- ◇ The card is token-clean and follows the card contract in
  [`docs/design.md`](../design.md) (Card standard).

### L5 — Mount and routing

- ⚙︎ `features/ui/index.jsx` mounts `/hub/<slug>` (the korner's own `mount:`
  for a core space). Checked for enforced korners: a live Hub tile must not 404.
- ⚙︎ `config/routes.rb` has a matching `get '/hub/<slug>'` (and
  `/hub/<slug>/*path`) to `home#index`, so a direct load boots the SPA.
  Checked for every non-core, non-portal korner, as a warning.
- ◇ A `soon` korner may mount the shared `KornerStub` placeholder
  (`features/korner_stub/`).
- ◇ If the korner moved from an older URL, the old path 301s to the new one in
  `config/routes.rb`.

### L6 — Nodes

- ◇ A `nodes:` block with at least the korner's index node. Each node has an
  `id`, a `bucket` from `Kronk::NodeRegistry::BUCKETS`
  (`feed profile hub nudges settings kronk search`) and a `lifecycle` from
  `live soon deprecated hidden`. Korner nodes default to `bucket: hub`,
  `parent: <slug>`. A node with a bad bucket or lifecycle is dropped from the
  registry with a log warning, so it never reaches the doctor: the log is the
  only place it shows.
- ⚙︎ A `hub` node's `parent` is a registered korner.
- ⚙︎ A node's `route_name` is a Rails named route, unless the node is
  `spa: true`.
- ⚙︎ A `live` node's `url` matches a Rails route or a React route. (A `soon`
  node is allowed to have none.)
- ⚙︎ A `live` node under `/kronk/…` has its `content/kronk/<page>.md`.
- ⚙︎ Every `links:` target (`settings_for`, `projects_to`, `listens_to`, …)
  is a registered node.
- ◇ Node ids are unique. The registry keeps the first and silently drops any
  duplicate; nothing reports it.
- ◇ **A node for every page someone can navigate to.** The Kommons Directory
  builds itself from this registry, and it's where people propose changes to a
  part of Kronk, so a page with no node can't be proposed about. Routes with
  `:id` are templates and stay off the tree.

### L7 — Aesthetic and tokens

The korner-side restatement of [`docs/design.md`](../design.md) (Aesthetic
system).

- ⚙︎ Every korner SCSS file that exists (`_<slug>.scss`,
  `_status_<slug>_card.scss`) is in the token-enforcing `files:` list in
  `stylelint.config.js`. Checked for enforced korners.
- ◇ Every colour, radius, elevation and duration is a token. On the governed
  list stylelint flags raw hex and pixel `border-radius` as **warnings**: they
  annotate the PR but don't fail `lint`, so reviewers have to read them.
  Legacy pre-token variables (`--background-color`, `--color-border`,
  `--surface-border`, `--surface-hover`) aren't checked at all.
- ◇ Uses `var(--accent)` and the semantic tokens, never a raw palette token,
  so it follows each person's Personal Appearance settings and works in both
  themes without branching. Feature headers use `@include kronk-cover-glow()`.
  Radius by role.

### L8 — Settings

- ◇ **`/hub/<slug>/settings` renders.** The generic route mounts
  `KornerSettings` for every korner, with the tune-in toggle, a push toggle
  per declared notification type, and the manifest's `settings:`. A korner
  only breaks this by mounting a route that swallows the path, so a bespoke
  settings page goes above the generic route in `ui/index.jsx`.
- ◇ Each `settings:` entry has `name`, `kind` and `default`. Kinds:
  `boolean`, `integer`, `number`, `string`, `enum`, `multi_enum`, `duration`.
  `enum` and `multi_enum` add `options`; `integer`, `number` and `duration` add
  `min`/`max`.
- ◇ **Shared widgets by default, bespoke when there is state.** Simple korners
  use the framework page. A korner with live state to show next to its
  settings (Klot's phase and share list, Kommons' tokens) may build its own
  page, which must still follow L12.

### L9 — Tests and docs

- ◇ A spec covering the model and the projection path. **Should**, not must.
- ◇ The manifest and space doc describe what exists. No references to specs,
  files or models that aren't there.

### L10 — Notifications

A korner that does something a person would want to know about declares it,
and something delivers it. The failure this closes: Kommons once declared five
notification types that nothing could deliver.

- ⚙︎ Every entry in `notifications.types` says how it's delivered, and that
  route exists:
  - **`delivery: notification`** (the default): a registered `Notification`
    type. If it names a `subject_type`, that resolves to a model.
  - **`delivery: nudge`** with **`event: <name>`**: carried on the Nudges bus
    (`Kronk::KornerEvents` → the `listens:` block in `nudges.yaml` →
    `Nudges::EventRouter`). The event must be both published somewhere and
    consumed, or the doctor fails it. **New korner activity should use this
    route.**
  - **`planned: true`**: declared but not delivered yet. A warning, so the
    korner's settings page can already show the push toggle.
- ◇ Every state change a person is waiting on fires a notification. If a
  korner asks someone to act, the ask is delivered, not left to be found.
- ◇ `default_push` is honest: on for things a person must act on, off for
  things that merely happened.

> **The `notifications.types` block is not legacy.** Mastodon's
> `Notification` store is legacy-only for Kronk
> (`docs/spaces/nudges.md`, Nudges spec), but this block also drives the
> per-korner push toggles (`Api::V1::KornersController`) and the aggregation
> windows in `Nudges::Aggregator.window_for`, matched by `name`. Removing an
> entry removes a person's push toggle and, where declared, its aggregation
> window. `albutts.album_new_photo` is a live example.

### L11 — Frame chrome (don't reimplement)

The Frame draws three pieces of chrome for every `/hub/<slug>` route, from the
manifest. A korner that draws them again produces a doubled surface (Klot did,
until alpha.225). Read [`docs/design.md`](../design.md) (Frame).

- ⚙︎ **No `<h1>`** in the file mounted at `/hub/<slug>`.
  `<AutoSpaceBadge>` shows the name as the back pill, and `<AutoSpaceHeader>`
  renders the one `<h1>` above the tagline.
- ⚙︎ **No tab row** (`role="tablist"` or `role="tab"`) when the manifest
  declares `views:`. `<AutoSpaceViewPicker>` renders it from `views:` and
  drives the URL (`/hub/<slug>` is the first view, `/hub/<slug>/<key>` the
  rest). Pick the view from the URL, never from `useState`.
- ⚙︎ **No tagline literal.** Keep the tagline in the manifest; the Frame
  renders it.
- ◇ Other landing copy (a lede, a getting-started card) is fine: it's
  content, not chrome.
- ◇ **Rotating title, opt-in.** `header.rotator: true` makes `<AutoSpaceHeader>`
  render a `<ScopeTitle>` that cycles through `views:`, each view optionally
  carrying its own `tagline`. The rotator is the title, so the korner still
  renders no `<h1>`, chevrons or rotator of its own. Example:
  `config/korners/kronikles.yaml`.
- ◇ Title and tagline sit at the standard height.

The doctor checks only the file the route mounts (resolved through
`ui/index.jsx` and `async-components.js`), and only warns. For core spaces it
instead warns when a landing page hand-rolls `.space-header__title` without
using `<SpaceHeader>`.

**The canonical shape** is in [`template/`](template/):

```tsx
export const MyKorner: React.FC = () => (
  <KornerShell
    slug='mykorner'
    label='MyKorner'
    className='mykorner'
    defaultView='default'
    views={{
      default: () => <DefaultView />,
      other: () => <OtherView />,
    }}
  />
);
```

The `views` keys match the manifest's `views:`, same keys, same order.

**One deliberate exception: `<KronkKosmos>`** (`features/kosmos/`), the
ambient background, is fixed at `inset: 0` behind every Frame slot with
`pointer-events: none`. It competes with no slot, isn't a korner mount, and
the check never sees it. See [`docs/design.md`](../design.md) (Frame, Kosmos).

### L12 — Settings pages use the same Frame

Settings pages (every `/settings/*` leaf and every `/hub/<slug>/settings`)
follow the Frame contract too, so going into settings doesn't feel like
leaving Kronk.

- ◇ They render inside `<Stage>`, not Mastodon's `<Column>`.
- ◇ `<AutoSettingsBadge>` fills the back-pill slot with "← All settings",
  linking to `/settings`. A settings page doesn't render its own back pill.
- ◇ The in-page header uses the shared classes:

  ```tsx
  <header className='space-header' data-frame-header=''>
    <h1 className='space-header__title'>…</h1>
    <p className='space-header__tagline'>…</p>
  </header>
  ```

- ◇ Every korner is reachable from `/hub/settings` (`features/settings_korners/`),
  which lists them all and links to each `/hub/<slug>/settings`. It reads the
  registry, so there is nothing to add.
- ◇ An autosave status line sits in its own row below the header, not inside
  it.

## 3. What the doctor checks

`bin/tootctl korners doctor` (`lib/mastodon/cli/korners.rb`) loads every
manifest and prints **issues** (exit 1) and **warnings** (exit 0), then a
coverage note listing what it can't check.

| Check                                                                                                | Layer | Applies to                    | Level   |
| ---------------------------------------------------------------------------------------------------- | ----- | ----------------------------- | ------- |
| Slug is one word, matches its file                                                                   | L1    | every non-core korner         | issue   |
| Slug isn't reserved                                                                                  | L1    | every non-core korner         | issue   |
| Slug isn't duplicated                                                                                | L1    | every manifest                | issue   |
| `docs/spaces/<slug>.md` exists                                                                       | L1    | enforced                      | issue   |
| Nested `security:` block                                                                             | L1    | enforced                      | issue   |
| `icon.material` is a `MATERIAL_TO_ICON` key                                                          | L1    | enforced                      | issue   |
| A table matches `db_namespace`; `Status` has the declared association                                | L2    | enforced                      | issue   |
| `StatusSerializer` exposes `status_association`                                                      | L3    | every korner declaring a card | issue   |
| Card registered in `korner_cards.tsx`                                                                | L4    | every korner declaring a card | issue   |
| Card declared `planned: true`                                                                        | L4    | every korner declaring a card | warning |
| `/hub/<slug>` mounted in `ui/index.jsx`                                                              | L5    | enforced                      | issue   |
| `/hub/<slug>` mounted in `config/routes.rb`                                                          | L5    | non-core, non-portal          | warning |
| Hub-node parent, `route_name`, live `url`, org page, `links:` targets                                | L6    | every node                    | issue   |
| Korner SCSS is on the stylelint list                                                                 | L7    | enforced                      | issue   |
| Notification types deliverable (registered type, or bus event published and consumed)                | L10   | enforced                      | issue   |
| Notification declared `planned: true`                                                                | L10   | every non-core korner         | warning |
| `<h1>`, tab row or tagline literal in the mounted file                                               | L11   | every non-core korner         | warning |
| Core space hand-rolls its header                                                                     | L11   | core spaces                   | warning |
| A `*composer*.tsx` doesn't use `<ComposeShell>`, or uses `createPortal`, `openModal`, `<ComposeFab>` | —     | every feature file            | warning |
| `listens:` names an event no manifest `emits:`                                                       | —     | every manifest                | issue   |
| `attaches:` entry the target doesn't `accepts:`                                                      | —     | every manifest                | issue   |

The doctor can't check L8, L9, L12, title placement, the per-resource half of
L2, or whether a korner uses the shared primitives rather than hand-rolling
them. Those are the `◇` items, and a reviewer signs them off.

**Where it runs.** `.github/workflows/korners-doctor.yml` runs it on every
PR and on pushes to `main` and `shadow`, and writes the output to the job
summary. It is **not** a required check (`continue-on-error: true`), so a
red doctor doesn't block a merge. Read it on your PR. When the doctor reports
platform-wide issues, look for the lines naming your slug. Separately, the
boot-time registry check logs a narrower set of warnings (reserved or
duplicate slug, missing table, missing `Status` association) and never stops
the app.

What does block a merge: `bin/lint-korner-docs` (the space doc, in `lint`),
and stylelint errors (not its warnings).

## 4. Definition of done

A korner is done, for its stage, when:

1. the doctor reports nothing for it at that stage, **and**
2. a human has signed off the `◇` items for that stage, **and**
3. its `enforced` flag and node `lifecycle` say honestly what works (§1).

For a live korner that means: you can create its records through the API;
they project into the feed as a token-clean card; `/hub/<slug>` and
`/hub/<slug>/settings` render, including on a direct load; its nodes resolve
on the Directory; and it looks like the rest of the family (icon and name
aside) in both themes and under any Personal Appearance setting.

## Open

- **Make the doctor gate.** It is advisory. The last measurement in the
  workflow header (2026-09-17) was no issues and eleven warnings, all
  `planned` notifications, Huddle's planned card and two composers outside
  `<ComposeShell>` (`kommons_tree`, `nudges_messenger`). Decide whether
  `planned: true` should warn at all, then make the job required.
- **Promote the warnings.** The L11 Frame checks and the composer check were
  meant to become issues once every korner was clean.
- **Stylelint severity.** Raw hex and pixel radii are warnings on the governed
  list. Making them errors would make L7's token rule real.
- **Duplicate node ids** are dropped silently. The doctor should report them.
- **L8 used to require a `settings.<slug>` node** with `settings_for:` for any
  korner with settings. No korner declares one and nothing checks it. Enforce
  it or drop it.
- **A korner test harness.** L9's spec rises to a must once a cheap one
  exists.
- **A shared authorisation layer**, which would retire Klot's exception
  (see [`adding_a_korner.md`](adding_a_korner.md#7-security-and-access-control)).

## History

Rewritten 2026-10-05 to describe the doctor and the layers as they are. The
standard was first set on 2026-07-16 (two decisions by Tal: the nested
`security:` block is canonical, and a korner spec is a should). Wachuneed was
its proving case, brought from failing L3, L4 and L5 to green. Earlier
versions, with the audit notes, the dated doctor counts and the L1 icon-check
history: `git show 231cca937:docs/korners/korner_standard.md`.
