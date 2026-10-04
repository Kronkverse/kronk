# Contributing to Kronk

Kronk is a community-owned social space at [kronk.info](https://kronk.info),
built as a fork of [Mastodon](https://github.com/mastodon/mastodon). It is run
and built by the people who use it, and contributions are welcome.

## The short version

You are a **collaborator** on this repo — you push branches here directly, and
you do not need a fork.

```bash
git fetch origin
git checkout -b feature/my-change origin/shadow   # branch off shadow
# ... work, commit ...
git push -u origin feature/my-change
```

Then open a pull request **into `shadow`**. When its checks are green, add it to
the merge queue. It reaches [shadow.kronk.info](https://shadow.kronk.info) —
where the whole team can see it — within about two minutes of merging.

That is the whole loop. Two branches matter:

- **`shadow`** is where work happens, and what the shadow site runs.
- **`main`** is the release line, and what production runs. It only ever
  receives releases, and only the maintainer merges them.

## Read this before your first PR

**[`CLAUDE.md`](CLAUDE.md) is the full workflow and it is the source of truth.**
It covers the parts that are easy to get wrong and expensive to get wrong:

- how to keep your branch current while other people are landing work
- why you should never stack one PR on another
- what belongs in a PR title and body
- which checks gate a merge, and which are advisory
- how a release goes from `shadow` to production
- who bumps the version, and when (short answer: not you, not in your PR)

It is written for both people and coding agents, so it is more detailed than a
typical contributing guide. Skim the Branches and Contributor Workflow sections
before your first PR, and come back to it when something surprises you.

## Getting set up

Kronk is a standard Mastodon fork — Ruby 3.4.7, Node, Yarn, PostgreSQL, Redis.
The [Mastodon development guide](https://docs.joinmastodon.org/dev/setup/)
applies. `CLAUDE.md` has the Kronk-specific commands under **Building
Locally**, including the asset precompile step you need for CSS and JS changes.

Contributors working on the shared dev server have auth, Postgres and Redis
already configured; ask and you will be pointed at it.

Before pushing, run the linters that match what you touched — `CLAUDE.md` lists
them under **CI gates**. A red `lint` blocks the merge queue, so it is cheaper
to catch locally.

## What we are looking for

- Bug fixes
- UI and UX improvements
- New korners, and improvements to existing ones (see
  [`docs/korners/adding_a_korner.md`](docs/korners/adding_a_korner.md))
- Accessibility and performance work
- Keeping compatibility with upstream Mastodon

## What to avoid

- **Breaking federation.** Changes must stay compatible with other
  ActivityPub instances.
- **Removing Kronk branding** — the logo, wordmark and custom emails are
  deliberate.
- **Unnecessary edits to upstream Mastodon files.** Keep diffs minimal so
  future upstream merges stay tractable.
- **Querying user personal data** from the database.
- **Large refactors without discussion first.** Open an issue.
- **Editing someone else's branch or PR.** Read them for context; leave them
  alone otherwise.

## Korners

Kronk organises features into **korners** — self-contained spaces declared by a
manifest in `config/korners/*.yaml`, each mounted under `/hub/<slug>`. If you
are adding or changing one, read
[`docs/korners/korner_standard.md`](docs/korners/korner_standard.md) first: it
defines what "the korner works" means, and `bin/tootctl korners doctor`
enforces part of it in CI.

## Questions

Open an issue if you are unsure about something. We would rather help you get
started than miss a good contribution.
