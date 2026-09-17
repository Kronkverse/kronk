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

**Fixed 2026-09-16.** `~claude/bin/kronk-db-dump.sh` on the droplet takes a
`pg_dump -Fc` of production, refuses to rotate if the result is implausibly
small, verifies the archive by reading its table of contents, and keeps 14
days. Cron runs it at 17:15 UTC — 3:15am Sydney. Tested under a stripped
cron-like environment, because that is where scripts like this usually die.

**The restore was tested, not assumed:** restored into a scratch database
with **0 pg_restore errors**, and every count matched live — 315 accounts,
2,628 statuses, 103 users, 1,936 media attachments, 6,939 notifications —
then the scratch database was dropped.

_Correction to this audit's first draft, which said there were no dumps:_
there is one, `mastodon_production_2025-05-07.dump` (2 MB) in
`/home/mastodon/backups`, alongside a 1.4 GB uploads tarball and some systemd
units from the same day. It is a one-off snapshot from **May 2025**, 17 months
stale — taken during setup, not a backup system. The rotation glob is
deliberately written not to match it.

**Still open:** every copy lives on the droplet it protects. That is a backup
against a bad migration, not against losing the droplet. An off-box mirror is
a decision for Tal rather than something to arrange unilaterally, because it
means copying 103 people's data to another host. Worth confirming whether
DigitalOcean snapshots are enabled at the provider level too — that is not
visible from inside the box.

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

## What shipping without search actually costs

The search decision (item 8) was left open as a question. It is answerable
without making it, so here is the answer, to make the decision an informed one.

**Shipping 2.0 with no search service is not a downgrade — it is exactly what
production does today.** `Kronk::Search.backend` reads `SEARCH_BACKEND` and
defaults to `null`, and `Api::V2::SearchController` only takes the Kronk search
path when that value is `meilisearch`. Everything else falls through to the
upstream `SearchService`, which is what production has always run.

What users get either way:

|                                                | null adapter (production today)              | Meilisearch |
| ---------------------------------------------- | -------------------------------------------- | ----------- |
| Find a person                                  | yes — Postgres-backed `AccountSearchService` | yes         |
| Find a hashtag                                 | yes — database                               | yes         |
| Full-text post search                          | **no**                                       | yes         |
| Events, proposals, booth sets, listings, krews | **no**                                       | yes         |

**The new search UI does not break on the null path.** This was the real
risk — production would be running the 2.0 frontend against the null backend,
a combination that has never run anywhere, because shadow has had Meilisearch
throughout. It holds up: `SearchService#default_results` always returns
`{ accounts: [], hashtags: [], statuses: [] }`, so the three collections
`result_list.tsx` reads without a null guard are always arrays, and the five
Kronk collections it reads are each guarded with `?? []`. The page renders its
`kronk_search.results.empty` state rather than throwing.

So the decision is about **whether full-text post search is part of 2.0**, not
about whether search works. Deferring it costs nothing that exists today.

## `check-i18n` — now green (was red since 2026-06-22)

Fixed rather than worked around. Worth recording what it was, because the
obvious fix made things worse and the first attempt here did exactly that.

`i18n-tasks` assumes one key lives in exactly one file, which is the opposite
of what the override file is for. Running `i18n-tasks normalize` turned the
check green by **deleting the overridden keys from upstream `en.yml`** and
**stripping the override file's explanatory header** — moving Kronk's strings
into upstream's file, defeating the convention.

The fix was to move the file out of the tools' sight instead:
`config/locales/kronk_overrides.en.yml` → **`config/locales/kronk/overrides.yml`**.
`i18n-tasks` read globs want `.en.` in the name, and `repo:check_locales_files`
globs only one directory deep, so neither sees it now. Rails globs
`**/*.{rb,yml}` and still loads it last, so the overrides still win. Verified:
1,920 keys in `en.yml` before and after, no value changed.

That unblocked the four later steps, which had **never run** — the workflow
stops at the first failure:

- **86 unused strings.** Three were ours and genuinely dead (a duplicate
  `kronk.thresholds.cta_enter` shadowed by `arrival.cta_enter`, a leftover
  `restart`, a `signup.account.step_counter`) — deleted. The other 83 are
  upstream strings for screens the rebuild replaced (terms of service and
  privacy are markdown in `content/kronk/` now; the sign-up flow is the
  thresholds ceremony). Those are ignored, not deleted: deleting means editing
  ~70 locale files and every edit becomes a conflict on the next upstream merge.
- **Two missing English strings.** `notification_mailer.nudge.subject` and
  `.title` existed in `en-GB.yml` only, for a mailer that does not exist —
  `NotificationMailer` has no `nudge` method and there is no nudge view.
  Removed rather than copied across.
- **Eight inconsistent interpolations.** Kronk's English rewrite dropped
  variables the translations still carry. **Nothing breaks at runtime** —
  `UserMailer` still passes `instance:` and i18n ignores unused arguments.

### One finding worth a decision

The last item means **non-English users still receive Mastodon-branded email**.
The branding sweep covered English only; the ~70 translated copies of the
confirmation and welcome mail still say "Mastodon" and still read as upstream's
copy. Not a blocker and not a lint fix — a copy call for whoever owns
localisation.

## CodeQL — now green (was 25 alerts, one of them critical)

Worked through rather than explained away. What each one turned out to be:

**Fixed, because they were ours** (#1945, #1946):

- Two workflows declared no `permissions`, so they inherited the repository
  default. Both only read the repo and now say so.
- `Auth::UsernameAvailabilityController` carried
  `skip_before_action :verify_authenticity_token`. The route is a **GET**, and
  Rails never verifies a token on GET or HEAD — the line did nothing except
  read as "CSRF is off here", which is the line someone copies onto a POST
  later.
- The ISO-8601 duration regex keeps its language and loses its ambiguity
  (`\d++`). Ruby 3.2+ memoises matches so the naive form was already linear
  (20,000 digits in 4ms); the possessive form does not depend on that.
- Three excerpt builders used `.replace(/<[^>]*>/g, '')`, which is **wrong on
  ordinary posts**: it eats from the first `<` to the next `>`, so "a < b and
  c > d" lost its middle, and entities came out raw. Replaced with one
  DOMParser helper that also drops script/style contents — `textContent`
  includes them, so an excerpt of such a post read as source code.
- `linkHref` put a profile field straight into an `href`. Bare-domain
  prefixing already made `javascript:` inert, but as a side effect rather than
  a decision; it now parses and checks the scheme.
- Two `innerHTML` writes in `signup.ts` became `replaceChildren`.

**Dismissed, with the reasoning recorded on each alert:**

- The one **critical** was ours and a false positive — the flagged mass
  assignment permits four closed keys and the open inner hash is the jsonb
  document stored in a jsonb column, not an attribute bag.
- Five upstream Mastodon findings where the flagged `href`/`src` is
  server-set instance config from `initial_state` (`sso_redirect`, mascot,
  status page, source URL) — operator configuration, not user input.
- The Devise `password=` pattern, which writes bcrypt to `encrypted_password`
  (the `users` table has no clear-text column).
- `img.src = URL.createObjectURL(file)` — a browser-generated `blob:` URL for
  the file the user just picked.

Design prototypes are excluded from analysis via `.github/codeql/codeql-config.yml`.

### Why 25 could pile up unseen

**`codeql.yml` and `check-i18n.yml` were both filtered to `main` and
`stable-*`.** Neither ran on a single rebuild PR in the whole rebuild — the
first time either saw this code was the release PR to `main`. Both now include
`rebuild/2.0.0`. Worth remembering as a shape: a long-lived integration branch
silently opts out of every workflow that lists its branches.

## Open questions the green pass turned up

None of these block the cutover. All three want a decision rather than a fix.

**Four design prototypes are publicly reachable.** `booth-preview.html`,
`inflow-preview.html`, `map-preview.html` and `wachuneed-preview.html` sit in
`public/` — about 143 KB — so they will be served from `kronk.info` at launch.
Nothing links to them (only a code comment in `Kronk::GeoCoarsen` mentions
one), and `map-preview.html` pulls Leaflet from cdnjs. They were left in place
rather than moved, because someone may have the URLs; moving them to
`docs/prototypes/` is a one-line change whenever that is wanted.

**Non-English users still get Mastodon-branded email.** The branding sweep
covered English only. The ~70 translated copies of the confirmation and welcome
mail still say "Mastodon" and still read as upstream's copy. Nothing breaks —
`UserMailer` passes the interpolations either way — but a French or Chinese
user's first email from the relaunched instance names the wrong product.

**`korners-doctor` reports 27 real issues** and is deliberately non-blocking.
That was the right call while the rebuild moved, but the count has not been
worked down and nothing forces it to be.

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

---

## The worklist

Every finding above, as work. **Status here is the source of truth** — update
it in this file as things land, so the next session (or the next person) picks
up from a list rather than re-running the audit.

| #   | Item                                                                   | Whose                                                    | Status                                                                                                                   |
| --- | ---------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 1   | `yarn install` in `deploy-production.sh`                               | claude (script is claude-owned)                          | **done** — plus a sourcemap prune and a major-version guard                                                              |
| 2   | `default` branch + new constants in the app's `StatusPrivacy` switches | claude (`kronk-app`, `development` branch)               | **done**                                                                                                                 |
| 3   | Visibility compatibility strategy for existing installs                | Tal decided, claude built                                | **done** — decision was "point people at the web app"; `Kronk::LegacyAppGate` answers the old app with 410 and a message |
| 4   | Database dump before cutover, with a verified restore                  | claude                                                   | **done** — `kronk:~/bin/kronk-db-dump.sh`, restore verified. Take a fresh one on the day                                 |
| 5   | Reclaim disk (`assets:clean`, prune old packs)                         | claude                                                   | **done**                                                                                                                 |
| 6   | Regenerate `db/schema.rb` on `main` so its CI runs                     | claude                                                   | **done by the merge itself** — see note below                                                                            |
| 7   | Re-run the rehearsal against the current tip                           | claude                                                   | **done** 2026-09-16 — see below                                                                                          |
| 8   | Search + mail: shadow's config vs production's                         | **Tal decides** search; claude exercises mail            | **blocked on decision** — the last one that is                                                                           |
| 9   | Install the domain-move nginx configs                                  | **Tal / root** — staged at `kronk:/home/claude/cutover/` | **blocked on access**                                                                                                    |
| 10  | Land or close the open cutover PRs                                     | claude                                                   | **done** — #1861 merged; the four Settings PRs are not blockers (below)                                                  |
| 11  | Android CI (dead since 22 June, so no app could be built)              | claude                                                   | **done**                                                                                                                 |
| 12  | `en.json` vs the source strings — `check-i18n` red since June          | claude                                                   | **done** — #1935                                                                                                         |

**On item 6.** No separate PR was needed. `main`'s `db/schema.rb` sits at
`2026_05_30_000001` while its migrations run to `20260709120000`, which is why
every test job there dies at _Load database schema_ and why the Historical data
migration test fails at a 2016 upstream migration with
`relation "settings" does not exist`. The release branch's schema is at
`2026_09_16_100000` — exactly its latest migration — so the merge that ships
2.0.0 replaces the stale file and `main`'s CI starts running again as a side
effect. PR #1925 is superseded by that and can be closed.

**On item 10.** `#1861` (imported messages arriving read) merged 2026-09-16.
The four Settings PRs — `#1854`, `#1841`, `#1839`, `#1837` — are **not cutover
blockers**, which is worth stating plainly because "native Settings work is
unmerged" sounds like it should be. They replace Rails pages that still exist
and still work: `config/routes/settings.rb` still draws `/settings/export`,
`/settings/imports` and the CSV export routes, `/filters` is still routed, and
the SPA's `/settings/data` page links out to exactly those endpoints. Nobody
loses filters or the ability to download their data at cutover; the PRs make
those flows native instead of hand-offs. All four are ~90 commits behind and
conflicting, so they want a rebase whenever they are picked up again.

`#1675` was closed as superseded — its proposal (retire followers/following in
favour of mates) was accepted and built, and the doc it edits already carries
the decided version.

### The three decisions only Tal can make

Two of the three are now answered.

1. ~~**Which visibility strategy**~~ — **answered.** Point people at the web
   app; `LegacyAppGate` makes the old app say so instead of failing. A
   replacement app is separate work.
2. **Does search ship in 2.0.0** (item 8) — which means Meilisearch on the
   droplet — or does it stay on the null adapter until 2.1? **Still open, and
   now the only decision holding anything up.** Shadow has run Meilisearch
   throughout, so every search path exercised there is a path production has
   never run.
3. ~~**`unlisted` → `self_only`**~~ — **answered**, 87 posts move out of public
   view and that is intended. The `production:` feature-flag block is also
   settled: all three flags are correct for day one, and their comments were
   rewritten (#1937) because one of them explained itself as shadow-only
   "because `main` does not carry this block" — a sentence that becomes false
   the moment the release merges.

Still needing Tal but not a decision: **one real email address** to send the
first genuine mail to. Shadow has `SMTP_DELIVERY_METHOD=test`, so no rebuild
mail has ever actually left a server; production sends to 103 people.

### Order, if it helps

Everything that could be done without Tal is done. What is left, in order:

1. **Answer the search question** (item 8). It is the only open decision.
2. **Send one real email** from the rebuild to a real address, before 103
   people get the first one at once.
3. **Install the nginx vhosts** (item 9) — needs root, staged and documented.
4. **Merge the release PR** (#1932) and deploy by hand. Nothing auto-deploys to
   production; `~/deploy-production.sh` is the only path.
5. **Take a fresh dump immediately before**, not the rehearsal one.

---

## Rehearsal — run 2026-09-16 against `a8b98d57ca`

Same method as 2026-09-13: fresh production dump, restored into a scratch
database on the same host, migrated with the rebuild code, measured, then the
database dropped. Production untouched and up throughout. The scratch target
was confirmed before migrating (`db:version` reporting
`database: kronk_rehearsal_tip`), because the one mistake that would matter
here is migrating shadow — or production — by accident.

**It worked.** `db:migrate` exit 0. **106 migrations in 9 seconds.**

That matters more than it looks: **this morning's tip would have failed this
run**, aborting on `BackfillTopKornersProfileSections` with the database
half-migrated (fixed in #1928). A rehearsal from three days ago would have
said everything was fine.

| Checked                             | 2026-09-13   | Now          |                                                            |
| ----------------------------------- | ------------ | ------------ | ---------------------------------------------------------- |
| Users / local accounts              | 103 / 108    | 103 / 108    | match                                                      |
| Statuses                            | 2,609        | **2,628**    | equals production exactly — nothing lost                   |
| Media attachments                   | 1,936        | 1,936        | match                                                      |
| Events / Booth sets / proposals     | 10 / 15 / 21 | 10 / 15 / 21 | match                                                      |
| `direct` + `unlisted` → `self_only` | 248          | **256**      | equals production's 256 unlisted+direct — every one mapped |
| `private` → `mates`                 | 26           | 26           | match                                                      |
| `direct` / `unlisted` left behind   | —            | 0 / 0        | none missed                                                |
| Nudge conversations / messages      | 36 / 165     | 36 / 165     | match                                                      |
| Kuestions / answers                 | 4 / 9        | 4 / **15**   | see below                                                  |
| Users yet to cross the thresholds   | 103          | 103          | match                                                      |

Every difference is production having lived for three days, not the migration
behaving differently — and the two that matter were checked against
production's live counts rather than assumed.

**The answers difference, explained.** Production holds 22 answer-typed posts;
the import creates 15. The other **7 have no `in_reply_to_id` at all** —
answer-typed posts attached to no question. The import only adopts answers
that reply to a question, so those 7 stay as ordinary posts. Nothing is lost;
they simply do not become Kuestions answers.

**Measured for the first time:**

|                                     |                               |
| ----------------------------------- | ----------------------------- |
| `roses` table created               | yes                           |
| Accounts with a Mates count         | 95                            |
| Stored Mates counts equal the graph | **true, every local account** |
| Profile sections backfilled         | 12 rows across 9 accounts     |

The Mates row is that morning's backfill doing its job on real data: before
it, all 95 read zero. Profile sections landing on 9 of 108 accounts is
expected — the backfill gives an account rows only where it has korner
content to show.
