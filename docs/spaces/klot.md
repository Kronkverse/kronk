# Klot (`klot`)

**Manifest:** `config/korners/klot.yaml` · **Mount:** `/hub/klot` · `enforced: true`

## Purpose

Klot is a **private menstrual-cycle tracker** with **phase-only
sharing**: kronkers share the _phase_ of their cycle, not the data. The
sovereignty contract is the whole point. Raw dates never leave the
owner's account; at most a phase name reaches a viewer the owner chose.

## How it works

- **Log a period, start and end.** "My period started" and "My period
  ended" are separate, each for today or for any earlier day picked on the
  calendar, so a bleed can be logged as it happens or in retrospect. A
  period left open is closed when the next one starts. Two periods cannot
  cover the same day.
- **Log a day.** Any day, inside a period or not, can carry how heavy the
  bleed was (spotting, light, medium, heavy), symptoms from a fixed list
  (body, mood and energy, others) and a short note. Each tap saves.
- **Nobody is asked their cycle length.** `Kronk::CycleStats`
  (`lib/kronk/cycle_stats.rb`) works it out: the cycle is the average gap
  between the starts of the last six logged periods, so it exists from the
  second period on, and the period length is the average of the bleeds
  that have an end. Until then a typical 28 and 5 days stand in and the
  page says so. A gap outside 15 to 60 days is taken as a period nobody
  logged, and is left out. (Tal, 2026-10-13: asking for the cycle length
  up front was backwards; you cannot know it until it has been recorded.)
- **The next period** is the last start plus the cycle length, with the
  window recent cycles have varied by. Once that day passes it reads as
  late; it is not moved along.
- **Phase is derived, never stored.** `Kronk::CyclePhase.derive`
  (`lib/kronk/cycle_phase.rb`) computes day-of-cycle and one of four
  phases (menstrual, follicular, ovulatory, luteal) at read time from the
  newest period and the lengths above. The bleed of the current cycle
  counts for as long as it was logged, not the average. There is no
  `phase` column.
- **Share with chosen people.** The owner adds viewers to an allowlist.
  A viewer must be someone the owner follows (`ViewersController#viewable?`).
  Grants are one-way: sharing with someone does not let you see theirs.
  Revoking deletes the row; nothing is kept about a revoked viewer.

## Surfaces

Two views (manifest `views:`), plus settings:

- **Circle** (default, `/hub/klot`) — the people sharing their phase with
  you, drawn as a ring with each phase's moon name.
- **My cycle** (`mine_view.tsx`) — top to bottom: the cycle ring and
  phase; the **day card** (`components/day_card.tsx`: period started or
  ended, bleeding, symptoms, note) for the day picked, today by default;
  the **calendar** (`components/cycle_calendar.tsx`: bleed days filled,
  the expected window outlined, a dot on days with something written)
  which picks that day; **Your cycle so far**
  (`components/cycle_summary.tsx`: cycle, period, next period, and the
  periods logged); and **Shared with**, where a Mate is added with the
  Mate picker.
- **Settings** (`/hub/klot/settings`) — what the log says your cycle and
  period lengths are (read only), your viewer allowlist, and a "clear
  everything" action that removes every period and every day. It writes
  to Klot's own tables, not the framework `UserKornerSetting` store.

Frontend: `app/javascript/mastodon/features/klot/`.

## API

All under `/api/v1/klot` (`config/routes/api.rb`):

- `GET self` — your own state: day of cycle, phase, the lengths and
  whether they are known yet, the next period, and the periods.
- `POST self/logs` — a period started (`started_on`, today if absent).
- `PATCH self/logs/:id` — it ended (`ended_on`; blank reopens it), or a
  date was wrong.
- `DELETE self/logs/:id` — remove a period.
- `GET self/days?from=&to=` and `PUT self/days/:day` — how a day was
  (`flow`, `symptoms`, `note`). A day emptied of all three is deleted.
- `DELETE self/data` — every period and every day.
- `PATCH self/settings` — `cycle_length`, `period_length`. No page sends
  this any more; the values only stand in until the log has its own.
- `GET|POST viewers`, `DELETE viewers/:account_id` — your outbound allowlist.
- `GET circle` — the inbound projection: `{ account_id, name, handle, phase }`
  per sharer, and nothing else.

`Api::V1::Klot::CircleController` **is** the privacy contract. It builds
each row by hand so it cannot return anything below the phase.

## Data

Migration `db/migrate/20260724170000_create_klot_tables.rb`:

- `cycle_profiles` — one per account: `cycle_length` (default 28),
  `period_length` (default 5). A stand-in only, see above.
- `cycle_logs` — one row per period: `account_id`, `started_on`,
  `ended_on` (null while it is going, and on logs from before 2026-10-14).
- `cycle_days` — one row per account per day: `day`, `flow`, `symptoms`
  (array), `note`. Added in
  `20261014090000_add_period_ends_and_days_to_klot.rb`.
- `phase_shares` — `sharer_id`, `viewer_id`, unique per pair.

Every foreign key cascades, so deleting an account removes its periods,
its days and both directions of its shares. Models: `CycleProfile`,
`CycleLog`, `CycleDay`, `PhaseShare`.

Days, symptoms and notes are owner-only, exactly as dates are. The Circle
still receives a phase name and nothing else.

## Rules (manifest)

- `federates: false` — local only.
- **No feed projection.** Klot is body data and refuses to project. That
  refusal is its framework conformance.
- **No subscription.** The per-viewer, revocable `phase_shares` allowlist
  is the right primitive instead.
- No media, no events (`emits: []`, `listens: []`).

## Open

- The manifest `settings:` block declares `cycle_length_days`,
  `period_length_days` and `share_phase_publicly`, but nothing reads them;
  the real values live in `cycle_profiles`. `share_phase_publicly` has no
  effect at all. Either wire them or drop them from the manifest.
- A day's note is stored as plain text on the server, like the dates.
  The trackers this borrows from (drip) keep everything on the device.
- Day of cycle wraps round once a period is late, as if a new cycle had
  begun unlogged; the summary says "late" but the ring moves on.
- Symptoms are logged but not yet charted or counted across cycles.
- The phase-only check is bespoke to Klot. It should move onto the shared
  authorization layer if one lands.

## History

Rewritten 2026-10-05 to describe what is built. The earlier doc said Klot
had no routes or models on this branch; it has both. Earlier designs and
notes: `git show 231cca937:docs/spaces/klot.md`.
