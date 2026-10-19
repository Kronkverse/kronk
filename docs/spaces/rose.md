# Rose

**Manifest:** `config/korners/rose.yaml` · **Mount:** `/hub/rose` ·
`enforced: true`. Sent from the profile block
(`docs/spaces/profile.md` § The profile block) or from the Ж menu on
`/hub/rose`.

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
| Does it notify?              | Yes, on the Notifications face. On by default; can be off.  |

## The surface

Roses live at `/hub/rose` and nowhere else. They do not overlay other
screens, do not enter the feed, and never enter a chat. The one trace
elsewhere is the notification below.

**Sending from here** (Tal, 2026-10-11): the Ж menu on `/hub/rose` has
**Send a rose**. It opens the Mate picker Nudges uses for a new chat
(`features/rose/send_picker.tsx`); a tap sends, the row then reads "Sent
today", and the picker stays open for the next person. Same rules and the
same endpoint as the profile button.

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

None of its own (`settings: []`). A rose sends its recipient a notification,
"{name} sent you a rose", on the Notifications face of Nudges, with **See
your roses** opening `/hub/rose` (Tal, 2026-10-19: on by default).
`Rose::SendService` publishes `rose.sent`; `config/korners/nudges.yaml`
listens and delivers `rose.received`. It is turned off like any nudge type,
on `/hub/rose/settings` or `/settings/notifications`
(`Nudges::MuteCatalogue`). It never lands in a chat. The 3am sweep deletes
these notifications with the roses, so nothing outlives the day.

## What this korner deliberately does not do

- No reply, no thanking, no rose-back-at-them affordance.
- No streak, no leaderboard, no all-time total, no public count.
- No feed projection — a rose is not a post and produces no card.
- No rose from a post, a comment or a Krew — the profile and the Rose
  page are the only places to send one.

Every one of those is a way of turning a small kindness into a score. The
feature is worth building only if it stays unscored.

## Open

- **Push.** The notification raises no phone push yet; that waits on the
  Nudges push path.
- **Moderation.** Roses are wordless and Mates-only, so the abuse surface
  is thin, and the rows are gone by morning. If per-person refusal is
  wanted it belongs on the per-person settings screen
  (`docs/spaces/profile.md`), not here.

## History

Decided 2026-09-15 with Tal and built the same week. Revised 2026-10-05 to
match the code (API paths, the unbuilt notification toggle). Earlier
version: `git show 231cca937:docs/spaces/rose.md`.
