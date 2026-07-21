# Remaining-work backlog — 2026-07-20

> Companion to `phase_audit_2026-07-20.md`. That audit covered the 14
> implementation-plan phases. This sweep read the **rest** of the docs — the
> spec, `docs/spaces/*`, `docs/korners/*`, settings docs — with four parallel
> readers, verifying each described feature against code. Only items **not**
> already in the phase audit are listed.
>
> **Read the tiers correctly.** Tiers 0–2 are concrete gaps/bugs/cleanups in
> shipped surfaces. **Tier 3 is product _vision_ from the space docs** — the
> per-korner UI roadmap. Much of it is design-track and not necessarily
> committed 2.0 scope; it is captured here so it's visible, not to imply it all
> blocks release. Tal decides what's 2.0 vs later.
> Effort: S = <½ day · M = 1–3 days · L = multi-day/design-heavy.

## Tier 0 — Bugs & quick correctness fixes

| Item                                                                                                                                                                                              | Evidence                                                                  | Effort |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------ |
| `settings.account` + `settings.data` nav nodes lead nowhere — declared with URLs but no route/component                                                                                           | `config/kronk_nodes.yaml:291,297`; no route in `config/routes.rb:187-193` | S      |
| Verify SPA `/settings/privacy` covers the classic fields (`indexable`/`noindex`, `hide_collections`, `show_application`) — GET→SPA is intentional, but confirm these aren't stranded classic-only | `Settings::PrivacyController` vs `features/privacy_settings/`             | S      |
| `default_quote_policy` absent from posting settings API (lives only in credentials)                                                                                                               | `app/controllers/api/v1/settings/posting_controller.rb:17-21`             | S      |
| Wachuneed `subcategory` column doc says "retires" but persists + is serialized                                                                                                                    | `docs/spaces/wachuneed.md`; `app/models/listing.rb`                       | S      |
| `fetch_link_card` `ALLOWED_LOCAL_PATHS` lists legacy korner paths, not `/hub/<slug>`                                                                                                              | `app/services/fetch_link_card_service.rb:38`                              | S      |
| Dead `interactions.must_be_follower`/`must_be_following` settings keys (writeable, wired to nothing)                                                                                              | `app/models/user_settings.rb:67-68`                                       | S      |

## Tier 1 — Doc corrections (mislead a contributor today)

**Cleared 2026-07-20** (docs cleanup PR). All three resolved:

| Item                                                                                 | Resolution                                                                                                                                     |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `adding_a_korner.md` "3 false statements" (Hub, `hub_registered`, Kuestions tables)  | Already corrected in-repo — Hub section now states it's shipped, no such field, tables shipped.                                                |
| `anatomy.md` self-stale — retired `planets.tsx`/`--space-color` described as current | Rewritten: planet layer removed from diagrams/table/walkthrough; icons via `useKornerIcon`, manifest doctor-validated.                         |
| Spec §13 lists already-resolved items as open                                        | Already trimmed — §13 marks token generation (§3.4) resolved; remaining forks are genuine (hard-mount, `render_target`, subscription posture). |

## Tier 2 — Framework-level gaps

| Item                                                                                                                                                                        | Evidence                                                       | Effort    |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | --------- |
| **Launch card (§8.7)** declared in 10 manifests, parsed by registry, but no producer/service exists — the one-time launch announcement never projects                       | `kronk_korner_registry.rb:184`; grep of services/workers empty | M         |
| **Korner tombstones / 410 Gone (§5.6)** — only AP Statuses tombstone; korner objects (Listing etc.) have no `deleted_at`/410 resolution                                     | `app/models/tombstone.rb` (Status-only)                        | M         |
| **L7 stylelint-governance doctor check** — §3 lists it as ⚙︎ but `korners.rb` implements L1/L3/L4/L5/L10 only                                                              | `lib/mastodon/cli/korners.rb`                                  | S         |
| **Core-space manifests** for Feed/Profile/Hub — "every space gets a manifest" is 1/4 done (only `nudges.yaml`); reserved-slug check must first distinguish core from korner | `config/korners/`; `reserved_slugs.yaml`                       | M         |
| **`render_target` inert (§9.1)** — every manifest sets it; nothing consumes it; app-shell path unbuilt (also open decision §13.2)                                           | `config/korners/kommons.yaml:8`                                | L / defer |
| `_status_korner_card.scss` TODO: hardcoded `#fff` → `--text-on-accent` token                                                                                                | `_status_korner_card.scss:37`                                  | S         |

### Settings-retirement track (not a plan phase; blocks retiring classic /settings)

| Item                                                                                                                | Evidence                                                | Effort |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------ |
| Account & Security (2FA, sessions, apps, migration, delete, export/import) still classic-only; must rehome          | `config/kronk_nodes.yaml` `settings.account`; no SPA    | L      |
| Automated post deletion (`AccountStatusesCleanupPolicy`, 10 fields) links out to classic Rails; no SPA              | `features/navigation_panel/components/more_link.tsx:75` | M      |
| Nudges hasn't absorbed notification-email prefs (`notification_emails.*`, `always_send_emails`, `software_updates`) | `config/korners/nudges.yaml` settings                   | M      |
| Profile composer can't edit avatar/header/display-name yet advertises `lifecycle: live`                             | `features/profile_compose/index.tsx:44-46`              | M      |

## Tier 3 — Per-space UI / feature roadmap (from `docs/spaces/*` — vision, not all 2.0)

The recurring reality: backend shipped, **per-korner UI largely unbuilt**. Grouped by space; each is design-heavy (mostly L).

- **Groups → Krew:** audience-scoping (the central promise — posts are currently normal public Statuses merely tagged to a group), Krew badge in timeline, listed/unlisted + invite links, Event↔Krew bidirectional, and the `groups`→`krew` URL/vocab rename. `groups/statuses_controller.rb:35-47`.
- **Wachuneed:** listing detail + composer UI, the 5 interaction modes, "or trade" flag, mate-affinity signals. `features/wachuneed/index.tsx` is discovery-only (its own header says detail/composer are follow-ups).
- **Kommons:** backing/token UI (backing is console-only today), token display glyph, "reflect on this page" button.
- **Kuestions:** swipe deck, answer-format field (free-text/MC/yes-no), daily-prompt post-box, answer edit history.
- **Kalendar:** birthdays, event visibility scopes, Krew-spawn-from-event, RSVP playful labels (S, copy), spiral view, Inflow→Kalendar celestial projection.
- **Huddle:** Main Huddle + per-Krew Huddle model (current model is host-scheduled sessions), flat moderation, capacity cap.
- **Booth:** `kind` taxonomy, BoothSeries primitive, save/library + live listener count, storage migration to `spaces/booth/`.
- **Inflow:** unified dashboard (retire the 4 strand tabs), observations user-response UI, Kosmic subscribe toggle. (Kosmic feed projection itself is being redesigned — deferred.)

## Tier 4 — Open decisions (Tal)

- Spec §13 unresolved forks: `render_target` default (§13.2), subscription default posture (§13.3), naming-grammar rule-vs-default (§2), notification transport UnifiedPush vs FCM (§9.2).
- Nudges "pillar move" — promote to a top-level nav pillar? (PR #331 closed pending the nav call.)
- You-portal / Anthemos membrane items — post-2.0, membrane-blocked.
- Wachuneed "fully shipped" in the phase audit is over-stated for UI — reconcile against Tier-3 Wachuneed items before release.

## Suggested first moves

Tier 0 + Tier 1 are a clean sweep of small, verifiable fixes (one PR each or a bundled cleanup PR) that remove real dead-ends and stop the author-facing docs lying. Tier 2's launch card + L7 check + core-space manifests are the framework's genuine remaining gaps. Tier 3 is the "2.0 UI rebuild" — a program of work to scope with Tal, not a checklist to blast through.
