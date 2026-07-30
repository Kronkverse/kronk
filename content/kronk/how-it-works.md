---
title: How Kronk works
updated: 2026-07-21
---

Kronk is a Mastodon fork, but it is organised differently. Where a
stock instance is one monolithic timeline app, Kronk is a small
framework with feature spaces plugged into it. This page explains the
shape so the rest of the platform is legible.

## Korners

A **korner** is a feature space — Kommons for governance, Kalendar for
events, Booth for music, Kuestions for Q&A. Each korner is declared by
a **manifest** (a YAML file under `config/korners/`) that states its
identity, the resources it owns, how it stores data, how it projects
into the feed, and what settings it exposes. Shipping something new
means writing a manifest and its code — not lobbying for a redesign.

Every korner mounts under `/hub/<slug>` and shares one visual identity
(the Kronk-purple palette); differentiation comes from icon, name, and
content, not colour.

## Pillars

Alongside the korners sit a handful of **core pillars** — the spaces
that are part of Kronk itself rather than a feature plugged into it:

- **Home** — your timeline.
- **Profile** — you, and how you present.
- **Hub** — the grid of korners.
- **Nudges** — activity and notifications.
- **Settings** — your preferences.
- **Kronk** — this space: who we are, what we value, how we work.

## Kommons — building Kronk in the open

**Kommons** is where the community builds Kronk together. Anyone can
plant a **proposal** — a suggested change to a specific part of the
platform. A proposal is not a place; it is a piece of feedback that
sits _within_ the surface it concerns. The **Skeleton** and **Lattice**
are two views of the same map: every real page in Kronk is a node, and
the proposals about that page gather on it.

The 2.0.0 rebuild is itself tracked this way — the work still to do
lives as proposals on this page and across the korners they touch. So
the platform is, increasingly, built by using the platform.

## Federation & privacy

Kronk speaks ActivityPub: you can follow Kronk accounts from any
Mastodon instance, and we federate with the peers we choose to. There
is no tracking and no analytics — not as a promise, but because the
data isn't structured for it. See [Privacy](/kronk/privacy) and
[Values](/kronk/values) for the principles behind that.

For contributors, `docs/kronk_korner_spec.md` in the repo is the
technical specification this page paraphrases.
