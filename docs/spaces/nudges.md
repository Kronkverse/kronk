# Nudges (`nudges`)

**Manifest:** `config/korners/nudges.yaml` (`core: true`, `enforced: true`) ·
**Mount:** `/nudges` (top-level — there is no `/hub/nudges` route) ·
**Status:** top-level pillar shipped; activity feed live; wider rework in progress.

Nudges is a **core space and a top-level navigation pillar**, not a korner
reached from the Hub grid. It sits in the primary switcher alongside **Me** and
**Home** (`app/javascript/mastodon/features/ui/components/hub_switcher.tsx`),
mounts at `/nudges` (routes `/nudges`, `/nudges/activity`, `/nudges/:accountId`),
and carries the unread badge. The earlier "pillar move" question (PR #331) is
settled: the manifest is `core: true`, `enforced: true`, and it's in the switcher.

## Purpose

The unified **activity surface** — Kronk's replacement for the notifications
bell, presenting activity directed at you in a chat-like form rather than a
passive notification list. Membership vocabulary is _tune in / tune out_.

## Rebuild status (2.0.0)

Partially landed — Phase 5 is the least-complete phase per
[`../rebuild/phase_audit_2026-07-20.md`](../rebuild/phase_audit_2026-07-20.md):

- Activity feed + switcher pillar: **shipped**.
- Bell removal (5.5) and the unified Nudges UI (5.1/5.2): **pending**.
- **Notification preferences fold into Nudges.** Per
  [`../kronk_settings_ia.md`](../kronk_settings_ia.md) §3 ("Notifications ≡
  Nudges") and the settings section-cut decision (see `../rebuild/decisions.md`),
  there is no standalone Notifications settings page — notification prefs
  (`notification_emails.*`, `software_updates`, push, per-activity toggles) move
  here. The classic `NotificationsSettings` and the `settings.notifications`
  registry node still stand; folding them in is open work.

## Related

- [`../kronk_korner_spec.md`](../kronk_korner_spec.md) — framework spec.
- [`../kronk_settings_ia.md`](../kronk_settings_ia.md) §3 — Notifications ≡ Nudges.
