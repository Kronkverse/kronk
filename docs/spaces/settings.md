# Settings

**Manifest:** `config/korners/settings.yaml` (`core: true`, mount
`/settings`) · **Node bucket:** `settings` (`config/kronk_nodes.yaml`) ·
**Cross-cutting.**

Settings is where you shape how Kronk works for you: appearance, posting
defaults, privacy, notifications, your account and your data. It is a core
space, not a korner. It has no Hub tile and you can't tune out of it.

## Purpose

There are two ways in, and both open the same pages (decisions.md,
"Settings: a hub _and_ contextual entry, converging"):

- **The hub**, `/settings`, which indexes the personal and account pages.
- **From each space.** A space configures itself in its own limb: feed
  settings at `/home/settings`, Hub settings at `/hub/settings`, and each
  korner's settings at `/hub/<slug>/settings`.

## Pages

All are SPA pages unless marked. Rails serves each SPA path to the client
(`config/routes.rb`, ahead of `draw(:settings)`).

| Path                         | Node                     | Component (`features/…`)       | Backed by                                                                                |
| ---------------------------- | ------------------------ | ------------------------------ | ---------------------------------------------------------------------------------------- |
| `/settings`                  | none                     | `settings_hub`                 | A wheel of section spokes, like `/me`                                                    |
| `/settings/you`              | `settings.you`           | `settings_you`                 | The list of personal sections (below)                                                    |
| `/settings/appearance`       | `settings.appearance`    | `appearance_settings`          | `/api/v1/settings/appearance`                                                            |
| `/settings/posting`          | `settings.posting`       | `posting_settings`             | `/api/v1/settings/posting`, `/api/v1/settings/statuses_cleanup`                          |
| `/settings/privacy`          | `settings.privacy`       | `privacy_settings`             | `/api/v1/settings/privacy`, `/api/v1/mutes`, `/api/v1/blocks`                            |
| `/settings/notifications`    | `settings.notifications` | `notifications_settings`       | `/api/v1/settings/notifications` (email), `/api/v1/settings/nudges` (mutes)              |
| `/settings/account`          | `settings.account`       | `account_settings`             | `/api/v1/settings/credentials`, `/sessions`, `/login_activities`; links out for the rest |
| `/settings/data`             | `settings.data`          | `data_settings`                | Links out to the Rails export, CSV and import pages                                      |
| `/settings/profile_sections` | `settings.sections`      | `profile_sections_settings`    | Profile section order and toggles                                                        |
| `/home/settings`             | `settings.feed`          | `feed_settings`                | `/api/v1/kronk_settings` (reach), `/api/v1/settings/feed`, korner tune-in                |
| `/hub/settings`              | `settings.hub`           | `settings_korners`             | Tune in or out of each korner; opens its settings                                        |
| `/hub/<slug>/settings`       | the korner's own         | `korner_settings` (or bespoke) | `GET/POST /api/v1/korners/:slug/settings`, per-name `PATCH`/`DELETE`                     |

Klot, Kommons and Kuestions have bespoke settings pages. Every other korner
gets the generic `KornerSettings`, rendered from the `settings:` block in its
manifest.

**The "You" list** (`features/settings/nav.tsx`) is driven by the node
registry. A section shows if its node exists. It links to the node's URL when
the node is `lifecycle: live`, and shows "Soon" otherwise. Every section is
live today. The **Profile** row is special: it opens your own profile
(`/@you`), where Arrange mode edits display name, bio, avatar, header and
fields (`features/profile_shelves/components/identity_editor.tsx`). The
`settings.profile` node still points at the classic `/settings/profile`.

`settings.prefs` (`/settings/preferences`, a bare redirect to the classic
appearance page) is `lifecycle: deprecated`.

## Settings inventory

Where each setting lives today. Code comments cite this section as
`docs/spaces/settings.md (Settings inventory)`.

### In Kronk pages

- **Appearance**: theme, interface language, time zone, emoji style, reduce
  motion, auto-play GIFs, and Kronk's personal appearance (accent, purple
  hue, display and body fonts, UI scale). See `docs/design.md`.
- **Posting**: default reach (`public`, `orbit`, `mates`, `self_only`),
  default language, sensitive by default, and **automated post deletion**
  (all ten `AccountStatusesCleanupPolicy` fields).
- **Privacy**: follow approval (`locked`), discoverable, Kommunity
  discoverability, profile visibility, hide follows/followers, and the
  mute and block lists.
- **Feed**: feed reach (`kronk.feed_scope`), korner tune-in, group boosts,
  media display, the Moments strip on home, languages shown in public
  timelines (`chosen_languages`). Links out to keyword filters.
- **Notifications**: which events send email, "email even when active",
  server-update emails, and the list of muted nudge types. Nudges' own
  settings are in `docs/spaces/nudges.md` (Nudge settings).
- **Account & security**: change email and password (in the page), signed-in
  devices with revoke, and recent sign-ins.
- **Korner settings**: tune-in, per-korner push toggles, and the manifest
  settings.

Retired as user-facing fields on 2026-09-13 because nothing read them:
`indexable`, `show_application`, `dm_followers_only` (privacy) and
`default_quote_policy` (posting). The underlying keys stay. The 2026-07-23
retirement of `must_be_follower` / `must_be_following` is noted in
`app/models/user_settings.rb`.

### Still only on classic Rails pages

Kronk pages link out to some of these. The rest have no link from Kronk.

| What                                                           | Classic path                                                                   | Linked from          |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------- |
| Two-factor (TOTP, recovery codes, security keys)               | `/settings/two_factor_authentication_methods`                                  | Account              |
| Move account (migration, redirect)                             | `/settings/migration`                                                          | Account              |
| Delete account                                                 | `/settings/delete`                                                             | Account              |
| Archive export, six CSV exports, imports                       | `/settings/export`, `/settings/exports/*`, `/settings/imports`                 | Data                 |
| Keyword filters                                                | `/filters`                                                                     | Feed settings        |
| Account aliases                                                | `/settings/aliases`                                                            | none                 |
| Authorised apps; your own developer apps                       | `/oauth/authorized_applications`; `/settings/applications`                     | none                 |
| Profile form (incl. bot flag); verification; featured hashtags | `/settings/profile`; `/settings/verification`; `/settings/featured_tags`       | none                 |
| Relationships, severed relationships, invites, appeals         | `/relationships`, `/severed_relationships`, `/invites`, `/disputes`            | none                 |
| Classic preference pages                                       | `/settings/preferences/{appearance,posting_defaults,notifications,other,feed}` | some older SPA links |

The classic preference pages write the same keys as the Kronk pages, so both
work and either can overwrite the other. A few classic-only toggles live
there too (confirm before boosting, warn on missing alt text, and similar).

**Per-type web-push toggles** have no reachable UI. They lived in the old
notifications column settings, which are no longer routed.

## Open

- **Retire the classic settings pages.** Decided (decisions.md,
  2026-07-19): every capability needs a home first. What's left is the
  classic table above. Rebuilding 2FA, migration and delete-account was
  deliberately put off, because the classic flows are tested and a bug there
  is severe. Decide whether they stay as link-outs for good.
- **Unlinked capabilities.** Aliases, authorised apps, developer apps,
  verification, featured hashtags and the classic profile form can't be
  reached from Kronk. The Account page's description promises "apps".
- **Duplicate preference pages.** The classic `/settings/preferences/*`
  pages, `/settings/preferences/feed` above all, duplicate Kronk pages. Some
  SPA links still point at them: `compose/index.tsx`,
  `navigation_panel/index.tsx`, `visibility_modal.tsx`, and
  `navigation_panel/components/more_link.tsx` (which also links `/auth/edit`
  and `/statuses_cleanup`).
- **Notifications fold into Nudges, Privacy into Profile.** Decided
  (decisions.md, 2026-07-20, "Settings section cut"), not done. Both are
  still standalone pages and live nodes.
- **Nudge mutes and push toggles don't take effect.** See
  `docs/spaces/nudges.md` (Open).
- **Tune-out doesn't filter the feed** while `tune_in_enforced` is off. See
  `docs/spaces/feed.md`.
- **Admin entry point.** Instance administration (`/admin/*`) hangs off the
  classic settings layout. Retiring that layout must keep a way in.
- **`settings.profile` node** points at the classic `/settings/profile`
  while the nav sends people to their profile. Repoint the node or retire it.
- **Web push.** Bring back the per-type toggles, or replace them with
  Nudges push when that exists.

## History

Rewritten 2026-10-05 to describe what is built. Earlier designs and notes
(including the 2026-07-19 settings inventory and its 2026-08-14
re-verification): `git show
231cca937a00bf7bdbee9db6f25b6cbc541a8565:docs/spaces/settings.md`.
