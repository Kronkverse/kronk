# Kronk

Kronk is a community-owned social platform at **kronk.info** (it moved there from `mastodon.kronk.info` with the 2.0 release, which now redirects — see `docs/decisions.md`, 2026-09-16). It began as a fork of [mastodon/mastodon](https://github.com/mastodon/mastodon) and since 2.0.0 is its own platform, with Mastodon as the engine underneath. **What Kronk is, and how to build in it, are the first two sections below — read them before building anything new.** New contributors: start with `CONTRIBUTING.md`, which links back here.

> **This file is the single source of truth for the Kronk contributor & agent workflow.** It is public. Do **not** put server IPs, SSH keys, deploy keys, droplet names, or credentials here — those live in the private infra runbook (see below). Every other instruction file (per-host, per-user) should link back here rather than restating it, so nothing drifts.
>
> **Where things live:**
>
> - **What Kronk is, principles, language, aesthetic, korner building, workflow, code rules** → this file (repo, normative). Claude loads it automatically; keep it the one place.
> - **Infra topology, SSH keys, deploy mechanics, credentials, merge authority** → private infra runbook (mainframe: `/home/shared/infra.md`; portal: `/home/claude/CLAUDE.md`). Not in this public repo.
> - **Deeper reference** → the docs listed under **Building in Kronk → The docs**.

## Where to look first

New contributor or agent: load the files below in order. Everything else is
depth behind these.

| Order | File                                         | For                                                             |
| ----- | -------------------------------------------- | --------------------------------------------------------------- |
| 1     | `CLAUDE.md` (this file)                      | What Kronk is, principles, language, aesthetic rules, workflow  |
| 2     | `docs/design.md`                             | The detail behind the aesthetic rules — tokens, Frame, Membrane |
| 3     | `app/javascript/mastodon/tokens/tokens.yaml` | Ground-truth values when §2 is ambiguous                        |
| 4     | `docs/korners/korner_standard.md`            | L1–L10 conformance — what "the korner works" means              |
| 5     | `docs/korners/adding_a_korner.md`            | The step-by-step for a new korner                               |
| 6     | `docs/decisions.md`                          | Dated decisions and their reasoning — the _why_                 |
| 7     | `docs/spaces/<slug>.md`                      | Per-space detail — add the one for the space you're touching    |

Everything a Claude Project or a new human contributor needs to design or
extend Kronk is in those seven places; a bundle for upload to Claude.ai lives
at `talitamoss.info/files/uploads/kronk-design-bundle.zip`.

## What Kronk is

Kronk began as a Mastodon instance. With 2.0.0 "Rose" (production, 2026-09-20)
it became its own platform: its own shape, look, vocabulary, and idea of what a
relationship and a feed are. Mastodon is still the engine underneath, but
nothing a member sees is "Mastodon with a theme" any more, and nothing you build
should be.

- **Every relationship is a Mate** — mutual, request and accept. There is no
  one-way follow.
- **One reach ladder** — Just me → Mates → Orbit → Kronkverse — sets both how far
  a post goes (the composer) and how wide your feed reads (`/home/settings`).
  **Krews** are a separate group axis on top. Mastodon's visibilities are gone.
- **Four pillars** — Me, Home (the feed), Hub, Nudges (a messenger, not a bell)
  — and **korners** plugged into the Hub: Kalendar, Kommons, Booth, Kuestions,
  Moments, Albutts, Wachuneed, Kronikles, Krew and more.
- **Governance is in the open.** Structural change is a Kommons proposal on the
  instance itself.

The member-facing version is `content/kronk/about.md` and `how-it-works.md`.

### What Kronk holds to

These come from the three vows every member makes on the way in (ownership,
custodianship, trajectory). A change that breaks one is not a Kronk change,
however good the code.

- **No reach without consent.** Nothing lets one person reach another outside
  the Mate graph and reach ladder.
- **The member holds the lever.** Reach is chosen on the composer, feed width in
  settings, and korners reach your feed only when you tune in. **No algorithmic
  ranking**, ever.
- **No surveillance, no extraction.** No tracking, no data sales, no engagement
  manipulation — and no data structured to make them possible.
- **Present by default, private by choice.** Discoverability and profile reach
  are things you narrow, not things you earn.

### Mastodon underneath

Two kinds of code, with different rules:

- **Kronk's surface and product** — web client, spaces, korners, copy, design
  system, Kronk's own models and services. Ours. Change it freely, **replace a
  leftover Mastodon surface with a Kronk one rather than restyle it**, delete
  what Kronk no longer uses.
- **The engine** — Mastodon's backend and core (Rails, accounts, media, API
  plumbing, jobs). We still merge upstream for security and framework updates —
  Rails 8.0 is EOL 2026-10-07 and the Mastodon 4.6 merge is how we move
  (`docs/upstream-merge.md`). Change it as little as it takes: add a
  Kronk file (`app/lib/kronk/`, a service, a concern) rather than edit an
  upstream one. Every engine line changed is a conflict in the next merge.

Keep Mastodon's names in code and the database (`favourite`, `subscription`);
use Kronk's in anything a member reads. Never put a Kronk version into
`Mastodon::Version`.

### Federation, and Kronk 3.0

**Federation is closed and is not a design constraint.** Production federates
with no one. Do not shape a feature around ActivityPub compatibility. **Do not
delete the ActivityPub code either** — it is switched-off engine code, and
removing it enlarges every upstream merge.

The 3.0 direction is a Kronk-native federation, built so other communities can
run their own Kronk and connect on Kronk's terms (Mates, consent, reach). So,
from now: **no instance in the code.** Never hardcode `kronk.info` or
community content — read the domain from configuration and keep rules, terms
and about-pages in `content/kronk/*.md`. About a dozen files still hardcode the
domain; that is debt, not precedent.

## Building in Kronk

### Principles

- **Everything lives in a space.** A big new thing is a korner; a smaller thing
  lives inside the space it belongs to. Read that space's doc in
  `docs/spaces/<slug>.md` before building — the decided direction is often
  already written, and `docs/decisions.md` records why.
- **Use the shared systems as they are** — tokens, the component kit,
  `<KornerShell>`, `<ComposeShell>`, the feed card, the auth layer, the event
  bus. If one does not do what you need, change the shared system in its own
  PR; never fork it quietly inside a korner.
- **Write decisions into the repo.** A structural decision goes in
  `docs/decisions.md` (dated, newest first, with the reasoning). A wrong
  doc gets fixed in the same PR that proves it wrong. **Code > repo docs >
  anything outside the repo.**
- **Don't add docs.** Extend this file, the space's own doc, or the korner
  standard. A new standalone doc is almost always the wrong home.

### The docs

Kept deliberately few (consolidated 2026-10-04 from about 70). Everything else
is in git history.

| File                              | What it is                                                                                                       |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `CLAUDE.md`                       | This file. The one guide.                                                                                        |
| `docs/spaces/<slug>.md`           | One per space — how it works, what is decided, what is open. Required for every korner (`bin/lint-korner-docs`). |
| `docs/korners/korner_standard.md` | Normative: what "the korner works" means. Enforced by `korners doctor`.                                          |
| `docs/korners/adding_a_korner.md` | The step-by-step build, plus proposing, anatomy, attachments and the framework spec.                             |
| `docs/design.md`                  | Aesthetic system, Frame, card standard, Membrane nav, platform primitives index, walkthrough.                    |
| `docs/decisions.md`               | Dated decisions and their reasoning. Append-only, newest first.                                                  |
| `docs/upstream-merge.md`          | The live plan for merging upstream Mastodon (and so Rails 8.1).                                                  |

Before writing something new, grep `docs/design.md` (Platform primitives) — the
platform may already have it.

- **Keep checks honest.** If a check is red for a known reason, fix the reason
  or remove the check.

### Language

All user-facing strings go through react-intl (`defineMessages` +
`intl.formatMessage` for data-driven copy; never a dynamic `id`). Kronk's
server-side strings go in `config/locales/kronk/overrides.yml`.

| Use                                  | Not                              | Notes                                             |
| ------------------------------------ | -------------------------------- | ------------------------------------------------- |
| Mate                                 | follower, friend                 | mutual by definition                              |
| Just me / Mates / Orbit / Kronkverse | public, unlisted, followers-only | the reach ladder (code: `privacy_dropdown.jsx`)   |
| Krew                                 | list, group (for audience)       | an audience axis, separate from reach             |
| Kommunity                            | (a reach tier)                   | the community korner, not a reach tier            |
| korner                               | app, module, planet              | "space" is the general term; a korner is one kind |
| tune in / tune out                   | subscribe, follow (a korner)     | code field stays `subscription`                   |
| nudge, Nudges                        | notification, bell               |                                                   |
| froth                                | like, favourite                  | code stays `favourite`                            |
| steward                              | moderator                        | reserved — don't repurpose                        |

The K-grammar (Kalendar, Kommons, Kuestions) is the house style for names.
**Retired, don't reintroduce:** planet, moon, Kosmos, fan.

### Aesthetic — the rules

One platform, one palette. Every space wears **Kronk-purple** on a
**dark-first** surface; spaces differ by **icon, name and content, never
colour**. Full reference: `docs/design.md` (Aesthetic system); live components at
`/styleguide`.

- **Everything through tokens.** No raw hex/rgb, pixel radii, hand-built
  shadows or durations in feature CSS. Stylelint flags raw hex and pixel
  radii, but only as warnings — they don't fail `lint`, so don't rely on CI to
  catch them. Tints use `color-mix()` against a token.
- **Semantic tokens are the contract:** `--accent`, `--surface-primary`,
  `--surface-elevated`, `--border-default`, `--text-primary` /
  `-secondary` / `-muted`, `--warning-red`, `--success-green`,
  `--decision-agree` / `-abstain` / `-block` / `-pending`. Don't reach past them
  to raw palette tokens — members personalise accent, theme, fonts and scale by
  overriding these on `:root`, and a hardcoded value silently opts them out.
- **No per-korner colour.** Accent is `var(--accent)`. No colour field in a
  manifest.
- **Both themes free.** Build against semantic tokens; never branch on theme.
- **Radius by role:** `--radius-small` (chips, small buttons), `-medium`
  (cards, panels), `-large` (hero surfaces, sheets, modals), `-round` (pills,
  avatars, toggles). No sharp corners; borders 1–1.5px.
- **Type:** `--font-display` (serif) for titles, `--font-body` for the rest.
  Elevation via `--elevation-*`; motion via `--dur-*` and `--ease-*`.
- **Feature headers** use `@include kronk-cover-glow()`, not a bespoke gradient.
- **Tokens change in one place:** `app/javascript/mastodon/tokens/tokens.yaml`,
  then `bin/generate-tokens` and commit `_tokens.scss` (CI runs `--check`).

**Feed and grid cards** use the six-slot card contract — `media`, `badge`,
`title`, `meta`, `body`, `actions`. A slot may be empty but is never
re-purposed, and the arrangement (feed / portrait / grid) decides size, never
the content. Detail: `docs/design.md` (Card standard).

### Building a korner

A korner is a manifest in `config/korners/<slug>.yaml`, mounted at
`/hub/<slug>`, held to **`docs/korners/korner_standard.md`** — read the
Standard before touching any manifest. `bin/tootctl korners doctor` checks it;
its CI job reports but does not block yet (`continue-on-error`).

1. **Proposal first.** A new korner starts as a Kommons proposal on kronk.info
   and a conversation, not a PR.
2. **Shape it.** Run the question flow in `docs/korners/adding_a_korner.md` (Proposing a korner).
   It produces a first PR with `docs/spaces/<slug>.md` (required —
   `bin/lint-korner-docs` checks every korner has one) and a skeleton manifest
   with `enforced: false`, `lifecycle: soon`. Check the slug against
   `config/korners/reserved_slugs.yaml`.
3. **Build the layers** following `docs/korners/adding_a_korner.md`, starting
   from `docs/korners/template/`: data (models use a `status_id` column for
   feed-projected items), API and serializers, frontend module, routes, styles,
   feed projection, compose action, settings.
4. **Let the Frame draw the chrome.** Wrap the korner in `<KornerShell>` (new
   korners do; only five of the older ones have moved onto it so far) with
   `views` matching the manifest's `views:` list. Do **not** render your own
   badge, `<h1>` header, tagline or tab row — the Frame does, from the manifest
   (Frame, in `docs/design.md`). Views are URL-driven (`/hub/<slug>/<key>`), never
   `useState` tabs.
5. **Two traps.** Never call `PostStatusService` inside a transaction (the
   status silently misses home feeds). Declare only notification types that
   actually fire.
6. **Go live honestly.** Set `enforced: true` only when every layer passes:
   doctor green, records create via the API, they project as a token-clean
   card, `/hub/<slug>` and `/hub/<slug>/settings` render, and it looks
   identical-in-family to every other korner in both themes.

## Branches

| Branch                                 | What it is                                     | Who writes to it                            | Deploys to                         |
| -------------------------------------- | ---------------------------------------------- | ------------------------------------------- | ---------------------------------- |
| `main`                                 | The release line. What production runs.        | Release PRs only, merged by the maintainer. | `kronk.info`, by hand              |
| `shadow`                               | Integration. Everyone's work, finished or not. | Anyone, by PR through the merge queue.      | `shadow.kronk.info`, automatically |
| `feature/*` `fix/*` `chore/*` `docs/*` | Your own work in progress.                     | You. Push freely.                           | nothing, until you ask             |

**Work happens on `shadow`**, which is also the repo's default branch. Branch
off it, PR back into it. Every merge
reaches https://shadow.kronk.info within about two minutes, so the whole team
sees the integrated state as work lands. Work that is finished gets marked
**ready to ship**, and a release takes just those PRs to `main` (see
**Releasing** below); unfinished work stays on shadow.

**Never commit directly to `main` or `shadow`.** Always a branch plus a PR.

> `shadow` was called `rebuild/2.0.0` until 2026-10-04. The rebuild it was
> named after shipped to production on 2026-09-20, so the branch was renamed to
> the environment it deploys to. `staging` and `dev/<name>` are retired and
> deploy nothing. The systemd units and deploy scripts on the host are still
> named `staging` — that naming predates the shadow host and is load-bearing in
> the SSH forced command, so it stays. Branch and site are "shadow"; the
> service layer underneath is "staging".

## Contributor Workflow

### 0. Pick something up

- **Issues are the shared to-do list.** `good first issue` is small and
  self-contained; `help wanted` means nobody is on it. **Claim before you
  start** — comment or self-assign — and check open PRs; an open PR is a claim.
- **Found a bug yourself?** Open an issue first (the form asks the right
  questions), even if you are about to fix it.
- **Fixing a bug:** reproduce it on shadow or locally and write the steps down
  (they become "How to test"). Check it is not already fixed on `shadow` —
  production runs `main`, which only moves at release. Read the space's doc in
  `docs/spaces/`; if the code is right and the doc is wrong, the fix is the doc.
  Branch `fix/<name>`, one bug per PR, add a spec for Ruby bugs, and put
  `Fixes #<issue>` in the body.
- **New feature or korner:** see **Building in Kronk**. Anything touching
  several spaces, or a large refactor, gets an issue and a conversation first.

Several people and several Claude sessions land work on `shadow` every day.
Small PRs merged fast, every branch off the shadow tip, nobody touches anyone
else's branch, and anyone can review anyone's PR — a second pair of eyes on
"How to test" is the most useful review there is.

### 1. Branch off shadow

```bash
git fetch origin
git checkout -b feature/my-change origin/shadow
```

Use `feature/`, `fix/`, `chore/` or `docs/` prefixes, and keep a branch to one
feature or fix. You are a **collaborator** on `Kronkverse/kronk` — push
directly, no fork needed. (On the mainframe dev server, push and fetch auth is
already set up for you; see the infra runbook. You do not need a personal
token.) GitHub deletes a PR's branch automatically once it merges.

**Every branch starts from the shadow tip. Do not stack PRs.** A stacked PR —
one branched off another open PR instead of `shadow` — cannot survive its
parent merging. The parent lands as a **squash**, so the child still carries the
parent's original commits, the merge queue's rebase collides, and the child is
**silently ejected from the queue**: still open, still green, simply not
merging. Nothing tells you.

This cost real time on 2026-08-13: a four-deep stack was ejected twice, needing
manual re-rebasing both rounds, and each round looked like "queued" until
someone checked (`docs/decisions.md`, 2026-08-13).

- **Base each PR on `origin/shadow`** and accept a little duplication in review
  over serialised, self-ejecting merges.
- **If work genuinely cannot compile without earlier work**, that is one PR,
  not two. Split by _reviewable unit_, not by commit tidiness.
- **If you stack anyway** (rare, and say so in the PR body), you own
  re-rebasing after each parent merges — and **"I queued it" is not "it
  landed."** Re-check `gh pr view <N> --json state` after the parent lands.

### 2. Keep your branch current

Other people are landing work on `shadow` while you build. Before you open a PR,
and before you push again to an open one, check whether you are stale:

```bash
gh api repos/Kronkverse/kronk/compare/shadow...<your-branch> --jq .behind_by
# 0 means current. Anything else means rebase first.
```

To catch up:

```bash
git fetch origin
git rebase origin/shadow        # your commits move on top of everyone else's
# conflicts? fix them, git add, then git rebase --continue
git push --force-with-lease     # --force-with-lease, never a plain --force
```

`--force-with-lease` refuses the push if someone else has touched your branch in
the meantime. A plain `--force` would overwrite their work without telling you.

### 3. See your work

Three ways, cheapest first.

**Your branch plus green checks** is the default, and it needs no server. Every
PR runs the production and test builds, the Ruby suite, the end-to-end and
system specs, the ImageMagick specs, lint and the korners doctor (plus the JS
tests and i18n check when you touch those files). "Clean before it goes into
shadow" means those are green — see **CI gates** below.

**Run it locally** when you need to click through something interactively. See
**Building Locally**.

**Put your PR on shadow** when you need to see it live — a visual regression, a
layout question, anything CI cannot judge. Run the **Staging Deploy** Action
(Actions tab, `workflow_dispatch`) with your PR number. It deploys _shadow as it
currently stands, plus your PR_ — so you are looking at your change merged into
everyone else's work, not at your branch in isolation.

There is **one shadow host**, so this is a slot people take turns in. While your
PR is up there, the integrated view is displaced; the next merge into `shadow`
restores it. Say so before you claim it for a long session, and prefer the two
cheaper options above when they would answer your question.

#### Shadow gotchas (read before debugging a "failed" deploy)

A deploy usually **succeeded** even when it looks like it didn't:

- **Hard-reload before you believe what you see.** The service worker serves
  stale JS chunks, so an old bundle can survive a good deploy.
- **Don't trust the version string as a deploy signal.** `/api/v1/instance`
  reports `version` from an env var (`MASTODON_VERSION_PRERELEASE`) and is
  cached — not from the deployed code. Verify by the **actual route or
  feature**, or by the deployed git ref.
- **The DB is a symlink between two databases.** Shadow has a classic DB and an
  isolated rebuild DB; the active one is chosen by a symlink that persists
  across deploys. If you "can't log in", the DB is likely pointed at the wrong
  one — see the infra runbook.
- **Pushing to `main` does not touch shadow.** `auto-deploy-shadow.yml` is
  the only workflow that reaches shadow without a human; `staging-deploy.yml`
  and `staging-sync.yml` are dispatch-only. If shadow ever comes back showing
  the production line, suspect a `push:` trigger added to one of those two —
  production-line code on shadow's database 500s every page (it happened on
  2026-08-13).

### 4. Open a PR into shadow

**Title:** a clean headline — name the thing in a few words, nothing more.
The explanation belongs in the body, not the title.

```
FreeTheDream korner
Moments reactions
Kalendar edit button
Rails 8.1
```

not `Add FreeTheDream (the Dream Web) as an iframe prototype korner`, not
`fix(kalendar): KAL-12`, and no version number — the one exception is a
release PR into `main`, which is titled with just the version (`2.0.1`).

**Body:** four headings, every time.

- **What changed** — the files and the behaviour.
- **Why** — the problem being solved. If it is a bug, what the user saw.
- **How to test** — concrete steps on shadow, enough that someone else can
  follow them without asking you.
- **Dependencies** — migrations, other PRs, deploy steps, or "none".

Three habits worth keeping:

- **Name commits by their message**, not by pasting a SHA.
- **Say which checks you ran green**, so a reviewer knows what is covered.
- **Flag anything users will notice the moment it deploys** — a copy change, a
  re-prompt, a moved button. That belongs in the body, where the person pressing
  deploy will read it.

**Do not touch `lib/kronk/version.rb`.** See **Versioning**.

### 5. Land it via the merge queue

Once it is reviewed and the required checks are green, land it with "Add to
merge queue", or `gh pr merge <N> --squash --auto`. The queue serialises merges,
rebases each PR against the tip, re-runs the required checks, then merges —
which is what makes several people landing work at once safe. Trust the queue;
don't force-merge past it.

Two traps:

- **Don't use the "Enable auto-merge" button.** It is not the same as "Add to
  merge queue": it arms a plain merge (the queue requires **squash**) and, if a
  required check is **red**, it silently _parks_ the PR — armed, but never
  entered into the queue, with no error, indefinitely. If "Add to merge queue"
  is greyed out, that **is** the signal a required check is red. Fix the check;
  don't reach for auto-merge.
- **Don't mass-arm failing or stale PRs.** A stack of armed-but-blocked PRs
  looks like a jammed queue but is not _in_ the queue at all — each is just
  waiting on its own red check, holding nothing up.

A red required check means the PR simply **cannot** enter the queue. That is the
gate working, not a bug. The only thing that overrides it is a maintainer's
admin "merge without waiting for requirements", used deliberately and never as a
shortcut.

### 6. Mark it ready to ship

Merging into `shadow` is not shipping. Shadow holds everyone's work, finished
or not, and **a release only takes PRs marked _ready to ship_**.

When your PR has merged, check it on https://shadow.kronk.info. When it is
finished — the thing you'd be happy for every member to have — comment on the
PR:

```
/ready to ship
```

(or add the `ready to ship` label yourself). `/not ready` takes it back. Leave
unfinished work unmarked: it stays on shadow, where people can try it, and
nothing ships until you say so. A PR that only makes sense alongside another
one should be marked ready together with it.

## Releasing: shadow to main

A release takes the PRs marked **ready to ship** and nothing else. It starts
from `main` and cherry-picks each one's squash commit (every PR is a single
commit on `shadow`), in the order they merged. Unfinished work stays on
shadow for a later release. `bin/release` does the mechanics:

1. **See what would ship** — `bin/release plan` lists the ready PRs and the
   merged ones that are not, so nothing is a surprise.

2. **Cut it** — `bin/release cut 2.0.2` builds `release/2.0.2` from `main`,
   cherry-picks the ready PRs, bumps `MILESTONE` (the only place a version is
   ever bumped — see **Versioning**), adds a changelog entry from the PR titles,
   and opens the PR into `main`, titled with the version. A ready PR that can't
   apply on its own — because it builds on work that isn't ready — is left out
   and named in the PR body. Edit the changelog wording in the PR if it needs
   it.

3. **Check it.** The release tree is `main` plus the picked PRs, not exactly
   what shadow ran, so its CI is the real check — the full Ruby suite, not just
   the required checks. For a final look, put the release PR on shadow with the
   **Staging Deploy** action.

4. **The maintainer merges it**, then deploys production by hand (the infra
   runbook defines deploy authority). Contributors never merge to `main`.

5. **Close the loop** — `bin/release done 2.0.2` marks the shipped PRs
   `shipped` (and comments on each), and opens the PR that brings the version
   bump and changelog back to `shadow`.

**Fixes go to `shadow` first**, like everything else, then get marked ready.
If something genuinely cannot wait for a release and is fixed on `main`
directly, open the same fix as a PR into `shadow` too — otherwise shadow, and
every later release built from it, won't have it.

There is **no auto-deploy to production**, and there should not be. Merging to
`main` ships nothing by itself.

## Versioning

Kronk has its own version in `lib/kronk/version.rb`, layered on the upstream
Mastodon version in `lib/mastodon/version.rb`. They are separate on purpose:
upstream's number is what federation and the update checker read, Kronk's is the
release train.

**One rule: the version is bumped once per production release, in the release
PR, and by no other PR.** That is what lets several people land work in parallel
without colliding on the version line, and it keeps releases legible.

| Change                                   | Becomes | Kind  |
| ---------------------------------------- | ------- | ----- |
| Bug fixes, copy, refactors               | `2.0.1` | patch |
| New korner, new subsystem, features      | `2.1.0` | minor |
| Breaking client changes, paradigm shifts | `3.0.0` | major |

Production is `2.0.3 "Rose"` (`MILESTONE` on `main`). Release names belong to majors and minors; a patch
inherits its minor's name rather than earning a new one.

Builds are identified by their git ref and commit, not by a hand-bumped number —
`Kronk::Version` appends the short commit from `SOURCE_COMMIT` when the deploy
provides it.

**Never let a Kronk version suffix reach `Mastodon::Version`.** A prerelease
suffix there sorts _before_ the release it qualifies, which is what made the
upstream update checker read us as older than we are and mail every admin every
thirty minutes until 2026-09-20 (#1960).

## Building Locally

**The supported setup is the shared dev server (mainframe).** Ruby, Node,
PostgreSQL, Redis, push access and the memory flags are already set up there,
and that is where the rest of the team builds and runs the suite. Ask the
maintainer for access.

To build on your own machine instead: Ruby 3.4.7 (`.ruby-version`; CI also
tests 3.3, and 3.2 no longer installs), Node.js, Yarn, PostgreSQL, Redis.

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

**Feature flags differ by environment.** `config/feature_flags.yaml` has a
`default:` block and a `production:` block, read through
`Kronk::FeatureFlags.enabled?`. Development and test get only the defaults, so
`feed_scope_enforced`, `status_nudges` and `legacy_app_gate` are **off**
locally and in specs, and **on** in production and on shadow (both run
`RAILS_ENV=production`). If the feed ignores its scope or nudges don't arrive
locally, that is why. Specs that need a flag on wrap the example in
`Kronk::FeatureFlags.with_flag(flag_name: true) { ... }` or stub
`enabled?`.

## Pre-commit Hooks

The repo uses **husky + lint-staged**. On commit it runs, on **changed files only**, the fast auto-fixers: **prettier** (formatting), **eslint --fix** (strict TS: no-unsafe-\*, no-non-null-assertion, prefer-nullish-coalescing), **stylelint --fix** (CSS), **rubocop -a**, **haml-lint -a**. These are quick — **let the hook run; do not `--no-verify` past it.** A bypass skips the whole hook including `prettier --write`, which is exactly how unformatted code reaches a PR and fails the `lint` merge gate (the parked-PR pattern of 2026-08-03).

**Type-checking is not in the pre-commit hook.** Project-wide `tsc --noEmit` can't be scoped to changed files, so running it on every `.tsx` commit was slow + needed ~2 GB + drove people to `--no-verify` (taking the formatters down with it). **CI runs the identical check** (`yarn typecheck` in `.github/workflows/lint-js.yml`), so nothing is lost. To catch type errors locally before pushing, run it yourself once:

```bash
NODE_OPTIONS="--max-old-space-size=2048" yarn typecheck
```

(On the mainframe dev server the memory flag is already set in `/etc/profile.d/mainframe.sh`.)

## CI gates

**Two checks gate a merge into `shadow`: `lint` and `build (production)`.**
(`main` requires `lint` only.) Everything else still runs on PRs — keep it
green — but cannot block the merge.

Why those two. `lint` is fast (about 2.5 min) and catches the formatting and
style drift that would otherwise reach review. `build (production)` costs about
the same and runs alongside it, so requiring it adds roughly nothing to the
wait — and it closes a gap `lint` provably cannot see: **the eslint config does
not match `.jsx` files at all**, so a broken router can pass lint and
type-checking and still fail to build.

The Ruby suite (`test (.ruby-version)`) takes about 15 minutes, which _was_ the
queue's entire latency back when it gated; taking it off the merge path cut
merges from ~15 min to ~2 (see `docs/decisions.md`, 2026-08-02). It is
now a **release** gate rather than a merge gate — step 1 of **Releasing**. The
suite is flaky under parallel CI, so **`rspec-retry`** retries a failed example
up to 3× **on CI** (not locally, so flakes still surface in development).

The main `test` job skips `spec/system` and image-processing specs. They run in
their own jobs in `.github/workflows/test-ruby.yml` — **End to End testing**
(browser specs, and the non-browser system specs via `bin/rspec spec/system`)
and **ImageMagick tests** — on every PR and push but not in the merge group, so
they report before you queue without slowing the queue. A merge into
`shadow` reruns them (and the 3.3 Ruby leg) on the new tip whenever it touches
Ruby, config or the database — those push runs are what step 1 of
**Releasing** reads.

> **A green queue is not a green suite.** A red `test` will **not** stop your PR
> merging. Read it before you queue — the queue won't do it for you. And note
> `test` and `test (.ruby-version)` are _different jobs_: the first is
> JavaScript, the second is rspec. Check the one you mean.

`check-i18n` is green and gates nothing, but **a red one now means something
real** — it was red for months for reasons that have since been fixed (#1968).
The usual cause is that `app/javascript/mastodon/locales/en.json` was not
regenerated after a PR added or removed copy. English still renders (react-intl
falls back to the `defaultMessage` in source), so only translators are
shortchanged — but fix it in the same PR: run `yarn i18n:extract` and commit
the diff.

Kronk's server-side strings live in `config/locales/kronk/overrides.yml`, kept
apart from upstream's `en.yml` so our diff against upstream stays clean. Do not
fold them in with `i18n-tasks normalize`.

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
- **Ruby Linting** — RuboCop, Brakeman and `bin/lint-korner-docs` (every
  korner has its `docs/spaces/<slug>.md`).
- **Haml Linting** — haml-lint.

`check-i18n` is a separate check, not part of `lint`.

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

## Code Rules

- **Hold to "What Kronk holds to"** and **build Kronk-native** (see above).
- **Federation is closed, not a constraint** — but leave the ActivityPub code in place.
- **No instance in the code** — no hardcoded `kronk.info` or community content.
- **Change Mastodon's engine as little as it takes**; Kronk's surface is ours.
- **Don't remove branding** — logo, wordmark and welcome email are deliberate.
- **Never query user personal data** from the database.
- **No secrets in the repo** — it is public.

## Hard Limits

- **Never commit directly to `main` or `shadow`** — always via a branch + PR.
- **Contributors never merge to `main`** — the maintainer merges in the GitHub UI.
- **Never edit, push to, or close another contributor's branch or PR** — read for context only.
- Merge authority, deploy authority, and the release policy are defined in the private infra runbook — do not infer them from names or hosts.

## Useful Links

- Instance: https://kronk.info
- Shadow: https://shadow.kronk.info
- Issues: https://github.com/Kronkverse/kronk/issues
