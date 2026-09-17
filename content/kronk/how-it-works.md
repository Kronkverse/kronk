---
title: How Kronk works
updated: 2026-09-15
---

Kronk is a Mastodon fork, but it is organised differently. Where a
stock instance is one monolithic timeline app, Kronk is a small
framework with feature spaces plugged into it. This page explains
the shape so the rest of the platform is legible.

## Korners

A **korner** is a feature space — Kommons for governance, Kalendar
for events, Booth for audio, Moments for micro-photos, Albutts for
albums, Kuestions for Q&A, Wachuneed for asks, Kronikles for long
writing, and more. Each korner is declared by a **manifest** (a
YAML file under `config/korners/`) that states its identity, the
resources it owns, how it stores data, how it projects into the
feed, and what settings it exposes. Shipping something new means
writing a manifest and its code — not lobbying for a redesign.

Every korner mounts under `/hub/<slug>` and shares one visual
identity (the Kronk-purple palette); differentiation comes from
icon, name and content, not colour.

## Mates and reach

Kronk drops one-way following entirely. Every person-to-person
relationship is a **Mate** — mutual, formed by request → accept,
both sides consent.

Reach flows out along a single scale:

- **Mates** — your mutual connections.
- **Orbit** — Mates of Mates, one hop out.
- **Kommunity** — everyone on this Kronk.

The same scale governs both what you see (feed width in
`/home/settings`) and how far a post radiates (visibility in the
composer). **Just me** sits below the ladder — a post visible on
your profile timeline only, no fan-out.

**Krews** are an orthogonal group axis. A post carries exactly one
reach tier and, independently, any set of Krews it targets — its
members see the post whether or not they're on your Mates graph.

## Pillars

Four spaces sit in the top-of-app switcher (**Me / Home / Hub /
Nudges**), reachable in one tap from anywhere:

- **Me** (`/me`) — a radial wheel of self-actions (your profile,
  Mates, Timeline, Settings, Kronk, invite, sign out).
- **Home** — your feed, filtered by the Mates / Orbit / Kommunity
  scale you pick in `/home/settings`.
- **Hub** — the grid of every korner.
- **Nudges** — activity, in a chat-form messenger rather than a
  bell. Person-to-person and korner-triggered events land here.

Two further "meta" spaces sit on the /me wheel:

- **Settings** — appearance, posting, privacy, notifications,
  account, data — arranged as its own wheel of sections.
- **Kronk** — this space: who we are, what we value, how we work.

## Kommons — building Kronk in the open

**Kommons** is where the community builds Kronk together. Anyone
can plant a **proposal** — a suggested change to a specific part
of the platform. A proposal is not a place; it is a piece of
feedback that sits _within_ the surface it concerns. The
**Skeleton** and **Lattice** are two views of the same map: every
real page in Kronk is a node, and proposals about that page gather
on it.

The 2.0.0 rebuild is itself tracked this way — the work still to
do lives as proposals on this page and across the korners they
touch. The platform is, increasingly, built by using the platform.

## Federation and privacy

Kronk speaks ActivityPub: you can follow Kronk accounts from any
Mastodon instance, and we federate with the peers we choose to.
There is no tracking and no analytics — not as a promise, but
because the data isn't structured for it. See
[Privacy](/kronk/privacy) and [Values](/kronk/values) for the
principles behind that.

For contributors, `docs/kronk_aesthetic_system.md` is the visual +
tokens reference, `docs/kronk_korner_spec.md` covers the manifest
schema, and `docs/spaces/` holds one canonical doc per space in
the platform.
