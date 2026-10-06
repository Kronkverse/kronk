# Kronk (`/kronk`, the org space)

**Node bucket:** `kronk` · **Routes:** `/kronk`, `/kronk/:page` (SPA) and
`GET /api/v1/kronk_pages(/:page)` (JSON) · **Content:** `content/kronk/*.md` ·
**Cross-cutting.**

`/kronk` is where Kronk the project talks about itself: what it is, how it
works, who runs it, its rules and promises. A signed-out visitor lands here
from `/about`, `/privacy-policy`, `/terms-of-service` or the wordmark. A member
reaches it from the wordmark or the Ж spoke on the `/me` wheel. This doc
describes what is built as of 2026-10-05. Spec: `docs/decisions.md` §O.

## Rendering

`/kronk` is an ordinary SPA route: `KronkOrgSpace`
(`features/kronk_org/index.tsx`), mounted in `features/ui/index.jsx` inside
the same `KronkFrame` as every other space.

- **`KronkController`** only boots the SPA shell (`app/views/kronk/show.html.haml`).
- **`Api::V1::KronkPagesController`** returns `{ page, title, body_html,
nav_pages }`. It needs no sign-in. `nav_pages` comes with every response so
  the wheel draws on first paint.
- **Markdown** is rendered server-side with Redcarpet (`safe_links_only`, so no
  `javascript:` links). Files may carry YAML frontmatter (`title:`). The source
  is in the repo and trusted; the SPA inserts `body_html` directly.
- **Page names** must match `KronkController::PAGE_PATTERN`. An unknown name
  falls back to `about` in the API.

**Caching.** For signed-out visitors both the shell and the JSON are
`public` for 3 minutes (stale-while-revalidate 30s, stale-if-error 1 day). The
shell omits the CSRF meta tag when signed out, so no session cookie is set, and
`vary_by 'Accept-Language, Cookie'` keeps the anonymous copy away from members.

Crawlers that don't run JavaScript see only the SPA shell, like every other
route.

## Content

Every top-level `content/kronk/*.md` file is a page; add a file and it appears
on the wheel. Order is `KronkController::NAV_ORDER`, then anything else
alphabetically. Seven pages today:

| Page           | Layer    | Who edits it   |
| -------------- | -------- | -------------- |
| `about`        | project  | the Kronk repo |
| `how-it-works` | project  | the Kronk repo |
| `contributors` | project  | the Kronk repo |
| `governance`   | project  | the Kronk repo |
| `rules`        | instance | each operator  |
| `privacy`      | instance | each operator  |
| `terms`        | instance | each operator  |

Project pages stay in sync with upstream on other people's Kronks. Instance
pages are for each operator to replace before launch.

`/kronk` is `about`. `/kronk/about`, `/kronk/privacy` and `/kronk/terms` keep
the Mastodon route names (`about`, `privacy_policy`, `terms_of_service`) so
inherited helpers still work. Retired pages redirect: `values` and
`announcements` to `/kronk`, `contact` to `/kronk/contributors`.

## Nodes in the Skeleton

Each page has a `kronk.*` node in `config/kronk_nodes.yaml` (bucket `kronk`,
`lifecycle: live`, `spa: true`). That puts the org space in the Kommons
Directory, so members can propose changes to how Kronk itself is run, the same
way they propose changes to a korner.

## Chrome

The page uses the real components: `KronkWordmark`, `HubSwitcher`,
`KornerSidebar`, `KronkMenu` and the `KronkKosmos` canvas. The
page wheel is the shared `KronkWheel` (`components/kronk_wheel.tsx`), the same
one `/me` and `/settings` use, with Ж at the centre linking back to `/kronk`.
Page and wheel styles: `app/javascript/styles/mastodon/_kronk_org.scss`.

Until 2026-09-14 this space was a Rails view with a hand-built Haml copy of the
chrome, which drifted from the app. Moving it into the SPA removed the copy for
`/kronk`. The Haml chrome (`shared/_kronk_static_chrome.html.haml`) and a
pure-CSS stand-in for the `KronkKosmos` backdrop
(`shared/_kronk_kosmos_static.html.haml`) still render on Rails-only pages
such as `/auth/*`. The application layout skips them whenever the SPA mounts.

## Open

- **The static chrome can still drift.** Rails-only pages use the Haml copy of
  the chrome and a CSS stand-in for `KronkKosmos`. Nothing keeps them in step
  with the React components.
- **Generated contributors list.** `contributors.md` says a section will be
  built from manifest `maintainers:` and git history. It's still a placeholder.
- **Per-page look.** Pages are plain prose. Individual pages could get small
  identifying touches (a wordmark hero on `about`, say), as korners do.

## History

Rewritten 2026-10-05 to describe what is built. Earlier notes (the 2026-09-14
dial and SPA rebuild, the announcements idea): `git show
231cca937:docs/spaces/kronk.md`.
