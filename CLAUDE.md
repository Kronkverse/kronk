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

| Branch          | Purpose                                                                    | Deploy target          |
| --------------- | -------------------------------------------------------------------------- | ---------------------- |
| `main`          | Production (protected — PRs only, merged by the maintainer)                | mastodon.kronk.info    |
| `rebuild/2.0.0` | **Active 2.x integration branch — base your work here during the rebuild** | shadow (via `staging`) |
| `staging`       | Transient deploy branch for shadow — push to it to show work; disposable   | shadow.kronk.info      |

**Never commit directly to `main`, `rebuild/2.0.0`, or `staging`.** Always work on a branch and open a PR.

While the 2.0.0 rebuild is in progress, `rebuild/2.0.0` is the integration branch: base feature branches on it and open PRs against it. Once 2.0.0 ships, `main` resumes that role.

## Contributor Workflow

### 1. Start from a branch

Branch off the **active integration branch** — `rebuild/2.0.0` during the 2.x rebuild (`main` otherwise):

```bash
git fetch origin
git checkout -b feature/my-change origin/rebuild/2.0.0
```

Use `feature/`, `fix/`, or `docs/` prefixes. Keep branches small — one feature or fix per branch. You are a **collaborator** on `Kronkverse/kronk` — push directly, no personal fork needed. (On the mainframe dev server, push/fetch auth is handled for you — see the infra runbook; you do not need a personal token.)

### 2. Show work on shadow

Push to the **`staging`** branch to make work visible at https://shadow.kronk.info — this triggers an auto-deploy:

```bash
git push origin HEAD:staging      # or push the integration tip: origin/rebuild/2.0.0:staging
```

`staging` is a **transient, disposable** deploy branch (force-pushing it is fine). Shadow auto-deploys within a few minutes. Shadow may be down; if so, ask the maintainer to start it.

#### Shadow gotchas (read before debugging a "failed" deploy)

A deploy usually **succeeded** even when it looks like it didn't:

- **Don't trust the version string as a deploy signal.** `https://shadow.kronk.info/api/v1/instance` reports `version` from an env var (`MASTODON_VERSION_PRERELEASE`) and is cached — not from the deployed code. Verify a deploy by the **actual route/feature** (does your new page render?) or the deployed git ref, never the version endpoint. (The deploy now re-stamps this and clears the cache, so it should track the code going forward.)
- **The DB is a symlink between two databases.** Shadow has a classic DB and an isolated rebuild DB; the active one is chosen by a symlink that is now **persistent across deploys**. If you "can't log in," the DB is likely pointed at the wrong one — see the infra runbook.
- **Pushing to `main` resets shadow.** A push to `main` redeploys the production line onto shadow, reverting it off the rebuild. After any `main` merge, re-push the rebuild to `staging`.

### 3. Open a PR

Open a PR from your feature branch to the **active integration branch** (`rebuild/2.0.0` during the rebuild; `main` for production). **Contributors never merge to `main` — the maintainer does.** `rebuild/2.0.0` PRs are merged per the team's rebuild policy (see the infra runbook).

**Title:** minimal — the version this PR bumps to (`2.0.0-alpha.N` on the rebuild; semver on `main`).

**Body must include:**

- **What changed** — files and behaviour affected
- **Why** — the problem being solved
- **How to test** — concrete steps on shadow
- **Dependencies** — migrations, other PRs, or deploy steps required
- **Version bump** — every PR updates `lib/kronk/version.rb`. Patch for fixes/refactors, minor for features, major for breaking changes; the rebuild uses `2.0.0-alpha.N`. Include the bump in the PR itself.

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

The repo uses **husky + lint-staged**. On commit it runs **prettier** (formatting), **eslint** (strict TS: no-unsafe-\*, no-non-null-assertion, prefer-nullish-coalescing), **stylelint** (CSS), and **tsc --noEmit** (full project type check).

`tsc` runs project-wide and needs extra memory:

```bash
export NODE_OPTIONS="--max-old-space-size=2048"
```

(On the mainframe dev server this is already set in `/etc/profile.d/mainframe.sh`.)

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
