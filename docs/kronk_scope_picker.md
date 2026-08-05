# Kronk Scope Picker — the standard "who's this for / who can add?" primitive

Status: DRAFT (2026-08-05). Design doc; nothing shipped yet.

## Why this doc exists

Every korner has an ownership + access conversation buried
somewhere in its composer. Statuses have visibility (public /
mates / krew / self_only). Kommons proposals have a scope.
Kuestions has one. Albutts has one. Moments has one. They all
mean roughly the same thing but each is styled, worded, and
placed differently in its own composer, and each conflates
**who can see** with **who can act** in slightly different ways.

The result: no user learns the vocabulary once. They re-learn
per surface. That's a compounding tax on the aesthetic-alignment
work happening across Kronk.

This doc proposes a single primitive — a **Kronk Scope Picker** —
that codifies the vocabulary, splits the two axes cleanly, and
becomes the canonical way to ask "who is this for?" across every
korner. First user: Albutts (the concrete change that started
this thread). Later users: statuses, proposals, questions,
moments, whatever comes next.

Companion to `docs/kronk_aesthetic_system.md` and the aesthetic
audit (2026-08-04). Sits in the same "shared primitive"
category as `KronkWordmark` and `.kronk-form__*`.

## The vocabulary

Two questions, always in this order, always in plain English:

**1. Who's this for?** — Answers the _visibility_ axis. Who can
see this thing exist at all.

**2. Who can add to it?** — Answers the _contribution_ axis. Of
the people who can see it, who can act on it (add photos,
comment, back a proposal, answer a question, etc.).

The visible label per option is designed to be readable by
someone who has never used Kronk. The stored enum value is the
technical name used in the DB + API. Both are listed below.

### Axis 1 — Who's this for? (visibility)

| Enum value  | Label in UI       | What it means                                                              |
| ----------- | ----------------- | -------------------------------------------------------------------------- |
| `public`    | Everyone on Kronk | Any signed-in member can see it. Federates where the korner supports that. |
| `mates`     | My mates          | Mutual-follow (mates) of the owner.                                        |
| `orbit`     | My orbit          | Mates + mates-of-mates of the owner (one hop out).                         |
| `krew`      | A specific Krew   | Members of the picked Krew(s). Owner selects Krews inline.                 |
| `self_only` | Just me           | Owner only.                                                                |

Not every korner supports every scope — a Kommons proposal
doesn't need a `self_only` (nothing to propose to yourself),
statuses don't need `orbit` if they federate publicly, etc. Each
korner declares the subset it supports (see **API contract**).

### Axis 2 — Who can add to it? (contribution)

| Enum value | Label in UI           | What it means                                                                         |
| ---------- | --------------------- | ------------------------------------------------------------------------------------- |
| `open`     | Anyone who can see it | Contribution follows visibility 1:1. Default for most existing korner behaviour.      |
| `closed`   | Only me               | Owner is the only contributor. Others (per visibility) can still view.                |
| `invited`  | Just people I add     | Owner picks specific accounts inline. Named roster.                                   |
| `krew`     | A specific Krew       | Contributors must be members of picked Krew(s). May reuse the visibility Krew picker. |
| `event`    | Anyone at [Event]     | Roster = RSVP list of a Kalendar event. Owner picks the event inline.                 |

The default when the owner doesn't touch this field is `open`
(current Albutts + everywhere-else behaviour). Migration
strategy per korner is that korner's call — Albutts is
migrating existing rows to `closed` explicitly (Tal, 2026-08-05)
because contribution-scoping was a bug the whole time.

## What the picker looks like

Not a single dropdown — a two-question conversation. Both
questions render in the composer as sibling blocks with a shared
visual treatment. Selecting an option that requires a sub-picker
(Krew, invited list, event) reveals that picker below, in place.

Rough layout:

```
┌─────────────────────────────────────────────────────────────┐
│  Who's this for?                                             │
│    [ Just me ] [ My mates ] [ My orbit ]  ← chips            │
│    [ A specific Krew ] [ Everyone on Kronk ]                 │
│                                                              │
│    (if 'A specific Krew' picked:)                            │
│    ┌ Pick a Krew ────────────────────────────────┐           │
│    │ ○ Wellington Surf                            │           │
│    │ ○ Book club                                  │           │
│    └──────────────────────────────────────────────┘          │
├─────────────────────────────────────────────────────────────┤
│  Who can add to it?                                          │
│    [ Anyone who can see it ] [ Only me ] [ People I add ]    │
│    [ A specific Krew ] [ Anyone at Event ]                   │
│                                                              │
│    (sub-pickers reveal inline as above)                      │
└─────────────────────────────────────────────────────────────┘
```

Chip selection: single-select per question. The picker
enforces sensible constraints — e.g. contribution `open` is
suppressed if visibility is `self_only` (nobody can see it,
so nobody can contribute); contribution `krew` picker
auto-populates from the visibility Krew if visibility is also
`krew`; etc. Constraints declared in one place per korner.

## Component API (React)

`app/javascript/mastodon/components/scope_picker.tsx`
(planned filename).

Approximate shape:

```typescript
interface ScopePickerProps {
  // Which visibility options this korner supports.
  visibilityOptions: VisibilityScope[];
  // Which contribution options this korner supports.
  contributionOptions: ContributionRoster[];

  // Current state. Controlled component.
  visibility: VisibilityScope;
  contribution: ContributionRoster;
  krewIds?: string[]; // when visibility or contribution is 'krew'
  invitedIds?: string[]; // when contribution is 'invited'
  eventId?: string | null; // when contribution is 'event'

  // State updates. One callback per axis; sub-picker changes
  // fold into the appropriate one.
  onVisibilityChange: (v: VisibilityScope, meta?: PickerMeta) => void;
  onContributionChange: (c: ContributionRoster, meta?: PickerMeta) => void;

  // Optional labels — a korner can rewrite the question text if
  // 'add to it' doesn't fit (e.g. Kommons: 'Who can back it?').
  visibilityQuestion?: string;
  contributionQuestion?: string;
}
```

CSS lives in `app/javascript/styles/kronk/_scope_picker.scss`
(planned). Chip styling reuses the same token palette as
`.kronk-form__button` variants; sub-picker styling reuses
`.kronk-form__*` primitives.

## API contract per korner

Each korner that adopts the picker declares its own supported
subsets + defaults. Album (the first user) declares:

```yaml
scope_axes:
  visibility:
    options: [public, mates, orbit, krew, self_only]
    default: mates
  contribution:
    options: [open, closed, invited, krew, event]
    default: open # (existing behaviour); migration overrides
```

The API accepts both `visibility` and `contribution` on the
album resource; the backend validates the pair, resolves any
sub-picker payload (krew_ids / invited_ids / event_id), and
returns 422 with a `scope_error` if the combination is invalid
for this korner.

## Backend model shape

Per-korner tables get two columns:

```
albums.visibility        integer  (existing enum, unchanged)
albums.contribution      integer  (new enum — open, closed, invited, krew, event)
```

Plus supporting join tables for the multi-account rosters:

```
album_contributors    (album_id, account_id)  # 'invited' roster
album_krews           (album_id, krew_id)     # already exists for visibility='krew'; now also usable for contribution='krew'
albums.event_id       (existing belongs_to)   # already there; now consulted for contribution='event'
```

`Album#contributable_by?(viewer)` — new logic:

```ruby
def contributable_by?(viewer)
  return false unless visible_to?(viewer)  # gate on visibility first
  return true if viewer.id == owner_id     # owner always adds

  case contribution
  when 'open'    then true                                # already visible → can add
  when 'closed'  then false                               # owner-only, and we've ruled out owner
  when 'invited' then album_contributors.exists?(account_id: viewer.id)
  when 'krew'    then album_krews.exists?(krew_id: viewer.krews.select(:id))
  when 'event'   then event&.attendees&.exists?(viewer.id)  # or however Kalendar exposes it
  end
end
```

## Migration strategy per korner

Each korner picks its own default when adding the `contribution`
column. Recorded here so it's traceable:

- **Albutts**: existing rows → `contribution: 'closed'`. Owner
  must actively open albums up. Aggressive default per Tal
  (2026-08-05) — the current "open" behaviour was surprising
  George when he was rejected uploading to Tal's mates-scoped
  album.
- **Statuses** (if migrated later): stay `open` — matches ~10
  years of Mastodon-family convention that anyone who can see
  a post can reply.
- **Kommons proposals** (if migrated later): TBD when we look
  at Kommons.

## Not in the first PR

Follow-ups after the initial doc + picker + Albutts wiring:

- **Invited-list UX**: owner-side flow to add/remove accounts
  from an album's contributor list. Autocomplete on account
  handles; probably reuses whatever the DM composer's account
  picker looks like.
- **Event-tied contribution**: needs a Kalendar event picker in
  the composer + a `Kalendar::Event#attendees` reader that maps
  RSVPs to accounts.
- **Roll-out to other korners**: statuses, proposals, questions,
  moments, etc. Each is its own PR — the picker is the shared
  primitive; the per-korner enum + migration is per-korner.
- **Deprecating status visibility**: down the line, if the
  scope picker is universally adopted, the status composer's
  bespoke visibility dropdown becomes redundant. That's a
  bigger conversation.

## Open questions for Tal

- Sub-picker inline vs. modal? Inline reveal keeps the
  conversation in flow but eats vertical space when three
  scopes are picked with sub-pickers. Modal is more compact
  but breaks the "one continuous conversation" feel.
- Krew for BOTH visibility and contribution: if visibility
  is Krew-A, is contribution 'krew' automatically Krew-A too,
  or can it be Krew-B (a subset / different Krew)? Probably
  auto-mirror; edge cases can be revisited if anyone wants
  the split.
- Kalendar event scope: does the album inherit the event's
  visibility, or does the owner set them independently? An
  event might be public but its photo album mates-only.
  Recommendation: independent (composer keeps both axes for
  the album; event membership only feeds the contribution
  roster).

Once these are resolved, this doc becomes the spec for a
follow-up PR chain: (1) `<ScopePicker />` component +
`_scope_picker.scss`, (2) Albutts backend wiring + migration,
(3) Albutts composer + edit UX. Later PRs adopt in other
korners.
