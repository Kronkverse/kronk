# The Korner Standard

> **Status:** v1 (2026-07-16, two open decisions resolved — see foot). The normative definition of what makes a korner **slide in smoothly** to Kronk's infrastructure. Derived from the 2026-07-16 recreation audit (the dimensions where real korners broke) + the aesthetic standard (`docs/kronk_aesthetic_system.md` §6). Companion docs: `docs/kronk_korner_spec.md` (manifest field reference) and `docs/korners/adding_a_korner.md` (the build walkthrough — follows this standard).
>
> **How to read it:** §1 is the lifecycle gate — _what's required when_. §2 is the ten layers — _the checklist_. §3 is the conformance matrix — _what `korners doctor` enforces automatically vs. what a human signs off_. A korner is done when it passes every layer required for its lifecycle stage.
>
> **`⚙︎` = machine-checkable** (target for the extended `korners doctor`, see §3). **`◇` = human sign-off.** **`▲` = a v0 open decision for review.**

## 0. Why this exists

`korners doctor` and stylelint gave false confidence: the audit found `enforced: true` korners (Wachuneed [then `marketplace`], In Flow) that passed every automated check yet had no serializer, no card, and a dead `/hub/<slug>` mount. The guardrails validated _slugs and associations_ but not _whether the korner actually works end to end_. This standard names every layer a korner must satisfy, so "it passes" means "it slides in" — and §3 makes the automatable layers into doctor checks so the gap can't reopen.

## 1. The lifecycle gate — what's required when

A korner's `lifecycle` (in its node) and its manifest `enforced` flag are **promises about completeness**. Requirements scale with the stage; the golden rule is that you don't make a bigger promise than the korner keeps.

| Stage                  | Manifest `enforced` | In Hub grid?         | Projects to feed? | Required layers (from §2)                                                              |
| ---------------------- | ------------------- | -------------------- | ----------------- | -------------------------------------------------------------------------------------- |
| **soon** (stub)        | `false`             | shown as "soon" tile | no                | L1 identity · L5 mount (via `KornerStub`) · L6 node (`lifecycle: soon`) · L7 aesthetic |
| **building** (partial) | `false`             | no                   | no                | + L2 data (models/tables/migrations/schema)                                            |
| **live** (complete)    | `true`              | yes                  | yes               | **all ten layers L1–L10**                                                              |

> **⚠ The golden rule.** `enforced: true` says: _this korner mounts, projects, serialises, and renders — right now._ Do not set it until every layer in §2 passes. Wachuneed and Nudges were `enforced: true` while their `/hub/<slug>` was a dead link — that's the exact failure this rule prevents. A korner under construction stays `enforced: false` (and its node `lifecycle: soon|building`), which keeps it out of the Hub grid and the feed until it's real.

## 2. The ten layers

### L1 — Identity & manifest

- ⚙︎ Manifest exists at `config/korners/<slug>.yaml`.
- ⚙︎ **Slug** is one lowercase word (no hyphens/underscores), **equals the filename**, is **not** in `reserved_slugs.yaml`, and is unique across korners. _(Audit: `in-flow` has a hyphen and ≠ its filename `in_flow.yaml`.)_
- ⚙︎ `name` and `icon` present; **`icon` is wired in `hooks/useKornerIcon.tsx`** and the mapping matches the manifest's `icon:` field. _(Audit: huddle/nudges icons are cross-wired vs their manifests.)_
- ⚙︎ **No colour field** — no `--space-color`, no per-korner hex/hue. Differentiation is icon + name + content only.
- ⚙︎ **Canonical manifest shape.** Every manifest carries identity + `resources` + `storage` + a nested **`security:`** block (permissions / visibility / federation / maintainers) + `feed_projection` (if it projects) + `settings` (if it has options) + `nodes`. The nested `security:` shape (matching groups/huddle) is canonical; `steward_role` is renamed `maintainers`. All enforced korners are migrated (booth, kalendar, kommons, kuestions, wachuneed, nudges, inflow, klot — #391, #390-follow); stubs gain a `security:` block when they graduate to `enforced`. The doctor warns on a legacy root-level manifest (it reads the raw file for a top-level `security:` key, since `extract_security` otherwise synthesises a block and hides the difference).

**Accepted exceptions** (deliberate, not drift — do not "fix" these):

- **Nudges** is a `core:` space, not a Hub korner: it declares its own `mount:` (`/nudges`), has no Hub tile, and cannot be tuned out of. It carries a manifest only because a manifest is how anything is declared. L5 checks it against its own mount, not `/hub/nudges`.
- **Groups** opts out of feed projection by design (`render_target: web`, no `status_association`); its L3/L4 gates are N/A rather than failures.
- **Klot** keeps a bespoke `klot_phase_viewer` visibility scope enforced by an ownership check + the `KlotShare` allowlist (not the shared authorization layer, which is unbuilt — §7). Sanctioned until §7 lands, at which point it migrates onto it.

### L2 — Data

- ⚙︎ Every resource declared in `resources:` has a real model (`app/models/<x>.rb`), a table, and a migration.
- ⚙︎ `db_namespace` matches the real table prefix(es).
- ⚙︎ The tables are present in `db/schema.rb` (so `db:schema:load` builds a working DB). _(Audit P0: schema.rb was 8 weeks stale — fixed in #336.)_
- ⚙︎ If the korner projects to the feed, `Status has_one :<x>` (or the appropriate association) exists.

### L3 — API & serialization

- ⚙︎ CRUD controllers exist for the korner's resources (`app/controllers/api/v1/<korner>/…`) with routes in `config/routes/api.rb`.
- ⚙︎ **Serializer exposure** — `REST::StatusSerializer` exposes the projection attribute, **and** the `REST::<Korner>SummarySerializer` the card needs actually exists. _(Audit: Wachuneed `enforced` but no controllers, no serializer attr, summary serializer only referenced in a comment — the single biggest doctor blind spot.)_

### L4 — Feed projection

- ⚙︎ `feed_projection.card` names a component.
- ⚙︎ That **card component exists** (`components/status_<korner>_card` or via the shared `StatusKornerCard` frame).
- ⚙︎ The card is **registered** in the card registry (`components/korner_cards.tsx` → `KORNER_CARDS`).
- ⚙︎ The serializer (L3) **populates the field** the card reads — projection is only real when all three (declare → serialise → render) line up.
- ⚙︎ **Built or planned.** The doctor checks L3/L4 for **every** korner that declares a card — enforced or not — so a stub can't promise a phantom card. A card that isn't built yet must be declared `feed_projection.planned: true`, which the doctor tracks as a **warning** rather than a hard failure. Any card declared _without_ `planned` **must** be built (registered + serialised) or the boot validator fails. _(Currently planned: huddle, albutts, moments. Retired/removed → `card: null`: kuestions, inflow.)_

### L5 — Mount & routing

- ⚙︎ **`/hub/<slug>` resolves** in `features/ui/index.jsx` — either the real feature, or a `KornerStub` for `soon`.
- ⚙︎ **`enforced: true` ⇒ the mount resolves.** No enforced korner may show a Hub tile whose link 404s. _(Audit: Wachuneed + Nudges `enforced` with dead `/hub/<slug>`.)_
- ◇ If the korner graduated from a legacy route (e.g. `/nudges`), that route redirects/aliases to `/hub/<slug>`.

### L6 — Skeleton & nodes

- ⚙︎ `nodes:` block: valid `bucket` (`feed|profile|hub|nudges`), `parent` is a registered slug, `lifecycle` set.
- ⚙︎ Each node's `route_name` resolves to a Rails named route **or** `spa: true`. _(Audit: `feed.nudges` failed this — fixed in #335.)_
- ⚙︎ No node-id collisions (across korners + `kronk_nodes.yaml`); all link targets (`settings_for`, `listens`, `projects_to`, …) resolve.

### L7 — Aesthetic & tokens

_(This layer is `docs/kronk_aesthetic_system.md` §6, restated as korner requirements.)_

- ⚙︎ Every colour / radius / elevation / motion value is a **token** — no raw hex, no legacy pre-token vars (`--background-color`, `--color-border`, `--surface-border`, `--surface-hover`). _(Audit: booth/kommons/kuestions/tree card SCSS + the shared frame drift here.)_
- ⚙︎ The korner's SCSS (incl. its feed-card partial) is in the **stylelint governance list**. _(Audit: card partials are ungoverned + `color-no-hex` is only a warning — item 7 closes this.)_
- ◇ Uses `var(--accent)` + semantic tokens (never a raw palette token) → automatically respects the **Personal Appearance** per-user layer (accent/theme/font/scale). Both themes work with no branching. Header uses `@include kronk-cover-glow()`; radius language applied by role.

### L8 — Settings (§K)

- ⚙︎ **Every korner has a settings page at `/hub/<slug>/settings`**, regardless of whether the manifest carries a `settings:` block. Empty settings still get a page — the page is the surface a user reaches from the Settings Hub, from the Kronk menu's contextual "Settings" item, and from any per-korner gear affordance. A missing mount here is a dead link from the hub grid.
- ⚙︎ Manifest `settings:` block declares the user-facing options the framework will render for free. Every entry needs `name` + `kind` + `default`. Choice kinds (`enum`, `multi_enum`) add `options`; range kinds (`integer`, `number`, `duration`) add `min` / `max`.
- ⚙︎ If the korner exposes options in the manifest, it also declares a `settings.<slug>` node in the tree with `settings_for: <slug>` — the doctor's L6 checks pin the two together.
- ◇ **Schema-driven is the default, not the ceiling.** Simple korners render fine through the shared widgets (`SettingRow` / `NamedSettingRow` dispatch on `kind`). Korners with meaningful live state (Klot's current phase + share list; Kommons' token balance; Krew's memberships) may compose a bespoke page that renders their manifest settings alongside the state — this is the recommended shape once the korner's settings surface stops being trivial. Bespoke pages MUST still adhere to L12 (Frame chrome).

### L9 — Tests & docs

- ◇ A korner spec covering the model + the projection path — **SHOULD** (recommended, not gating). Rises to MUST once a cheap korner-test harness exists.
- ◇ Manifest is self-documenting; no phantom references. _(Audit: `nudges.yaml` cites a non-existent spec; `adding_a_korner.md` holds up non-existent Klot models — item 9 rewrites it against this standard.)_

### L10 — Notifications

_(Appended after L9 to avoid renumbering existing references. Layer order is not priority order — notifications are build-time work, not an afterthought.)_

A korner that generates activity a user would want to know about declares it, and the framework delivers it. The failure this closes: Kommons declares five notification types in its manifest and **none of them exist** — no type registration, no worker, no service. The manifest described a subsystem nobody built, and nothing caught it.

- ⚙︎ Every entry in the manifest's `notifications.types` has a matching registered type. A declared type with no registration is the notification equivalent of a dead `/hub/<slug>` mount.
- ⚙︎ Each declared type names a real `subject_type` resolving to a model the korner owns.
- ⚙︎ Types are registered as **native** (non-legacy) entries in `Notification::PROPERTIES`. Kronk-native types already exist there (`nudge`); korner types join them rather than extending the 15 legacy Mastodon types, which are on a retirement path.
- ◇ Every state transition a user is waiting on fires a notification. If a korner asks someone to act — confirm, respond, close — the ask is delivered, not left to be discovered on a return visit.
- ◇ `default_push` is honest: on for things a user is being asked to act on, off for things that merely happened. Noisy defaults train people to switch the korner off.

**On Nudges.** Notifications are becoming Nudges, and Nudges is not built. That does not block this layer. A korner declares its types in the manifest and the framework delivers them through `Notification` today; when Nudges lands it inherits the same declarations. The manifest contract is the stable surface — build against it, not against the current delivery mechanism.

### L11 — Frame chrome (don't reimplement)

_(Appended after L10 for the same reason. Frame adherence is build-time work, not a review-time catch: the failure this closes is Klot pre-alpha.225 — a korner rendered its own hero + tab row while the Frame was also rendering them, producing a doubled surface visible to any user who opened the space. The check itself is a `korners doctor` warning until every shipped korner is clean, then it promotes to an issue.)_

The Kronk Frame provides three chrome slots for every `/hub/<slug>` route via shared `Auto*` components. Reimplementing any of them creates a doubled surface. **Read [`docs/kronk_frame.md`](../kronk_frame.md)** for the layout spec; this layer restates it as korner-side requirements.

- ⚙︎ **No local hero title.** The `<AutoSpaceBadge>` renders the space name into the SpaceNav slot. A korner index MUST NOT render its own `<h1>`. _(Audit: Klot pre-alpha.225 shipped `<h1 className='klot__title'>Klot</h1>` above a Frame that was already rendering the badge.)_
- ⚙︎ **No local view/tab row when the manifest declares `views:`.** The `<AutoSpaceViewPicker>` renders a pill/dropdown from the manifest's `views:` list and drives the URL (`/hub/<slug>` → default; `/hub/<slug>/<key>` → `key`). A korner with `views:` MUST NOT render `role="tablist"` or a bespoke tab class of its own — pick the current view from the URL (`useLocation`) and match the segment against `views:`. _(Audit: Klot pre-alpha.225 rendered a `__tab-row` above the Frame's picker.)_
- ⚙︎ **No local hero title in the content.** The `<AutoSpaceHeader>` renders `<h1>{name}</h1>` above the tagline at the top of the Stage's scrollable region on the space landing (and on any declared-view sub-path). The header is the in-content title — a korner MUST NOT render its own `<h1>` in the content either.
- ⚙︎ **No local tagline paragraph.** `<AutoSpaceHeader>` also renders the manifest's `tagline` under the title. A korner MUST NOT hardcode the same copy in its index. Keep the tagline in the manifest; the Frame renders it.
- ◇ Landing-view copy that _isn't_ the tagline (a lede paragraph, a getting-started card, a signup teaser) is fine — it's the korner's content, not chrome. The rule is against duplicating what the Frame renders, not against writing prose.

**What a Frame-adherent korner looks like.** See `docs/korners/template/` for the canonical shape. Every korner sits inside a `<KornerShell>` which owns the Stage + URL-to-view routing:

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

No `<h1>`, no `<nav>` tab row, no repeated tagline copy. Title / tagline / tabs come from the Frame, driven by `config/korners/mykorner.yaml`. The view keys MUST match the manifest's `views:` list (same keys, same order).

**One deliberate exception: `<KronkKosmos>` (the ambient background layer).** It fixes-position at inset:0 outside every Frame slot by design — the Mates orb cross-section has to span the whole viewport regardless of grid geometry. This is not a Frame parasite: nothing about it competes with a Frame slot; the layer sits at z-0 with `pointer-events: none` and a self-contained vignette so chrome always wins over it. The doctor already ignores it because L11 only inspects `/hub/<slug>` mounts (`detect_frame_parasites` early-returns for core spaces, and `KronkKosmos` isn't a korner mount at all). See `docs/kronk_frame.md` § Kosmos.

### L12 — Settings adhere to the same Frame chrome

_(Added after the alpha.251/.253 settings audit. The failure this closes: settings pages shipped as classic Mastodon `<Column>` surfaces — bespoke back buttons, big square column headers, no shared title typography — while every korner around them moved to the Frame. The result was that entering settings felt like leaving Kronk, and reaching one settings page from another required going all the way back out through the Kronk menu.)_

Settings pages are second-class korners: they carry no manifest and no `views:`, but they otherwise obey the same Frame contract as `/hub/<slug>` surfaces.

- ⚙︎ **Settings pages render inside `<Stage>`**, not `<Column>`. This applies to every personal-settings leaf under `/settings/*` and every per-korner settings page at `/hub/<slug>/settings`, including bespoke redesigns.
- ⚙︎ **The SettingsBadge takes the SpaceNav slot** (`<AutoSettingsBadge>` fires on `/settings/<leaf>` and `/hub/<slug>/settings`). Reads `← All settings`, links to `/settings`. A settings page MUST NOT render its own back pill — the badge above already does it, and doubling up muddies the "one back-target" contract.
- ⚙︎ **In-content header uses the shared `.space-header` classes**, not a bespoke `__hero`. Structurally: `<header className='space-header' data-frame-header=''><h1 className='space-header__title'>...</h1><p className='space-header__tagline'>...</p></header>`. This matches the display-typography korners use and keeps the whole family visually coherent.
- ⚙︎ **Every korner reaches its settings page from the Settings Hub.** `/settings` lists every non-core enforced korner as a card; the router mounts `/hub/<slug>/settings` before any specific korner route so the settings page isn't swallowed by the korner's default view. (Route ordering was the silent regression that made "Klot has no settings" look real — see alpha.254.)
- ◇ **Save-status indicators** (for autosave leaves) live in a sibling row below the header, not nested inside it. Keeps the header slot a single job (title + tagline) rather than a mixed-concerns bar.

**What a settings page looks like** — the pattern shared by every personal leaf + the framework's default `KornerSettings`:

```tsx
export const MySettings: React.FC = () => {
  const intl = useIntl();
  return (
    <Stage label={intl.formatMessage(messages.title)}>
      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
      </Helmet>
      <div className='scrollable mysettings'>
        <header className='space-header' data-frame-header=''>
          <h1 className='space-header__title'>
            {intl.formatMessage(messages.title)}
          </h1>
          <p className='space-header__tagline'>
            {intl.formatMessage(messages.intro)}
          </p>
        </header>
        {/* fields / bespoke content */}
      </div>
    </Stage>
  );
};
```

The Frame provides the `← All settings` pill via `<AutoSettingsBadge>` in the SpaceNav slot — no import, no per-page wiring. Bespoke settings pages (Klot's cycle overview, Kommons' token dashboard, …) may render any content inside the scrollable div, but the wrapper + header pattern above is fixed.

## 3. Conformance matrix — the automated gate

Everything marked ⚙︎ above is **machine-checkable**, and the extended `korners doctor` (item 7) **has shipped** — `lib/mastodon/cli/korners.rb#detect_conformance_issues` now gates L1, L5, L7 and L10 (with L3/L4 feed-card conformance in `#detect_feed_card_issues`, run for every korner and honouring `feed_projection.planned`), alongside the L6 node checks (`detect_node_issues` + orphan-listens) and the L2 drift check. The L3/L4/L5 gaps that once sailed through are now enforced. What each check catches:

| Check                                                                                                                                   | Layer | Catches                                                             |
| --------------------------------------------------------------------------------------------------------------------------------------- | ----- | ------------------------------------------------------------------- |
| slug is a word · == filename · unique                                                                                                   | L1    | `in-flow`                                                           |
| icon wired in `useKornerIcon`, matches manifest                                                                                         | L1    | huddle/nudges cross-wiring                                          |
| `db_namespace` prefix has matching tables · `Status` association exists                                                                 | L2    | namespace/association drift                                         |
| serializer exposes projection attr                                                                                                      | L3    | Wachuneed/In Flow non-functional projection                         |
| card component exists **and** is registered                                                                                             | L4    | groups/in_flow phantom cards                                        |
| `/hub/<slug>` resolves; **enforced ⇒ mount resolves**                                                                                   | L5    | Wachuneed/Nudges dead tiles                                         |
| node bucket/parent/lifecycle valid; route_name resolves or spa; no id collision; links resolve                                          | L6    | `feed.nudges` route                                                 |
| card partial is stylelint-governed (no raw hex)                                                                                         | L7    | ungoverned card drift                                               |
| every declared `notifications.types` entry is a registered type; `subject_type` resolves                                                | L10   | Kommons' five declared, zero built                                  |
| Frame parasites — `<h1>`, `role='tablist'` when manifest has `views:`, inlined tagline copy in the mounted feature file                 | L11   | Klot pre-alpha.225 doubled hero + tab row (**warning**, not gating) |
| Settings page reaches Frame chrome — `/hub/<slug>/settings` mounted, renders `<Stage>` + `.space-header`, SettingsBadge covers back-nav | L12   | route-ordering swallowed `/hub/klot/settings` (fixed alpha.254)     |

**L2 caveat — the gate is narrower than the layer.** `detect_drift` only checks that some table matches the manifest's `db_namespace` prefix and that any declared `Status` association exists. It does **not** verify a real model + table + `schema.rb` entry _per resource_ (the full L2 definition in §2). So a korner can declare three resources, ship one namespaced table, and pass L2. The per-resource model/table/schema checks remain human sign-off until the drift check is deepened.

`◇` items stay human sign-off (aesthetic judgment, tests). Canonical manifest-shape conformance (nested `security:`) is `⚙︎` per L1.

## 4. Definition of done — "slides in smoothly"

A korner **slides in** when, for its lifecycle stage:

1. `korners doctor` is green (all ⚙︎ for that stage), **and**
2. a human has signed off the `◇` items for that stage, **and**
3. its `enforced` flag and node `lifecycle` honestly reflect what works (§1 golden rule).

For a **live/enforced** korner specifically: you can create its records via API, they project into the feed as a token-clean card, its `/hub/<slug>` and `/hub/<slug>/settings` render, its nodes resolve in the Skeleton, and it looks identical-in-family to every other korner (icon/name aside) in both themes and under any Personal Appearance choice.

## 5. Proving the standard — Wachuneed

Wachuneed (then called Marketplace; slug renamed 2026-07-21) is the v0 test case (item 8): billed as the greenfield "reference korner," `enforced: true`, yet failing L3 (no controllers/serializer), L4 (card never populated), and L5 (dead mount). Bringing it to this standard — and watching the extended doctor light up every gap, then go green — is how we validate both the standard and the checker against a real rebuild. What Wachuneed _teaches_ during that rebuild feeds back into this doc (v1).

---

_v1 decisions (2026-07-16, Tal): **(L1)** the nested `security:` block is the canonical manifest shape — the ~9 root-level manifests migrate to it. **(L9)** a korner spec is **SHOULD**, not gating. The standard is now normative for the recreation work._
