# Kronk — Mastodon Fork

Kronk is a custom Mastodon instance at **mastodon.kronk.info**. This repo is a fork of [mastodon/mastodon](https://github.com/mastodon/mastodon) with custom features.

## Branch Strategy

| Branch    | Purpose                                       | Deploy target           |
| --------- | --------------------------------------------- | ----------------------- |
| `main`    | Production — promoted from `staging` only     | mastodon.kronk.info     |
| `staging` | Integration branch — all PRs land here first  | dev.mastodon.kronk.info |

Contributors open PRs against `staging`. Once changes on `staging` have soaked and the maintainer is comfortable, a single `staging` → `main` PR promotes to production. Never push directly to either branch.

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

## Contributing

1. Fork `Kronkverse/kronk` on GitHub
2. Branch off `staging` (e.g. `feature/my-change`)
3. Make changes, commit, push to your fork
4. Open a PR to `staging` on `Kronkverse/kronk`
5. PR gets deployed to staging for testing via `/deploy-staging`
6. After review, PR is merged into `staging`
7. The maintainer periodically promotes `staging` → `main` once changes have soaked; production deploys off `main`

## Useful Links

- Instance: https://mastodon.kronk.info
- Staging: https://dev.mastodon.kronk.info
- Issues: https://github.com/Kronkverse/kronk/issues
