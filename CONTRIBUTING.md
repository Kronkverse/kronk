# Contributing to Kronk

Kronk is a customized [Mastodon](https://github.com/mastodon/mastodon) instance at [mastodon.kronk.info](https://mastodon.kronk.info). We welcome contributions!

## Getting Started

1. **Fork** this repo on GitHub
2. **Clone** your fork locally
3. **Branch** off `main` (e.g. `git checkout -b feature/my-change`)
4. **Make your changes**
5. **Push** to your fork and **open a PR** against `main`

## Branch Structure

| Branch    | Purpose                                       |
| --------- | --------------------------------------------- |
| `main`    | Production — deployed to mastodon.kronk.info  |
| `staging` | Testing — deployed to dev.mastodon.kronk.info |

`main` is protected. All changes go through pull requests.

## Development Setup

Kronk is a standard Mastodon fork. Follow the [Mastodon development guide](https://docs.joinmastodon.org/dev/setup/) to set up your local environment.

Key differences from upstream Mastodon:

- Custom branding (logos, colors, terminology)
- Custom features (events, live rooms, invite system)
- Extended limits (character counts, poll durations, trend thresholds)

## Code Standards

This repo uses pre-commit hooks (husky + lint-staged) that run automatically:

- **Prettier** — code formatting
- **ESLint** — strict TypeScript rules (`no-unsafe-*`, `no-non-null-assertion`, `prefer-nullish-coalescing`)
- **Stylelint** — CSS linting
- **TypeScript** — `tsc --noEmit` (project-wide type checking)

If TypeScript runs out of memory during commit, set:

```bash
export NODE_OPTIONS=--max-old-space-size=2048
```

## Testing Your Changes

When you open a PR, a maintainer will deploy your branch to the staging environment at `dev.mastodon.kronk.info` for testing. You don't need to worry about deployment — just make sure your code works locally.

## What We're Looking For

- Bug fixes
- UI/UX improvements
- New features that fit Kronk's community focus
- Upstream Mastodon compatibility improvements
- Performance improvements

## What to Avoid

- Changes that break federation with other Mastodon/ActivityPub instances
- Removing or weakening existing features without discussion
- Large refactors without prior discussion in an issue

## Upstream Syncing

Kronk periodically merges upstream Mastodon releases. If your PR conflicts with an upcoming upstream merge, we may ask you to rebase.

## Questions?

Open an issue if you're unsure about something. We'd rather help you get started than miss a good contribution.
