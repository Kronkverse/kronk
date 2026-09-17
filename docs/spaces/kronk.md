# Kronk (`/kronk` — org space)

**Node bucket:** `kronk` (`app/lib/kronk/node_registry.rb::BUCKETS`) · **Routes:**
`/kronk`, `/kronk/:page` (SPA) + `/api/v1/kronk_pages(/:page)` (JSON) ·
**SPA route:** `features/kronk_org/index.tsx` mounted in `features/ui/index.jsx` ·
**Content root:** `content/kronk/*.md` · **Cross-cutting.**

Spec: `docs/rebuild/implementation_plan.md` §O ("org space"). Landed
2026-07-10 (commit `289daba9b7`) as a Rails-rendered space with a Haml
mirror of the SPA chrome. **Rebuilt as a real SPA route 2026-09-14**
after Tal's read of the drifted mirror: "it's gotta be hooked up the
same as the rest of Kronk." The Rails controller now just boots the
SPA shell; the SPA fetches content from the JSON endpoint.

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

## Rendering

`/kronk/*` is an SPA route (`WrappedRoute path={['/kronk', '/kronk/:page']}`
in `features/ui/index.jsx`). The Rails `KronkController` serves the
SPA shell for those URLs — same as `/home`, `/hub`, `/nudges`, `/me`.
The SPA component (`features/kronk_org/index.tsx`) fetches from
`Api::V1::KronkPagesController` and renders the wheel + article body
inside the real `KronkFrame`.

**Content pipeline** — unchanged from the Rails-rendered era:

- Markdown files under `content/kronk/*.md`, optional YAML frontmatter
  (`title:`, `updated:`).
- Renderer: `Redcarpet::Markdown.new(safe_links_only: true)` — blocks
  `javascript:` URLs. Source is repo-versioned and trusted; the SPA
  side inserts `body_html` via `dangerouslySetInnerHTML`.
- URL constraint: `%r{\A[a-z0-9-]+(?:/[a-z0-9-]+)?\z}`. Nav order:
  `KronkController::NAV_ORDER` (recommended reading flow), then any
  remaining files alphabetically.

**Cache posture** — preserved from the earlier direct-render setup so
first-paint stays fast for anonymous readers:

- `KronkController` sets `expires_in(3.minutes, public: true,
stale_while_revalidate: 30.seconds, stale_if_error: 1.day)` on the
  shell response.
- `skip_csrf_meta_tags?` returns `true` when signed out — the layout
  omits the CSRF meta tag, no `_mastodon_session` cookie is written,
  the response stays CDN-cacheable.
- `vary_by 'Accept-Language, Cookie'` protects the anonymous cache
  from ever being served to a signed-in member.
- The JSON endpoint carries the same 3-minute public cache for
  anonymous requests, so subsequent nav within the space also hits
  the CDN.

**SEO note.** The rendered Markdown is no longer in the initial HTML —
crawlers that don't execute JS see the SPA shell + `<noscript>`
fallback (same as every other SPA route). Modern crawlers (Googlebot,
Bing 2025+) render the JS-hydrated content. This is the same tradeoff
every SPA route makes; `/kronk` used to be the exception, and the
2026-09-14 rebuild folded it into the rule.

## Content

Every top-level `content/kronk/*.md` file becomes a page. The controller
does no whitelisting beyond a URL regex
(`%r{\A[a-z0-9-]+(?:/[a-z0-9-]+)?\z}`); drop a new `.md` in the folder and
it appears in the nav dial.

Ships today (7 pages):

| Slug           | Kind           | Owned by            |
| -------------- | -------------- | ------------------- |
| `about`        | project-layer  | upstream Kronk repo |
| `how-it-works` | project-layer  | upstream Kronk repo |
| `contributors` | project-layer  | upstream Kronk repo |
| `governance`   | project-layer  | upstream Kronk repo |
| `rules`        | instance-layer | each operator edits |
| `privacy`      | instance-layer | each operator edits |
| `terms`        | instance-layer | each operator edits |

**Project-layer** files stay in sync with upstream on downstream forks.
**Instance-layer** files are placeholders each operator replaces before
launch.

`about` is the default (`get '/kronk' → 'kronk#show', defaults: { page:
'about' }`) and where the wordmark lands.

Nav order is a hardcoded list in `KronkController::NAV_ORDER` — anything
not in the list appends alphabetically after.

**Consolidated 2026-09-15** (Tal, "reduce the number of options on the
wheel to simplify"): `announcements` retired, `values` folded into
`about`, `contact` folded into `contributors`. Their `/kronk/*` URLs
301-redirect (see `config/routes.rb`) so bookmarks + federation
crawlers survive.

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

## Chrome — the real thing

The 2026-09-14 rebuild is the whole point here. `/kronk/*` now mounts
inside the same `KronkFrame` every other SPA route uses. Every piece
that used to be a hand-mirrored Haml parallel is the actual React
component now:

- **Top band** — the real `<KronkWordmark>` and `<HubSwitcher>` (from
  `features/ui/index.jsx`), no longer the Haml twin at
  `shared/_kronk_static_chrome.html.haml`.
- **Right band** — the real `<KornerSidebar>`.
- **Invite FAB** — the real `<InviteButton>` opening the invite modal
  directly. No more `/home?invite=1` deep-link handoff.
- **Ж menu** — the real `<KronkMenu>`, moveable, walkthrough-aware,
  ring-of-moons on tap. Not the bare `<a href="/publish">Ж</a>` the
  Haml chrome used.
- **`KronkKosmos`** — the real canvas with live Mates-orb chord
  geometry and the 10-min breathing cycle. The pure-CSS
  `.kronk-kosmos-static` fallback (added earlier the same day) stays
  live for the OTHER Rails-only surfaces (invite acceptance pages,
  `/auth/*`, etc.) but is no longer used by /kronk.

**Nothing on /kronk is a mirror any more.** Drift between /kronk's
chrome and the rest of the SPA is architecturally impossible now —
the same components render both.

The `/kronk`-specific styling — page body + navigation dial — lives in
`app/javascript/styles/mastodon/_kronk_org.scss`.

## Aesthetic — 2026-09-14 rebuild timeline

Two waves, same day:

1. **Dial pass** (PR #1870 + fix PR #1873): sticky sidebar list →
   pill-labelled radial dial. Ten spokes around a dashed ring, centre
   Ж, active spoke filled purple. The idiom itself — same as `/me` +
   `/settings` hubs — was fine; the Rails-view implementation was
   still the drift-prone one.
2. **Real-thing pass** (this PR): retire the Rails-rendered surface
   entirely. `/kronk/*` becomes a real SPA route mounted inside the
   real `KronkFrame`. Content flows over the JSON endpoint. The
   `_kronk_static_chrome.html.haml` mirror stays live for the other
   Rails-only surfaces but no longer carries /kronk.

Dial geometry (unchanged from wave 1):

- **Centre Ж** — mirrors the wordmark's opening glyph + the /me hub
  Kronk spoke. Clicking it returns to `/kronk` (about).
- **Spokes** — one per `content/kronk/*.md` file; angle distributed
  automatically by page count. Drop a new file and the wheel reflows.
- **Active spoke** — filled purple.
- **Geometry** — CSS-variable driven; rescales at `<720px` without
  per-spoke media queries. Per-spoke `--spoke-angle` values are set
  inline from React state (CSP-safe: React applies inline styles as
  element properties, not attributes).

## Related

- **Framework** — [`../rebuild/implementation_plan.md`](../rebuild/implementation_plan.md) §O.
- **Aesthetic tokens** — [`../kronk_aesthetic_system.md`](../kronk_aesthetic_system.md).
- **Adjacent hubs** — `/me` hub (`docs/spaces/you.md` for the Me
  pillar, `me_hub/index.tsx` for the wheel), `/settings` hub
  (`docs/spaces/settings.md`).
- **SPA chrome** — `KronkFrame`
  (`app/javascript/mastodon/components/kronk_frame.tsx`) and its
  parasites. /kronk now mounts inside this, same as every other
  SPA route.
- **Static Kosmos fallback** — still shipped for Rails-only surfaces
  that don't mount the SPA (`_kronk_kosmos_static.scss` +
  `_kronk_static_chrome.html.haml`). No longer used by /kronk.
- **Content** — every `.md` under `content/kronk/`.

## Open work

Ordered by how much visual drift they close.

Items 1-3 (ambient parity, real Ж menu, chrome de-duplication)
resolved by the 2026-09-14 SPA-mount rebuild — /kronk now uses the
real components rather than mirrors of them. What's left:

1. **Per-page aesthetic pass.** `about`, `values`, `governance` etc.
   currently render as prose only. Individual pages could earn small
   distinguishing treatments (a wordmark hero on `about`, a lattice
   motif on `governance`, a spiral on `values`) — matching how each
   korner tile identifies itself.
2. **Announcements as a live stream.** `announcements.md` is a static
   file today; the intent (per its content) is a feed of dated posts.
   Either markdown with a stronger date convention or a small
   append-only source that renders into the page.
3. **Auto-generated contributors section.** `contributors.md` says
   the section will pull maintainers from manifests + git history;
   currently a placeholder. Would need a controller-side generator
   (or a build-time step) that reads the two sources and emits the
   list into `body_html`.

## Status

- **SPA-mounted /kronk shipped (2026-09-14)** — real Frame, real
  KronkMenu, real Kosmos, real HubSwitcher/KornerSidebar; Rails
  chrome mirror retired for this space.
- Nav dial shipped (2026-09-14, PR #1870 + fix #1873).
- Node bucket + Directory presence shipped (`kronk.*` nodes in
  `config/kronk_nodes.yaml`).
- Content complete for launch (10 pages).

_This doc is the reference for /kronk. Structural changes to the space
land as PRs against it._
