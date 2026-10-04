# Kronk — Mastodon Fork

Kronk is a custom Mastodon instance at **kronk.info** (the production host is moving from `mastodon.kronk.info` to `kronk.info` as part of the 2.0 rebrand — see `docs/rebuild/cutover.md`). This repo is a fork of [mastodon/mastodon](https://github.com/mastodon/mastodon) with custom features.

> **This file is the single source of truth for the Kronk contributor & agent workflow.** It is public. Do **not** put server IPs, SSH keys, deploy keys, droplet names, or credentials here — those live in the private infra runbook (see below). Every other instruction file (per-host, per-user) should link back here rather than restating it, so nothing drifts.
>
> **Where things live:**
>
> - **Workflow / build / korners / code rules** → this file (repo, normative).
> - **Infra topology, SSH keys, deploy mechanics, credentials, merge authority** → private infra runbook (mainframe: `/home/shared/infra.md`; portal: `/home/claude/CLAUDE.md`). Not in this public repo.
> - **Deeper reference** → `docs/` (`docs/kronk_korner_spec.md`, `docs/korners/adding_a_korner.md`, `docs/kronk_aesthetic_system.md`).

## Branches

| Branch                        | What it is                                        | Who writes to it                              | Deploys to                         |
| ----------------------------- | ------------------------------------------------- | --------------------------------------------- | ---------------------------------- |
| `main`                        | The release line. What production runs.           | Release ports only, merged by the maintainer. | `kronk.info`, by hand              |
| `shadow`                      | Integration. The sum of everyone's finished work. | Anyone, by PR through the merge queue.        | `shadow.kronk.info`, automatically |
| `feature/*` `fix/*` `chore/*` | Your own work in progress.                        | You. Push freely.                             | nothing, until you ask             |

**Work happens on `shadow`.** Branch off it, PR back into it. Every merge
reaches https://shadow.kronk.info within about two minutes, so the whole team
sees the integrated state as work lands. When shadow is tidy, it ships to
`main` as a release (see **Releasing** below).

**Never commit directly to `main` or `shadow`.** Always a branch plus a PR.

> `shadow` was called `rebuild/2.0.0` until 2026-10-04. The rebuild it was
> named after shipped to production on 2026-09-20, so the branch was renamed to
> the environment it deploys to. `staging` and `dev/<name>` are retired and
> deploy nothing. The systemd units and deploy scripts on the host are still
> named `staging` — that naming predates the shadow host and is load-bearing in
> the SSH forced command, so it stays. Branch and site are "shadow"; the
> service layer underneath is "staging".

## Contributor Workflow

### 1. Branch off shadow

```bash
git fetch origin
git checkout -b feature/my-change origin/shadow
```

Use `feature/`, `fix/`, `chore/` or `docs/` prefixes, and keep a branch to one
feature or fix. You are a **collaborator** on `Kronkverse/kronk` — push
directly, no fork needed. (On the mainframe dev server, push and fetch auth is
already set up for you; see the infra runbook. You do not need a personal
token.) **Delete your branch once its PR merges.**

**Every branch starts from the shadow tip. Do not stack PRs.** A stacked PR —
one branched off another open PR instead of `shadow` — cannot survive its
parent merging. The parent lands as a **squash**, so the child still carries the
parent's original commits, the merge queue's rebase collides, and the child is
**silently ejected from the queue**: still open, still green, simply not
merging. Nothing tells you.

This cost real time on 2026-08-13: a four-deep stack was ejected twice, needing
manual re-rebasing both rounds, and each round looked like "queued" until
someone checked (`docs/rebuild/decisions.md`, 2026-08-13).

- **Base each PR on `origin/shadow`** and accept a little duplication in review
  over serialised, self-ejecting merges.
- **If work genuinely cannot compile without earlier work**, that is one PR,
  not two. Split by _reviewable unit_, not by commit tidiness.
- **If you stack anyway** (rare, and say so in the PR body), you own
  re-rebasing after each parent merges — and **"I queued it" is not "it
  landed."** Re-check `gh pr view <N> --json state` after the parent lands.

### 2. Keep your branch current

Other people are landing work on `shadow` while you build. Before you open a PR,
and before you push again to an open one, check whether you are stale:

```bash
gh api repos/Kronkverse/kronk/compare/shadow...<your-branch> --jq .behind_by
# 0 means current. Anything else means rebase first.
```

To catch up:

```bash
git fetch origin
git rebase origin/shadow        # your commits move on top of everyone else's
# conflicts? fix them, git add, then git rebase --continue
git push --force-with-lease     # --force-with-lease, never a plain --force
```

`--force-with-lease` refuses the push if someone else has touched your branch in
the meantime. A plain `--force` would overwrite their work without telling you.

### 3. See your work

Three ways, cheapest first.

**Your branch plus green checks** is the default, and it needs no server. Every
PR runs the production build, the test build, the Ruby suite, lint and the
korners doctor. "Clean before it goes into shadow" means those are green — see
**CI gates** below.

**Run it locally** when you need to click through something interactively. See
**Building Locally**.

**Put your PR on shadow** when you need to see it live — a visual regression, a
layout question, anything CI cannot judge. Run the **Staging Deploy** Action
(Actions tab, `workflow_dispatch`) with your PR number. It deploys _shadow as it
currently stands, plus your PR_ — so you are looking at your change merged into
everyone else's work, not at your branch in isolation.

There is **one shadow host**, so this is a slot people take turns in. While your
PR is up there, the integrated view is displaced; the next merge into `shadow`
restores it. Say so before you claim it for a long session, and prefer the two
cheaper options above when they would answer your question.

#### Shadow gotchas (read before debugging a "failed" deploy)

A deploy usually **succeeded** even when it looks like it didn't:

- **Hard-reload before you believe what you see.** The service worker serves
  stale JS chunks, so an old bundle can survive a good deploy.
- **Don't trust the version string as a deploy signal.** `/api/v1/instance`
  reports `version` from an env var (`MASTODON_VERSION_PRERELEASE`) and is
  cached — not from the deployed code. Verify by the **actual route or
  feature**, or by the deployed git ref.
- **The DB is a symlink between two databases.** Shadow has a classic DB and an
  isolated rebuild DB; the active one is chosen by a symlink that persists
  across deploys. If you "can't log in", the DB is likely pointed at the wrong
  one — see the infra runbook.
- **Pushing to `main` does not touch shadow** (fixed 2026-08-13). It used to:
  two workflows redeployed the production line onto shadow on every main push,
  and because shadow keeps its database symlink on the **rebuild** DB, that left
  production code on a rebuild schema and every page 500'd.
  `auto-deploy-shadow.yml` is now the only workflow that reaches shadow without
  a human. If shadow ever comes back showing the production line, suspect a
  `push:` trigger has been added to one of the manual deploy workflows.

### 4. Open a PR into shadow

**Title:** what changes, from the reader's side, in a short imperative phrase.
No version number, no ticket prefix, no area tag.

```
Kalendar: edit button opens the event you clicked
Moments: standard reactions bar on the viewer
```

not `fix(kalendar): KAL-12`, and not `1.7.3`.

**Body:** four headings, every time.

- **What changed** — the files and the behaviour.
- **Why** — the problem being solved. If it is a bug, what the user saw.
- **How to test** — concrete steps on shadow, enough that someone else can
  follow them without asking you.
- **Dependencies** — migrations, other PRs, deploy steps, or "none".

Three habits worth keeping:

- **Name commits by their message**, not by pasting a SHA.
- **Say which checks you ran green**, so a reviewer knows what is covered.
- **Flag anything users will notice the moment it deploys** — a copy change, a
  re-prompt, a moved button. That belongs in the body, where the person pressing
  deploy will read it.

**Do not touch `lib/kronk/version.rb`.** See **Versioning**.

### 5. Land it via the merge queue

Once it is reviewed and the required checks are green, land it with "Add to
merge queue", or `gh pr merge <N> --squash --auto`. The queue serialises merges,
rebases each PR against the tip, re-runs the required checks, then merges —
which is what makes several people landing work at once safe. Trust the queue;
don't force-merge past it.

Two traps:

- **Don't use the "Enable auto-merge" button.** It is not the same as "Add to
  merge queue": it arms a plain merge (the queue requires **squash**) and, if a
  required check is **red**, it silently _parks_ the PR — armed, but never
  entered into the queue, with no error, indefinitely. If "Add to merge queue"
  is greyed out, that **is** the signal a required check is red. Fix the check;
  don't reach for auto-merge.
- **Don't mass-arm failing or stale PRs.** A stack of armed-but-blocked PRs
  looks like a jammed queue but is not _in_ the queue at all — each is just
  waiting on its own red check, holding nothing up.

A red required check means the PR simply **cannot** enter the queue. That is the
gate working, not a bug. The only thing that overrides it is a maintainer's
admin "merge without waiting for requirements", used deliberately and never as a
shortcut.

## Releasing: shadow to main

"When shadow is tidy, it ships" is a short repeatable sequence. Steps 1 and 5
are the ones people skip, and both cost real time when skipped.

1. **Check shadow is genuinely green** — not just the required checks, but the
   Ruby suite and the builds on the current tip. The queue does not gate on
   rspec (see **CI gates**), so this is where the rest gets enforced.

2. **Bump the version** on the release branch. This is the only place a version
   is ever bumped — see **Versioning**.

   ```bash
   git fetch origin
   git checkout -b release/2.0.2 origin/main
   git read-tree -u --reset origin/shadow   # take shadow's tree wholesale
   # edit MILESTONE in lib/kronk/version.rb, then commit
   ```

   The result is byte-identical to what shadow has been serving, which is the
   point: you ship the thing you tested.

3. **Open the PR into `main`.** Title is the version (`2.0.2`, or
   `2.1.0 "Thistle"`). Body is the roll-up: every PR included since the last
   release, the deploy range, any migrations, and — most important — **anything
   users will notice on deploy**.

4. **The maintainer merges it.** Contributors never merge to `main`.

5. **Deploy production by hand**, then **merge `main` back into `shadow`.** Both
   steps live in the infra runbook, which is where deploy authority is defined.
   The back-merge is not optional: releases are cut by taking shadow's tree
   wholesale, so a fix that ever lands on `main` alone would be silently
   reverted by the next release. With `main` merged in, that shows up as a real
   diff instead of disappearing.

There is **no auto-deploy to production**, and there should not be. Merging to
`main` ships nothing by itself.

## Versioning

Kronk has its own version in `lib/kronk/version.rb`, layered on the upstream
Mastodon version in `lib/mastodon/version.rb`. They are separate on purpose:
upstream's number is what federation and the update checker read, Kronk's is the
release train.

**One rule: the version is bumped once per production release, in the release
PR, and by no other PR.** That is what lets several people land work in parallel
without colliding on the version line, and it keeps releases legible.

| Change                                   | Becomes | Kind  |
| ---------------------------------------- | ------- | ----- |
| Bug fixes, copy, refactors               | `2.0.2` | patch |
| New korner, new subsystem, features      | `2.1.0` | minor |
| Breaking client changes, paradigm shifts | `3.0.0` | major |

Production is `2.0.0 "Rose"`. Release names belong to majors and minors; a patch
inherits its minor's name rather than earning a new one.

Builds are identified by their git ref and commit, not by a hand-bumped number —
`Kronk::Version` appends the short commit from `SOURCE_COMMIT` when the deploy
provides it.

**Never let a Kronk version suffix reach `Mastodon::Version`.** A prerelease
suffix there sorts _before_ the release it qualifies, which is what made the
upstream update checker read us as older than we are and mail every admin every
thirty minutes until 2026-09-20 (#1960).

## Building Locally

Requirements: Ruby >= 3.2 (repo uses 3.4.7), Node.js, Yarn, PostgreSQL, Redis.

```bash
bundle install
yarn install
RAILS_ENV=development bundle exec rails db:setup
RAILS_ENV=development bundle exec rails server
```

Asset precompilation (needed for CSS/JS changes):

```bash
NODE_OPTIONS=--max-old-space-size=2048 RAILS_ENV=production bundle exec rails assets:precompile
```

## Pre-commit Hooks

The repo uses **husky + lint-staged**. On commit it runs, on **changed files only**, the fast auto-fixers: **prettier** (formatting), **eslint --fix** (strict TS: no-unsafe-\*, no-non-null-assertion, prefer-nullish-coalescing), **stylelint --fix** (CSS), **rubocop -a**, **haml-lint -a**. These are quick — **let the hook run; do not `--no-verify` past it.** A bypass skips the whole hook including `prettier --write`, which is exactly how unformatted code reaches a PR and fails the `lint` merge gate (the parked-PR pattern of 2026-08-03).

**Type-checking is not in the pre-commit hook** (changed 2026-08-04). Project-wide `tsc --noEmit` can't be scoped to changed files, so running it on every `.tsx` commit was slow + needed ~2 GB + drove people to `--no-verify` (taking the formatters down with it). **CI runs the identical check** (`yarn typecheck` in `.github/workflows/lint-js.yml`), so nothing is lost. To catch type errors locally before pushing, run it yourself once:

```bash
NODE_OPTIONS="--max-old-space-size=2048" yarn typecheck
```

(On the mainframe dev server the memory flag is already set in `/etc/profile.d/mainframe.sh`.)

## CI gates

**Two checks gate a merge, on both `shadow` and `main`: `lint` and
`build (production)`.** Everything else still runs on every PR — keep them
green — but cannot block the merge.

Why those two. `lint` is fast (about 2.5 min) and catches the formatting and
style drift that would otherwise reach review. `build (production)` costs about
the same and runs alongside it, so requiring it adds roughly nothing to the
wait — and it closes a gap `lint` provably cannot see: **the eslint config does
not match `.jsx` files at all**, so a broken router can pass lint and
type-checking and still fail to build.

The Ruby suite (`test (.ruby-version)`) takes about 15 minutes, which _was_ the
queue's entire latency back when it gated; taking it off the merge path cut
merges from ~15 min to ~2 (see `docs/rebuild/decisions.md`, 2026-08-02). It is
now a **release** gate rather than a merge gate — step 1 of **Releasing**. The
suite is flaky under parallel CI, so **`rspec-retry`** retries a failed example
up to 3× **on CI** (not locally, so flakes still surface in development).

> **A green queue is not a green suite.** A red `test` will **not** stop your PR
> merging. Read it before you queue — the queue won't do it for you. And note
> `test` and `test (.ruby-version)` are _different jobs_: the first is
> JavaScript, the second is rspec. Check the one you mean.

`check-i18n` has been red for months and gates nothing. Two different failures
share that name, and only one is expected:

- `i18n-tasks check-normalized` is red **by design**. Normalising would strip
  the header from `config/locales/kronk/overrides.yml` and move Kronk's strings
  into upstream's `en.yml`, defeating the override convention that keeps our
  diff against upstream clean. Do not "fix" it by running `i18n-tasks normalize`.
- "missing strings in English JSON" is **real and fixable**: it means
  `app/javascript/mastodon/locales/en.json` was not regenerated after a PR added
  or removed copy. English still renders (react-intl falls back to the
  `defaultMessage` in source), so only translators are shortchanged — but it is
  worth clearing so the job becomes trustworthy again.

Read the log before assuming a red `check-i18n` is the expected one.

The pre-commit hook only runs against **staged** files, and `--no-verify`
skips it entirely — so lint drift reaches CI easily. A red `lint` check blocks
the merge queue, so run it locally before pushing rather than finding out in the
queue. The lint workflows run on **every** PR (no path filters), so `lint`
always reports even on a docs- or config-only change. `lint` is not one job but
several, each of which can fail independently and each of which CI runs:

- **`lint:js`** — ESLint, run with **`--max-warnings 0`** (so warnings fail the
  build too, e.g. `import/order`, `import/no-duplicates`).
- **`lint:css`** — Stylelint, including the Kronk custom rules (no raw hex —
  use a `--kronk-*` / `--semantic-*` token or `color-mix()`; `border-radius`
  must reference a `--radius-*` token; blank line before comments).
- **`format:check`** — Prettier (`prettier --check`). A file that is otherwise
  valid still fails here if it isn't Prettier-formatted.
- Plus **Ruby (RuboCop)**, **Haml (haml-lint)**, and **i18n** checks. The
  RuboCop/Haml-lint debt that previously blocked requiring `lint` has been
  cleared, so `lint` is now a required gate (see above).

Before pushing, run the ones that match your changes — not just ESLint:

```bash
yarn lint:js       # or: eslint <file> --max-warnings 0
yarn lint:css      # or: stylelint <file>
yarn format:check  # or: prettier --check <file>   (yarn format to auto-fix)
rubocop <file>     # Ruby (bare rubocop, not `bundle exec`, on the dev server)
```

Prettier and Stylelint can disagree: a long trailing comment on a
`--custom: var(...)` line makes Prettier wrap it, which then trips Stylelint's
`custom-property-empty-line-before`. Put the comment on its own line above the
property and re-run **both** — fixing one linter can trip the other.

## Korners Architecture

Kronk organises features into **korners**, each declared via a manifest under `config/korners/*.yaml`. Every korner mounts under the `/hub/<slug>` prefix and shares a common visual identity — the Kronk-purple palette — with differentiation coming from icon, name, and content.

> **Read [`docs/korners/korner_standard.md`](docs/korners/korner_standard.md) before editing anything under `config/korners/*.yaml`.** The Standard is normative — it defines what "the korner works" means across L1–L10, and `bin/tootctl korners doctor` enforces the ⚙︎-marked layers. Manifest edits that flunk the Standard land on shadow but break the gate.

### The framework

Full spec: `docs/kronk_korner_spec.md`. Reference implementation for adding a new korner: `docs/korners/adding_a_korner.md`. Visual system: `docs/kronk_aesthetic_system.md`.

Canonical sources of truth:

- `config/korners/*.yaml` — one manifest per korner (identity, resources, storage, security, feed projection, settings, etc.)
- `config/korners/reserved_slugs.yaml` — slugs a korner cannot claim
- `config/initializers/kronk_korner_registry.rb` — `Kronk::KornerRegistry` loads manifests at boot and warns on drift
- `app/javascript/mastodon/tokens/tokens.yaml` — design tokens generated into `_tokens.scss` by `bin/generate-tokens`

### Adding a new korner

1. **Author the manifest** at `config/korners/<slug>.yaml`. See `docs/korners/adding_a_korner.md` and `docs/kronk_korner_spec.md` §1.
2. **Ship the models, controllers, and UI.** Boot validator (`bin/tootctl korners doctor`) surfaces drift between manifest and reality.
3. **Wire feed projection** via `feed_projection.card` in the manifest.
4. **Theme with shared tokens** — reference `var(--accent)`. The Kronk-purple palette applies platform-wide; per-korner colour identity was retired in 2.0.0.

### Historical note

Prior to 2.0.0, Kronk used a "planet metaphor" — spaces themed from a `--space-color` custom property. That was retired to consolidate visual identity; `--space-color` and `planets.tsx` have been swept from the code.

## Custom Features (Kronk-specific)

Additions on top of upstream Mastodon: **Events/RSVP/invitations** (kalendar), **Booth** sets, **Kommons** proposals/votes/tasks/budget, **Kuestions** Q&A, **Groups**, **Nudges** activity feed, **InFlow** observations, sectioned **profile composer**, live room banners, custom welcome email, and custom logo/wordmark branding.

## Code Rules

- **Don't break federation.** Changes must remain compatible with other Mastodon instances.
- **Don't remove branding.** Kronk-specific branding (logo, wordmark, welcome email) is preserved.
- **Don't modify upstream files unnecessarily.** Keep diffs minimal to ease future upstream merges.
- **Never query user personal data** from the database.

## Hard Limits

- **Never commit directly to `main` or `shadow`** — always via a branch + PR.
- **Contributors never merge to `main`** — the maintainer merges in the GitHub UI.
- **Never edit, push to, or close another contributor's branch or PR** — read for context only.
- Merge authority, deploy authority, and the release policy are defined in the private infra runbook — do not infer them from names or hosts.

## Useful Links

- Instance: https://kronk.info
- Shadow: https://shadow.kronk.info
- Issues: https://github.com/Kronkverse/kronk/issues
