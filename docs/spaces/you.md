# YOU (`you` — portal)

**Manifest:** `config/korners/you.yaml` · **Mount:** `/hub/you` ·
`enforced: false` (portal)

## Purpose

YOU is a **portal**: a Kronk page that leads people out to Kashka's YOU
app (repo:
[`Kashka-25/you-app-build`](https://github.com/Kashka-25/you-app-build)),
a personal-growth app for values, streaks, an avatar ("Seed Being"),
Memory Bank, mood and kosmic rhythms.

**The portal shape is the target, not a shim.** YOU keeps its own look
on its own domain; Kronk hosts the door. Deeper wiring (shared sign-in,
YOU signals on the Kronk profile) is meant to come through the Anthemos
membrane, not by absorbing YOU into Kronk.

## Anthemos context

YOU is meant to be Kronk's first **pod client**. Anthemos is personal-pod
infrastructure (self-hosted, capability tokens, schema-neutral); YOU is
one app on it, and Kronk would read from the pod through the membrane.
See [`../decisions.md`](../decisions.md) for the decision to park the
membrane work until Anthemos exists.

## What is built

- **Manifest** — no Kronk-side resources, tables, permissions or feed
  card. `portal.url` is `https://you.kronk.info`. Icon `snowflake`.
  `enforced: false` because it owns nothing; the Hub still shows it as
  live because it has a `portal.url`.
- **Page** — `/hub/you` mounts `YouPortal`
  (`app/javascript/mastodon/features/you_portal/index.tsx`): a hero, a
  short intro, a list of what YOU offers, an "Open YOU" button that opens
  the external app in a new tab, and a "How it fits together" section.
  The URL comes from the manifest's `portal.url`, with a hard-coded
  fallback for when the manifest hasn't loaded.
- **Styles** — `app/javascript/styles/mastodon/_you_portal.scss`.
- **Node** — `you.index`, `/hub/you`, `lifecycle: live`, `bucket: hub`.

## Deferred

Blocked on Anthemos (see [`../decisions.md`](../decisions.md)):

- **Shared sign-in** — log in to YOU with a Kronk identity.
- **YOU signals on the Kronk profile** — the "✓ Anthemos" chip in
  `docs/prototypes/kronk-profile-redesign.html`.
- **A "Connected apps" settings surface** — see and revoke what YOU (or
  any pod client) can access. It belongs in Account & Security, and YOU
  would be its first entry.

## History

Rewritten 2026-10-05 to describe what is built. Earlier notes:
`git show 231cca937:docs/spaces/you.md`.
