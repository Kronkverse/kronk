# Settings inventory — everything that must find a home

Compiled 2026-07-19 against `rebuild/2.0.0` @ alpha.73.

> **Re-verified 2026-08-14 against `rebuild/2.0.0`.** Several items below were
> resolved since the 07-19 compile — the code moved, the doc didn't. The stale
> claims are corrected inline and tagged **[RESOLVED 08-14]**. Current state:
>
> - **Resolved since July:** the three once-"stranded" privacy settings
>   (`indexable`, `hide_collections`, `show_application`) now render in the SPA
>   privacy controller; `default_quote_policy` and `always_send_emails` are now
>   in the API; the `must_be_follower` / `must_be_following` dead keys were
>   retired (2026-07-23); `settings.prefs` is now `deprecated`;
>   `settings.account` / `.data` now point at real classic routes
>   (`soon`, `spa: false`) rather than 404ing; keyword filters are reachable
>   via the upstream `features/filters` SPA.
> - **Still open — the real work:** a Kronk **Account & Security** surface
>   (entirely classic — there is no `api/v1/settings` controller for it; the
>   five that exist are appearance / feed / notifications / posting / privacy);
>   **profile identity editing** (the backend `accounts/credentials`
>   `update_credentials` API exists, but the Kronk composer is still the
>   `header_stub`); **automated post deletion** (classic-only); **data
>   export/import** (classic-only); and the small API-less prefs
>   `chosen_languages` / `time_zone` / `emoji_style`.

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
   export, six CSV exports, imports. Still entirely classic: there is **no
   `api/v1/settings` controller** for account/security (the five that exist are
   appearance / feed / notifications / posting / privacy). **[Partly corrected
   08-14]** the `settings.account` node is still `soon`, but no longer routes
   to nothing — it now points at the real classic route
   `/settings/two_factor_authentication_methods` (`spa: false`), handing the
   surface to Rails until a Kronk one is built. This is the largest single
   piece of the settings job.
3. **Profile identity fields** — display name, bio, avatar, header, metadata
   fields. **Resolved:** the SPA identity editor (display name, bio, avatar,
   header, fields) now lives in Arrange mode on the shelved profile
   (`features/profile_shelves/components/identity_editor.tsx`). The standalone
   `features/profile_compose/` composer was retired; `/@:user/edit` redirects
   to `/@:user/shelves`. The `profile.edit` node stays `lifecycle: live` and
   now genuinely resolves to a working editor.
4. **`default_quote_policy`** — now in the API: it is present in
   `PostingController::FIELDS` (an enum of `public|followers|nobody`) and
   serialized in the controller's payload. What the API still does **not**
   reproduce is the classic page's coupling that forces it to `nobody` when
   privacy is `private` — that constraint lives only on the classic view.
5. **Single-surface classic settings with no API field** — `chosen_languages`,
   `time_zone`, `emoji_style`. (`always_send_emails` was on this list; it is now
   in the notifications API — **[RESOLVED 08-14]**.)
6. **[RESOLVED 08-14]** `indexable`/`noindex`, `show_collections`
   (`hide_collections`) and `show_application` — once stranded (the classic
   privacy GET still resolves to the SPA before `draw(:settings)`, so the
   classic view can't render). All three are now exposed by the **SPA** privacy
   controller (`app/controllers/api/v1/settings/privacy_controller.rb` — in its
   `FIELDS` map and payload), so they are reachable and writeable again. Left
   here as the cautionary tale it was: the original compile recorded them as
   safely reachable when they weren't, which is exactly the error this document
   exists to prevent — re-verification is what caught both the break and its
   fix.
7. **Rails CRUD with no SPA replacement** — keyword filters (`/filters`),
   profile verification, featured hashtags, relationships and severed
   relationships.

---

## Feed — what reaches you

| Setting                                        | Today                                                                                                    | Status                                        |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Feed reach (Mates / Orbit / Kommunity)         | `kronk.feed_scope`; `/api/v1/kronk_settings`; classic `/settings/preferences/feed`; SPA `/home/settings` | Both                                          |
| Per-korner tune-in/out                         | `KornerTuneOut`; classic feed page + `/home/settings` + `/hub/:slug/settings`                            | Both (three surfaces)                         |
| Group boosts                                   | `aggregate_reblogs`                                                                                      | Both                                          |
| Slow mode (load new posts manually)            | `web.use_pending_items`                                                                                  | Both — classic files under Appearance         |
| Media display                                  | `web.display_media`                                                                                      | Both — also Appearance                        |
| Blur media                                     | `web.use_blurhash`                                                                                       | Both — also Appearance                        |
| Always expand CWs                              | `web.expand_content_warnings`                                                                            | Both — also Appearance                        |
| Show trends                                    | `web.trends`                                                                                             | Both — also Appearance                        |
| Languages in public timelines                  | `chosen_languages`                                                                                       | Classic — no API                              |
| Keyword filters                                | `/filters`                                                                                               | SPA (upstream `features/filters`) **[08-14]** |
| Muted / blocked accounts, blocked domains      | `/mutes`, `/blocks`, `/domain_blocks`                                                                    | SPA                                           |
| Home column: replies/boosts/quotes, body regex | Redux `settings.home.*` → `/api/web/settings`                                                            | SPA (column header, not the hub)              |
| Firehose only-media, per-timeline regex        | Redux `settings.firehose.*`                                                                              | SPA (column header)                           |
| Notification-source gating                     | `NotificationPolicy`                                                                                     | SPA — also Nudges                             |

## Profile — identity and how you appear

| Setting                                                      | Today                                                | Status                                        |
| ------------------------------------------------------------ | ---------------------------------------------------- | --------------------------------------------- |
| Display name, bio, avatar, header, metadata fields, bot flag | `Settings::ProfilesController` → `/settings/profile` | Classic                                       |
| Require follow approval                                      | `Account#locked`; privacy API + classic              | Both — also Feed                              |
| Discoverable                                                 | `Account#discoverable`                               | Both                                          |
| Indexable by search engines                                  | `Account#indexable`, user `noindex`                  | SPA (privacy controller) **[RESOLVED 08-14]** |
| Show follows/followers collections                           | `Account#hide_collections`                           | SPA (privacy controller) **[RESOLVED 08-14]** |
| Profile sections layout                                      | `/settings/profile_sections`                         | SPA (Kronk-only)                              |
| Profile verification (rel=me)                                | `/settings/verification`                             | Classic                                       |
| Featured hashtags                                            | `/settings/featured_tags`                            | Classic                                       |

## Nudges — notifications and alerts

| Setting                                                                                     | Today                                   | Status                       |
| ------------------------------------------------------------------------------------------- | --------------------------------------- | ---------------------------- |
| Email per type (mention, follow, follow request, boost, favourite, quote, event invitation) | `notification_emails.*`                 | Both                         |
| Email even when active                                                                      | `always_send_emails`                    | Both — API added **[08-14]** |
| Admin emails (report, appeal, pending account, trends)                                      | role-gated                              | Classic                      |
| Server update emails                                                                        | `notification_emails.software_updates`  | Both                         |
| Web-push subscription, per-type alerts, policy                                              | `Web::PushSubscription`                 | SPA                          |
| Per-korner push                                                                             | `/hub/:slug/settings`                   | SPA — also Korner            |
| In-app desktop alerts, per type (13 types)                                                  | Redux `settings.notifications.alerts.*` | SPA (column)                 |
| Show in column, per type                                                                    | `settings.notifications.shows.*`        | SPA (column)                 |
| Sounds, per type                                                                            | `settings.notifications.sounds.*`       | SPA (column)                 |
| Group follow notifications                                                                  | `settings.notifications.group.follow`   | SPA                          |
| Quick filter bar, unread, banners                                                           | `settings.notifications.*`              | SPA                          |

## Account — security and lifecycle (all Classic)

Change email · change password · 2FA overview/disable · TOTP setup · recovery
codes · WebAuthn security keys · active sessions · login activity ·
authorised OAuth apps · own developer apps · account migration · aliases ·
delete account · archive export · CSV exports (follows, blocks, mutes, lists,
domain blocks, bookmarks) · imports · invites · relationships and severed
relationships · moderation strikes and appeals.

## Appearance

| Setting                                                                                            | Today                    | Status           |
| -------------------------------------------------------------------------------------------------- | ------------------------ | ---------------- |
| Theme, interface language                                                                          | appearance API + classic | Both             |
| Time zone                                                                                          | classic only             | Classic          |
| Reduce motion, auto-play GIFs                                                                      | appearance API + classic | Both             |
| Personal accent, display font, body font, UI scale                                                 | appearance API only      | SPA (Kronk-only) |
| Emoji style, advanced layout, system font, system scrollbars, disable swiping, disable hover cards | classic only             | Classic          |
| Emoji skin tone, column layout, dismissed banners                                                  | Redux                    | SPA              |

## Posting

| Setting                                                                   | Today                                                                              | Status                                        |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------- |
| Default visibility, language, sensitive                                   | posting API + classic                                                              | Both                                          |
| Default quote policy                                                      | in posting API; classic-only coupling (force `nobody` when private) not reproduced | Both **[08-14]**                              |
| Confirm before boosting, quick boosting, confirm delete, warn missing alt | classic only                                                                       | Classic                                       |
| Show which app posted                                                     | classic `/settings/privacy`                                                        | SPA (privacy controller) **[RESOLVED 08-14]** |
| Composer language memory, recent emojis                                   | Redux                                                                              | SPA                                           |
| Automated post deletion (10 fields)                                       | `/statuses_cleanup`                                                                | Classic                                       |

## Korner-specific

Tune-in/out · per-korner push · manifest-declared preferences rendered by the
widget engine (`GET/PATCH /api/v1/korners/:slug/settings`) · korner list
ordering (`/hub/settings`).

---

## Fits no group

- **Instance administration** (`/admin/*`, Sidekiq, PgHero) — role-gated, not
  a user preference, but it hangs off the same settings chrome. Retiring the
  Rails settings layout must keep an entry point for it.
- **Invites** and **moderation strikes/appeals** — capabilities and records
  rather than preferences.
- **Dead keys: [RESOLVED 08-14]** `interactions.must_be_follower` and
  `interactions.must_be_following` were **retired 2026-07-23** (see the note in
  `app/models/user_settings.rb`). Only `must_be_following_dm` — a live gate —
  remains.

## Dead or redundant classic pages

- `/settings/preferences` — a pure redirect to
  `/settings/preferences/appearance`. **[Corrected 08-14]** the `settings.prefs`
  node that pointed at it is now `lifecycle: deprecated` (was `live`), so the
  registry no longer advertises a redirect as a live destination.
- `/settings/account`, `/settings/data` — nodes exist (`soon`), no route
  exists. A direct hit 404s.
- `/settings/preferences/feed` — Kronk-authored. The SPA `/home/settings` is a
  strict superset of it (the classic view carries only `kronk.feed_scope` plus
  tune-in checkboxes; the SPA adds `expand_content_warnings` and
  `show_trends`). Both live, both writeable, no redirect between them. First
  candidate to delete.
- `/settings/preferences/other` — down to `aggregate_reblogs` (already
  duplicated in the SPA) and `chosen_languages`. Empty once that is rehomed.
- `app/views/settings/shared/_profile_navigation.html.haml` — the only route
  to verification and featured hashtags. If the profile page goes, those two
  lose their entry point.
