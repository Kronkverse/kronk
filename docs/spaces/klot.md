# Klot (`klot`)

**Manifest:** `config/korners/klot.yaml` · **Mount:** `/hub/klot` · `enforced: true`

## Purpose

Klot is a **private menstrual-cycle tracker** with **phase-only
sharing**: kronkers share the _phase_ of their cycle, not the data. The
sovereignty contract is the whole point. Raw dates never leave the
owner's account; at most a phase name reaches a viewer the owner chose.

## How it works

- **Log a period.** The owner records start dates. The newest log anchors
  the cycle.
- **Phase is derived, never stored.** `Kronk::CyclePhase.derive`
  (`lib/kronk/cycle_phase.rb`) computes day-of-cycle and one of four
  phases (menstrual, follicular, ovulatory, luteal) at read time from the
  newest log plus the owner's cycle and period length. There is no
  `phase` column.
- **Share with chosen people.** The owner adds viewers to an allowlist.
  A viewer must be someone the owner follows (`ViewersController#viewable?`).
  Grants are one-way: sharing with someone does not let you see theirs.
  Revoking deletes the row; nothing is kept about a revoked viewer.

## Surfaces

Two views (manifest `views:`), plus settings:

- **Circle** (default, `/hub/klot`) — the people sharing their phase with
  you, drawn as a ring with each phase's moon name.
- **My cycle** — your own log, cycle ring and phase card.
- **Settings** (`/hub/klot/settings`) — cycle length, period length, your
  viewer allowlist, and a "clear all logs" action. It writes to Klot's own
  tables, not the framework `UserKornerSetting` store.

Frontend: `app/javascript/mastodon/features/klot/`.

## API

All under `/api/v1/klot` (`config/routes/api.rb`):

- `GET self` — your own state: day of cycle, phase, lengths, logs.
- `POST self/logs`, `DELETE self/logs/:id` — add or remove a period start.
- `PATCH self/settings` — `cycle_length`, `period_length`.
- `GET|POST viewers`, `DELETE viewers/:account_id` — your outbound allowlist.
- `GET circle` — the inbound projection: `{ account_id, name, handle, phase }`
  per sharer, and nothing else.

`Api::V1::Klot::CircleController` **is** the privacy contract. It builds
each row by hand so it cannot return anything below the phase.

## Data

Migration `db/migrate/20260724170000_create_klot_tables.rb`:

- `cycle_profiles` — one per account: `cycle_length` (default 28),
  `period_length` (default 5).
- `cycle_logs` — `account_id`, `started_on`.
- `phase_shares` — `sharer_id`, `viewer_id`, unique per pair.

Every foreign key cascades, so deleting an account removes its logs and
both directions of its shares. Models: `CycleProfile`, `CycleLog`,
`PhaseShare`.

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
- `cycle_logs` has no end date or duration, only `started_on`.
- The phase-only check is bespoke to Klot. It should move onto the shared
  authorization layer if one lands.

## History

Rewritten 2026-10-05 to describe what is built. The earlier doc said Klot
had no routes or models on this branch; it has both. Earlier designs and
notes: `git show 231cca937:docs/spaces/klot.md`.
