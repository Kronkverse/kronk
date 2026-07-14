# Kronk Settings — Information Architecture

> **Status:** proposed spec (2026-07-14). Defines the canonical settings layout and ties it to the Kommons Tree node registry so it stops being a hand-maintained list. Supersedes the ad-hoc section list in `features/settings/nav.tsx`.

## 1. The principle

Settings is **a projection of the node map, not a hand-typed list.** The Kommons Tree already models every page-type as a node in `Kronk::NodeRegistry` (`lib/kronk/node_registry.rb`, fed by `config/kronk_nodes.yaml` + each korner manifest's `nodes:` block). Settings pages are page-types too, so they should be **nodes in that same registry**, and the settings nav should **render from the registry**.

Why: the settings nav in `nav.tsx` is currently a hardcoded list that drifts from reality — which is how *posting* defaults (post visibility, posting language, sensitive-by-default) ended up mislodged under **Appearance**. Deriving from the registry gives the same anti-drift guarantee the Tree gives: add a korner → its settings node appears automatically; define what a section *owns* once → fields can't wander.

This is the settings half of the Tree vision's "nav / settings / chrome all derive from the same map."

## 2. Two axes

Settings has exactly two axes:

1. **"You"** — personal settings that cut across every space (theme, your posting defaults, your privacy, your account). A cluster of cross-cutting nodes.
2. **Per-space (§K)** — settings scoped to one korner, at `/hub/<slug>/settings`. One settings node per korner, declared in that korner's manifest.

Nothing else. Instance/admin settings remain Mastodon's `/admin` and are out of scope here.

## 3. Node model

Add a **`settings` bucket** to the registry (alongside `feed | profile | hub`). The "You" cluster lives in `config/kronk_nodes.yaml`:

```yaml
# config/kronk_nodes.yaml
- id: settings.profile        # bucket:settings, lifecycle:live, spa:true …
  bucket: settings
  label: Profile
  url: /@:acct/edit
  lifecycle: live
  spa: true
- id: settings.appearance
  bucket: settings
  label: Appearance
  url: /settings/appearance
  lifecycle: live
  spa: true
# … settings.posting, settings.privacy, settings.notifications,
#     settings.account, settings.data
```

**Per-korner settings** are `hub` nodes declared in the korner manifest and linked back with the existing `settings_for` link kind:

```yaml
# config/korners/kommons.yaml → nodes:
- id: kommons.settings
  label: Kommons settings
  url: /hub/kommons/settings
  lifecycle: live
- id: kommons.index
  links:
    - to: kommons.settings
      kind: settings_for
```

The nav is then a projection:
- **"You" cluster** = `NodeRegistry.for_bucket('settings')`, ordered per §4.
- **Per-korner** = for the current korner, `NodeRegistry.in_korner(slug)` filtered to its `settings_for` target.

`bin/tootctl korners doctor` already validates node route-names against Rails routes, so a settings node that points at a dead route fails the boot check — settings can't silently rot.

## 4. The "You" cluster — sections and what each OWNS

Ordered as they should appear in the nav. "Owns" is normative — it resolves the current mixups.

| # | Node | Owns | Status |
|---|------|------|--------|
| 1 | `settings.profile` | Identity: display name, bio, avatar/header, profile fields, pinned/sections (the profile composer at `/@:acct/edit`). | **Built** (composer) |
| 2 | `settings.appearance` | **Look & feel only:** theme (dark/light/contrast), personal accent (purple), display/body font, UI scale, reduce motion, auto-play, interface (UI) language. | **Built — needs trimming** |
| 3 | `settings.posting` | **Composing defaults:** default post visibility, default posting language, mark media sensitive by default. | **NEW** |
| 4 | `settings.privacy` | Safety & reach: mutes, blocks, domain blocks, discoverability (locked / discoverable / indexable), DM filtering, keyword filters. | **Built** (filters pending) |
| 5 | `settings.notifications` | Notification preferences: email prefs, software-update emails, (later) in-app notification prefs. | **Built** |
| 6 | `settings.account` | Account & security: email, password, 2FA, active sessions, authorized apps, account migration, deactivate/delete. | **Monolith** (classic Mastodon `/settings/*`) |
| 7 | `settings.data` | Your data: export archive, import follows/lists/blocks. | **Monolith** |

### Reassignments this spec mandates (the fix you flagged)

The `Api::V1::Settings::AppearanceController` currently also carries `default_privacy`, `default_language`, `default_sensitive` — those are **posting defaults, not appearance.** Move them to a new `Api::V1::Settings::PostingController` (`settings.posting`). Appearance keeps only look-&-feel + interface language.

## 5. Build status → what's left

- **Trim Appearance** — move the three posting-defaults to a new **Posting** section/controller. (Schema-driven: relocate the `FIELDS` entries + labels; no data migration — the underlying `default_*` user settings are unchanged.)
- **Add Posting** (`settings.posting`) — new controller + section + node.
- **Account & Security** and **Data** — still the untouched Mastodon monolith; rehome into the SPA shell (the two remaining "You" sections). Mark `lifecycle: soon` until built so the nav shows them honestly.
- **Wire the nav to the registry** — replace the hardcoded list in `settings/nav.tsx` with a projection of `NodeRegistry` (`settings` bucket + per-korner `settings_for`). Needs the registry serialized to the client (extend the Kommons nodes API / initial_state).
- **Register the settings nodes** — add the `settings` bucket + the seven "You" nodes to `kronk_nodes.yaml`, and a `*.settings` node + `settings_for` link to each korner manifest that has a §K surface.

## 6. Lifecycle & projections

- Sections carry `lifecycle` (`live | soon | deprecated | hidden`), so "coming soon" sections (e.g. Data before it's built) render from data, not a hardcoded "Soon" pill.
- Settings is a **projection** of the node map — same as the Kommons Tree feedback view, and later nav/breadcrumbs/search. Keep the node schema rendering-agnostic; the settings nav is one renderer.

## 7. Coordination

This spec **writes into the Tree's `NodeRegistry` / `kronk_nodes.yaml`**, which the `tal@mainframe` session owns (Kommons Tree backend). The `settings` bucket + settings nodes should land in coordination with that work so the two don't diverge. Suggested split: Tree owner adds the `settings` bucket + node loading; settings work (portal-me) adds the nodes, the Posting controller, the Appearance trim, and the registry-driven nav.

---

_Related: `docs/kronk_korner_spec.md` (korner manifests + `nodes:`), the Kommons Tree, and `docs/kronk_aesthetic_system.md`. The settings widget kit (`features/settings/setting_widgets.tsx`) renders every section; sections are schema-driven, so a new section is a controller `FIELDS` map + a node, not a bespoke page._
