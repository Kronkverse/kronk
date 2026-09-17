# Cutover — taking the rebuild live

> **Status:** first draft, 2026-09-13. Written from the state of
> `rebuild/2.0.0` and the live server on that date; every number in it was
> measured rather than estimated. Nothing here has been executed.
>
> The implementation plan's Phase 14 covers the release mechanics — flip the
> flags, bump the version, open one PR. This document covers what happens to
> the **data and the people already on the server** when that PR lands, which
> Phase 14 does not.

## What the cutover actually is

Two separate acts, and the gap between them is the thing people get wrong:

1. **`rebuild/2.0.0` merges into `main`.** This ships nothing. There is no
   production auto-deploy.
2. **Somebody runs `~/deploy-production.sh` on the kronk droplet.** That is
   the deploy: it resets `/home/mastodon/live` to `origin/main`, bundles,
   precompiles, runs `db:migrate` against `mastodon_production`, re-stamps the
   version label, and restarts.

Shadow is not a rehearsal for step 2. Shadow runs from `/home/mastodon/staging`
against **a different database** (`mastodon_staging_rebuild`). Every migration
in this release has only ever run against that database — one with no
Mastodon-era history in it. That is why the finding below was invisible until
someone counted rows in production.

## The size of the job

Measured on 2026-09-13:

| Thing             | Production |
| ----------------- | ---------- |
| Users             | 103        |
| Local accounts    | 108        |
| Statuses          | 2,608      |
| Media attachments | 1,936      |
| Migrations to run | 108        |

Production is running **1.7.4**, deployed 2026-08-14. (108 migration files
exist on the rebuild branch and not on `main`, but seven are already applied
here, so 103 actually run — measured, not counted.)

At this size the migrations take seconds and the deploy is minutes. **This is
not a scale problem. It is a correctness problem** — every risk below is about
what the migrations _mean_ for existing rows, not how long they take.

## The old private messages — decided, and built

`20260828020000_fold_retired_visibilities` collapses the Mastodon
follower-model visibilities into the Kronk reach ladder. As originally
written it mapped `direct` → `mates`, which is harmless on an instance with
no history and wrong on one with any.

Against production's actual rows:

| Today      | Count   | Becomes                                                      | What that does                                                                                       |
| ---------- | ------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `public`   | 2,334   | unchanged                                                    | —                                                                                                    |
| `direct`   | **161** | **migrated into the messenger**, original set to `self_only` | See below.                                                                                           |
| `unlisted` | 87      | `self_only`                                                  | **Narrows to nothing.** Those posts leave everyone else's view; only the author sees them.           |
| `private`  | 26      | `mates`                                                      | Roughly equivalent — followers-only becomes mutuals-only. A follower who is not a mate loses access. |

**What was wrong with folding `direct`.** A direct status is visible to the
author and the people mentioned in it. As `mates` it is visible to every
mutual connection of the author — and the person it was actually sent to
loses access unless they happen to be a mate. 161 old conversations would
have opened to people who were never party to them.

**What happens instead (Tal, 2026-09-13: "we should be able to migrate it over
somehow").** `ImportLegacyDirectMessages` carries each one into the messenger:
find the local accounts it was addressed to, find or create the 1:1
conversation with each, insert the message with its original text, timestamps
and up to five attachments, then set the original status to `self_only`.
Nothing is deleted — a status carrying more attachments than a message can
hold keeps all of them in the original, which its author can still open. The
messenger's attachment cap moved from four to five to fit them better.

They are worth the trouble: 161 messages spanning February 2024 to a week
before this was written, 110 of them replies, across 18 people. Conversations,
not residue.

`unlisted` → `self_only` still deserves its own nod: 87 posts become invisible
to everyone but their author. That is probably right — an unlisted post was
"public but not promoted", which has no Kronk equivalent — but it is content
disappearing from other people's view, and it should be a decision rather than
a side effect.

## What the korners already hold

Only four korners have any production data at all. Everything else —
Albutts, Moments, Map, Krews, Wachuneed, Art, Cinema, Kronikles, Karporn,
Huddle, Klot, Inflow — arrives with empty tables, so there is nothing to
migrate and nothing to lose.

| Korner        | On production                             | What happens                                                                                                                                                               |
| ------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Kalendar**  | 10 events, 30 RSVPs, 161 invitations      | Carries over. Events gain a slug; their links to huddles, albums and Booth sets move to the shared attachment table **before** the old columns drop, so the links survive. |
| **Booth**     | 15 sets                                   | Carries over; each set gains a feed projection, and its event link moves the same way.                                                                                     |
| **Kommons**   | 21 proposals, 19 votes                    | Carries over. Every local account also receives its 10-token starting balance. See the anchoring note below.                                                               |
| **Kuestions** | 4 questions, 10 answers (stored as posts) | Imported into the v2 tables by `ImportLegacyKuestions`; the original posts stay in the feed, linked to the new rows.                                                       |

**The 21 proposals have no node anchor.** In 2.0 a proposal is anchored to a
Directory node — that is how it appears on the page about a particular part of
Kronk. Production's `proposals` table has no such column; it arrives with the
rebuild, empty. So all 21 remain readable on the Kommons board and appear on
no node page.

Deliberately left that way. Anchoring them somewhere uniform would file a
proposal about Kalendar under Kommons, which is worse than unfiled — the board
is the primary surface and they are all still on it. Twenty-one is few enough
to file by hand afterwards if it matters.

## The gate every existing user walks into

All 103 users have `thresholds_version = NULL`, and
`ApplicationController#require_crossed_thresholds!` redirects every signed-in
HTML request to `/auth/thresholds` until they cross. API and OAuth paths are
exempt, so apps keep working; the web app does not.

This is the intended welcome rather than an accident — existing members are
meant to be brought into 2.0 through the ceremony rather than grandfathered
past it. Two things have to be true on the day:

- The ceremony and the first-run walkthrough are both finished and tested by
  someone who has never seen them.
- Everyone is told it is coming. 103 people hitting an unexplained interstitial
  is a support problem; 103 people expecting a welcome is a launch.

## Configuration that changes meaning at cutover

**`config/feature_flags.yaml` has a `production:` block** that turns on
`feed_scope_enforced` and `status_nudges`. Its own comment explains why that is
safe: _"Real production is deployed from `main`, which does not carry this
config."_ **At cutover `main` becomes the rebuild, and that sentence stops
being true.** Both flags switch on for real users in the same breath as
everything else. Decide whether that is wanted, then correct the comment either
way — it will mislead the next person otherwise.

**Search stays off unless someone provisions it.** `SEARCH_BACKEND` defaults to
`null`; production's env file carries 27 variables and none of them are
`MEILISEARCH_URL` or `MEILI_MASTER_KEY`. Phase 14.1 says flip the default to
`meilisearch` — that cannot happen until Meilisearch is actually running on the
droplet. Leaving search on the null adapter for 2.0.0 is a valid choice; flipping
the default without the service is not.

**Federation is already locked down.** `LIMITED_FEDERATION_MODE=true` is set on
production today, so the go-live decision on federation is already in force. No
action, just don't undo it.

**Version.** `lib/kronk/version.rb` is a static `2.0.0-alpha` milestone that PRs
no longer bump. Phase 14.2 bumps it to `2.0.0`. The deploy script re-stamps
`MASTODON_VERSION_PRERELEASE` from `Kronk::Version` before restarting, so the
displayed version follows automatically — that part is already solved.

## `main` holds nothing the rebuild needs

`main` is four commits ahead of the merge base (1.7.1 through 1.7.4), which
looks like a conflict risk and is not. Checked file by file: the three
substantive fixes — the 15,000-character post limit, the justified media
gallery, and photo descriptions in the media modal — are all already present in
`rebuild/2.0.0`. What differs is one comment in `.gitignore` and
`components.scss`, which the rebuild has deliberately rewritten.

So the merge direction is clean. Re-check this on the day rather than trusting
it, because `main` can move.

## Rehearsal

Do this before the real thing, and do it on the kronk droplet:

1. `pg_dump mastodon_production` to a file on that host.
2. Restore it into a scratch database on the same host.
3. Point a checkout of `rebuild/2.0.0` at the scratch database and run
   `db:migrate`.
4. Record, before and after: the visibility histogram, row counts per major
   table, and the count of users with `thresholds_version` set.
5. Check the numbers against the predictions in this document. The visibility
   table above is the assertion.
6. Drop the scratch database and delete the dump.

**Not on shadow, and not off the host.** A production dump contains 103 real
people's private posts. Shadow is a different database on a box other
contributors can reach; copying production's history there to test a migration
would be a privacy decision dressed as a technical one. Keep the data where it
already lives, and delete the copy when the rehearsal is done.

## The domain move

`mastodon.kronk.info` → `kronk.info`, which the implementation plan has always
had "coordinated with the merge".

**Most of the danger in changing a Mastodon instance's domain is federation,
and Kronk's federation is closed.** Verified 2026-09-15 on both production and
shadow: zero remote accounts, zero remote follows, zero known servers, nothing
in the delivery queues. Nobody out there holds a `mastodon.kronk.info` handle
for one of our users, so nothing breaks when the handle changes, and
`LIMITED_FEDERATION_MODE=true` goes into production's env at cutover to keep it
that way (env, not code — reversible the day a decision is made to open up).

This is settled. It does not need re-deriving each time the domain, the handles
or the URLs come up — every question of that shape has the same answer, which
is that there is no other server involved.

What is already true:

- `kronk.info` and `www.kronk.info` both resolve to the droplet and serve
  HTTPS today. Both currently 301 to `https://mastodon.kronk.info/home`. The
  move is largely **reversing that redirect**.
- Local links are **generated, not stored**.
  `ActivityPub::TagManager#uri_for` builds from the routes for anything local,
  so every permalink follows `LOCAL_DOMAIN` the moment it changes. Accounts
  hold no stored `uri` or `url` at all.
- **Media is unaffected** — files live in Spaces, addressed by their own host.
- No OAuth application and no webhook has the old domain in it.

What to do:

1. Point nginx at the app for `kronk.info`, and turn `mastodon.kronk.info`
   into the 301 — the exact inverse of today's configuration. **Both vhosts are
   written and staged** at `kronk:/home/claude/cutover/` with a README; they
   need a root install (`claude` cannot write `/etc/nginx`), so this is the one
   step of the day that is not ours to run.
2. Set `LOCAL_DOMAIN=kronk.info` in production's env.
3. Precompile and restart. Links regenerate.
4. Optional tidy: 1,950 local statuses carry a stored `uri` of the form
   `https://mastodon.kronk.info/users/<name>/statuses/<id>`. Nothing reads it
   for a local status, so this is housekeeping rather than a step:
   `UPDATE statuses SET uri = replace(uri, 'mastodon.kronk.info', 'kronk.info') WHERE local = true`.
5. **Keep `mastodon.kronk.info` redirecting indefinitely.** Twenty-one
   existing posts link to it, and so will bookmarks, old emails and anything
   anyone has pasted elsewhere.

### Email does NOT follow the domain — leave `SMTP_FROM_ADDRESS` alone

**`SMTP_FROM_ADDRESS` stays `Kronk <notifications@mastodon.kronk.info>` at
cutover.** It is a separate env var from `LOCAL_DOMAIN`, so it does not move on
its own; the risk is somebody tidying it up to match the new domain. Don't.

Found by sending one, 2026-09-17. SparkPost refuses mail from any domain not
configured in the account:

```
550 5.7.1 Unconfigured Sending Domain <shadow.kronk.info>
```

and the DNS says `kronk.info` is not one of them:

| domain                | SPF                                                     | verdict                                                  |
| --------------------- | ------------------------------------------------------- | -------------------------------------------------------- |
| `mastodon.kronk.info` | `include:sparkpostmail.com`                             | the configured sending domain — works                    |
| `kronk.info`          | `include:_spf.protonmail.ch` only, DMARC `p=quarantine` | SparkPost mail would be rejected, or quarantined as spam |
| `shadow.kronk.info`   | none                                                    | rejected outright                                        |

`kronk.info` is set up for Tal's ProtonMail, not for the instance. So moving the
from-address without doing the DNS work first means **no password-reset mail on
the day the domain move signs all 106 members out** — the worst possible
combination, and silent, because the failure is a 550 in a worker log.

Keeping the old from-address costs nothing: `mastodon.kronk.info` is staying
alive as a permanent redirect anyway, so the address keeps resolving and
replies keep working.

**To tidy it up later** (not cutover work): add `kronk.info` as a sending domain
in SparkPost, publish the DKIM record it issues, and extend SPF to
`v=spf1 include:_spf.protonmail.ch include:sparkpostmail.com ~all` so Tal's own
mail on the domain keeps passing. Only then move `SMTP_FROM_ADDRESS`.

Two consequences worth expecting rather than discovering:

- **Everyone is signed out.** Session cookies are scoped to the old host. On
  the new domain nobody is logged in — which lands people at a sign-in, then
  at the thresholds ceremony. That is a coherent relaunch shape, but it should
  be deliberate.
- **Push notifications need re-subscribing.** 205 web push subscriptions are
  bound to the old origin. Nobody loses anything permanently; they just stop
  arriving until each browser subscribes again on the new domain.
- **The Android app stops working, and is meant to.** It is pinned to the old
  host and predates the reach ladder, so it would post at the wrong visibility
  rather than fail honestly. `Kronk::LegacyAppGate` answers its API calls with
  410 and a message pointing at the web app; a replacement app is a separate
  piece of work. The gate is behind the `legacy_app_gate` flag with an
  `LEGACY_APP_MIN_VERSION` escape hatch, so it can be lifted the moment there
  is a build worth letting through.

**Do it on a different day from the data migration** if there is any choice.
Two changes at once means two suspects when something misbehaves.

## Rehearsal — run 2026-09-13, against `552b45a0f3`

Done once, exactly as described above: production dumped (36 MB, half a
second, read-only), restored into a scratch database on the same host,
migrated, measured, then the database and the dump deleted. Production was
untouched throughout and stayed up.

**It worked.** `db:migrate` exited 0. **103** migrations ran — not 108: seven
of the rebuild-only migration files are already applied on production, from
when Kommons v1 shipped there. Total migration time **2.7 seconds**; the
slowest single one was the private-message import at 0.9s.

Every prediction in this document held:

| Checked                                 | Expected                     | Got                                                                                 |
| --------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------- |
| Users / local accounts                  | 103 / 108, unchanged         | 103 / 108                                                                           |
| Statuses                                | 2,609, none lost             | 2,609                                                                               |
| Media attachments                       | 1,936, none lost             | 1,936                                                                               |
| Events / RSVPs / Booth sets / proposals | 10 / 30 / 15 / 21, unchanged | 10 / 30 / 15 / 21                                                                   |
| `direct` + `unlisted` → `self_only`     | 161 + 87 = 248               | 248                                                                                 |
| `private` → `mates`                     | 26                           | 26                                                                                  |
| Private messages imported               | 161 statuses                 | 165 messages (8 went to more than one person), 9 with no local recipient left alone |
| Conversations created                   | —                            | 36, dated 2024-02-16 → 2026-09-06, none showing as today                            |
| Messages carrying media                 | 18                           | 18                                                                                  |
| Kuestions imported                      | 4 questions, 9 answers       | 4 and 9, all four linked to their posts                                             |
| Token balances granted                  | one per local account        | 107 × 10 tokens                                                                     |
| Users yet to cross the thresholds       | all of them                  | 103                                                                                 |

**What it also proved, which nobody had checked:** the rebuild's code cannot
boot against an un-migrated production schema — `rails runner` dies on
`Account`'s `kommunity_discoverability` enum, because the column arrives with
the migrations. `db:migrate` is a rake task and rake does not eager-load, so
the deploy path is fine; but any `rails runner` or console against production
between the code landing and the migrations finishing will fail. Do not reach
for one to check on things mid-deploy.

**What it did not test:** whether anything looks right. It exercises the data,
not the software.

## Shadow as the working environment

From 2026-09-14 shadow runs the rebuild against **a copy of production**, so
the remaining work happens against real content rather than fixtures. What
that means in practice:

- **Shadow holds real people's private posts.** It is publicly reachable and
  anyone with a production password can sign in — the same audience as
  production, but on a server built for testing. Keep that in mind before
  wiring anything experimental into it.
- **Outbound mail is off.** `SMTP_DELIVERY_METHOD=test` in
  `.env.production.rebuild`; mail is collected in memory and never sent.
  Without it, shadow's live SparkPost account would email 103 real people from
  "Kronk Staging". **Do not remove it while this data is here**, and check it
  survived after any change to that file.
- **Shadow's own accounts are gone** — kronky, snowtal and the contributors'
  logins were replaced by production's account list. The previous database is
  dumped at `/home/mastodon/shadow-pre-clone-backup.sql` on the droplet and can
  be restored to put shadow back as it was.
- **The copy drifts.** Production keeps moving; shadow does not follow. Re-clone
  when the gap starts to matter — the whole procedure is the rehearsal above,
  restoring into `mastodon_staging_rebuild` instead of a scratch database, with
  the services stopped for the swap.
- **Nothing made on shadow survives the cutover.** Production is the source of
  truth on the day. Test posts, test messages and anything else created here is
  discarded when the real thing is migrated.
- **The home timeline lives in Redis, not the database.** A clone copies
  Postgres only, so every timeline arrives empty until
  `bin/tootctl feeds build` regenerates them. This is a cloning artifact and
  not a cutover risk: the feed key format is identical on both branches and the
  production deploy never touches Redis.

## Search in production

Search works on shadow, and shadow runs on the **same droplet** as production,
so this is configuration rather than new infrastructure. Meilisearch has been
running there as a systemd unit since 2026-07-15, enabled at boot, bound to
`127.0.0.1:7700` and behind a master key. Production has simply never pointed at
it: `SEARCH_BACKEND` is unset, so it takes the null adapter and gets
account and hashtag search from Postgres, with no full-text post search.

**Do not simply copy shadow's three env vars across.** Both environments would
then share one set of indexes, and shadow currently runs on a _clone of
production_ — the document ids are the same ids. A post deleted on shadow would
delete the real production document, and shadow's test posts would appear in
production's search results. `MEILISEARCH_INDEX_PREFIX` exists to prevent that.

Production's `.env.production` needs:

```
SEARCH_BACKEND=meilisearch
MEILISEARCH_URL=http://localhost:7700
MEILI_MASTER_KEY=<same key shadow uses — kronk:/home/mastodon/.credentials/>
```

leaving `MEILISEARCH_INDEX_PREFIX` unset so production takes the default
`kronk_`. Shadow moves to `MEILISEARCH_INDEX_PREFIX=kronk_shadow_` and is
rebuilt, which takes seconds at its size.

Then, after the deploy:

```
bin/tootctl kategories seed      # see below — this has never been run here
bin/rake kronk:search:rebuild
```

**`tootctl kategories seed` first, and it is not only a search step.**
Kategories are curated `Tag` rows, and `Tag.curated.count` on production is
**zero** — the seeder has never been run there. `GET /api/v1/kategories`
returns `Tag.curated`, which is what fills the composer's kategory picker, so
without this the whole Kategories feature ships **empty**: no suggestions to
tag a post with, and nothing for kategory search to find. The seeder reads
`config/kategory_defaults.yaml` (21 entries) and is idempotent.

Run the seeder _before_ the rebuild so the freshly-curated tags are in the
index the rebuild walks.

**`rebuild`, not `reindex`.** Reindexing only ever _adds_ documents — it writes
one per record it walks and removes nothing — so anything already sitting in
the `kronk_*` indexes from shadow's use of them would survive untouched.
`rebuild` empties each index first.

Sizing is not a concern: the whole index is 38 MB across eleven indexes
(2,622 statuses, 330 accounts) on a clone of production, and Meilisearch has
been running alongside everything else on this droplet for two months.

If Meilisearch is down or misconfigured, the adapter swallows the error and
returns an empty result set, so search degrades to "no results" rather than
500ing the page.

## Rollback

Take a dump immediately before the deploy. Not the rehearsal dump — a fresh one.

Rolling back the **code** is `git reset --hard <previous main sha>`, precompile,
restart. Minutes.

Rolling back the **database** is a restore from that dump. The migrations are
not reversible in practice: five of them drop tables or rename them
(`album_photo_comments`, `album_photo_froths`, `groups` → `krews` and its two
join tables, three foreign-key columns), and `db:rollback` across 108
migrations is not a procedure anybody should attempt on live data.

So the decision on the day is not "roll back the migration", it is "restore the
dump and lose whatever happened since". Which means: **short window, announced,
and somebody watching.** Everything written after the deploy is lost if the
restore is used, so the sooner the call is made, the cheaper it is.

## Order of the day

1. Announce the window. Say the welcome ceremony is coming.
2. Settle the `direct` visibility mapping. Nothing else proceeds until this is
   decided.
3. Settle the production feature flags.
4. Run the rehearsal. Compare against both tables above — the visibility
   counts and the korner counts.
5. Confirm `main` still holds nothing the rebuild needs.
6. Bump the version to `2.0.0`; regenerate the changelog (Phase 14.2).
7. Fresh dump.
8. Merge the single `rebuild/2.0.0` → `main` PR.
9. Run `~/deploy-production.sh`.
10. Watch: does a page render, does a post send, does the ceremony appear, does
    the visibility histogram match the rehearsal.
11. Tell people it is done.

## Open questions

- **`unlisted` → `self_only`.** 87 posts stop being visible to anyone but
  their author. Probably right, currently undiscussed.
- **Do `feed_scope_enforced` and `status_nudges` turn on for real users at
  2.0.0**, or does the `production:` block come out first?
- **Meilisearch on the droplet for 2.0.0**, or does search stay on the null
  adapter until 2.1?
- **The domain move.** The implementation plan has
  `mastodon.kronk.info` → `kronk.info` "coordinated with the merge". Doing a
  data migration and a domain move on the same day means two suspects when
  something breaks.
- **Who is awake.** A rollback is a database restore, so the window needs
  someone able to make that call quickly.
