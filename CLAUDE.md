# Kronk — Mastodon Fork

Kronk is a custom Mastodon instance at **mastodon.kronk.info**. This repo is a fork of [mastodon/mastodon](https://github.com/mastodon/mastodon) with custom features.

## Branch Strategy

| Branch    | Purpose                                        | Deploy target       |
| --------- | ---------------------------------------------- | ------------------- |
| `main`    | Production (protected — PRs only)              | mastodon.kronk.info |
| `staging` | Shared integration — all work accumulates here | shadow.kronk.info   |

**Never commit directly to `staging` or `main`.** Always work on a branch.

## Building Locally

Requirements: Ruby >= 3.2 (repo uses 3.4.7), Node.js, Yarn, PostgreSQL, Redis.

```bash
bundle install
yarn install
RAILS_ENV=development bundle exec rails db:setup
RAILS_ENV=development bundle exec rails server
```

For asset precompilation (needed for CSS/JS changes):

```bash
NODE_OPTIONS=--max-old-space-size=2048 RAILS_ENV=production bundle exec rails assets:precompile
```

## Pre-commit Hooks

The repo uses **husky + lint-staged**. On commit, it runs:

- **prettier** — formatting
- **eslint** — strict TypeScript rules (no-unsafe-\*, no-non-null-assertion, prefer-nullish-coalescing)
- **stylelint** — CSS linting
- **tsc --noEmit** — full project type check

`tsc` runs project-wide and needs extra memory:

```bash
export NODE_OPTIONS="--max-old-space-size=2048"
```

This is already set in `/etc/profile.d/mainframe.sh` on the dev server.

## Korners Architecture

Kronk organises features into **korners**, each declared via a manifest under `config/korners/*.yaml`. Every korner mounts under the `/hub/<slug>` prefix and shares a common visual identity — the Kronk-purple palette — with differentiation coming from icon, name, and content.

### The framework

Full spec: `docs/kronk_korner_spec.md`. Reference implementation for adding a new korner: `docs/korners/adding_a_korner.md`.

Canonical sources of truth:

- `config/korners/*.yaml` — one manifest per korner (identity, resources, storage, security, feed projection, settings, etc.)
- `config/korners/reserved_slugs.yaml` — slugs a korner cannot claim
- `config/initializers/kronk_korner_registry.rb` — `Kronk::KornerRegistry` loads manifests at boot and warns on drift
- `app/javascript/mastodon/tokens/tokens.yaml` — design tokens (colours, spacing, motion) generated into `_tokens.scss` by `bin/generate-tokens`

### Adding a new korner

1. **Author the manifest** at `config/korners/<slug>.yaml`. See `docs/korners/adding_a_korner.md` for the field-by-field walkthrough and `docs/kronk_korner_spec.md` §1 for the full schema.
2. **Ship the models, controllers, and UI** as usual. Boot validator (`bin/tootctl korners doctor`) surfaces drift between the manifest and reality.
3. **Wire feed projection** by declaring `feed_projection.card` in the manifest — the framework's card registry picks up the adapter component.
4. **Theme with shared tokens** — reference `var(--accent)` for accents. The Kronk-purple palette applies platform-wide; per-korner colour identity was retired in 2.0.0.

### Historical note

Prior to 2.0.0, Kronk used a "planet metaphor" — each space orbited a coloured planet, and cards themed from a `--space-color` custom property. That metaphor was retired to consolidate visual identity. `--space-color` and its transitional alias were swept from the code in the 2.0.0 rebuild; `planets.tsx` remains as an accent-only compatibility shim until its remaining imports are removed.

## Custom Features (Kronk-specific)

These are additions on top of upstream Mastodon:

- **Events** — Event model, RSVP, invitations, events API (`app/controllers/api/v1/events_controller.rb`, `app/models/event.rb`)
- **Live room banners** and REST API-based lobby
- **Custom welcome email** with Kronk branding and deep links
- **Custom logo and wordmark** branding
- **Event share/unshare**, create event form, invite modal, activity feed

## Important Rules

- **Don't break federation.** Changes must remain compatible with other Mastodon instances.
- **Don't remove branding.** Kronk-specific branding (logo, wordmark, welcome email) should be preserved.
- **Don't modify upstream files unnecessarily.** Keep diffs minimal to make future upstream merges easier.

## Contributor Workflow

### 1. Start from a branch

Always branch off `staging`:

```bash
git fetch origin
git checkout -b feature/my-change origin/staging
```

Use `feature/`, `fix/`, or `docs/` prefix. Keep branches small — one feature or fix per branch. Push directly to `Kronkverse/kronk` — no personal fork needed, you are a collaborator.

### 2. Show work on shadow

Merge your branch into `staging` when you want it visible at https://shadow.kronk.info:

```bash
git checkout staging
git pull origin staging
git merge feature/my-change
git push origin staging
```

Any push to `staging` fires the **`auto-deploy-staging`** GitHub Action, which SSHes to the kronk droplet and deploys `staging` to shadow — you never SSH to kronk yourself. Shadow auto-deploys within a few minutes. Multiple contributors' work accumulates simultaneously — don't worry about overwriting others.

**To put a whole branch on shadow** (e.g. the `rebuild/2.0.0` integration branch), point `staging` at it and push — the same Action deploys it:

```bash
git push -f origin origin/rebuild/2.0.0:staging   # shadow now runs rebuild/2.0.0
```

**⚠️ Pushing to `main` resets shadow.** The `staging-sync` Action fires on _every_ push to `main` and redeploys `main` to shadow — silently reverting whatever branch you had running there back to the production line. So if you merge anything to `main` while dogfooding a branch on shadow, **re-push that branch to `staging` afterwards** to restore it.

**⚠️ Every deploy resets the DB — reconnect it after each one.** The rebuild shadow runs on a **separate database**, `mastodon_staging_rebuild` (its own users/content, empty of the classic ~14-user `mastodon_staging` data). `/home/mastodon/staging/.env.production` is a **symlink** to either `.env.production.classic` (the old DB) or `.env.production.rebuild` (the rebuild DB), and **every deploy — any `staging` push, not just `main` — resets it to `.classic`.** So after *any* shadow deploy, switch it back and restart:

```bash
ssh kronk
sudo -u mastodon bash -lc 'cd /home/mastodon/staging && ln -sf .env.production.rebuild .env.production'
sudo systemctl restart mastodon-staging-web mastodon-staging-sidekiq mastodon-staging-streaming@4001
```

Switch the *symlink* — don't `sed` `DB_NAME`. Verify with `RAILS_ENV=production bin/rails runner "puts ActiveRecord::Base.connection.current_database"` (the `/api/v1/instance` `user_count` is cached and lags). Durable fix (infra): make `.rebuild` the deploy default, or stop the deploy clobbering the symlink.

Shadow is transient and may be down. If it is, ask Tal to start it.

### 3. Open a PR for production

When your feature is tested on staging and ready to ship, open a PR from your **feature branch** to `main`. Tal reviews and merges — never run `gh pr merge` yourself.

**Title:** the version number this PR bumps to (e.g. `1.7.0`, `1.7.1`).
The title is intentionally minimal — all context lives in the body.

**Body must include:**

- **What changed** — files and behaviour affected
- **Why** — the problem being solved
- **How to test** — concrete steps on shadow
- **Dependencies** — migrations, other PRs, or deploy steps required
- **Version bump** — every PR to main updates `lib/kronk/version.rb`.
  Patch for fixes/refactors, minor for features, major for breaking changes.
  Include the bump in the PR itself; do not add it as a post-merge commit.

### 4. Clean up

Delete your branch after it's merged to `main`.

---

## Hard Limits

- **Never run `gh pr merge`** — PRs are always merged by Tal in the GitHub UI
- **Never commit directly to `staging` or `main`** — always via a branch first
- **Never edit, push to, or close another contributor's branch or PR** — you may read them for context but must not modify them
- **Never query user personal data** from the database

---

## Technical Notes for Claude Agents

**Committing on mainframe:** pre-commit hooks run rubocop, eslint, and a full `tsc` type check. `NODE_OPTIONS=--max-old-space-size=2048` is already set in `/etc/profile.d/mainframe.sh`. On portal, Ruby is not available — route commits through mainframe using `sudo -u chris bash -c 'cd ~chris/kronk && ...'`.

**Asset compilation** (staging only, after JS/CSS changes):

```bash
RAILS_ENV=production NODE_OPTIONS=--max-old-space-size=2048 bundle exec rails assets:precompile
```

**Staging is a git worktree** of the live repo. `git checkout <branch>` silently fails in this context — always use `git reset --hard origin/<branch>` to update the working tree, and suppress fetch errors with `git fetch origin 2>/dev/null; true` before resetting.

---

## Useful Links

- Instance: https://mastodon.kronk.info
- Shadow: https://shadow.kronk.info
- Issues: https://github.com/Kronkverse/kronk/issues
