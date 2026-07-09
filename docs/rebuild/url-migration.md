# URL Migration — `mastodon.kronk.info` → `kronk.info`

Status: **planned, folded into 2.x rebuild** (2026-07-09).

Kronk currently identifies as `mastodon.kronk.info` — that's the value
of `LOCAL_DOMAIN` in prod and what federation partners would see if
federation were enabled. `kronk.info` currently 301-redirects to
`mastodon.kronk.info/home`. In the rebuild, this flips: `kronk.info`
serves the Mastodon app, `mastodon.kronk.info` redirects back to
`kronk.info`.

## Why full migration (not a WEB_DOMAIN split)

Standard Mastodon "pretty URL" advice is a WEB_DOMAIN split
(`LOCAL_DOMAIN` stays, `WEB_DOMAIN` changes) — that keeps federation
identity intact. **Kronk is pre-federation**, so that constraint doesn't
bind. The full migration is simpler long-term and gets us to the desired
identity (`@tal@kronk.info`) before we ever start federating.

## What changes

**Configuration:**
- `LOCAL_DOMAIN=kronk.info` in prod `.env.production`
- No `WEB_DOMAIN` split — one env var flip

**Nginx:**
- `kronk.info` — serves the Mastodon app (currently 301s to
  `mastodon.kronk.info/home`)
- `mastodon.kronk.info` — redirects back to `kronk.info` for backwards-
  compatibility with old bookmarks and the APK's existing links
- TLS covers both hosts through the transition (likely already does)

**Database rewrites** (Rails runner, one-shot):
- `accounts.uri`, `accounts.url` — for local accounts, swap the host
- `statuses.uri`, `statuses.url`, `statuses.in_reply_to_uri` for local
  statuses
- Verify `media_attachments` URL storage (usually derived at read time
  from `LOCAL_DOMAIN`, not stored)
- `preview_cards`, `custom_emojis`, `web_push_subscriptions` — anywhere
  the host is baked in
- Instance record

**Client-facing / code:**
- Email `from:` address (`notifications@mastodon.kronk.info` →
  `notifications@kronk.info`)
- Contact email defaults
- Hardcoded host strings in views, mailers, i18n (survey pass needed)
- The APK link in `application_helper.rb` is already `kronk.info/kronk.apk`

**Post-flip:**
- `Rails.cache.clear` (same gotcha as the version prerelease work today —
  `Api::V2::InstancesController#show` uses `render_with_cache`)

## Sequencing

1. **Discovery pass** — enumerate every hardcoded `mastodon.kronk.info`
   reference in code + DB. Draft the SQL/Ruby update script from the
   findings.
2. **Test on shadow** — shadow stays at `shadow.kronk.info`, so the
   test is really about the DB rewrite script working correctly, not
   about proving the whole flip end-to-end.
3. **Nginx staging** — set up the new nginx config, verify it works
   before the flip.
4. **Backup prod DB** — before any DB rewrite.
5. **Flip window** — `LOCAL_DOMAIN` update, DB rewrite, restart, cache
   clear, nginx swap.
6. **Manual QA** — feed, profile, RSS, `/about`, notifications, email,
   Android app.
7. **Cleanup PR** — sweep for any straggler hardcoded strings we missed.

## Open questions

- **Timing of the flip** relative to opening federation. Do it well
  before? Same milestone?
- **How long does `mastodon.kronk.info` redirect stay?** Forever?
  N months? Depends on where the old domain shows up (documentation,
  external mentions, APK metadata).
- **Do we want to reserve `@user@mastodon.kronk.info` handles** for the
  same accounts on the new host so incoming federation from anyone who
  cached the old identity Just Works? Or is that "not our problem"
  because we control who we federate with initially?
- **Email delivery** — `notifications@kronk.info` needs SMTP configured
  for `kronk.info`. Currently probably points at `mastodon.kronk.info`
  DKIM / SPF records.

## Notes / decisions log

- **2026-07-09** — Tal chose full migration (Option B) over WEB_DOMAIN
  split. Reasoning: pre-federation, simpler long-term.
- **2026-07-09** — Folded into 2.x rebuild rather than shipped
  standalone. Rebuild is the natural home; version 2.0.0 already
  reserved for it.
- **2026-07-09** — Post-migration: `mastodon.kronk.info` redirects to
  `kronk.info` (not taken offline). Preserves old bookmarks and existing
  APK links.
