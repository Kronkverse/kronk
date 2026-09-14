# Kronk (`/kronk` — org space)

**Node bucket:** `kronk` (`app/lib/kronk/node_registry.rb::BUCKETS`) · **Routes:**
`/kronk`, `/kronk/:page` (`config/routes.rb`, `KronkController`) ·
**Content root:** `content/kronk/*.md` · **Layout:** `layouts/application` +
`shared/_kronk_static_chrome.html.haml` (Rails-served, NOT the SPA) ·
**Cross-cutting.**

Spec: `docs/rebuild/implementation_plan.md` §O ("org space"). Landed
2026-07-10 (commit `289daba9b7`). This doc was overdue — the space shipped
without a normative reference, and the aesthetic drift called out below is
partly a consequence.

## Purpose

`/kronk/*` is the **organisation space** — where Kronk-the-project speaks
about itself: what it is, why it exists, how it's governed, what it
promises. It's the entry point an anonymous visitor lands on when arriving
via `/about`, `/privacy-policy`, `/terms-of-service`, or the top-left
`<KronkWordmark>` in the app chrome.

Two audiences share the surface:

- **Signed-out visitors** — first impression. Landing page for federated
  crawlers, direct links from other instances, and the wordmark on the
  greeting/sign-up flow.
- **Signed-in members** — the "what am I part of, and who runs it" reference.
  Reachable from the wheel (the Ж spoke on `/me`, PR #1868) and the
  wordmark.

## Why Rails-served, not SPA

Deliberate architectural choice, not oversight. `KronkController` is a
plain Rails controller with a Redcarpet-rendered Markdown body and a
`layout 'application'` shell. Rationale:

- **First-paint speed for the anonymous case.** A signed-out reader
  shouldn't have to boot the whole React bundle to read a paragraph. The
  controller sets `expires_in(3.minutes, public: true,
stale_while_revalidate: 30.seconds, stale_if_error: 1.day)`.
- **No session for strangers.** `skip_csrf_meta_tags?` returns `true`
  when signed out, so the layout doesn't emit `csrf_meta_tags`, so no
  `_mastodon_session` cookie is written, so the response stays cacheable.
  `vary_by 'Accept-Language, Cookie'` protects the anonymous cache from
  ever being served to a signed-in member.
- **No dynamism to speak of.** Content is static Markdown, versioned in
  the repo. Rendering is `Redcarpet::Markdown.new(safe_links_only: true)`;
  optional YAML frontmatter (`title:`, `updated:`) parses via
  `YAML.safe_load(permitted_classes: [Date])`.

## Content

Every top-level `content/kronk/*.md` file becomes a page. The controller
does no whitelisting beyond a URL regex
(`%r{\A[a-z0-9-]+(?:/[a-z0-9-]+)?\z}`); drop a new `.md` in the folder and
it appears in the nav dial.

Ships today (10 pages):

| Slug            | Kind           | Owned by            |
| --------------- | -------------- | ------------------- |
| `about`         | project-layer  | upstream Kronk repo |
| `announcements` | project-layer  | upstream Kronk repo |
| `values`        | project-layer  | upstream Kronk repo |
| `governance`    | project-layer  | upstream Kronk repo |
| `contributors`  | project-layer  | upstream Kronk repo |
| `how-it-works`  | project-layer  | upstream Kronk repo |
| `privacy`       | instance-layer | each operator edits |
| `terms`         | instance-layer | each operator edits |
| `rules`         | instance-layer | each operator edits |
| `contact`       | instance-layer | each operator edits |

**Project-layer** files stay in sync with upstream on downstream forks.
**Instance-layer** files are placeholders each operator replaces before
launch.

`about` is the default (`get '/kronk' → 'kronk#show', defaults: { page:
'about' }`) and where the wordmark lands.

Nav order is a hardcoded list in `KronkController::NAV_ORDER` — anything
not in the list appends alphabetically after.

## Nodes in the Skeleton

Every page has a `kronk.*` node in `config/kronk_nodes.yaml` (bucket
`kronk`, lifecycle `live`, `spa: true`). This puts them in the Kommons
Directory so members can plant proposals about how Kronk itself is run —
the org space is the target of "here's how the project should work
differently" the same way a korner is the target of "here's how the space
should work differently."

`spa: true` on these nodes skips the route-name drift check because there
is no per-page named Rails route (the single `/kronk/:page` route serves
them all), so there is nothing to bind. It's a technicality; these are
not SPA routes.

## Chrome — shared with the rest of Rails-served Kronk

`/kronk/*` doesn't render its own chrome. The `application` layout emits
`shared/_kronk_static_chrome.html.haml`, which draws:

- **Top band** — `KronkWordmark` (`shared/_kronk_wordmark.html.haml`, the
  `ЖЯѺƝ₭` spans) + `hub-switcher` pillar row (Me · Home · Hub · Nudges),
  when signed in.
- **Right band** — `korner-sidebar` (icons for every enforced korner,
  clickable to `/hub/<slug>`), when signed in.
- **Invite FAB** — `.kronk-invite-button` deep-linking to
  `/home?invite=1`; the SPA's `<InviteButton>` reads the query param on
  mount, dispatches the invite modal, cleans the URL. Deliberate
  hand-off so Rails pages don't have to ship the modal.
- **Ж trigger** — `.kronk-menu__trigger` linking to `/publish`.

That partial's own opening comment describes it as a **mirror** of the
React `KronkFrame`. It's the honest word: the SPA-side chrome
(`KronkFrame`, `HubSwitcher`, `KornerSidebar`, `KronkMenu`,
`KronkKosmos`) is the source, and the Haml is a hand-maintained parallel.
There is **no shared code, no shared tests, no drift doctor** — visual
divergence from the SPA is a known risk carried by design.

Consequences on `/kronk` today:

- **`KronkKosmos` ambient starfield** — React-only, so the Rails pages
  render on a flat dark background instead of the starry canvas the SPA
  puts behind `/me`, `/hub`, `/nudges` etc.
- **The floating Ж** — on the SPA it's the moveable `<KronkMenu>` with a
  ring of moon actions; on Rails it's a bare `<a href="/publish">Ж</a>`
  in the same corner. Same glyph, different affordance.
- **Shadows, glass, motion tokens** that live in TSX components (walkthrough
  bubble, SpaceBadge, Nudges messenger) don't reach here.

The `/kronk`-specific styling — page body + navigation dial — lives in
`app/javascript/styles/mastodon/_kronk_org_page.scss`.

## Aesthetic — 2026-09-14 dial pass

The navigation between pages was a sticky sidebar list until 2026-09-14
(PR #1870 + fix PR #1873): a stack of ten flat pills that took a lot of
first-fold weight for what's ultimately short prose. The wheel replaces
it — the same idiom as `/me` hub and `/settings` hub:

- **Centre Ж** — mirrors the wordmark's opening glyph + the new `/me`
  hub Kronk spoke. Clicking it returns to `/kronk` (about).
- **Ten spokes** — pill-labelled, arrayed around a dashed ring. Angle
  distributed automatically by page count; drop a new `.md` and the
  wheel reflows.
- **Active spoke** — filled purple, matching the emphasis the old
  sidebar pill used, so the visual signal is continuous.
- **Geometry** — CSS-variable driven; rescales at `<720px` without per-
  spoke media queries. Per-spoke `--spoke-angle` values are emitted in
  a nonce-tagged `<style>` block from the view because production CSP
  (`style-src :self, assets_host`) strips inline `style` attributes.

## Related

- **Framework** — [`../rebuild/implementation_plan.md`](../rebuild/implementation_plan.md) §O.
- **Aesthetic tokens** — [`../kronk_aesthetic_system.md`](../kronk_aesthetic_system.md).
- **Adjacent hubs** — `/me` hub (`docs/spaces/you.md` for the Me
  pillar, `me_hub/index.tsx` for the wheel), `/settings` hub
  (`docs/spaces/settings.md`).
- **Chrome source-of-truth** — SPA-side `KronkFrame`
  (`app/javascript/mastodon/components/kronk_frame.tsx`) and its
  parasites. The Rails mirror at
  `app/views/shared/_kronk_static_chrome.html.haml` reflects the same
  structure by hand.
- **Content** — every `.md` under `content/kronk/`.

## Open work

Ordered by how much visual drift they close.

1. **Ambient — `KronkKosmos` on Rails.** The starfield background is the
   most visible SPA-vs-Rails divergence; a member visiting `/kronk` from
   `/me` walks off a starry backdrop onto a flat one. Options: (a) port
   the canvas to a small vanilla-JS script the Rails layout can include;
   (b) render a static SVG starfield when the React canvas isn't
   available. (a) matches the SPA visuals exactly; (b) is cheaper and
   gets 80% of the effect.
2. **Ж menu — real `<KronkMenu>` on Rails.** Replace the bare
   `<a href="/publish">Ж</a>` with the moveable ring-of-moons the SPA
   has. Requires extracting `KronkMenu` into a vanilla-JS bundle the
   Rails layout can include, or accepting a smaller Rails-side subset
   (single-action floating trigger with a shared shadow / motion
   pass).
3. **Chrome de-duplication.** The Haml chrome is a copy of the React
   chrome's structure. A shared source — either tokens/partials the
   React side reads at build time, or a tokens/YAML file both consume —
   would remove the drift risk. Bigger job; likely lands after (1) and
   (2) prove the pattern.
4. **Per-page aesthetic pass.** `about`, `values`, `governance` etc.
   currently render as prose only. Individual pages could earn small
   distinguishing treatments (a wordmark hero on `about`, a lattice
   motif on `governance`, a spiral on `values`) — matching how each
   korner tile identifies itself.
5. **Announcements as a live stream.** `announcements.md` is a static
   file today; the intent (per its content) is a feed of dated posts.
   Either markdown with a stronger date convention or a small
   append-only source that renders into the page.

## Status

- Nav dial shipped (2026-09-14, PR #1870 + fix #1873).
- Node bucket + Directory presence shipped (`kronk.*` nodes in
  `config/kronk_nodes.yaml`).
- Content complete for launch (10 pages).
- Chrome drift acknowledged and documented; unresolved.

_This doc is the reference for /kronk. Structural changes to the space
land as PRs against it._
