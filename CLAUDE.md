# Kronk — Mastodon Fork

Kronk is a custom Mastodon instance at **mastodon.kronk.info**. This repo is a fork of [mastodon/mastodon](https://github.com/mastodon/mastodon) with custom features.

## Branch Strategy

| Branch    | Purpose                           | Deploy target           |
| --------- | --------------------------------- | ----------------------- |
| `main`    | Production (protected — PRs only) | mastodon.kronk.info     |
| `staging` | Testing PRs before merge          | dev.mastodon.kronk.info |

**All changes go through pull requests to `main`.** Never push directly to main.

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

Kronk organises features into **spaces**, each orbiting a **planet** on the Hub (`/hub`). Every space inherits its accent colour from its parent planet.

### Planet → Space mapping

The canonical source of truth is `app/javascript/mastodon/planets.ts`:

- `PLANET_COLORS` — hex colour for each planet
- `SPACE_PLANET` — which planet each space orbits
- `spaceColor(spaceName)` — returns the hex colour for a space

### Adding a new space

1. **Decide which planet it belongs to** based on the planet's meaning (see Hub for meanings).
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

## Contributing

1. Fork `Kronkverse/kronk` on GitHub
2. Branch off `main` (e.g. `feature/my-change`)
3. Make changes, commit, push to your fork
4. Open a PR to `main` on `Kronkverse/kronk`
5. PR gets deployed to staging for testing
6. After review, PR is merged and deployed to production

## Useful Links

- Instance: https://mastodon.kronk.info
- Staging: https://dev.mastodon.kronk.info
- Issues: https://github.com/Kronkverse/kronk/issues
