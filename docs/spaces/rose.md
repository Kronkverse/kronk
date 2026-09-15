# Rose

**Slug:** `rose` · **Korner** — `config/korners/rose.yaml` · **Decided
2026-09-15** with Tal, in the session that also standardised the profile
block (`docs/spaces/profile.md` § The profile block).

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
| Does it notify?              | Only if you turn that on. **Never** a nudge.                |

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

Implementation note: this is a **window query, not a nightly job**. Today's
roses are the rows created since the most recent 3am Sydney boundary, so
nothing depends on a cron firing on time and a missed run cannot leave
yesterday's roses on screen. Use `Time.use_zone('Australia/Sydney')` and
let TZInfo handle the AEST/AEDT switch — do not hardcode +10.

A separate sweep deletes rows past the boundary, because nothing is kept.
The sweep is housekeeping; correctness does not depend on it.

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
boundary above, not from `created_at.to_date`.

Nothing else is stored. There is no `seen` column, no counter on
`accounts`, and no rose on a Status.

## API

- `POST /api/v1/accounts/:id/rose` — send. Rejects non-Mates and a repeat
  within the same Kronk day.
- `GET /api/v1/roses` — today's roses for the signed-in account, each with
  the sender the tap reveals.

## Settings

One toggle, in the korner's settings space per Korner Standard §L8: **tell
me when a rose arrives** (push / web notification), **off by default**. A
rose never produces a Nudge, never lands in the messenger, and never
raises an unread count there.

## What this korner deliberately does not do

- No reply, no thanking, no rose-back-at-them affordance.
- No streak, no leaderboard, no all-time total, no public count.
- No feed projection — a rose is not a post and produces no card.
- No rose from a post, a comment or a Krew — the profile is the only
  place to send one.

Every one of those is a way of turning a small kindness into a score. The
feature is worth building only if it stays unscored.

## Open

- **A quiet marker.** With notifications off by default, a person could go
  a whole day without knowing roses arrived. A dot on the Hub tile would
  fix that without becoming a notification; unresolved, and deliberately
  left out of the first build rather than guessed at.
- **Moderation.** Roses are wordless and Mates-only, so the abuse surface
  is thin, and the rows are gone by morning. If per-person refusal is
  wanted it belongs on the per-person settings screen
  (`docs/spaces/profile.md`), not here.
