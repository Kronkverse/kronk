# Contributing to Kronk

Kronk is a community-owned social platform at [kronk.info](https://kronk.info),
run and built by the people who use it, and contributions are welcome. It began
as a fork of Mastodon and is now its own platform, with Mastodon as the engine
underneath. **Read [`docs/how_we_build.md`](docs/how_we_build.md) first** — it
explains what Kronk is, what it holds to, and the principles every change
should follow.

## The short version

You are a **collaborator** on this repo — you push branches here directly, and
you do not need a fork.

```bash
git fetch origin
git checkout -b fix/my-change origin/shadow   # branch off shadow
# ... work, commit ...
git push -u origin fix/my-change
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
before your first PR, and come back to it when something surprises you. If you
work with a coding agent, point it at `CLAUDE.md` too — it is written to be read
by one.

## Getting set up

Kronk's engine is Mastodon's — Ruby 3.4.7, Node, Yarn, PostgreSQL, Redis — so
the [Mastodon development setup guide](https://docs.joinmastodon.org/dev/setup/)
applies. `CLAUDE.md` has the Kronk-specific commands under **Building
Locally**, including the asset precompile step you need for CSS and JS changes.

Contributors working on the shared dev server have auth, Postgres and Redis
already configured; ask and you will be pointed at it.

Before pushing, run the linters that match what you touched — `CLAUDE.md` lists
them under **CI gates**. A red `lint` blocks the merge queue, so it is cheaper
to catch locally.

## Finding something to work on

- **[Open issues](https://github.com/Kronkverse/kronk/issues)** are the shared
  to-do list. `good first issue` marks something small and self-contained;
  `help wanted` marks something nobody is on yet.
- **Something you noticed yourself** is just as welcome. If it is a bug, open an
  issue for it first (the templates ask the right questions), even if you are
  about to fix it — that is how the next person finds out it is already taken.
- **Ideas for new features or korners** go through the community first. A new
  korner starts as a Kommons proposal on kronk.info and a discussion, not as a
  PR — see **Adding something new** below.

**Claim before you start.** Comment on the issue, or assign yourself, so two
people do not build the same fix. If you stop, say so and unassign. An open PR
also counts as a claim — check the
[open PRs](https://github.com/Kronkverse/kronk/pulls) before starting on
anything.

## Fixing a bug

1. **Reproduce it on shadow or locally.** Write down the steps — they become the
   "How to test" in your PR.
2. **Check it is not already fixed on `shadow`.** Production runs `main`, which
   only moves at release time, so a bug you saw on kronk.info may already be
   fixed and waiting for the next release. Search merged PRs for the area.
3. **Find the doc for the space.** [`docs/spaces/<space>.md`](docs/spaces/README.md)
   says how it is meant to behave. If the code is right and the doc is wrong,
   the fix is a doc PR.
4. **Branch off `shadow`** as `fix/<short-name>`, keep the change to that one
   bug, and add or update a spec when the bug is in Ruby.
5. **Open the PR** with the four headings `CLAUDE.md` asks for (what changed,
   why, how to test, dependencies). Put `Fixes #<issue>` in the body so the issue
   closes when it merges.

## Adding something new

Kronk has a deliberate shape, and new work should look like it was always
there. **Build it Kronk-native**: when a leftover Mastodon surface is in the
way, replace it with a Kronk one rather than restyle it. Four things keep it
coherent:

- **It lives somewhere.** Most features belong inside an existing space or
  korner. Read that space's doc in [`docs/spaces/`](docs/spaces/README.md)
  before building — the decided direction is often already written down, and
  [`docs/rebuild/decisions.md`](docs/rebuild/decisions.md) records why things
  are the way they are.
- **It speaks Kronk.** Use the house vocabulary in user-facing text —
  korner, tune in / tune out, nudge, Hub, froth (Kronk's word for a favourite)
  — and never repurpose a reserved word. The list is in
  [`docs/kronk_korner_spec.md`](docs/kronk_korner_spec.md) §2 Language and §14
  Glossary. In code and the database, keep Mastodon's names (`favourite`,
  `subscription`). Every user-facing string goes through react-intl, never
  hardcoded.
- **It looks like Kronk.** One Kronk-purple palette everywhere, dark first,
  everything through design tokens — no raw colours, no per-korner brand colour,
  named radius tokens. Stylelint enforces much of this. The full reference is
  [`docs/kronk_aesthetic_system.md`](docs/kronk_aesthetic_system.md); feed cards
  follow [`docs/kronk_card_standard.md`](docs/kronk_card_standard.md).
- **It meets the korner standard.** A new korner, or a change to a manifest in
  `config/korners/*.yaml`, must satisfy
  [`docs/korners/korner_standard.md`](docs/korners/korner_standard.md);
  `bin/tootctl korners doctor` checks part of it in CI.

**A new korner** goes in this order:

1. Raise it in the community — a Kommons proposal on kronk.info — so people can
   back it or shape it before anyone writes code.
2. Run the question flow in
   [`docs/korners/proposing_a_korner.md`](docs/korners/proposing_a_korner.md).
   It produces a draft space doc and a skeleton manifest, which go in as a first
   PR.
3. Build it following
   [`docs/korners/adding_a_korner.md`](docs/korners/adding_a_korner.md), using
   `docs/korners/template/` as the starting point.

**A large change** — a refactor, a new subsystem, anything that touches several
spaces at once — gets an issue and a conversation before the code. It is much
cheaper to agree on direction than to rework a big PR.

## Working alongside each other

Several people, and several coding agents, land work on `shadow` every day.
What keeps that working:

- **Small PRs, merged fast.** A branch that lives for weeks drifts; a small one
  rebases cleanly and is easy to review.
- **One branch per change, always off `shadow`.** Never stack one PR on
  another — `CLAUDE.md` explains why it silently fails.
- **Leave other people's branches and PRs alone.** Read them freely; comment if
  you spot something; do not push to, rebase, or close them.
- **The shadow site is shared.** Every merge shows up there for everyone.
  Putting a single PR up for preview displaces the integrated view, so say so
  before you hold it for long.
- **Write decisions down in the repo.** If you settle something structural,
  add it to `docs/rebuild/decisions.md`. If a doc is wrong, fix it in a PR —
  notes kept elsewhere drift, and the next person will not see them.
- **Review each other.** Anyone can review any PR. A second pair of eyes on
  "How to test" is the most useful review there is.

## What to avoid

- **Going against what Kronk holds to.** No one-way reach without consent, no
  algorithmic ranking, no tracking or data extraction. See
  [`docs/how_we_build.md`](docs/how_we_build.md).
- **Hardcoding the instance.** No `kronk.info`, community names or rules baked
  into code — read the domain from configuration and keep community content in
  `content/kronk/`, so others can one day run their own Kronk.
- **Removing Kronk branding** — the logo, wordmark and custom emails are
  deliberate.
- **Unnecessary edits to Mastodon's engine.** Kronk's surface is ours to
  change freely, but the backend and core still take upstream updates, so
  change them only as much as you must. Prefer adding a Kronk file over editing
  an upstream one, and Kronk strings go in `config/locales/kronk/overrides.yml`
  rather than upstream's locale files.
- **Querying user personal data** from the database.
- **Secrets in the repo.** It is public. No keys, tokens, passwords, server
  addresses or credentials in code, docs, issues or PR bodies.
- **Bumping `lib/kronk/version.rb`.** It moves once per release, in the release
  PR.
- **Editing someone else's branch or PR.**

## Questions

Open an issue if you are unsure about something, or ask on the PR you are
working on. We would rather help you get started than miss a good contribution.
