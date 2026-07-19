# Settings inventory — everything that must find a home

Compiled 2026-07-19 against `rebuild/2.0.0` @ alpha.73.

Kronk intends to **retire Mastodon's classic settings pages entirely**
(`docs/rebuild/decisions.md`, 2026-07-19). This is the checklist that decides
whether doing so silently drops capabilities people rely on.

**Status:** `SPA` reachable and writeable in Kronk · `Classic` Mastodon Rails
page only · `Both` duplicated in two places, which is a live drift risk.

---

## Do not retire classic settings until these exist

Ordered by how much is lost.

1. **Automated post deletion** — `/statuses_cleanup`,
   `AccountStatusesCleanupPolicy`. Ten fields (enabled, min age, keep
   pinned/direct/self-fav/self-bookmark/polls/media, min favs, min boosts).
   No SPA equivalent whatsoever; the frontend only links out to it.
2. **All of Account & security** — password, email, 2FA (TOTP, recovery
   codes, WebAuthn), active sessions, login activity, authorised OAuth apps,
   own developer apps, account migration, aliases, delete account, archive
   export, six CSV exports, imports. The `settings.account` node is `soon`
   and `/settings/account` has **no route at all**.
3. **Profile identity fields** — display name, bio, avatar, header, metadata
   fields, bot flag. All classic-only. The `profile.edit` node is
   `lifecycle: live` at `/@:user/edit`, but `features/profile_compose/`
   renders `profile_compose.header_stub`: *"Cover image, avatar and display
   name — editing lands in the next step."* **The registry advertises a live
   surface that cannot do the thing it names.**
4. **`default_quote_policy`** — classic only, and omitted from
   `PostingController::FIELDS`. The classic page also forces it to `nobody`
   when privacy is `private`; the API reproduces neither the field nor the
   coupling.
5. **Single-surface classic settings with no API field** — `chosen_languages`,
   `time_zone`, `emoji_style`, `always_send_emails`, `noindex`/`indexable`,
   `show_collections`, `show_application`.
6. **Rails CRUD with no SPA replacement** — keyword filters (`/filters`),
   profile verification, featured hashtags, relationships and severed
   relationships.

---

## Feed — what reaches you

| Setting | Today | Status |
|---|---|---|
| Feed scope (Friends / FoF / Kommunity) | `kronk.feed_scope`; `/api/v1/kronk_settings`; classic `/settings/preferences/feed` | Both |
| Per-korner tune-in/out | `KornerTuneOut`; classic feed page + `/home/settings` + `/hub/:slug/settings` | Both (three surfaces) |
| Group boosts | `aggregate_reblogs` | Both |
| Slow mode (load new posts manually) | `web.use_pending_items` | Both — classic files under Appearance |
| Media display | `web.display_media` | Both — also Appearance |
| Blur media | `web.use_blurhash` | Both — also Appearance |
| Always expand CWs | `web.expand_content_warnings` | Both — also Appearance |
| Show trends | `web.trends` | Both — also Appearance |
| Languages in public timelines | `chosen_languages` | Classic — no API |
| Keyword filters | `/filters` | Classic |
| Muted / blocked accounts, blocked domains | `/mutes`, `/blocks`, `/domain_blocks` | SPA |
| Home column: replies/boosts/quotes, body regex | Redux `settings.home.*` → `/api/web/settings` | SPA (column header, not the hub) |
| Firehose only-media, per-timeline regex | Redux `settings.firehose.*` | SPA (column header) |
| Notification-source gating | `NotificationPolicy` | SPA — also Nudges |

## Profile — identity and how you appear

| Setting | Today | Status |
|---|---|---|
| Display name, bio, avatar, header, metadata fields, bot flag | `Settings::ProfilesController` → `/settings/profile` | Classic |
| Require follow approval | `Account#locked`; privacy API + classic | Both — also Feed |
| Discoverable | `Account#discoverable` | Both |
| Indexable by search engines | `Account#indexable`, user `noindex` | Classic |
| Show follows/followers collections | `Account#hide_collections` | Classic |
| Profile sections layout | `/settings/profile_sections` | SPA (Kronk-only) |
| Profile verification (rel=me) | `/settings/verification` | Classic |
| Featured hashtags | `/settings/featured_tags` | Classic |

## Nudges — notifications and alerts

| Setting | Today | Status |
|---|---|---|
| Email per type (mention, follow, follow request, boost, favourite, quote, event invitation) | `notification_emails.*` | Both |
| Email even when active | `always_send_emails` | Classic |
| Admin emails (report, appeal, pending account, trends) | role-gated | Classic |
| Server update emails | `notification_emails.software_updates` | Both |
| Web-push subscription, per-type alerts, policy | `Web::PushSubscription` | SPA |
| Per-korner push | `/hub/:slug/settings` | SPA — also Korner |
| In-app desktop alerts, per type (12 types) | Redux `settings.notifications.alerts.*` | SPA (column) |
| Show in column, per type | `settings.notifications.shows.*` | SPA (column) |
| Sounds, per type | `settings.notifications.sounds.*` | SPA (column) |
| Group follow notifications | `settings.notifications.group.follow` | SPA |
| Quick filter bar, unread, banners | `settings.notifications.*` | SPA |

## Account — security and lifecycle (all Classic)

Change email · change password · 2FA overview/disable · TOTP setup · recovery
codes · WebAuthn security keys · active sessions · login activity ·
authorised OAuth apps · own developer apps · account migration · aliases ·
delete account · archive export · CSV exports (follows, blocks, mutes, lists,
domain blocks, bookmarks) · imports · invites · relationships and severed
relationships · moderation strikes and appeals.

## Appearance

| Setting | Today | Status |
|---|---|---|
| Theme, interface language | appearance API + classic | Both |
| Time zone | classic only | Classic |
| Reduce motion, auto-play GIFs | appearance API + classic | Both |
| Personal accent, display font, body font, UI scale | appearance API only | SPA (Kronk-only) |
| Emoji style, advanced layout, system font, system scrollbars, disable swiping, disable hover cards | classic only | Classic |
| Emoji skin tone, column layout, dismissed banners | Redux | SPA |

## Posting

| Setting | Today | Status |
|---|---|---|
| Default visibility, language, sensitive | posting API + classic | Both |
| Default quote policy | classic only, **absent from the API** | Classic |
| Confirm before boosting, quick boosting, confirm delete, warn missing alt | classic only | Classic |
| Show which app posted | classic `/settings/privacy` | Classic — also Profile |
| Composer language memory, recent emojis | Redux | SPA |
| Automated post deletion (10 fields) | `/statuses_cleanup` | Classic |

## Korner-specific

Tune-in/out · per-korner push · manifest-declared preferences rendered by the
widget engine (`GET/PATCH /api/v1/korners/:slug/settings`) · korner list
ordering (`/settings/korners`).

---

## Fits no group

- **Instance administration** (`/admin/*`, Sidekiq, PgHero) — role-gated, not
  a user preference, but it hangs off the same settings chrome. Retiring the
  Rails settings layout must keep an entry point for it.
- **Invites** and **moderation strikes/appeals** — capabilities and records
  rather than preferences.
- **Dead keys:** `interactions.must_be_follower` and
  `interactions.must_be_following` are defined in `UserSettings`, rendered by
  no view, exposed by no API — but writeable through classic mass-assignment.
  Implement or drop.

## Dead or redundant classic pages

- `/settings/preferences` — a pure redirect to
  `/settings/preferences/appearance`. The `settings.prefs` node points at it
  with `lifecycle: live`, so the registry advertises a redirect as a
  destination.
- `/settings/account`, `/settings/data` — nodes exist (`soon`), no route
  exists. A direct hit 404s.
- `/settings/preferences/feed` — Kronk-authored, fully duplicates the SPA
  `/home/settings`. Both live, both writeable, no redirect. First candidate
  to delete.
- `/settings/preferences/other` — down to `aggregate_reblogs` (already
  duplicated in the SPA) and `chosen_languages`. Empty once that is rehomed.
- `app/views/settings/shared/_profile_navigation.html.haml` — the only route
  to verification and featured hashtags. If the profile page goes, those two
  lose their entry point.
