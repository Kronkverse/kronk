# Remaining-work backlog — 2026-07-23

> Supersedes `remaining_work_2026-07-20.md`. Refreshed after the
> Kuestions v2 completion, the KronkFrame + shared space-chrome
> landing, and the Nudges Phase 2 push. Effort: S = <½ day · M = 1–3
> days · L = multi-day/design-heavy.

## Since 2026-07-20 — what moved off the board

The prior doc + the live status board at talitamoss.info/rebuild-status.html
both lag reality. Confirmed shipped on `rebuild/2.0.0` (tip alpha.189):

- **Kuestions v2 complete** — Phases 1–3a landed (alpha.130s–.157).
  Board still labels this "still pending". It's done: dedicated
  `Question` + `Answer` models, panels wired (Deck / Today /
  Answered / Ask / Settings), legacy Status-polymorphic Q&A
  swept, `docs/kronk_frame.md` slot contract adopted.
- **KronkFrame + shared space chrome landed end-to-end** — PRs
  #585–#613 (alpha.176–.187). Docs at
  `docs/kronk_frame.md`, prototypes at `docs/kronk_frame_prototype_v*.html`
  on branch `docs/frame-prototype`. Covers:
  Frame wrapper, fade bands migrated off `body::before`/`body::after`,
  chrome un-fixed into slots, `.columns-area` padding-top hack retired,
  `<SpaceBadge>` + `<AutoSpaceBadge>` frame-provided on every
  `/hub/<slug>` route via `SLUG_TO_GLYPH`, `<SpaceViewPicker>` +
  `<AutoSpaceViewPicker>` via `SLUG_TO_VIEWS` (Kuestions only for
  now).
- **Profile composer** — PRs #352 (Ӂ-menu entry) + #353 (Me-tab
  card render) both **merged 2026-07-17**. Board still shows them
  as drafts; that's stale by six days.
- **Kommons Tree standalone surface** — Directory + Lattice
  operational; #601 named it "Directory". Board says "partial".
  It's live.
- **`tsc` gate green** — `NODE_OPTIONS=--max-old-space-size=3072
./node_modules/.bin/tsc --noEmit` returns clean (0 errors) on the
  current tip. Board still says "~12 pre-existing errors — gate
  red". Not any more.
- **`aws/` history purge** — commit `ae202349b` removed the 226MB
  aws/ tree. `git rev-list --objects --all | grep '^aws'` returns
  empty. Board still shows this in "work".
- **Nudges Phase 2** — Krew + Mate conversations, read receipts,
  mute, leave, member-joined events. Board says
  "Notifications≡Nudges cutover (Phase 5) mostly unbuilt"; that's
  the Phase 5 _cutover_, which is different from Phase 2 primary
  surface. The primary surface is live.
- **Kommons token/Koin system** — wallet redesign, Minted Kin coin
  badge, backing-with-tokens wiring (alpha.169–.175). Not
  itemized on the board.
- **"Propose a new Korner" flow shipped** — the structured Korner
  Composer at `features/governance/propose_page.tsx`, reached via the
  `kommons.propose` node → `/hub/kommons/propose` (#629, alpha.196).
  Not reflected on the board.

## What's genuinely still open

### Release-critical (Phase 14 gate)

| Item                                                                                        | State | Effort                     |
| ------------------------------------------------------------------------------------------- | ----- | -------------------------- |
| Flip `tune_in_enforced` + `SEARCH_BACKEND` defaults (spec §14.1)                            | todo  | S                          |
| Bump version alpha.189 → **2.0.0** + regenerate CHANGELOG + retire `docs/spaces.md` (§14.2) | todo  | S                          |
| Single PR to `main` (§14.3)                                                                 | todo  | S — after everything below |

### Framework + korners — still genuine gaps

| Item                                                                                                                                                     | State | Effort                    |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ------------------------- |
| Nudges Phase 5 cutover — retire the classic notifications bell UI _for real_ (currently CSS-hidden)                                                      | work  | M                         |
| Huddle Phase 9.5 — event bus wiring (Phase 9.1–9.2 models shipped; 9.3–9.5 pending)                                                                      | work  | M                         |
| Nudges hasn't absorbed notification-email prefs (`notification_emails.*`, `always_send_emails`, `software_updates`)                                      | todo  | M                         |
| **moments / albutts / kompass** — manifests set `enforced: false`; no models. Phase 13 stubs (each a "coming soon" card).                                | todo  | S each × 3                |
| **klot** — manifest-only; runtime lives on `dev/tbone` (not merged)                                                                                      | todo  | L (out-of-scope for 2.0?) |
| CLAUDE.md must-read line for the Standard before editing `config/korners/*.yaml`                                                                         | todo  | S                         |
| ~~L7 stylelint-governance doctor check~~ — **DONE** (alpha.196): `korners.rb` now implements the L7 check + `stylelint_governance_list` helper, so the doctor gates L1/L3/L4/L5/L6/L7/L10 | done  | —                         |
| ~~Core-space manifests for Feed/Profile/Hub~~ — **DONE**: `config/korners/{feed,hub,profile,settings}.yaml` all present; doctor distinguishes core via `manifest.core?`                                  | done  | —                         |
| Launch card (§8.7) declared in 10 manifests, parsed, but no producer/service — the one-time launch announcement never projects                           | todo  | M                         |
| Korner tombstones / 410 Gone (§5.6) — only AP Statuses tombstone; Listing etc. have no `deleted_at`/410 resolution                                       | todo  | M                         |
| `render_target` inert (§9.1) — every manifest sets it; nothing consumes it (also open decision §13.2)                                                    | todo  | L / defer                 |

### Settings retirement — blocks retiring classic /settings

| Item                                                                                                                                                         | State | Effort |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- | ------ |
| **Account & Security** (2FA, sessions, apps, migration, delete, export/import) — still classic Devise/Doorkeeper. `settings.account` nav node leads nowhere. | todo  | L      |
| **Data** (export/import) — still classic Rails pages; `settings.data` nav node also lands on nothing.                                                        | todo  | M      |
| Automated post deletion (`AccountStatusesCleanupPolicy`, 10 fields) — links to classic Rails                                                                 | todo  | M      |
| Profile composer can't yet edit avatar/header/display-name — the composer itself is `lifecycle: live` but these fields aren't in it                          | work  | M      |

### Tier 0 sweep — small correctness fixes (bundle into one PR)

Copied from `remaining_work_2026-07-20.md`; none moved off the list:

| Item                                                                                                                                                | Effort |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `settings.account` + `settings.data` nav nodes lead nowhere (declared with URLs but no route/component)                                             | S      |
| Verify SPA `/settings/privacy` covers `indexable`/`noindex`, `hide_collections`, `show_application`                                                 | S      |
| ~~`default_quote_policy` absent from posting settings API~~ — **DONE**: now in `PostingController::FIELDS` + serialized (the private→`nobody` coupling is still not reproduced in the API)          | —      |
| Wachuneed `subcategory` column doc says "retires" but persists + is serialized                                                                      | S      |
| `fetch_link_card` `ALLOWED_LOCAL_PATHS` lists legacy korner paths, not `/hub/<slug>`                                                                | S      |
| Dead `interactions.must_be_follower`/`must_be_following` settings keys (writeable, wired to nothing)                                                | S      |
| Dead code from Frame migration — `<KornerExit>`, `<SpaceTabs>`, per-panel `.space-title` heroes in Kuestions (retired by spec rule 5 but not swept) | S      |

### Per-space UI vision (design-heavy — mostly post-2.0 unless promoted)

Unchanged from `remaining_work_2026-07-20.md` Tier 3 — Groups→Krew
audience-scoping, Wachuneed detail/composer + 5 interaction modes,
Kommons backing UI (backing itself now works via Koin), Kuestions
swipe deck (deferred; current panels ship on Deck/Today/etc.),
Kalendar spiral view + Krew-spawn-from-event + Inflow→celestial,
Huddle "Main Huddle + per-Krew" model, Booth kind taxonomy +
BoothSeries + storage migration, Inflow unified dashboard + Kosmic
subscribe.

## Suggested path to 2.0.0

Ordered by dependency:

1. **Tier 0 sweep** (one bundled PR, ½ day) — clears 6+ small
   correctness bugs and the Frame dead code. Board still lists
   these as visible gaps.
2. **CLAUDE.md must-read line + L7 doctor check** (~1 hr, one PR).
3. ~~**Feed/Profile/Hub core-space manifests** (M) — parity with
   `nudges.yaml` + `settings.yaml`.~~ **DONE** — all four core manifests
   now exist.
4. **Launch card producer** (M) — Phase 5 side-quest; needed for
   Phase 14 announcement flow.
5. **Nudges Phase 5 cutover proper** — retire the classic bell UI
   (not just CSS-hide) + absorb notification-email prefs into
   Nudges settings. Currently work-M each.
6. **Huddle Phase 9.5** — event-bus wiring. Currently work-M.
7. **Phase 13 stubs** — moments / albutts / kompass "coming soon"
   cards (S each × 3).
8. **Phase 14** — flip enforcement + version + CHANGELOG + main PR.

Not on the critical path:

- **klot backend** — either promote or park as `enforced: false`
  stub for 2.0.
- **Settings Account & Security rehome** — big surface, may ship as
  2.1. Currently the nav pretends it's there.
- **Per-korner design roadmap items** — Krew audience-scoping,
  Wachuneed composer, etc. Program of work.

## Live status board diff

For the board at `talitamoss.info/rebuild-status.html`, the following
state changes reflect reality on 2026-07-23:

| Section             | Item                      | Board says | Actual                                         |
| ------------------- | ------------------------- | ---------- | ---------------------------------------------- |
| Individual korners  | kuestions                 | done       | done ✓ (already correct)                       |
| Individual korners  | tree                      | **work**   | **done**                                       |
| Individual korners  | nudges                    | **work**   | still work — Phase 5 cutover is the gap        |
| Individual korners  | huddle                    | work       | still work — Phase 9.5 pending                 |
| Navigation & chrome | Profile composer via Ӂ    | **work**   | **done** (#352 merged 2026-07-17)              |
| Custom features     | Profile composer polish   | **work**   | **done** (#353 merged 2026-07-17)              |
| Infrastructure      | Project tsc green         | **work**   | **done** (zero errors)                         |
| Infrastructure      | Purge `aws/` from history | **work**   | **done** (commit ae202349b)                    |
| Docs                | Retire stale shared docs  | work       | still work — templates still un-formal-retired |
| Release prep        | CI fully green (tsc gate) | **work**   | **done**                                       |

**New section to add** (not currently on the board):

- **Frame architecture** — six PRs, alpha.176–.187 landed the shared
  space chrome (SpaceBadge/ViewPicker automatic on every `/hub/*`).
  All done.
