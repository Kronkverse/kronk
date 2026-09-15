# Production readiness audit — 2026-09-16

Run against production, shadow and the branch on 2026-09-16, at the point
where the rebuild is "about ready to ship".

This does **not** restate [`cutover.md`](cutover.md), which already covers the
rehearsal, the thresholds gate, the rollback shape and the order of the day.
What follows is what that document does not cover, what has drifted since it
was written, and what a fresh look at the machine turned up.

Everything here was measured, not assumed. Where something is fine, it says so
plainly so nobody spends a second checking it again.

---

## Blockers — these stop the deploy being a good idea

### 1. The Android app crashes on the new visibility values

**The single most serious finding, and the cutover doc does not mention it.**

The migrations remap existing posts onto the reach ladder: `direct` +
`unlisted` → `self_only` (248 posts), `private` → `mates` (26). Every post
composed after cutover carries the new values too. `REST::StatusSerializer`
serialises them raw — it masks only upstream's `limited` → `private`.

The app cannot read them. `StatusPrivacy` knows four constants:

```java
@SerializedName("public")  PUBLIC(0),
@SerializedName("unlisted") UNLISTED(1),
@SerializedName("private")  PRIVATE(2),
@SerializedName("direct")   DIRECT(3);
```

GSON maps an unrecognised string to **null**, and
`FooterStatusDisplayItem.onBind` then does:

```java
Drawable d=itemView.getResources().getDrawable(switch(item.status.visibility){
    case PUBLIC, UNLISTED -> R.drawable.ic_boost;
    case PRIVATE -> isOwn ? R.drawable.ic_boost_private : R.drawable.ic_boost_disabled_24px;
    case DIRECT -> R.drawable.ic_boost_disabled_24px;
}, ...);
```

A `switch` on a null enum throws `NullPointerException`, and the expression has
no `default`, so even a non-null unknown constant would throw. This is on the
timeline binding path: **the app crashes rendering the feed**, for every user,
as soon as one post carries a new value.

The app's last commit is 2026-05-30 and no branch knows `mates`, `orbit` or
`self_only`. APKs are sideloaded from `kronk.info/kronk.apk`, so there is no
store update to push and no guarantee anyone installs a new one.

Three ways out, none free:

- **Compatibility mapping in the serializer** — send `mates` and `orbit` as
  `private`, `self_only` as `direct`, and carry the true value in a new field
  the web client reads. Old apps keep working and see a sensible approximation.
  Costs a parallel field and a web-client change.
- **Ship an app release first**, with the new constants and a `default` branch,
  and delay cutover until enough people have it. There is a
  `feature/auto-update` branch which may make this cheaper than it sounds.
- **Accept it** — tell app users to expect a broken app until they update.
  Honest, but it means the relaunch day is the day the app dies.

Whichever is chosen, `FooterStatusDisplayItem` wants a `default` branch
regardless. An exhaustive switch over a server-controlled enum is a crash
waiting for any future value.

### 2. `deploy-production.sh` cannot build the rebuild

The production deploy script runs `bundle install`, then
`assets:precompile`. It never runs `yarn install`. `deploy-shadow-rebuild.sh`
does — that is how shadow has been building this branch all along.

Production's `node_modules` dates from 2026-07-19. The rebuild moved to Vite 7
and added packages; precompiling against July's tree either fails outright or
produces assets from stale dependencies. **Add the `yarn install` line before
cutover day**, not during it.

### 3. There is no database backup, and rollback depends on one

Rollback for this deploy is "restore the dump" — 113 migrations, five of which
drop or rename tables, are not reversible in practice.

On the droplet: no `.sql` dumps except `shadow-pre-clone-backup.sql` (4.4 MB,
shadow's own pre-clone state, not production), no dump cron visible, no backup
tooling installed beyond `pg_dump` itself. If DigitalOcean snapshots are
enabled at the provider level, confirm it — from inside the box there is
nothing.

The plan's "take a fresh dump" is one command, and it is currently the only
thing standing between a bad migration and permanent loss. It should be a
written step with a verified restore, not an instruction to remember.

---

## Decide before the day

### 4. Disk is at 80%

`/` is 50 GB with **9.6 GB free**. `public/packs` is already 545 MB across
18,022 files and `node_modules` is 810 MB — a rebuild deploy adds another
dependency tree and another set of packs before the old ones are cleared.
It probably fits. "Probably fits" is a poor property for a step that runs
between the migrations and the restart.

Run `assets:clean` (or prune old packs) first, and check free space after the
`yarn install` rather than after the deploy has failed.

### 5. The rehearsal is stale

It ran on 2026-09-13 against `552b45a0f3`: 108 rebuild-only migrations, 103
applied, 2.7 seconds. Since then the branch has taken **three more
migrations** — `create_roses`, `backfill_mates_count`,
`backfill_top_korners_profile_sections` — and the count is now **113**.

Two of those are mine, from today. `backfill_mates_count` rewrites
`account_stats` for every account; `backfill_top_korners_profile_sections`
touches profile sections. Neither is slow, both are new since anyone measured
anything. The doc's own step 4 says re-run the rehearsal; that is still right.

### 6. Shadow is not testing production's configuration

Shadow's env carries seven variables production lacks:

```
SEARCH_BACKEND  MEILISEARCH_URL  MEILI_MASTER_KEY
SMTP_DELIVERY_METHOD  REDIS_URL  SINGLE_USER_MODE  GITHUB_REPOSITORY
```

Two of those matter:

- **Search.** Shadow runs Meilisearch; production has no search service, so it
  runs the null adapter. Every search path exercised on shadow is a path
  production has never run.
- **Mail.** Shadow has `SMTP_DELIVERY_METHOD=test` — mail is collected in
  memory and never sent. Production sends for real, to 103 people. No rebuild
  mail has ever actually left a server. Whatever the cutover triggers by email,
  its first real send will be to everyone at once.

### 7. `main`'s CI has been dead since July

Every test job on `main` fails at _Load database schema_, before a single spec
runs, because `db/schema.rb` is missing ten migrations that exist in
`db/migrate/`. It has failed this way on main's own commits since at least
2026-08-14.

Consequences: the `rebuild/2.0.0` → `main` PR cannot be validated by CI on the
target branch, and this is a fair part of why four upstream security releases
went unnoticed. Regenerating `schema.rb` from a fully-migrated database is a
small PR and worth doing before the merge that matters.

### 8. Still open, still needed

- **#1861** — imported private messages arrive unread; sixty-three on one
  account. This is a cutover-day experience fix and it is not merged.
- Ten other open PRs against `rebuild/2.0.0`, four of which (`#1854`, `#1841`,
  `#1839`, `#1837` — Settings work) have **no CI results at all**, which means
  they cannot enter the queue and do not look broken either.
- `unlisted` → `self_only` takes 87 posts out of public view. The cutover doc
  lists it as "probably right, currently undiscussed". It is still undiscussed.
- The `production:` block in `config/feature_flags.yaml` turns on
  `feed_scope_enforced` and `status_nudges` the moment `main` becomes the
  rebuild. Its comment explaining why that is safe stops being true on the same
  day.

---

## The domain move

Configs for both vhosts are written, syntax-tested and staged at
`kronk:/home/claude/cutover/` with a README covering install order, rollback
and post-checks. They are **not installed** — `claude` has no root on the
droplet, by design. See the 2026-09-16 entries in
[`decisions.md`](decisions.md) for the full reasoning; the three things that
would have bitten:

- The apex is **not empty** — `/var/www/kronk.info` serves ~105 MB including
  the APK download, per-branch builds under `/dev/`, `/app`, `/branding` and
  `/events`. The new vhost keeps them.
- The shared nginx upstreams live **inside** the old vhost and have to move to
  `conf.d/` before two hosts can use them.
- `ALTERNATE_DOMAINS=mastodon.kronk.info` must be set **before** the reload, or
  Rails rejects every request still arriving with the old Host header — which
  is every phone.

And the old host must **proxy** the API rather than redirect it, for the same
reason as blocker 1: the app talks to whatever domain its session was created
with, and a 301 turns its POSTs into GETs.

---

## Verified fine — do not spend time re-checking these

| Checked           | State                                                                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Federation        | **Closed.** `limited_federation_mode=true`, 0 allowed domains, 0 relays. Settled — see decisions.md.                                                    |
| Ruby              | Droplet 3.4.7, repo asks 3.4.7.                                                                                                                         |
| Node / Yarn       | Droplet v20.19.6 and Yarn 4.10.3; repo asks `>=20` and `yarn@4.10.3`.                                                                                   |
| Sidekiq queues    | Unit runs `sidekiq -c 25` with no `-q`, so it reads `config/sidekiq.yml`. New queues and schedulers arrive with the code; no unit change.               |
| Media             | `S3_ENABLED` is set — media lives in Spaces, addressed by its own host. Unaffected by the domain move.                                                  |
| Web push keys     | `VAPID_PRIVATE_KEY` / `VAPID_PUBLIC_KEY` present. Subscriptions survive a deploy; only a **domain change** invalidates them (205 of them).              |
| New gems          | `meilisearch` and `request_store` — both pure Ruby, no native build.                                                                                    |
| Security          | All upstream security commits through 4.5.18 are on both lines (1.7.5 / #1900).                                                                         |
| 2 GB video limit  | In the source on both lines, no longer a hand-edit.                                                                                                     |
| `main` vs rebuild | `main` is 6 commits ahead; all of it (security backport, video limit, version marker) is already in the rebuild. Re-check on the day — `main` can move. |

---

## Operational note from the rehearsal, worth repeating

The rebuild's code **cannot boot against an un-migrated production schema** —
`rails runner` dies on `Account`'s `kommunity_discoverability` enum. `db:migrate`
is a rake task and does not eager-load, so the deploy path is fine, but a
console or `rails runner` between the code landing and the migrations finishing
will fail. Do not reach for one to check on things mid-deploy.
