# Rose

**Manifest:** `config/korners/rose.yaml` · **Mount:** `/hub/rose` ·
`enforced: true`. Sent from the profile block
(`docs/spaces/profile.md` § The profile block).

## What it is

A rose is a wordless daily gesture. You tap the rose on someone's profile
and they get a rose. That is the whole feature — there is no message
attached, no reply, no thread, and nothing to answer.

It replaces what the old Kronk called a nudge: "send someone a little
bump". The word _nudge_ now belongs to the messenger
(`docs/spaces/nudges.md`), so the gesture needed its own name and its own
space rather than a second meaning bolted onto a korner that had moved on.

**This version of Kronk is named Rose.** The gesture is the release's
representation inside the platform — 2.0 "Rose".

## Rules

| Question                     | Answer                                                      |
| ---------------------------- | ----------------------------------------------------------- |
| Who can send?                | **Mates only** — a mutual follow, both directions           |
| How often?                   | **One per sender, per recipient, per Kronk day**            |
| What does the sender type?   | Nothing. One tap sends it.                                  |
| What does the recipient get? | A rose in their stack at `/hub/rose`                        |
| Who sent it?                 | Revealed on tap — plain until then                          |
| When does it clear?          | **3am Australia/Sydney**, one clock for the whole instance  |
| What survives the clear?     | **Nothing.** No history, no totals, no count on either side |
| Does it notify?              | No. **Never** a nudge. (An opt-in alert is open, below.)    |

## The surface

Roses live at `/hub/rose` and nowhere else. They do not overlay other
screens, do not enter the feed, and do not appear in Nudges.

The page draws today's roses **from the centre outward** — the first rose
sits in the middle, each new one takes its place beside the last, and the
stack grows symmetrically. Roses are drawn small; the arrangement is the
content, not any one flower. Tapping a rose names its sender and links to
their profile.

Empty is the normal state for most of the day and should read as calm
rather than as a failure — no "you have no roses" scolding.

## The Kronk day

The clear happens at **3am Australia/Sydney, instance-wide**, not at each
person's local 3am. Kronk is one small community in one place; a single
boundary means two Mates always see the same day.

This is a **read-time rule, not a nightly job**. `Rose.current_day`
(`app/models/rose.rb`) works out the Kronk day in `Australia/Sydney`,
stepping back a day before 3am, and lets TZInfo handle the AEST/AEDT
switch. Reads ask only for the current day, so nothing depends on a cron
firing on time and a missed run cannot leave yesterday's roses on screen.

`Scheduler::RoseSweepScheduler` deletes rows from earlier days, hourly at
:17 (`config/sidekiq.yml`), because nothing is kept. The sweep is
housekeeping; correctness does not depend on it.

## Data

```
roses
  from_account_id  → accounts
  to_account_id    → accounts
  sent_on          date, the Kronk day (3am Sydney boundary)
  created_at
  unique index (from_account_id, to_account_id, sent_on)
```

`sent_on` exists so the one-a-day rule is enforced by the database rather
than by a check the send path can race past. It is computed from the
boundary above, not from `created_at.to_date`. A second index,
`(to_account_id, sent_on)`, serves the recipient's stack. Both account
foreign keys cascade on delete.

Nothing else is stored. There is no `seen` column, no counter on
`accounts`, and no rose on a Status.

## API

`Api::V1::Rose::RosesController`:

- `POST /api/v1/rose/roses` with `to_account_id` — send. Goes through
  `Rose::SendService`: 403 if the two are not Mates (or it's yourself),
  409 if you already sent one today.
- `GET /api/v1/rose/roses` — today's roses for the signed-in account,
  each with the sender the tap reveals.
- `GET /api/v1/rose/roses?direction=sent` — today's roses you sent. The
  profile button reads this to show "You sent {name} a rose today".

No show, no destroy: a rose cannot be taken back.

## Settings

None (`settings: []`). A rose never produces a Nudge, never lands in the
messenger, and never raises an unread count there.

## What this korner deliberately does not do

- No reply, no thanking, no rose-back-at-them affordance.
- No streak, no leaderboard, no all-time total, no public count.
- No feed projection — a rose is not a post and produces no card.
- No rose from a post, a comment or a Krew — the profile is the only
  place to send one.

Every one of those is a way of turning a small kindness into a score. The
feature is worth building only if it stays unscored.

## Open

- **An opt-in alert.** The decision was "you can turn on notifications
  for it, but no nudge", off by default. It isn't built: the only
  delivery path today is a `Notification` row, which is what Nudges
  reads, so a rose alert would land in the messenger. The manifest
  declares `rose.received` as `planned: true` and leaves `settings`
  empty until there is a path that skips the messenger.
- **`rose.sent` is declared but never published.** The manifest lists it
  under `emits`; nothing sends it, and nothing needs to yet.
- **A quiet marker.** With notifications off by default, a person could go
  a whole day without knowing roses arrived. A dot on the Hub tile would
  fix that without becoming a notification; unresolved, and deliberately
  left out of the first build rather than guessed at.
- **Moderation.** Roses are wordless and Mates-only, so the abuse surface
  is thin, and the rows are gone by morning. If per-person refusal is
  wanted it belongs on the per-person settings screen
  (`docs/spaces/profile.md`), not here.

## History

Decided 2026-09-15 with Tal and built the same week. Revised 2026-10-05 to
match the code (API paths, the unbuilt notification toggle). Earlier
version: `git show 231cca937:docs/spaces/rose.md`.
