# Nudges (`nudges`)

**Manifest:** `config/korners/nudges.yaml` (`core: true`, `enforced: true`) ·
**Mount:** `/nudges` (top-level — there is no `/hub/nudges` route) ·
**Status:** top-level pillar shipped; unified messenger shipped; bell retired.

Nudges is a **core space and a top-level navigation pillar**, not a korner
reached from the Hub grid. It sits in the primary switcher alongside **Me** and
**Home** (`app/javascript/mastodon/features/ui/components/hub_switcher.tsx`),
mounts at `/nudges` (routes `/nudges` and `/nudges/:conversationId(\d+)`; the
old `/nudges/activity` now redirects to `/nudges`), and carries the unread
badge. The earlier "pillar move" question (PR #331) is settled: the manifest is
`core: true`, `enforced: true`, and it's in the switcher.

## Purpose

The unified **activity surface** — Kronk's replacement for the notifications
bell, presenting activity directed at you in a chat-like form rather than a
passive notification list. Membership vocabulary is _tune in / tune out_.

## Rebuild status (2.0.0)

Core Phase 5 has landed:

- Activity feed + switcher pillar: **shipped**.
- Unified Nudges UI (5.1/5.2): **shipped** — `/nudges` renders the
  Signal-shaped messenger at
  `app/javascript/mastodon/features/nudges_messenger/` (registered as
  `Nudges()` in `features/ui/util/async-components.js`; routed in
  `features/ui/index.jsx`).
- Bell removal (5.5): **shipped** — the notifications bell is gone from the
  nav, and `/notifications`, `/conversations`, `/timelines/direct` and
  `/nudges/activity` all `Redirect` to `/nudges` (`features/ui/index.jsx`).
  The legacy account-scoped view is archived at `/nudges/legacy`.
- **Residual:** the `notifications_v2` directory cleanup.
- **Notification preferences → Nudges (planned, not done).** Per
  [`../kronk_settings_ia.md`](../kronk_settings_ia.md) §3 and
  `../rebuild/decisions.md`, notification prefs (`notification_emails.*`,
  `software_updates`, push, per-activity toggles) are _intended_ to fold in
  here — but a standalone Notifications settings page is **still live** at
  `/settings/notifications` (`settings.notifications`, `lifecycle: live` in
  `config/kronk_nodes.yaml`; `NotificationsSettings` route in
  `features/ui/index.jsx`). Folding it into Nudges is open work.

## Related

- [`../kronk_korner_spec.md`](../kronk_korner_spec.md) — framework spec.
- [`../kronk_settings_ia.md`](../kronk_settings_ia.md) §3 — Notifications ≡ Nudges.
