# Kronk 2.0 Rebuild — Test Runsheet

A running checklist for exercising every user-facing interaction on the
rebuild. Runs against `https://shadow.kronk.info` (or a specific `shadow.kronk.info/hub/<slug>` surface). Intended for **manual
testing** — one person, one browser, one hour at a time; report every
break as it happens.

**Living doc.** Add rows as new surfaces land; strike rows through
(don't delete) when they retire. Keep entries specific — one gesture
per row.

## How to use

- **Priority** column: **P0** = shipped in the last ~2 weeks (highest
  regression risk); **P1** = older 2.x code; **P2** = stable classic
  paths worth spot-checking. Work top-down: signup → orientation →
  per-korner → cross-cutting → federation.
- **Result** column: `✓` if the gesture works as expected; write a
  short note if not (`✗ `, then what happened + browser/viewport if
  it matters). File a Github issue for anything that repeats.
- **Two accounts.** Some flows need a second identity (invites, RSVPs,
  Nudges, presence, mates). Sign up a `tester_a` and `tester_b` up
  front and keep both browsers logged in in separate windows.
- **Two viewports.** Desktop (≥ 1200px) and phone (≤ 640px, use browser
  DevTools). Kronk is a Frame-based responsive app; a lot of chrome
  swaps between the two.
- **Reset between runs** if you're catching state bugs. Sign out, hard
  reload, sign back in.
- **Bug reporting shape** — when you find a break, note:
  1. What you did (one sentence)
  2. What happened vs. what you expected
  3. URL + viewport + browser
  4. Console errors if visible
- **Where to leave findings** — Github issues for anything that needs
  fixing; a note in `/home/shared/inbox.md` for infra / access / data
  problems that block testing.

---

## 0 — Environment prep

| Priority | Check                                                                                                        | Where                                     | Result |
| -------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------- | ------ |
| P0       | Shadow is up                                                                                                 | https://shadow.kronk.info                 |        |
| P0       | `/api/v1/instance` reports a fresh commit ref (env-cached; not authoritative — read a real route to confirm) | https://shadow.kronk.info/api/v1/instance |        |
| P0       | Sign out flow works from a signed-in account                                                                 | Ж menu → Settings → Log out               |        |
| P1       | Two test accounts exist (`tester_a` and `tester_b`)                                                          |                                           |        |

---

## 1 — Signup and first-run

Fresh browser session, no cookies. Runs on both viewports.

### 1.1 Landing

| Priority | Check                                    | Where | Result |
| -------- | ---------------------------------------- | ----- | ------ |
| P1       | Landing page renders (no console errors) | `/`   |        |
| P1       | "Sign up" affordance visible             | `/`   |        |
| P1       | "Log in" affordance visible              | `/`   |        |

### 1.2 Signup

| Priority | Check                                                                                         | Where                             | Result |
| -------- | --------------------------------------------------------------------------------------------- | --------------------------------- | ------ |
| P0       | Signup form accepts a new email/username/password                                             | `/auth/sign_up`                   |        |
| P0       | Account activates immediately (no email confirmation gate) — see #1582                        |                                   |        |
| P0       | Post-signup lands in the Kronk shell, not a Mastodon settings splash                          |                                   |        |
| P0       | New account appears in `/hub/kommunity/discover` if opted-in (default is present) — see #1561 | Log in as another account, search |        |
| P1       | Duplicate email rejected cleanly                                                              |                                   |        |
| P1       | Rejected password (too short, common) shows a legible error                                   |                                   |        |

### 1.3 First orientation

| Priority | Check                                                                                    | Where                                    | Result |
| -------- | ---------------------------------------------------------------------------------------- | ---------------------------------------- | ------ |
| P0       | Frame chrome renders: top band + Ж menu + bottom nav (mobile) / korner sidebar (desktop) | any page                                 |        |
| P0       | Ж menu opens as a moon-fan of icons                                                      | Ж button                                 |        |
| P0       | Ž compose moon is a `+` icon (not the pencil) — see #1612                                |                                          |        |
| P0       | Ž search moon opens `/hub/search`                                                        |                                          |        |
| P0       | Ž settings moon opens the _context-aware_ settings page (feed/profile/korner/hub)        | On several surfaces                      |        |
| P0       | Ž menu drags between corners; position persists across pages                             |                                          |        |
| P0       | HubSwitcher pillars (Me / Home / Hub / Nudges) work                                      | Top band (desktop) / bottom nav (mobile) |        |

---

## 2 — Frame + core spaces

### 2.1 Feed (`/home`)

| Priority | Check                                                                     | Where                       | Result |
| -------- | ------------------------------------------------------------------------- | --------------------------- | ------ |
| P0       | Feed loads at the top on first arrival — see #1630                        | `/home`                     |        |
| P0       | Feed drum swipes between reach faces (mates / FoF / kommunity)            |                             |        |
| P0       | Feed cards render without the purple border frame — see #1624             |                             |        |
| P0       | InFlow veil opens at post #4 (not #2) — see #1617                         |                             |        |
| P0       | Reply, boost, favourite from a status                                     |                             |        |
| P0       | "Who can see this" audience readout on my own posts — see #1611           |                             |        |
| P0       | Edit-my-post (pencil in the Nudge slot) — see #1614                       |                             |        |
| P0       | Editing a post's audience (reach / krews / add/remove people) — see #1622 |                             |        |
| P1       | Status detail (open a post) — thread renders, replies visible             |                             |        |
| P1       | Notification arrival toast appears when someone replies to me             | Live: get tester_b to reply |        |

### 2.2 Profile (`/@<me>`)

| Priority | Check                                                                          | Where    | Result |
| -------- | ------------------------------------------------------------------------------ | -------- | ------ |
| P0       | Profile card renders + sizes correctly on desktop and phone — see #1623, #1628 | `/@<me>` |        |
| P0       | Profile peek modal opens from `/hub/kommunity/discover` tap — see #1602        |          |        |
| P0       | Location field renders as a chip; tapping reveals mini-map (#1574)             |          |        |
| P0       | Birthday field renders + countdown (#1577)                                     |          |        |
| P0       | Back-to-parent chip on `/@<user>/<statusid>` (BackToKorner)                    |          |        |
| P1       | Follow / Unfollow another account                                              |          |        |
| P1       | Profile shelves render, drag-arrange works                                     |          |        |
| P1       | Profile composer (settings) accepts edits + saves                              |          |        |

### 2.3 Hub (`/hub`)

| Priority | Check                                                  | Where | Result |
| -------- | ------------------------------------------------------ | ----- | ------ |
| P0       | 3 tiles across on mobile, 4 on desktop — see #1621     |       |        |
| P0       | Each tile navigates to its korner                      |       |        |
| P1       | Frame back chip (Ω "Hub") returns to Hub from a korner |       |        |

### 2.4 Ме hub (`/me`)

| Priority | Check                                    | Where | Result |
| -------- | ---------------------------------------- | ----- | ------ |
| P1       | Wheel renders and centres vertically     |       |        |
| P1       | Each spoke click navigates to its target |       |        |
| P1       | Drag rotation snaps to the nearest spoke |       |        |

### 2.5 Nudges (`/nudges`)

| Priority | Check                                          | Where        | Result |
| -------- | ---------------------------------------------- | ------------ | ------ |
| P1       | Threads list renders with last-message preview |              |        |
| P1       | New chat via Ž compose moon opens a picker     |              |        |
| P1       | Sending a text message delivers                | Two accounts |        |
| P1       | Image / video / voice memo attachments send    |              |        |
| P1       | Reply, react, milestone banner render          |              |        |

---

## 3 — Korners (per-surface)

Every korner detail page inherits the shared **`.kronk-back-chip`** (soft purple pill). Confirm across each: does the back chip render, does it navigate correctly?

### 3.1 Kalendar (`/hub/kalendar`)

Highest-touch surface this cycle. Test both viewports.

#### 3.1.1 Faces + list

| Priority | Check                                                                                           | Where                     | Result |
| -------- | ----------------------------------------------------------------------------------------------- | ------------------------- | ------ |
| P0       | Spiral face renders (default)                                                                   | `/hub/kalendar`           |        |
| P1       | Rotator cycles Spiral ↔ List ↔ Birthdays                                                      | ScopeTitle chevrons       |        |
| P0       | List face shows upcoming events as cards (no map thumbnail, no RSVP buttons) — see #1598, #1592 | `/hub/kalendar/list`      |        |
| P0       | Event card spiral badge visible; time/location dropped from card — see #1619                    |                           |        |
| P1       | Birthdays face lists Mates with an upcoming birthday                                            | `/hub/kalendar/birthdays` |        |

#### 3.1.2 Event detail (`/kalendar/<slug>`)

| Priority | Check                                                                                                      | Where                           | Result |
| -------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------- | ------ |
| P0       | Only one "Kalendar" nav in the top-left (Frame chip; no in-column duplicate) — see #1609                   |                                 |        |
| P0       | Title uses the Kalendar SpiralIcon (or Videocam for a huddle) — see #1603                                  |                                 |        |
| P0       | Description sits directly under the title with fade + Read more on long text — see #1609                   | Create a long-description event |        |
| P0       | `__when` block: weekday / date / time — purple left-border — see #1603                                     |                                 |        |
| P0       | Location row: pin icon + name + Copy button — see #1603                                                    |                                 |        |
| P0       | Tapping the location goes to `/hub/map?event=<slug>`, focuses map + opens preview card — see #1604         |                                 |        |
| P0       | For a text-only location (no OSM pin), the link falls back to the external URL (or is plain text)          |                                 |        |
| P0       | Map preview under location (composer-set events)                                                           |                                 |        |
| P0       | RSVP / Invite / Share squares below the map — icon-only, purple fill when active — see #1609               |                                 |        |
| P0       | RSVP toggle flips going ⇄ remove; Going count updates                                                      |                                 |        |
| P0       | Invite square opens the invite panel; searching finds accounts; sending invites works                      |                                 |        |
| P0       | Share square opens `<ShareSheet>` — Nudges search + Copy + native Share — see #1618                        |                                 |        |
| P0       | ShareSheet: pick a Kronker → routes to `/nudges/<id>` with the event URL pre-attached as a post-share card |                                 |        |
| P0       | Going section renders as purple-tinted card with larger avatar+name chips — see #1615                      |                                 |        |
| P0       | Ж menu on this page shows an "Edit" moon (pencil) for the owner — see #1612                                | Own an event                    |        |
| P0       | Bottom action bar shows Edit + Delete only when I own the event (Edit moved to the Ж — see #1612)          |                                 |        |
| P0       | Attach flow opens with Kronk-styled picker chrome — chip target selector, purple search — see #1620        |                                 |        |
| P0       | Attach an existing Huddle: it appears in the Attached list                                                 |                                 |        |

#### 3.1.3 Event composer (`/hub/kalendar/composer`)

| Priority | Check                                                                                                                        | Where | Result |
| -------- | ---------------------------------------------------------------------------------------------------------------------------- | ----- | ------ |
| P0       | Composer opens as ComposeShell overlay                                                                                       |       |        |
| P0       | ComposeShell body reserves scrollbar gutter — description textarea doesn't slide under the scroll thumb on phone — see #1625 |       |        |
| P0       | Pin-a-location picker returns lat/lng into location_url                                                                      |       |        |
| P0       | Composer submits + new event appears on the list face                                                                        |       |        |
| P0       | Composer visibility picker is `<KornerVisibilityPicker>` (Kronk-standard)                                                    |       |        |

#### 3.1.4 Feed embed (status_event_card)

| Priority | Check                                                                         | Where   | Result |
| -------- | ----------------------------------------------------------------------------- | ------- | ------ |
| P0       | Event posted to Orbit shows the feed event card (no RSVP buttons) — see #1597 | `/home` |        |
| P0       | Card map thumbnail: 200×150 (4:3) when composer used pin picker — see #1598   |         |        |
| P0       | Who's-going preview strip (avatars + count) on the body — see #1600           |         |        |
| P0       | Tapping card navigates to `/kalendar/<slug>`                                  |         |        |
| P0       | Location-only text events: no thumbnail (graceful degradation)                |         |        |

### 3.2 Kommunity (`/hub/kommunity`)

| Priority | Check                                                                      | Where                     | Result |
| -------- | -------------------------------------------------------------------------- | ------------------------- | ------ |
| P0       | Discover surface lists opt-in accounts — see #1149                         | `/hub/kommunity/discover` |        |
| P0       | Tapping a Kronker card opens the profile peek modal — see #1602            |                           |        |
| P0       | Peek modal actions clear the bottom nav — see #1610                        | Phone viewport            |        |
| P0       | Peek modal card height stays inside the viewport — see #1608, #1613, #1616 | Long-note profile         |        |
| P0       | Kommunity three-layer drawer + no bottom-nav labels — see #1606            |                           |        |
| P0       | Orb face renders; avatar sprites don't get fogged — see #1596              | Orb face                  |        |
| P0       | Tap-a-node popup card on the orb — see #1581                               |                           |        |

### 3.3 Kommons (`/hub/kommons`)

| Priority | Check                                                    | Where                 | Result |
| -------- | -------------------------------------------------------- | --------------------- | ------ |
| P1       | Kommons landing renders                                  | `/hub/kommons`        |        |
| P1       | Proposal detail opens                                    | `/hub/kommons/p/<id>` |        |
| P1       | Voting / backing works                                   |                       |        |
| P1       | Comments render                                          |                       |        |
| P1       | New proposal from the Ж compose moon (via target picker) |                       |        |
| P1       | Kommons Tree face renders                                |                       |        |

### 3.4 Booth (`/hub/booth`)

| Priority | Check                                                     | Where              | Result |
| -------- | --------------------------------------------------------- | ------------------ | ------ |
| P1       | Booth landing renders                                     | `/hub/booth`       |        |
| P1       | Set detail page opens                                     | `/booth/sets/<id>` |        |
| P1       | Play button starts audio via mini player                  |                    |        |
| P1       | Mini player persists across navigation                    |                    |        |
| P1       | Upload a set (composer) — reject on missing cover / audio |                    |        |

### 3.5 Krew (`/hub/krew`)

| Priority | Check                                  | Where                | Result |
| -------- | -------------------------------------- | -------------------- | ------ |
| P1       | Krew list renders                      | `/hub/krew`          |        |
| P1       | Discover face lists discoverable krews | `/hub/krew/discover` |        |
| P1       | Krew detail opens                      | `/hub/krew/<id>`     |        |
| P1       | Join / leave a krew                    |                      |        |
| P1       | Create a krew via composer             | `/hub/krew/composer` |        |

### 3.6 Map (`/hub/map`)

| Priority | Check                                                               | Where                   | Result |
| -------- | ------------------------------------------------------------------- | ----------------------- | ------ |
| P0       | Mates face loads with MapLibre canvas                               | `/hub/map`              |        |
| P0       | People strip renders on left (desktop) / top (phone)                |                         |        |
| P0       | Place-a-pin panel opens from the strip's self-slot; drop a pin      |                         |        |
| P0       | My pin appears; teardrop marker shows my avatar                     |                         |        |
| P0       | Mates pins visible (only mates, precision-fuzzed)                   | With tester_b as a mate |        |
| P0       | Zoom past ANON_ZOOM hides pins; "N mates in view" panel takes over  |                         |        |
| P0       | Off-map compass marks + tap fly to the mate                         |                         |        |
| P0       | Pin card opens on tap; own-pin note is editable                     |                         |        |
| P0       | Event pins on map (spiral squircle markers) — see #1604             |                         |        |
| P0       | Tap event pin → preview card bottom-right with "Open in Kalendar →" |                         |        |
| P0       | `/hub/map?event=<slug>` deep-link flies + opens the preview card    | Type URL directly       |        |
| P1       | My-treks / Mates'-treks faces render                                |                         |        |
| P1       | Trek composer records a manual trek and it appears in my-treks      |                         |        |

### 3.7 Art (`/hub/art`)

| Priority | Check                                                                                                           | Where                      | Result |
| -------- | --------------------------------------------------------------------------------------------------------------- | -------------------------- | ------ |
| P0       | Discipline wheel (page 1) renders + rotates                                                                     | `/hub/art`                 |        |
| P0       | Snap-scroll to page 2 (shelves)                                                                                 | Wheel centre tap or scroll |        |
| P0       | x-swipe through disciplines; y-swipe through shelves                                                            |                            |        |
| P0       | Piece card fills the shelf strip vertically (fullscreen) — see #1629                                            | Any populated shelf        |        |
| P0       | Empty state shows purple `+` square linking to composer                                                         | Empty shelf                |        |
| P0       | Composer opens at `/hub/art/composer`                                                                           |                            |        |
| P0       | Composer field order: Discipline / Shelf / Title / **Introduction** / Attach the piece / Visibility — see #1626 |                            |        |
| P0       | File input accepts documents (PDF, EPUB, .md, .docx, .txt) alongside media — see #1626                          |                            |        |
| P0       | Submitting a piece appears on the matching shelf (localStorage today)                                           |                            |        |

### 3.8 Huddle (`/huddle/rooms`)

| Priority | Check                                                 | Where | Result |
| -------- | ----------------------------------------------------- | ----- | ------ |
| P1       | Huddle rooms list renders                             |       |        |
| P1       | Live room banner appears when someone starts a huddle |       |        |
| P1       | Huddle PiP mini-window persists across navigation     |       |        |

### 3.9 Wachuneed (`/hub/martketplace`)

| Priority | Check                                    | Where                   | Result |
| -------- | ---------------------------------------- | ----------------------- | ------ |
| P1       | Listings render                          | `/hub/martketplace`     |        |
| P1       | New listing via composer                 | `/hub/martketplace/new` |        |
| P1       | Listing appears in the list after submit |                         |        |

### 3.10 Klot (`/klot`)

| Priority | Check                                    | Where          | Result |
| -------- | ---------------------------------------- | -------------- | ------ |
| P1       | Self-cycle log renders (owner-only)      |                |        |
| P1       | Log a new entry                          |                |        |
| P1       | Viewer allowlist add/remove works        |                |        |
| P1       | Shared-circle view for an allowed viewer | Second account |        |

### 3.11 Moments (`/hub/moments`)

| Priority | Check                                  | Where          | Result |
| -------- | -------------------------------------- | -------------- | ------ |
| P1       | Moments strip renders on the home feed |                |        |
| P1       | Composer creates a moment              |                |        |
| P1       | Froth (favourite) toggles              |                |        |
| P1       | Moment expires overnight (24h)         | Next-day check |        |

### 3.12 Inflow (`/hub/inflow`)

| Priority | Check                                           | Where   | Result |
| -------- | ----------------------------------------------- | ------- | ------ |
| P1       | Observation renders                             |         |        |
| P1       | Feed veil at insertAfter position 4 — see #1617 | `/home` |        |

### 3.13 Kuestions (`/hub/kuestions`)

| Priority | Check                       | Where | Result |
| -------- | --------------------------- | ----- | ------ |
| P1       | Kuestions list renders      |       |        |
| P1       | Ask a question via composer |       |        |
| P1       | Answer a question           |       |        |

---

## 4 — Cross-cutting primitives

### 4.1 Search (`/hub/search`)

| Priority | Check                                                                                       | Where                             | Result |
| -------- | ------------------------------------------------------------------------------------------- | --------------------------------- | ------ |
| P0       | Search bar accepts a query and returns results                                              | `/hub/search`                     |        |
| P0       | Accounts results render as a group                                                          | Query a person's name             |        |
| P0       | Statuses results render as a group                                                          | Query a word from a post          |        |
| P1       | Hashtags results render (requires Elasticsearch/Meilisearch data)                           | Query a kategory                  |        |
| P0       | Kronk-native groups render (events / proposals / booth sets / listings / krews) — see #1635 | Requires Meilisearch backend live |        |
| P0       | Recent searches remembered + tappable                                                       |                                   |        |
| P0       | Empty query shows recent list; no results shows "empty" message                             |                                   |        |

### 4.2 Share sheet (`<ShareSheet>`)

| Priority | Check                                                                               | Where | Result |
| -------- | ----------------------------------------------------------------------------------- | ----- | ------ |
| P0       | Opens from any Share button (currently: event detail) — see #1618                   |       |        |
| P0       | Header shows subject title                                                          |       |        |
| P0       | Copy link icon flashes + toast confirms                                             |       |        |
| P0       | Native Share… icon hidden on desktop Chrome/Firefox (`navigator.share` absent)      |       |        |
| P0       | Native Share… icon shown on mobile Safari / Chrome                                  |       |        |
| P0       | Kronker search returns accounts; tap routes to `/nudges/<id>` with URL pre-attached |       |        |
| P0       | Nudges thread renders the post-share card in the compose bar                        |       |        |
| P0       | ShareSheet closes on Escape / backdrop click                                        |       |        |
| P0       | Bottom-docked sheet on ≤640px; centred on desktop                                   |       |        |

### 4.3 Attachment picker (`<AttachmentPicker>`)

| Priority | Check                                                                                | Where                            | Result |
| -------- | ------------------------------------------------------------------------------------ | -------------------------------- | ------ |
| P0       | Opens from Attach on any korner detail page with `attaches:` in manifest — see #1620 | Kalendar event                   |        |
| P0       | Modal chrome matches ShareSheet (purple border, backdrop blur) — see #1620           |                                  |        |
| P0       | Single-target case: purple-wash target chip (no native `<select>`)                   | Kalendar (only Huddle)           |        |
| P0       | Multi-target case: segmented pill row (active pill filled purple)                    | Korner with multiple `attaches:` |        |
| P0       | Search input has purple wash + focus border                                          |                                  |        |
| P0       | Result rows show a purple-chip icon + medium-weight title                            |                                  |        |
| P0       | Selecting a result attaches it; row appears in the Attached list on the source page  |                                  |        |
| P0       | Empty state renders as a purple-tinted status card                                   |                                  |        |

### 4.4 Visibility picker (`<KornerVisibilityPicker>`)

| Priority | Check                                                                                    | Where         | Result |
| -------- | ---------------------------------------------------------------------------------------- | ------------- | ------ |
| P0       | Renders on every korner composer (Kalendar, Booth, Krew, Kommons, Albutts, Moments, Art) |               |        |
| P0       | Options match the korner manifest's `visibility_scopes`                                  |               |        |
| P0       | Compose audience: fold add/remove into Visibility dropdown — see #1607, #1622            | Home composer |        |
| P0       | Add/remove specific people layer functions — see #1601                                   |               |        |

### 4.5 ComposeShell

| Priority | Check                                                                                 | Where              | Result |
| -------- | ------------------------------------------------------------------------------------- | ------------------ | ------ |
| P0       | Body scrollbar gutter reserved — textareas don't slide under scroll thumb — see #1625 | Long form on phone |        |
| P0       | Cancel button closes; unsaved-work confirmation if applicable                         |                    |        |
| P0       | Submit disabled until required fields are filled                                      |                    |        |

### 4.6 KornerDetail shared chrome

| Priority | Check                                                                                     | Where             | Result |
| -------- | ----------------------------------------------------------------------------------------- | ----------------- | ------ |
| P0       | Title uses `.space-header` visual (proper hero) — see #1631                               | Any korner detail |        |
| P0       | Back chip is the shared `.kronk-back-chip` soft purple pill (not plain text) — where used |                   |        |

### 4.7 KornerMeta (meta line primitive)

| Priority | Check                                                                            | Where | Result |
| -------- | -------------------------------------------------------------------------------- | ----- | ------ |
| P1       | Meta lines render consistently across korners (event card, profile fields, etc.) |       |        |

### 4.8 Notifications

| Priority | Check                                                   | Where | Result |
| -------- | ------------------------------------------------------- | ----- | ------ |
| P1       | Nudge notifications arrive live (WebSocket / streaming) |       |        |
| P1       | Notification centre renders per-type groups             |       |        |
| P1       | Notification tap navigates to the correct target        |       |        |

---

## 5 — Federation + cross-instance

Requires either a second instance you control or a real Mastodon
account elsewhere.

| Priority | Check                                                                         | Where       | Result |
| -------- | ----------------------------------------------------------------------------- | ----------- | ------ |
| P0       | Reach ladder does not compute remote inboxes for local-only tiers — see #1632 | Server logs |        |
| P1       | Follow a remote account (paste `@user@instance.social`)                       |             |        |
| P1       | Post reaches the remote follower's timeline                                   |             |        |
| P1       | Remote reply appears in my thread                                             |             |        |
| P1       | Boosting a remote post fans out correctly                                     |             |        |
| P1       | ActivityPub inbox delivery works both ways                                    |             |        |

---

## 6 — Regression watch (recent PRs, high signal)

Every row here corresponds to a PR that landed in the last two weeks
and touches user-facing behaviour. Break-report immediately if any
fails — these are the freshest edits.

| PR                         | What it changes                                               | Where to test                          |
| -------------------------- | ------------------------------------------------------------- | -------------------------------------- |
| #1635                      | Search extended with 5 Kronk-native types                     | `/hub/search` (needs Meilisearch live) |
| #1632                      | Federation: no remote inbox computation for local-only tiers  | Post local-only, check server logs     |
| #1631                      | KornerDetail title uses `.space-header` visual                | Any korner detail page                 |
| #1630                      | Feed loads at the top on first arrival                        | `/home` first navigation               |
| #1629                      | Art shelf: fullscreen piece card                              | `/hub/art` any populated shelf         |
| #1628                      | Profile card: per-consumer sizing prop                        | Profile card in multiple contexts      |
| #1627                      | Event card: map doesn't crush title on phone                  | Feed on ≤640px                         |
| #1626                      | Art composer: Body→Introduction, docs in accept               | `/hub/art/composer`                    |
| #1625                      | ComposeShell scrollbar gutter                                 | Any composer, long text field, phone   |
| #1624                      | Feed cards: no purple border frame                            | `/home`                                |
| #1623                      | Profile card: self-sizing                                     | Profile in multiple contexts           |
| #1622                      | Edit-a-post audience (reach/krews/people)                     | Own post → Edit                        |
| #1621                      | Hub: 3 tiles across on mobile                                 | `/hub` on phone                        |
| #1620                      | AttachmentPicker Kronk chrome                                 | Attach on event detail                 |
| #1619                      | Event card: spiral badge, drop time/location line             | Feed                                   |
| #1618                      | Share sheet primitive                                         | Event detail → Share                   |
| #1617                      | InFlow veil opens 2 posts lower                               | `/home`                                |
| #1616, #1613, #1610, #1608 | Kommunity drawer sizing                                       | `/hub/kommunity/discover` tap          |
| #1615                      | Going strip: bigger names                                     | Event detail with attendees            |
| #1614                      | Post action bar: Edit pencil in Nudge slot                    | Own post                               |
| #1612                      | Ž menu: `+` compose icon; per-page Edit action                | Any page + event detail (owner)        |
| #1611                      | "Who can see this" audience readout                           | Own post                               |
| #1609                      | Event detail: description veil, RSVP below map, Going refresh | Event detail                           |
| #1607                      | Composer audience: add/remove folded into Visibility          | Home composer                          |
| #1606                      | Kommunity three-layer drawer, no bottom-nav labels            | `/hub/kommunity`                       |
| #1605                      | Event detail: RSVP as Kronk squares                           | Event detail                           |
| #1604                      | Kalendar ↔ Map bridge                                        | `/hub/map`, event location link        |
| #1603                      | Event detail top: Spiral icon, when block, Location + copy    | Event detail                           |
| #1602                      | Profile card + peek modal                                     | Kommunity Discover tap                 |
| #1601                      | Compose audience: add/remove specific people                  | Home composer                          |
| #1600                      | Feed event card: who's-going + zoom out                       | Feed                                   |
| #1599                      | Per-post audience: people layer foundation                    | Backend + composer                     |
| #1598                      | Kalendar list card: no map; feed card map larger              | `/hub/kalendar/list` + Feed            |
| #1597                      | Feed event card: map preview, drop RSVP                       | Feed                                   |
| #1596                      | Kommunity orb: avatar fog exempt                              | Orb face                               |
| #1592                      | Event card map preview / drop RSVP row (first pass)           | `/hub/kalendar/list`                   |

---

## Follow-ups (not part of this runsheet)

- **Automated coverage.** Once a manual pass surfaces the most fragile
  paths, we can convert those to Playwright/Cypress. Whole separate
  project — worth deferring until the manual sheet's been run at
  least once.
- **Screenshot atlas.** A companion `docs/rebuild/test_screens/` with
  reference screenshots per surface would speed regression review
  (compare "what it should look like" side-by-side). Also deferred.
- **Bug template.** A repeat-friendly Github issue template pre-filled
  with the runsheet's "what you did / what happened / where" prompt
  would keep reports uniform.
