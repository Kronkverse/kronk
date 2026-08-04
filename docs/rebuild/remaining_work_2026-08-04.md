# Remaining-work backlog — 2026-08-04

> Supersedes `remaining_work_2026-07-23.md`. Refreshed after ~440 PRs
> of drift — the prior doc was authored at alpha.189; the tip today
> is well past 700 PRs into `rebuild/2.0.0`. Effort:
> S = <½ day · M = 1–3 days · L = multi-day/design-heavy.

## Since 2026-07-23 — what moved off the board

The 07-23 doc + live status board at talitamoss.info/rebuild-status.html
have both lagged reality by two weeks. Confirmed shipped on
`rebuild/2.0.0` since:

### New korners — all three "Phase 13 stubs" turned into real surfaces

- **Moments** — end-to-end. Model + composer + Home strip + korner
  page + deep-link viewer + per-Moment visibility (reach ladder +
  krew, editable after posting) + Log archive (never-expiring). Also:
  camera capture in-composer (#1112), photo + voice-clip pairing
  (#1119 backend + composer + strip mic-glyph + viewer waveform;
  spec: `docs/spaces/moments.md`). Voice built on the shared
  `components/media/` module (#1117).
- **Albutts** — shipped end-to-end (alpha.315–.320) across four
  slices: backend models + REST, frontend directory / detail /
  composers + feed card, Mate-gated new-photo fan-out nudges,
  Kalendar `spawn_album` linkage. Since then: Status-backed photo
  refactor (#1028 — AlbumPhoto is now a thin join to Status;
  favourites/replies ride the standard pipeline), zombie-row
  cleanup (#1106 / #1109), autocomplete on caption inputs, drag +
  drop photo picker.
- **Map** — shipped end-to-end as _Map_ (renamed from Kompass at
  alpha.215). **Correction to this doc's first cut:** the backend
  is not TBD — a recheck against the code on 2026-08-04 found the
  full pipeline live: `PresenceState` + `Trek` models,
  `Api::V1::Map::{PresenceController,TreksController}`,
  `Kronk::GeoCoarsen` (server-side raw→fuzzed point) +
  `Kronk::RoutePrivacy` (route trimming), migrations
  `create_presence_states` + `create_treks` (2026-07-24), full test
  coverage. Frontend at `features/map_v2/` polls presence every
  30 s, renders pins + fuzz circles on maplibre, publishes treks
  to a Status at the author-chosen reach for feed projection via
  `trek_card`. Recent activity: PR #1029 (people strip). The
  manifest header claim "backend still to build" is stale and is
  being fixed in the same PR as this correction. Realtime pubsub
  (vs the current 30 s polling) is a 2.1 polish item, not a
  release blocker.

### Phase 5 — Nudges cutover: fully reconciled (2026-08-03 in `implementation_plan.md`)

The classic bell is gone. Nudges is a hub-switcher pillar
(Me / Home / Hub / Nudges) carrying the unread badge. `nudges_legacy`
archives the old surface. `Nudges::Aggregator` + `Nudges::EventRouter`
handle write-side aggregation and cross-korner event routing.
Per-korner unread badges shipped as an 8-layer stack (#1074 → #1088):
`Kronk::KornerSeen` service, `KornerContentStreams` adapters,
mark-seen-on-open endpoint, froth/reblog + Moment-froth clearing hooks,
`unread_count` API, Redux plumbing, Hub + side-nav numeric badges,
tuned-out korners hidden from the rail, Moments strip bright/dim.

The prior doc's "email-prefs absorption" gap is **closed** (#1107 —
Nudges settings expose `always_send_emails`, `email_software_updates`,
etc. via the SPA `/settings/notifications` page — see
`features/notifications_settings/index.tsx`).

### Signup — full revamp shipped

Eight-layer stacked chain (#1061–#1071): new **Screen 1** account
form (single page, avatar + username + email + password, no
confirmation, live client-side username-availability check at
`/auth/username_available`, 20/min throttle), new **Screen 2**
three-threshold ceremony (SVG rings around Ж, one vow per ring,
ripple + cosmos-scale + starfield-warp on each crossing, arrival
panel). Old welcome / rules / privacy pages retired.
`Kronk::Thresholds::CURRENT_VERSION`, `User#crossed_thresholds?`,
HTML-only `require_crossed_thresholds!` gate. Void layout
(`layouts/kronk_void.html.haml`) + cross-screen `kronk_void.ts`
entrypoint. All copy in `kronk.signup.*` + `kronk.thresholds.*`
i18n keys.

### URL consolidation under `/kronk/*`

Three-PR chain (#1097 / #1100 / #1102):

- **#1097** — Booth gated behind auth (external share links break;
  see `decisions.md` if we want them public).
- **#1100** — `/about`, `/privacy-policy`, `/terms-of-service`
  retired as SPA routes → 301 to `/kronk/{about,privacy,terms}`,
  Rails-served markdown from `content/kronk/`. Legacy paths
  permanently 301. Federation instance-actor `url` moved to
  `/kronk/about?instance_actor=true`. SPA `features/{about,
privacy_policy,terms_of_service}` bundles deleted.
- **#1102** — ToS versioning subsystem entirely retired (model +
  generator + policy + serializer + 7 admin controllers + admin
  sidebar entry + interstitial + worker + mailer +
  `/api/v1/instance/terms_of_service*` endpoints). Migration drops
  `terms_of_services` table + `users.require_tos_interstitial`
  column. Policy copy lives at `content/kronk/terms.md`.

### Landing page

Signed-out visitors landing at `/` get an inline sign-in form on
the Kronk void layout (#1108), with the canonical Kronk sigil as
hero (#1110) — not the placeholder React Router redirect to
`/explore` that used to be there.

### Brand chrome

- **Ӂ → Ж breve retirement** (#1115 / #1116) — code + SVG + i18n
  sweep across the platform; the docs also relabelled "Ӂ menu" →
  "Kronk menu" for consistency. Ѻ triple-click easter egg.
- **Brand assets** (#1118) — Ж-rendered PNGs + real-outline SVGs +
  full icon set (favicons, PWA manifest, etc.).

### Profile — rebuild almost complete

Sequenced stack (mostly landed):

- **#1073** — Status serializer: guard `has_one` korner cards by
  their own visibility.
- **#1075 / #1076** — Profile sections drawn-only + ProfileCard
  alignment; new `render` column on ProfileCard (block / chips /
  rail).
- **#1081** — SPA rewrite: shelved skeleton at `/@:acct/shelves`.
- **#1084** — Arrange mode for the shelved profile.
- **#1090 / #1091** — Told-card composer + chosen-order post
  picker.
- **#1093 / #1094** — Real drawn renders per korner + drag-and-drop
  reorder.
- **#1096** — Retire the old SectionedProfile route.
- **#1101** — FollowButton drops the own-account "Edit profile"
  button that used to link to the classic Rails
  `/settings/profile` page (which now diverges from the
  shelved-profile composer).

### Shared media capture — foundation for future korners

- **#1117** — `components/media/` library with `<VoiceRecorder>`,
  `<VoicePlayer>`, `<WaveformBars>`, `useVoiceRecording()`,
  `uploadMediaBlob()`, `<MediaPickButtons>`. Extracted from the
  archived `features/nudges/voices.tsx` (deleted with the PR);
  generic class names in `_media_capture.scss`; deletes four dead
  `.nudge-voice-*` selectors from `components.scss`.
- **#1119** — Moments end-to-end voice pairing: backend, composer, viewer, and strip mic-glyph — see the Moments section above.
- **#1120** — Nudges voice sending _revived_ using the shared
  library. Backend (`voice_attachment_id` on
  `nudges/conversation_message`, `NudgeService`,
  `AccountsController#nudge`) had been in place all along; this
  PR wires the composer + `MessageBubble` back to the pipeline via
  `<VoiceRecorder>` + `<VoicePlayer sent={isSent}>`.

## What's genuinely still open

### Release-critical (Phase 14 gate)

| Item                                                                                                       | State | Effort                     |
| ---------------------------------------------------------------------------------------------------------- | ----- | -------------------------- |
| Flip `tune_in_enforced` + `SEARCH_BACKEND` defaults (spec §14.1)                                           | todo  | S                          |
| Bump `MILESTONE` from `2.0.0-alpha` → **`2.0.0`** + regenerate CHANGELOG + retire `docs/spaces.md` (§14.2) | todo  | S                          |
| Single PR to `main` (§14.3)                                                                                | todo  | S — after everything below |

### Framework + korners — still genuine gaps

| Item                                                                                                                                                                                                                                                                                                                                                                                                                                                              | State | Effort    |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | --------- |
| **Map realtime pubsub** — presence refresh is 30 s HTTP polling; realtime pubsub would give sub-second pin updates. Not a release blocker; parked for 2.1. _Earlier draft of this doc claimed the whole Map backend was TBD — that was wrong (backend shipped alpha.270); manifest header updated in the same PR as this correction._                                                                                                                             | defer | L (2.1)   |
| **Launch card** (§8.7) declared in 10 manifests, parsed, but no producer/service — the one-time launch announcement never projects.                                                                                                                                                                                                                                                                                                                               | todo  | M         |
| **Korner tombstones / 410 Gone** (§5.6) — only AP Statuses tombstone; Listing etc. have no `deleted_at`/410 resolution.                                                                                                                                                                                                                                                                                                                                           | todo  | M         |
| `render_target` inert (§9.1) — every manifest sets it; nothing consumes it. Also open decision §13.2.                                                                                                                                                                                                                                                                                                                                                             | todo  | L / defer |
| **Huddle Phase 9.5 — event bus wiring** — the primitive shipped (`Kronk::KornerEvents.publish/subscribe`), and the initializer at `config/initializers/nudges_event_bus.rb` reads manifest `listens:` and registers real subscribers for the Nudges routes (2026-08-03 reconcile of Phase 5). Cross-korner listeners _other than_ Nudges (e.g. Huddle ← `kalendar.event.created`) still live unbuilt on the plan; the framework is ready when their handlers are. | work  | M         |

### Settings retirement — blocks retiring classic /settings

| Item                                                                                                                                                                                                                                                                                                                                                                                                         | State | Effort |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- | ------ |
| **Account & Security** (2FA, sessions, apps, migration, delete, export/import) — still classic Devise/Doorkeeper. `settings.account` nav node leads nowhere.                                                                                                                                                                                                                                                 | todo  | L      |
| **Data** (export/import) — still classic Rails pages; `settings.data` nav node also lands on nothing.                                                                                                                                                                                                                                                                                                        | todo  | M      |
| Automated post deletion (`AccountStatusesCleanupPolicy`, 10 fields) — links to classic Rails.                                                                                                                                                                                                                                                                                                                | todo  | M      |
| **Profile composer** avatar/header/display-name — the shelved-profile composer (#1081/1084/1090/1091/1093/1094/1096) is the canonical edit surface now, but doesn't yet include the classic account-level identity fields (avatar / header / display-name). #1101 dropped the "Edit profile" button that used to lead to the classic Rails page; the SPA affordance to reach these fields inline is pending. | work  | M      |

### Wachuneed — feature gaps (design-heavy, mostly post-2.0 unless promoted)

| Item                                                                           | Effort |
| ------------------------------------------------------------------------------ | ------ |
| Wachuneed detail view                                                          | M      |
| Wachuneed create-listing composer                                              | M      |
| Wachuneed offers/interactions (5 interaction modes)                            | L      |
| Wachuneed `subcategory` column doc says "retires" but persists + is serialized | S      |

### Tier 0 sweep — small correctness fixes (bundle into one PR)

Copied forward from `remaining_work_2026-07-23.md`; verified still open on 2026-08-04.

| Item                                                                                                                                                | Effort |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `settings.account` + `settings.data` nav nodes lead nowhere (declared with URLs but no route/component)                                             | S      |
| Verify SPA `/settings/privacy` covers `indexable`/`noindex`, `hide_collections`, `show_application`                                                 | S      |
| `fetch_link_card` `ALLOWED_LOCAL_PATHS` lists legacy korner paths, not `/hub/<slug>`                                                                | S      |
| Dead `interactions.must_be_follower`/`must_be_following` settings keys (writeable, wired to nothing)                                                | S      |
| Dead code from Frame migration — `<KornerExit>`, `<SpaceTabs>`, per-panel `.space-title` heroes in Kuestions (retired by spec rule 5 but not swept) | S      |

### Per-space UI vision (design-heavy — mostly post-2.0 unless promoted)

Unchanged from `remaining_work_2026-07-23.md` — Groups→Krew
audience-scoping, Kommons backing UI polish (backing itself works
via Koin), Kuestions swipe deck (deferred; current panels ship on
Deck / Today / etc.), Kalendar spiral view + Krew-spawn-from-event +
Inflow→celestial, Huddle "Main Huddle + per-Krew" model, Booth
kind taxonomy + BoothSeries + storage migration, Inflow unified
dashboard + Kosmic subscribe.

## Suggested path to 2.0.0

Ordered by dependency:

1. **Tier 0 sweep** (one bundled PR, ½ day) — clears the ~5 small
   correctness bugs and the Frame dead code.
2. **Launch card producer** (M) — Phase 5 side-quest; needed for
   the Phase 14 announcement flow.
3. **Settings Account & Security rehome** (L) — big surface, may
   ship as 2.1. Currently the nav pretends it's there and the
   #1101 change made the classic-Rails escape hatch (`Edit profile`
   on your own profile) go away — that back-door was the only
   working path to the classic pages from the SPA.
4. **Phase 14** — flip enforcement + version + CHANGELOG + main PR.

Not on the critical path:

- **Huddle Phase 9.5** — framework is ready; only Huddle's own
  cross-korner listener is unbuilt. Could ship post-2.0.
- **Wachuneed detail / composer / interactions** — program of work.
- **Per-korner design roadmap items** — Krew audience-scoping,
  Booth taxonomy, Inflow unified dashboard, etc.
- **Map realtime pubsub** — 30 s HTTP polling is the current
  shipping state; realtime pubsub is a 2.1 polish item.

## Live status board diff

For the board at `talitamoss.info/rebuild-status.html`, the following
state changes reflect reality on 2026-08-04:

| Section             | Item                         | Board says (likely) | Actual                                                                                                                                                               |
| ------------------- | ---------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Individual korners  | moments                      | **work / stub**     | **done** — end-to-end, plus camera + voice pairing shipped 2026-08-04                                                                                                |
| Individual korners  | albutts                      | **work / stub**     | **done** — end-to-end + Status-backed refactor                                                                                                                       |
| Individual korners  | map                          | **stub**            | **done** — full backend (`PresenceState` + `Trek` + coarsening + route-privacy libs) + SPA at `features/map_v2/` + Treks feed card. Realtime pubsub deferred to 2.1. |
| Individual korners  | klot                         | **work**            | **done** — enforced, full frontend + backend on `rebuild/2.0.0`                                                                                                      |
| Individual korners  | kompass                      | present             | **retired** — renamed to `map` at alpha.215; only a `/hub/kompass → /hub/map` redirect                                                                               |
| Individual korners  | huddle                       | work                | still work — Phase 9.5 cross-korner listener unbuilt                                                                                                                 |
| Individual korners  | nudges                       | work                | **done** — full Phase 5 cutover (bell retired, hub-switcher pillar, email-prefs, voice)                                                                              |
| Custom features     | Signup revamp                | not listed          | **done** — 8-layer chain #1061–#1071 (Screen 1 account form + Screen 2 ceremony + gate)                                                                              |
| Custom features     | Shared media capture library | not listed          | **done** — `components/media/` with `<VoiceRecorder>`, `<VoicePlayer>`, etc. (#1117)                                                                                 |
| Navigation & chrome | Ӂ → Ж breve retirement       | not listed          | **done** — #1115/#1116                                                                                                                                               |
| Navigation & chrome | Brand assets refresh         | not listed          | **done** — #1118 (Ж-rendered PNGs + real-outline SVGs + icon set)                                                                                                    |
| Navigation & chrome | Signed-out landing at `/`    | not listed          | **done** — #1108/#1110                                                                                                                                               |
| Custom features     | Profile shelved rebuild      | work                | **~done** — full stack (#1073–#1096) shipped; only avatar/header/display-name pending                                                                                |
| Custom features     | URL consolidation `/kronk/*` | not listed          | **done** — #1097/#1100/#1102 (Booth gate + about/privacy/terms → `/kronk/*` + ToS retirement)                                                                        |
| Custom features     | Per-korner unread badges     | not listed          | **done** — 8-layer stack #1074–#1088                                                                                                                                 |
| Release prep        | CI merge queue lint-only     | not listed          | **done** — 2026-08-02 (see `decisions.md`); merges land in ~2 min                                                                                                    |
