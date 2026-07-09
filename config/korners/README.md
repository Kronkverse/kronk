# `config/korners/*.yaml` — Korner manifest catalog

This directory holds one manifest per Korner: the declaration a space is
built against, per `docs/kronk_korner_spec.md`. The spec is the framework
these files instantiate.

## Status of this catalog — v0.5

These manifests are **retroactively authored from the shipped code** in
each space's respective branch. They describe *what a space actually
does today*, not what the framework aspires to. Fields that don't map
cleanly onto current implementation are marked explicitly:

- `# not-implemented` — feature exists in the spec but the space has no
  code for it yet (subscription is the biggest example: no Korner has
  a per-space subscribe primitive).
- `# implicit` — space currently does this by convention, not by
  reading the manifest (e.g., URL routing is hand-written in
  `config/routes.rb`, not derived from `slug`).
- `# TODO` — needs a decision or a follow-up commit.

The purpose is to make **drift** legible: reading a manifest tells you
exactly how far a space is from framework-conformance.

## Which branch owns which manifest

Not every space lives on `main` yet. Manifests here document the
current state across the ecosystem:

| Korner | Branch of record | Status |
|---|---|---|
| Kommons | `main` | Live in production |
| Kuestions | `main` | Live in production |
| Kalendar (Events) | `main` | Live in production |
| Booth | `main` | Live in production |
| InFlow | `main` | Live in production |
| Nudges | `main` | Live in production |
| Marketplace | `dev/kashka` | Live on shadow |
| Tree | `dev/chris` | Live on shadow |
| Klot | `dev/tbone` | Live on shadow |

A retired space (`flow/` — cycle tracker, superseded by Klot and purged
on `dev/tbone`) is not listed. If it returns, add its manifest with the
lifecycle notes from §10.

## What a first read tells you

Skim the manifests together and the picture is:

- **Storage discipline is mostly there.** Every space's `db_namespace`
  matches its actual table prefix. Nobody is using `spaces/<slug>/`
  paths on DO Spaces yet — Kronk media still lives under Mastodon's
  default `accounts/` and `media_attachments/` roots.
- **Feed projection is the newest convention.** Kommons and Kuestions
  have been projecting for a while; Marketplace was wired in on
  `feature/korner-cards` with the `StatusMarketplaceCard`. Booth still
  needs the reverse status association (see the manifest).
- **Subscription is universally not-implemented.** This is the biggest
  Phase 2 gap: no Korner has a per-space subscribe/mute today.
- **URL grammar is per-space, not under `/hub/`.** Every space today
  mounts at `/<slug>` (e.g. `/governance`, `/klot`). Moving to
  `/hub/<slug>` is a real migration — see §4 of the spec.
- **Manifest enforcement is a design idea, not code.** Reading these
  files is currently informational; nothing at boot rejects a space
  that lacks or mis-declares a manifest.

## Conventions in the YAML

Follows the shape in §1.1 of the spec. Comments preserved inline where
they document a decision or a gap.
