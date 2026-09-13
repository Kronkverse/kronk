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

Production is running **1.7.4**, deployed 2026-08-14.

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
