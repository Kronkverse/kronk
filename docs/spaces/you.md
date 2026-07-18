# YOU (`you` — portal)

**Manifest:** `config/korners/you.yaml` · **Mount:** `/hub/you` · **Status:** portal (link-out to Kashka's PWA)

## Purpose

YOU is a **portal** — a Kronk-native entry point that leads users out
to Kashka's YOU PWA (repo:
[`Kashka-25/you-app-build`](https://github.com/Kashka-25/you-app-build)),
a gamified personal-growth app for tracking values, streaks, avatar
("Seed Being"), Memory Bank, mood, and kosmic rhythms.

**The portal shape IS the target**, not a shim. YOU keeps its own
aesthetic and surface on its own domain; Kronk hosts the discoverable
door. Deeper YOU↔Kronk wiring (shared auth, YOU signals on Kronk
profile) will land at the auth / data-projection layer via the
Anthemos membrane — not by absorbing YOU into Kronk.

## Anthemos context

YOU is Kronk's first **pod client**. Per
`/home/shared/rebuild/memory/reference_kronk_anthemos_architecture.md`,
Anthemos is the personal-pod infrastructure (self-hosted, capability-
tokened, schema-neutral); YOU is one app on top of it defining
personal-growth schemas. Kronk is a social-fabric *consumer* of the
pod via the membrane. Multiple apps (habit tracker, reading log, etc.)
may later sit alongside YOU inside the same pod.

See memory `project_kronk_token_system.md` and
`reference_kronk_vocab_mates.md` for adjacent 2.0 subsystems.

## Current shape (shipped alpha.49 + alpha.50)

- **Manifest** — `config/korners/you.yaml` with the Standard's
  canonical nested `security:` block. `enforced: false` (portal, no
  Kronk-side resources).
- **Route** — `/hub/you` mounts `YouPortal` (async-components entry).
- **Component** — `app/javascript/mastodon/features/you_portal/index.tsx`.
  Landing card: hero (glyph + title + "Your Own Universe" subtitle),
  intro paragraph, bulleted list of what YOU offers, big "Open YOU"
  CTA opening the external app in a new tab, "How it fits together"
  section explaining the portal-is-target framing.
- **Icon** — wired in `hooks/useKornerIcon.tsx`: slug `you` →
  `AccountCircleIcon` (self/identity, proxy for the `self_improvement`
  icon which isn't shipped in the material asset set).
- **SCSS** — `_you_portal.scss`, in the stylelint governance list per
  Standard §L7.
- **Node** — `you.index` node with `lifecycle: soon`, `bucket: hub`.

## Deferred (post-2.0.0 or blocked on Anthemos)

- **Shared auth** — log-in-with-Kronk-DID or sibling clients against
  Anthemos.
- **YOU signals projected onto Kronk profile** — the profile
  prototype at `docs/prototypes/kronk-profile-redesign.html` already
  shows a "✓ Anthemos" chip pattern; wire it when the membrane ships.
- **Real YOU URL** — the constant `YOU_PORTAL_URL` in
  `features/you_portal/index.tsx` currently defaults to
  `https://you.kronk.info`; update once Kashka's Netlify URL is
  confirmed and/or when Kronk sets up a config surface for
  external-korner destinations.

## Related

- `../rebuild/plans/` — no active YOU-integration draft (the
  discussion lives in this file + the manifest + the component
  comments).
- `/home/shared/inbox.md` — the 2026-07-17 tal/mainframe → portal-me
  note documenting the initial YOU-portal Standard conformance work
  and asking portal-me to extend `korners doctor` per Standard §3
  (which they subsequently did).
