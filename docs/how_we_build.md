# How we build Kronk

Kronk started as a Mastodon instance. With 2.0.0 "Rose" (production,
2026-09-20) it became its own platform: its own shape, its own look, its own
vocabulary, its own idea of what a relationship and a feed are. Mastodon is
still in the engine room — but nothing a member sees is "Mastodon with a theme"
any more, and nothing we build next should be.

This doc is the why behind every other rule. `CONTRIBUTING.md` says how to get
a change in; `CLAUDE.md` says exactly how the workflow runs. This says what the
change should _be_. If you only read one doc before building something new,
read this one.

## Where we are

Before 2.0, Kronk was a Mastodon instance with features bolted on, and the
working rule was "touch upstream as little as possible". The rebuild turned
that around. In 2.0:

- **Following is gone.** Every relationship is a **Mate** — mutual, request
  and accept, both sides consent.
- **Mastodon's visibilities are gone.** One reach ladder — Just me, Mates,
  Orbit, Kommunity — sets both how far a post goes and how wide your feed
  reads. **Krews** are a separate group axis on top.
- **The bell is gone.** Activity arrives in **Nudges**, a messenger.
- **The app is a framework, not a timeline.** Four pillars — Me, Home, Hub,
  Nudges — and **korners** plugged into the Hub, each declared by a manifest.
- **Mastodon's pages are mostly gone.** Search, lists, the directory, the
  community and public timelines, the planet metaphor — each
  replaced by a Kronk-native surface or cut (`docs/rebuild/decisions.md`
  records each one).
- **One identity.** Kronk-purple, dark first, everything through tokens, the
  K-grammar in the names.
- **Federation is closed.** Kronk is an invite-only community that does not
  talk to the fediverse today.

The member-facing version of all this is in `content/kronk/` — `about.md` and
`how-it-works.md` — which is what kronk.info shows at `/kronk`. Read them: they
are the clearest statement of what the platform is for.

## What we hold to

These come from the three vows every member makes on the way in — ownership,
custodianship, trajectory — and from the non-negotiables in
`docs/kronk_korner_spec.md` §12. A change that breaks one of them is not a
Kronk change, however good the code.

- **Relationships are symmetric.** No one-way follows, no audiences you did not
  agree to. Anything that lets one person reach another without consent goes
  against the grain.
- **The member holds the lever.** Reach is chosen on the composer; feed width
  is chosen in settings; korners reach your feed only when you tune in. No
  algorithm decides for you, and no feature should add one.
- **No surveillance, no extraction.** No tracking, no data sales, no
  engagement manipulation. Data is not structured for it, and we do not add
  the structure.
- **Governance is in the open.** Anything that changes shared structure —
  reach, the feed contract, the manifest schema, a new korner — is a Kommons
  proposal first. Members can see the roadmap on the instance itself.
- **Present by default, private by choice.** Everyone is part of the community
  from the moment they cross in; discoverability and profile reach are things
  you narrow, not things you earn (`decisions.md`, 2026-08-16).

## How we build

**Build Kronk-native.** When a Mastodon surface is in the way, replace it with
a Kronk one rather than restyle it. That is how 2.0 was built and it is how we
keep going: `/explore` is still a Mastodon placeholder because nothing
Kronk-native replaced it yet, and that is the right status for it — a gap
waiting for a korner, not a page to polish.

**Everything is a space.** New functionality lives in a space. A big new
thing is a korner, with a manifest in `config/korners/`, mounted at
`/hub/<slug>`, meeting `docs/korners/korner_standard.md`. A smaller thing lives
inside the space it belongs to, and that space's doc in `docs/spaces/` says how
it is meant to work.

**Use the shared systems as they are.** Tokens, the component kit, the
`ComposeShell`, the feed card, the auth layer, the event bus. A korner that
needs something they do not do proposes a change to the shared system; it does
not fork it quietly. That is what keeps thirty spaces feeling like one place.

**Speak Kronk.** Korner, Mate, Orbit, Kommunity, Krew, tune in, nudge, froth,
Hub. The full lexicon is in `docs/kronk_korner_spec.md` §2 and §14. In code and
the database, Mastodon's names stay (`favourite`, `subscription`) —
renaming the engine's internals buys nothing and costs every upstream merge.

**Look like Kronk.** One palette, no per-korner brand colour, dark first with
light as a mirror, named radius tokens, no raw values. The reference is
`docs/kronk_aesthetic_system.md`, and stylelint enforces the core of it.

**Write it down where the next person will find it.** A structural decision
goes in `docs/rebuild/decisions.md`, dated, with the reasoning. A doc that is
wrong gets a PR. Notes kept outside the repo drift, and the person who needs
them cannot see them. When the code and a doc disagree, the code wins and the
doc gets fixed.

**Keep the checks honest.** A check that is red by habit teaches people to
ignore red. If a check is failing for a known reason, fix the reason or remove
the check; do not leave it red.

## Mastodon underneath

Kronk is ours from the surface down to the product logic. Underneath it,
Mastodon is still the engine — Rails, the database layer, accounts and
sessions, media, the API plumbing, background jobs — and we still take
upstream's releases for that engine: security fixes and framework upgrades
reach us that way. Rails 8.0 reaches end of life on 2026-10-07, and merging
Mastodon 4.6 is how we move to Rails 8.1 (`docs/rebuild/upstream-merge.md`).

So there are two kinds of code, with different rules:

- **Kronk's surface and product** — the web client, the spaces and korners,
  copy, the design system, Kronk's own models and services. This is ours. Change
  it freely, replace Mastodon's version outright, delete what Kronk no longer
  uses.
- **The engine** — Mastodon's backend and core. Change it when Kronk needs to,
  but as little as it takes: prefer adding a Kronk file (`app/lib/kronk/`, a
  new service, a concern) to editing an upstream one, and keep Kronk strings in
  `config/locales/kronk/overrides.yml`, not upstream's locale files. Every line
  changed here is a conflict in the next upstream merge, and the 2026-09 trial
  merge had 345 of them.

Two specific rules follow from this:

- **Never put a Kronk version into `Mastodon::Version`.** Kronk's version lives
  in `lib/kronk/version.rb`. Mastodon's number tracks which upstream we are on.
- **Deleting a Mastodon file is a real choice.** Once it is gone, every
  upstream change to it becomes a conflict to resolve as "stay deleted". That
  is fine for a surface Kronk has replaced; it is expensive for engine code.

## Federation, and Kronk 3.0

**Federation is closed, and it is not a constraint on new work.** Production
federates with no one (limited federation mode, empty allowlist —
`decisions.md`, 2026-09-16). Do not shape a Kronk feature around ActivityPub
compatibility, and do not hold back a design because Mastodon's federation
model would not support it.

**But leave the ActivityPub code in place.** It is engine code, it is switched
off, and removing it would add a large conflict surface to every upstream merge
for no gain while it is off. When Kronk's own federation is designed, that is
the moment to decide what of Mastodon's survives.

**Where it is going.** The 3.0 direction is a Kronk-native federation, built so
other communities can run their own Kronk and connect on Kronk's terms — Mates,
consent and reach, rather than Mastodon's open follow graph. That is a new
system and it will be designed as one. What we can do now is not make it
harder:

- **No instance in the code.** Do not hardcode `kronk.info`, Kronk's own
  community details, or anything else that is one instance's choice. Read the
  domain from configuration; put instance content in `content/` and
  configuration, not in components. (Today about a dozen files still hardcode
  the domain — those are debt to pay down, not a pattern to copy.)
- **Keep the community's own words out of the platform.** Rules, terms, the
  about page and the contributor list live in `content/kronk/*.md` so another
  Kronk can write its own.
- **Keep korners self-contained.** A korner declared by its manifest, using
  shared systems, is a korner another Kronk can switch on or off.

## The short version

Build it Kronk-native, put it in a space, use the shared systems, speak and
look like Kronk, hold to the vows. Change Mastodon's engine only as much as
you must. Write your decisions down in the repo. Build so that one day someone
else can run their own Kronk.
