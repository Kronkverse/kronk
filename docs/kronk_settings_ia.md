# Kronk Settings — Information Architecture

> **⚠️ SUPERSEDED (2026-07-20) — see [`docs/spaces/settings.md`](./spaces/settings.md) + [`docs/rebuild/decisions.md`](./rebuild/decisions.md).**
> This doc's central thesis — "exactly three surfaces, no new bucket,
> account/app settings fold into Profile" — was **reversed**. Settings now
> owns a **dedicated `settings` bucket** (`Kronk::NodeRegistry::BUCKETS =
feed profile hub nudges settings kronk`, in `app/lib/kronk/node_registry.rb`)
> and a core-space manifest (`config/korners/settings.yaml`). Personal/account
> section pages sit **flat** at `/settings/{profile,sections,appearance,posting,privacy,notifications,account,data,you}`
> (`config/kronk_nodes.yaml`, routes in `features/ui/index.jsx`), **not** as
> sections of Profile, and **not** in the `profile` bucket. Notifications is a
> **live standalone** `/settings/notifications` page, not folded into Nudges.
> The historical rev below is kept for context only; do not build from it.

> **Status:** SUPERSEDED spec (rev. 2026-07-15). Originally defined the settings layout as three surfaces tied to the Kommons Directory node registry.

## 1. The organising principle

> **Superseded:** the "exactly three surfaces / no account surface / fold into
> Profile" model below did not ship. Settings is its own `settings` bucket and
> core space, with flat `/settings/*` section pages. See the banner at top and
> `docs/spaces/settings.md`. The three-surface framing here is historical.

Settings mirror **the shape of Kronk itself**, not a flat preferences dump. There are exactly **three surfaces — the three Kommons Directory buckets** — and every setting belongs to one:

| Surface     | Test                                                                  | Skeleton bucket |
| ----------- | --------------------------------------------------------------------- | --------------- |
| **Feed**    | _Incoming_ — what reaches you / what you consume                      | `feed`          |
| **Profile** | _Self-management_ — your identity, what you publish, and your account | `profile`       |
| **Hub**     | A _space_ — the korners and how you arrange them                      | `hub`           |

There is **no separate "You"/account surface** — the account/app settings (Account & Security, Appearance, Data) **fold into Profile** as sections, because Profile is the self-management side of your identity. This matches the convention the Skeleton already uses (its `settings.profile` / `.sections` / `.prefs` nodes all live in the `profile` bucket).

Settings nodes live **in the bucket of the space they configure** (`settings.feed` → `feed`, `settings.hub` → `hub`, the profile/account ones → `profile`). The settings nav is a **projection of `Kronk::NodeRegistry`** — it gathers nodes whose id starts with `settings.` (across buckets). Same anti-drift guarantee as the Skeleton: add a korner → its settings node appears; define what a surface owns → settings can't wander (which is how posting-defaults had drifted into Appearance).

**Privacy is not a page** — it scatters to where it acts: blocks/mutes/filters are _incoming_ → **Feed**; discoverability is _outgoing_ → **Profile**; 2FA/sessions are _account_ → **Profile** (account section).

## 2. The three surfaces — full inventory + build status

### ① Feed — _incoming_ (`feed` bucket · `settings.feed`)

What reaches you, and what you filter out.

- **Feed scope** — mates / orbit / kommunity (`kronk.feed_scope`, default `orbit`) · **built** · picker lives on `/home/settings`. An inline chip row was mounted on the Home column in alpha.330–.331 then retreated in alpha.332 — the setting is the sole surface for now.
- Timeline display — group boosts, slow-mode (pending items), media display, autoplay, blurhash, expand content warnings, show trends, deck/advanced layout · _(Mastodon feed prefs)_
- **Keyword filters** — what's hidden (`/filters`) · classic
- **Mutes · Blocks · Domain blocks** — silencing incoming · classic (`Mutes`/`Blocks`/`DomainBlocks` exist)
- **Who can reach you** — follow-request approval (`locked`), who can DM you (`interactions.must_be_following_dm`)
- _(Home: a `FeedSettings` feature already exists — this is its remit.)_

### ② Profile — _self-management_ (`profile` bucket · `settings.profile` / `.sections` / `.prefs`)

Your identity, what you publish, and your account — all the "about me and my app" settings, as **sections** of one surface.

- **Identity editor** — display name, bio, avatar, header, fields, **sections** — folded into Arrange mode on the shelved profile (`/@:acct/shelves`); the standalone `/@:acct/edit` composer was retired · **built**
- **Posting defaults** — visibility, language, sensitive-by-default, quote policy · **built as a standalone Posting section (Slice A); target: a section here**
- **Discoverability** — searchable, suggest-to-others, index by search engines · outgoing projection
- **Account & Security** — email, password, 2FA, sessions, login activity, authorized apps, aliases, migration, deactivate/delete · **classic monolith** (folds in)
- **Appearance** — theme, personal accent, fonts, UI scale, motion, emoji style · **built** (+ Personal Appearance) (folds in)
- **Data** — export archive/CSVs, import, auto-delete old posts · **classic monolith** (folds in)

### ③ Hub — _the spaces_ (`hub` bucket · `settings.hub`)

- **Korner tune-in / ordering** — which korners you follow, hub layout · **built** (tune-in)
- **Per-korner §K settings** — one page per korner at `/hub/<slug>/settings` · **built** (`KornerSettings`)
- **Nudges** owns **notifications** — see §3.

## 3. Notifications ≡ Nudges

> **Superseded / factually wrong now:** a **standalone `/settings/notifications`
> page is live** (`settings.notifications`, `bucket: settings`, `lifecycle: live`
> in `config/kronk_nodes.yaml`; `NotificationsSettings` route in
> `features/ui/index.jsx`). Folding notification prefs into Nudges is a possible
> future direction, but the section is not gone. The paragraph below is
> historical.

Notifications are **merging into Nudges** (the classic bell is already retired; Nudges is the activity surface). So there is **no standalone Notifications section** — notification preferences (which activity nudges you, email digests, push, `notification_emails.*`, `software_updates`) live with **Nudges** (a korner → its §K settings under Hub). Treat the existing `NotificationsSettings` as folding into Nudges.

## 4. Node model

> **Superseded:** there **is** a new bucket. `Kronk::NodeRegistry::BUCKETS`
> now includes `settings` (and `nudges`, `kronk`), and every personal/account
> `settings.*` node declares `bucket: settings` in `config/kronk_nodes.yaml`
> (only `settings.feed` / `settings.hub` stay in their space's bucket). The
> "no new bucket, everything folds into `profile`" model below is historical.

**No new bucket.** Settings nodes live in the `feed | profile | hub` bucket of the space they configure — the convention the Skeleton already established:

```yaml
# config/kronk_nodes.yaml
- id: settings.feed # bucket: feed
- id: settings.profile # bucket: profile  (Skeleton — kept; the self-management home)
- id: settings.sections # bucket: profile  (Skeleton — kept)
- id: settings.prefs # bucket: profile  (Skeleton — kept)
- id: settings.hub # bucket: hub
```

Account & Security, Appearance, Data, Posting are **sections within the Profile settings surface**, not separate top-level nodes. Per-korner settings stay `hub` nodes in the korner manifest, linked with the existing `settings_for` kind (`kommons.settings`, `nudges.settings`, …).

The nav renders from `NodeRegistry` via the existing **`api/v1/kommons/nodes`** endpoint, selecting nodes whose id starts with `settings.` — no hardcoded list, no second endpoint, no dedicated bucket. `bin/tootctl korners doctor` already fails on a node pointing at a dead route.

## 5. Current state → target (re-homing)

Sections were built before this IA, so several need re-homing:

| Built today                                          | Under this IA                                                                 |
| ---------------------------------------------------- | ----------------------------------------------------------------------------- |
| Appearance (theme/accent/fonts/scale/motion)         | → a **section of Profile**                                                    |
| **Posting** (Slice A, standalone)                    | → a **section of Profile**                                                    |
| **Privacy** (mutes/blocks + discoverability toggles) | → **split**: mutes/blocks/filters to **Feed**; discoverability to **Profile** |
| **Notifications**                                    | → fold into **Nudges** (§3)                                                   |
| Profile composer                                     | ✅ **Profile**                                                                |
| Per-korner §K                                        | ✅ **Hub**                                                                    |
| Feed settings (`FeedSettings`)                       | ✅ **Feed** — absorb filters/mutes/blocks/scope                               |

### Remaining work

1. **Register** `settings.feed` (feed) + `settings.hub` (hub) nodes; keep the Skeleton's profile settings nodes. _(Done — PR #311.)_
2. **Feed surface** — gather scope + timeline display + filters + mutes/blocks/domain-blocks + reach controls into the Feed settings page.
3. **Profile surface** — bring posting defaults, discoverability, and (rehomed) Account/Appearance/Data together as sections of the Profile settings home.
4. **Nudges** — absorb notification prefs.
5. **Account & Security + Data** — rehome out of the classic Mastodon monolith into the Profile surface (mark `lifecycle: soon` until built).
6. **Registry-driven nav** — replace the hardcoded `YOU_SECTIONS` list with a projection of `NodeRegistry` (nodes with a `settings.` id prefix + per-korner `settings_for`).

## 6. Lifecycle & projection

Sections carry `lifecycle` (`live | soon | deprecated | hidden`) so "coming soon" surfaces render from data. Settings is one _projection_ of the node map — the same map the Kommons Skeleton, and later nav/breadcrumbs/search, read from. Keep the node schema rendering-agnostic.

## 7. Coordination

Writes into the Skeleton's `NodeRegistry` / `kronk_nodes.yaml`. Per Tal (2026-07-14), **portal-me owns the whole build** (nodes + surfaces + nav); the `tal@mainframe` session stays off `node_registry.rb` / `kronk_nodes.yaml` to avoid collision. (This rev reconciles with the settings nodes the Skeleton had already added.)

---

_Related: `docs/kronk_korner_spec.md` (korner manifests + `nodes:`), the Kommons Skeleton, `docs/kronk_aesthetic_system.md`. Sections are schema-driven (`features/settings/setting_widgets.tsx`): a new section is a controller `FIELDS` map + a node, not a bespoke page._
