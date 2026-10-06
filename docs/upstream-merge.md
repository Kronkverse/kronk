# Catching up with upstream Mastodon

First measured 2026-09-17 against `origin/main` at 2.0.0 "Rose"; the figures
below were re-measured on 2026-10-05 against the `shadow` tip (`231cca937`).
`main` and `shadow` are both still based on v4.5.9, so the commit counts are the
same from either.

## Why this is not optional

**Rails 8.1.3 arrives in Mastodon 4.6.0** (4.6.8 ships 8.1.3.1). We run
8.0.5.1 (`Gemfile.lock`), and Rails 8.0.x
reaches end of life on **2026-10-07**. So "merge upstream" and "do the Rails EOL
work" are the same job, and it has a date on it.

This is also the thing that makes the version marker honest. `lib/mastodon/version.rb`
says 4.5.18 because the security backport took every security commit up to that
release — but not its bugfixes, dependency bumps, or the Rails move. Finishing
the merge is how that number stops needing a paragraph to explain it.

## Where we actually are

Measured 2026-10-05 (`git rev-list --count origin/shadow..<tag>`; migrations are
files added under `db/migrate` and `db/post_migrate` since v4.5.9).

|                                     |                                                       |
| ----------------------------------- | ----------------------------------------------------- |
| last full upstream merge            | **v4.5.9** (`git rev-list origin/shadow..v4.5.9` = 0) |
| security content                    | backported to **4.5.18** (#1900)                      |
| upstream commits we lack, to v4.6.8 | **1,937**                                             |
| upstream commits we lack, to v4.7.2 | **2,290**                                             |
| new upstream migrations, to v4.6.8  | **34**                                                |
| new upstream migrations, to v4.7.2  | **61**                                                |

Upstream has released since the first measurement: **v4.5.19**, **v4.6.9** and
**v4.7.3** (all 2026-10-01). v4.6.9 is 1,961 commits ahead of us. v4.5.19 is
109 commits past v4.5.18, our backport point, and includes account-deletion,
sign-up and moderation-permission fixes (see Open).

## The conflict surface, measured not guessed

Upstream changed 2,632 files between 4.5.9 and 4.6.8. Kronk has changed 2,219
since 4.5.9 (`git diff --name-only v4.5.9 origin/shadow`). **645 files are in
both sets.** (The 2026-09-17 figures were 1,861 and 350; the method then is not
recorded, so compare the conflict counts below rather than these.)

A trial merge of `v4.6.8` into `shadow` (2026-10-05) produces **357 conflicts**
(345 into `main` on 2026-09-17):

| kind | count | what it means                                                     |
| ---- | ----- | ----------------------------------------------------------------- |
| `UU` | 285   | both edited the same file — the real work                         |
| `DU` | 55    | upstream edited a file **we deleted** — resolve as "stay deleted" |
| `UD` | 13    | we edited a file upstream deleted                                 |
| `AA` | 4     | both added the same path                                          |

So about a fifth of the count resolves almost mechanically.

### Where the 285 real conflicts are

| area                      | files    |
| ------------------------- | -------- |
| `app/javascript/mastodon` | 127      |
| `config/locales`          | 65       |
| `spec`                    | 21       |
| `app/views`               | 10       |
| `app/lib`                 | 8        |
| `app/models`              | 7        |
| everything else           | < 6 each |

### The encouraging part

**Kronk's own surfaces barely appear.** Profile, nudges, kommons, settings and
the walkthrough are new files upstream has never seen, so they do not conflict
at all. Of the frontend conflicts, only `features/ui` (10) and
`features/home_timeline` (4) touch areas we rewrote.

The rest are _inherited_ Mastodon code where we hold a small delta. That makes
most resolutions "take upstream, re-apply our change" rather than reconciling
two competing rewrites — which is the difference between a hard merge and an
impossible one.

The 65 locale conflicts are largely mechanical, and the override convention
(`config/locales/kronk/overrides.yml`) means our strings are not tangled into
upstream's file in the first place.

## Recommended shape

**Go to 4.6.8 first, not 4.7.2.**

- It clears the Rails EOL deadline, which is the only part with a date.
- It stops at a known-good upstream release rather than the newest thing.
- 353 fewer commits and a smaller conflict set to review.
- Whether to stop at 4.6.8 or take 4.6.9 (24 more commits, same Rails) is open.
- 4.7 then becomes a separate, calmer exercise with the Rails work already
  behind it.

### Method

1. **Branch from `shadow`**, not `main` — the integration branch is
   where multi-step work belongs, and shadow deploys from it.
2. **Resolve in passes, by category**, committing each so the diff stays
   reviewable: the 51 deletions first (fastest, highest certainty), then
   locales, then models/controllers, then the frontend.
3. **Run the 34 migrations against a clone of production**, the same way the
   cutover rehearsal did. Upstream migrations have not met Kronk's schema
   before, and the rebuild dropped tables upstream still expects.
4. **Deploy to shadow and live on it** for a few days before it goes near
   `main`. This is far larger than anything in the cutover.

### What to watch

- **Tables the rebuild dropped.** `terms_of_services` took shadow down once
  already when production-line code met a rebuild schema. Upstream migrations
  may assume tables we removed.
- **Upstream's new profile header.** Upstream deleted the 953-line
  `features/account_timeline/components/account_header.tsx` (which Kronk's
  profile had already deleted) and replaced it with a new
  `components/account_header/` directory of about 2,600 lines. Because those are
  new files, they merge in without a conflict. Nothing in Kronk renders them;
  decide whether to keep or delete them rather than let them arrive unnoticed.
- **The version marker** moves to a real 4.6.8 when this lands, and
  `SoftwareUpdateCheckService` should then stop needing its prerelease-stripping
  note.

## Not in scope here

4.7.x (do it after), and the korner-doctor warnings, which are unrelated.

## Open

- **v4.5.19.** It came out after our 4.5.18 backport and carries account
  deletion, sign-up (`SSO_ACCOUNT_SIGN_UP`) and moderator-permission fixes.
  Decide whether to backport it now or let the 4.6 merge bring it in.
- **4.6.8 or 4.6.9** as the target (see Recommended shape).
- **Rails 8.0 reaches end of life on 2026-10-07.** Until this merge lands we run
  an unsupported Rails, and Brakeman's EOL check (`CheckEOLRails`) is skipped in
  `config/brakeman.yml`, so nothing in CI will say so.
