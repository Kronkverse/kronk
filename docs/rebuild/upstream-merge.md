# Catching up with upstream Mastodon

Measured 2026-09-17, against `origin/main` at 2.0.0 "Rose".

## Why this is not optional

**Rails 8.1.3 arrives in Mastodon 4.6.0.** We run 8.0.5.1, and Rails 8.0.x
reaches end of life on **2026-10-07**. So "merge upstream" and "do the Rails EOL
work" are the same job, and it has a date on it.

This is also the thing that makes the version marker honest. `lib/mastodon/version.rb`
says 4.5.18 because the security backport took every security commit up to that
release — but not its bugfixes, dependency bumps, or the Rails move. Finishing
the merge is how that number stops needing a paragraph to explain it.

## Where we actually are

|                                     |                                                     |
| ----------------------------------- | --------------------------------------------------- |
| last full upstream merge            | **v4.5.9** (`git rev-list origin/main..v4.5.9` = 0) |
| security content                    | backported to **4.5.18** (#1900)                    |
| upstream commits we lack, to v4.6.8 | **1,937**                                           |
| upstream commits we lack, to v4.7.2 | **2,290**                                           |
| new upstream migrations, to v4.6.8  | **34**                                              |
| new upstream migrations, to v4.7.2  | **61**                                              |

## The conflict surface, measured not guessed

Upstream changed 2,632 files between 4.5.9 and 4.6.8. Kronk changed 1,861 over
the same span. **350 files are in both sets.**

A trial merge of `v4.6.8` into `main` produces **345 conflicts**:

| kind | count | what it means                                                     |
| ---- | ----- | ----------------------------------------------------------------- |
| `UU` | 278   | both edited the same file — the real work                         |
| `DU` | 51    | upstream edited a file **we deleted** — resolve as "stay deleted" |
| `UD` | 12    | we edited a file upstream deleted                                 |
| `AA` | 4     | both added the same path                                          |

So a third of the count resolves almost mechanically.

### Where the 278 real conflicts are

| area                      | files    |
| ------------------------- | -------- |
| `app/javascript/mastodon` | 127      |
| `config/locales`          | 65       |
| `app/models`              | 6        |
| `app/views/auth`          | 5        |
| everything else           | < 5 each |

### The encouraging part

**Kronk's own surfaces barely appear.** Profile, nudges, kommons, settings and
the walkthrough are new files upstream has never seen, so they do not conflict
at all. Of the frontend conflicts, only `features/ui` (15) and
`features/home_timeline` (3) touch areas we rewrote.

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
- 4.7 then becomes a separate, calmer exercise with the Rails work already
  behind it.

### Method

1. **Branch from `rebuild/2.0.0`**, not `main` — the integration branch is
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
- **`account_header.tsx`** is the shape of the whole merge: upstream changed
  953 lines in a file the profile rebuild **deleted**. Keep it deleted.
- **The version marker** moves to a real 4.6.8 when this lands, and
  `SoftwareUpdateCheckService` should then stop needing its prerelease-stripping
  note.

## Not in scope here

4.7.2 (do it after), and the 27→11 korner-doctor warnings, which are unrelated.
