# Kronk — Mastodon Fork

Kronk is a custom Mastodon instance at **mastodon.kronk.info**. This repo is a fork of [mastodon/mastodon](https://github.com/mastodon/mastodon) with custom features.

> **This file is the single source of truth for the Kronk contributor & agent workflow.** It is public. Do **not** put server IPs, SSH keys, deploy keys, droplet names, or credentials here — those live in the private infra runbook (see below). Every other instruction file (per-host, per-user) should link back here rather than restating it, so nothing drifts.
>
> **Where things live:**
>
> - **Workflow / build / korners / code rules** → this file (repo, normative).
> - **Infra topology, SSH keys, deploy mechanics, credentials, merge authority** → private infra runbook (mainframe: `/home/shared/infra.md`; portal: `/home/claude/CLAUDE.md`). Not in this public repo.
> - **Deeper reference** → `docs/` (`docs/kronk_korner_spec.md`, `docs/korners/adding_a_korner.md`, `docs/kronk_aesthetic_system.md`).

## Branch Strategy

| Branch          | Purpose                                                                                             | Deploy target              |
| --------------- | --------------------------------------------------------------------------------------------------- | -------------------------- |
| `main`          | Production (protected — PRs only, merged by the maintainer)                                         | mastodon.kronk.info        |
| `rebuild/2.0.0` | **Active 2.x integration branch — base your work here during the rebuild.** Auto-deploys to shadow. | shadow.kronk.info          |
| `staging`       | Retired auto-deploy branch. Manual override only via the `Auto-Deploy Staging` workflow_dispatch.   | shadow.kronk.info (manual) |

**Never commit directly to `main`, `rebuild/2.0.0`, or `staging`.** Always work on a branch and open a PR.

While the 2.0.0 rebuild is in progress, `rebuild/2.0.0` is the integration branch: base feature branches on it and open PRs against it. Once 2.0.0 ships, `main` resumes that role.

**Shadow reflects `rebuild/2.0.0` continuously** (2026-07-30). Every PR that merges into rebuild auto-deploys to https://shadow.kronk.info within ~2 minutes — you and every other contributor see the same integrated state. `staging` no longer auto-deploys on push; pre-merge previews are handled by the merge queue running your PR against the current tip.

## Contributor Workflow

### 1. Start from a branch

Branch off the **active integration branch** — `rebuild/2.0.0` during the 2.x rebuild (`main` otherwise):

```bash
git fetch origin
git checkout -b feature/my-change origin/rebuild/2.0.0
```

Use `feature/`, `fix/`, or `docs/` prefixes. Keep branches small — one feature or fix per branch. You are a **collaborator** on `Kronkverse/kronk` — push directly, no personal fork needed. (On the mainframe dev server, push/fetch auth is handled for you — see the infra runbook; you do not need a personal token.)

**Every branch starts from the integration tip. Do not stack PRs.** A stacked
PR — one branched off another open PR instead of `rebuild/2.0.0` — cannot survive
its parent merging. The parent lands as a **squash**, so the child still carries
the parent's original commits, the merge queue's rebase collides, and the child
is **silently ejected from the queue**: still open, still green, simply not
merging. Nothing tells you. Someone has to notice and rebase it, once per parent,
every time.

This cost real time on 2026-08-13: a four-deep stack was ejected twice, needing
manual re-rebasing both rounds, and each round looked like "queued" until someone
checked (`decisions.md` 2026-08-13).

- **Base each PR on `origin/rebuild/2.0.0`** and accept a little duplication in
  review over serialised, self-ejecting merges.
- **If work genuinely cannot compile without earlier work**, that is one PR, not
  two. Split by _reviewable unit_, not by commit tidiness.
- **If you stack anyway** (rare, and say so in the PR body), you own re-rebasing
  after each parent merges — and **"I queued it" is not "it landed."** Re-check
  `gh pr view <N> --json state` after the parent lands.

### 2. See work on shadow

You don't push to `staging` any more. Merged PRs land on shadow automatically because `rebuild/2.0.0` auto-deploys. To preview a PR before it merges, open the PR against `rebuild/2.0.0` and let the merge queue (see §3) run it against the current tip; the queue's status checks give you the same "does it build / does it pass tests" signal that a shadow deploy used to. If a specific PR really needs to be seen live on shadow before it merges (rare — e.g. visual regressions the CI can't catch), a maintainer can trigger the `Auto-Deploy Staging` workflow manually from the GitHub Actions tab after pushing the branch to `staging`. Shadow will revert to the rebuild tip on the next merge.

#### Shadow gotchas (read before debugging a "failed" deploy)

A deploy usually **succeeded** even when it looks like it didn't:

- **Don't trust the version string as a deploy signal.** `https://shadow.kronk.info/api/v1/instance` reports `version` from an env var (`MASTODON_VERSION_PRERELEASE`) and is cached — not from the deployed code. Verify a deploy by the **actual route/feature** (does your new page render?) or the deployed git ref, never the version endpoint. (The deploy now re-stamps this and clears the cache, so it should track the code going forward.)
- **The DB is a symlink between two databases.** Shadow has a classic DB and an isolated rebuild DB; the active one is chosen by a symlink that is now **persistent across deploys**. If you "can't log in," the DB is likely pointed at the wrong one — see the infra runbook.
- **Pushing to `main` resets shadow.** A push to `main` redeploys the production line onto shadow, reverting it off the rebuild. After any `main` merge, the next merge into `rebuild/2.0.0` restores it.

### 3. Open a PR, land it via the merge queue

Open a PR from your feature branch to the **active integration branch** (`rebuild/2.0.0` during the rebuild; `main` for production). **Contributors never merge to `main` — the maintainer does.** `rebuild/2.0.0` PRs land through the **GitHub merge queue** (enabled 2026-07-30): after review, hit "Add to merge queue" instead of "Merge". The queue serialises merges, rebases each PR against the tip, re-runs the required check (`lint` — see **CI gates**), then merges. (PRs no longer bump a version number — see **Body** — so there's nothing left to collide on.) Trust the queue: don't force-merge past it.

**Landing a PR — and two traps.** Once it's reviewed and **`lint` is green**, land it via "Add to merge queue" in the UI, or `gh pr merge <N> --squash --auto` from the CLI. But:

- **Don't use the "Enable auto-merge" button.** It's not the same as "Add to merge queue": it arms a plain `merge` (the queue requires **squash**) and, if `lint` is **red**, it silently _parks_ the PR — armed, but never entered into the queue, with no error, indefinitely. If "Add to merge queue" is greyed out, that **is** the signal your `lint` is red — fix the lint, don't reach for auto-merge.
- **Don't mass-arm failing or stale PRs.** A stack of armed-but-blocked PRs looks like a jammed queue but is not _in_ the queue at all — each is just waiting on its own red check, holding nothing up. Get `lint` green on each first, then queue it.

A red required check means the PR simply **cannot** enter the queue — that's the gate working, not a bug. The only thing that overrides it is a maintainer's admin **"merge without waiting for requirements"**, which is also the only way an unchecked PR could actually land — so it's used deliberately, never as a shortcut.

**Title:** a short, descriptive summary of the change. (The rebuild version is no longer a per-PR number — see **Body** below — so the title describes the work, not a version.)

**Body must include:**

- **What changed** — files and behaviour affected
- **Why** — the problem being solved
- **How to test** — concrete steps on shadow
- **Dependencies** — migrations, other PRs, or deploy steps required
- **No version bump** — `lib/kronk/version.rb` is a static milestone (`2.0.0-alpha`) that PRs do **not** touch. This removed the constant collisions on the version line between concurrent PRs. A build is identified by its git ref / commit (appended from `SOURCE_COMMIT`), not a hand-bumped number. Bump `MILESTONE` only at a real milestone (e.g. when `2.0.0` ships).

### 4. Clean up

Delete your branch after it merges.

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

## CI gates — `lint` is the only merge gate (run it before pushing)

**Only `lint` gates the merge queue** on `rebuild/2.0.0` (since 2026-08-02; was
`lint` + `test` before that). The rspec suite (`test (.ruby-version)`) and every
other check still run on **every PR** — so keep them green — but they **no
longer block the merge**: the queue merges as soon as `lint` is green, even
while `test` is still running. Rationale: the ~15-min Ruby suite _was_ the
queue's latency, so taking it off the merge path cut merges from ~15 min to ~2;
regressions are caught at PR-review time instead (see
`docs/rebuild/decisions.md`). The suite is flaky under parallel CI, so
**`rspec-retry`** retries a failed example up to 3× **on CI** (not locally, so
flakes still surface in development).

> **A green queue is not a green suite.** Because `test` no longer gates, a red
> `test` will **not** stop your PR merging. Read your PR's `test` result before
> you queue it — the queue won't do it for you.

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

- **Never commit directly to `main`, `rebuild/2.0.0`, or `staging`** — always via a branch + PR.
- **Contributors never merge to `main`** — the maintainer merges in the GitHub UI.
- **Never edit, push to, or close another contributor's branch or PR** — read for context only.
- Merge authority, deploy authority, and the rebuild-branch policy are defined in the private infra runbook — do not infer them from names or hosts.

## Useful Links

- Instance: https://mastodon.kronk.info
- Shadow: https://shadow.kronk.info
- Issues: https://github.com/Kronkverse/kronk/issues
