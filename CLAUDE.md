# Kronk — Mastodon Fork

Kronk is a custom Mastodon instance at **mastodon.kronk.info**. This repo is a fork of [mastodon/mastodon](https://github.com/mastodon/mastodon) with custom features.

## Branch Strategy

| Branch    | Purpose                                        | Deploy target           |
| --------- | ---------------------------------------------- | ----------------------- |
| `main`    | Production (protected — PRs only)              | mastodon.kronk.info     |
| `staging` | Shared integration — all work accumulates here | shadow.kronk.info       |

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

## Spaces Architecture

Kronk organises features into **spaces**, each orbiting a **planet** on the Kosmos (`/hub`). Every space inherits its accent colour from its parent planet.

### Planet → Space mapping

The canonical source of truth is `app/javascript/mastodon/planets.ts`:

- `PLANET_COLORS` — hex colour for each planet
- `SPACE_PLANET` — which planet each space orbits
- `spaceColor(spaceName)` — returns the hex colour for a space

### Adding a new space

1. **Decide which planet it belongs to** based on the planet's meaning (see Kosmos for meanings).
2. **Add it to `SPACE_PLANET`** in `app/javascript/mastodon/planets.ts`.
3. **Add it as a moon** in the `MOONS` array in `app/javascript/mastodon/features/hub/index.tsx` — position it near its parent planet's orbit.
4. **Theme the space UI** by setting `--space-color: spaceColor('YourSpace')` as an inline style on the space's root element. All accent colours (badges, borders, glows, tints) should derive from this variable via `color-mix()` — see `_status_kommons_card.scss` as the reference implementation.
5. **Theme feed cards** the same way — any card that appears in the home timeline from this space should carry `--space-color` so it's visually identifiable.

### Sol is special

Sol represents the user profile and integrates with Anthemos. It has no moons — the planets are Sol's moons. It does not follow the space pattern above.

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

## 2.x Rebuild planning

Ideas, plans, and open questions for the eventual Kronk 2.0 rebuild live
under `docs/rebuild/`. The Korner framework work (shipped as 1.7.0) and
the `mastodon.kronk.info` → `kronk.info` URL migration are both folded
into the rebuild rather than treated as standalone concerns.

**When Tal shares a rebuild-related idea, drop it into `docs/rebuild/`:**

- Look for an existing themed file (`docs/rebuild/<theme>.md`) that fits — append there
- If nothing fits, create a new themed file with a short kebab-case name
- Update `docs/rebuild/README.md` to link any new file you create
- Rough notes are fine — this is a capture surface, not a finished spec
- If it's unclear whether an idea is rebuild-scope, ask — better to over-attribute than to lose the thread

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

Shadow auto-deploys within a few minutes. Multiple contributors' work accumulates simultaneously — don't worry about overwriting others.

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
