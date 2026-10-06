# Contributing to Kronk

Kronk is a community-owned social platform at [kronk.info](https://kronk.info),
run and built by the people who use it. Contributions are welcome.

**Everything you need is in [`CLAUDE.md`](CLAUDE.md)** — what Kronk is and what
it holds to, its language and look, how to build a korner, and the full
workflow. Most of our building happens with Claude, which reads that file
automatically; it is written to be read by you too. Read **What Kronk is** and
**Building in Kronk** before your first change.

## The loop

You are a collaborator on this repo — push branches here directly, no fork.

```bash
git fetch origin
git checkout -b fix/my-change origin/shadow   # always branch off shadow
# ... work, commit ...
git push -u origin fix/my-change
```

Open a pull request **into `shadow`**. When its checks are green, add it to the
merge queue; the branch is deleted when it merges, and the change reaches [shadow.kronk.info](https://shadow.kronk.info) about two
minutes later. Releases move `shadow` to `main`, which is what production runs,
and only the maintainer merges those.

## Finding something to do

[Open issues](https://github.com/Kronkverse/kronk/issues) are the shared to-do
list — look for `good first issue` and `help wanted`, and claim one before you
start. A new korner starts as a Kommons proposal on kronk.info, not as a PR.

## Setting up

**The supported setup is the shared dev server, mainframe.** Contributors work
there: Ruby, Node, PostgreSQL, Redis and push access are already set
up, and the test suite runs there. Ask the maintainer for access.

Building on your own machine works too, but you are on your own for it.
Kronk's engine is Mastodon's — Ruby 3.4.7, Node, Yarn, PostgreSQL, Redis — so
the [Mastodon setup guide](https://docs.joinmastodon.org/dev/setup/) applies;
`CLAUDE.md` has the Kronk-specific commands and the feature-flag differences
under **Building Locally**.

## Questions

Open an issue, or ask on your PR. We would rather help you get started than
miss a good contribution.
