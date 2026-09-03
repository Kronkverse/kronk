# Mates tab (`/@user/mates`)

**Location:** profile sub-route · **Status:** live — a plain, paginated list
of the subject's Mates.

> A Mate is a **mutual follow**. That is not local to this page: `mates` is a
> rung of the reach ladder (`public` / `mates` / `orbit` / `self_only`) that
> gates post visibility, so what this page lists and what a `mates`-scoped
> post reaches are the same set of people. See `docs/rebuild/decisions.md`.

## What it renders

One shared `<Account>` row per Mate, in the standard `.stage-column`
measure, inside a `<Stage>`. The row is the same component every other
people-list on Kronk uses, so it carries the avatar, display name, handle,
relationship button and menu without this page restating any of it. Tapping
a row opens that person's profile.

Pagination is a "Load more" button rather than infinite scroll — the mates
list is small for most people, and a button is honest about there being
more.

## Data

- **Hook:** `useMatesList()` at `features/mates_tab/use_mates_list.ts`.
- **Endpoint:** `GET /api/v1/accounts/:id/mates` —
  `app/controllers/api/v1/accounts/mates_controller.rb`. Returns full
  `REST::AccountSerializer` records, paginated by Follow row id through the
  `Link` header.
- The page knows a handle, not an id, so the hook resolves the handle
  through `accounts/lookup` first, then fetches. Fetched accounts are pushed
  into the Redux account store and the hook returns ids — that is what lets
  the list use the shared row.

**Privacy** follows the followers list exactly: `hide_collections` hides the
list from everyone but the owner, a viewer the subject has blocked sees
nothing, and accounts the viewer has muted or blocked are filtered out.

**Neighbouring endpoints, easily confused:**

- `GET /api/v1/accounts/:id/matuals` — mates in _common_ between viewer and
  subject, as a capped preview for the profile card. Different question.
- `GET /api/v1/mates/timeline` — the whole graph slice (members, bonds,
  invite lineage). Not used by this page any more; it is graph substrate.

## History

The page began as the invite-lineage drawing from `KRONK_KOMMUNITY.md`
(attached to Kommons proposal "Mates", #116990859270976043): a horizontal
track with mate tiles above the line at bond date, invitees below at join
date, the inviter at the head, openable branches, hover lineage traces and a
contacts rail. That SVG timeline **retired 2026-08-11** (Tal: keep it a
list).

What replaced it was a list, but not of Mates: it rendered every member of
the graph payload — mates, the inviter, and invitees together — in
hand-rolled rows labelled "Mates since {date}" or "Joined {date}". So the
page called itself Mates while listing the community.

**2026-09-03** (Tal: "just a simple list of someone's mates") it became
Mates only, off the paginated endpoint above, on the shared account row.
Two things went with that change:

- **Inviter and invitee rows.** They are invite lineage, not Mates. Lineage
  belongs to the Kommunity graph, which is where the drawing went.
- **The "Mates since {date}" line.** The shared row has no subtitle slot.
  Worth adding back as a slot on the shared component if it earns its place,
  rather than by hand-rolling a bespoke row again.

## Open

- **Bond date.** See above — dropped rather than reimplemented. Needs a
  subtitle slot on `<Account>` to come back.
- **Order.** The list currently comes back in Follow-row order (most
  recently formed follow first, by id). Whether Mates should sort by bond
  date, alphabetically, or by recency of interaction is undecided.
- **Empty state.** "No Mates yet." is a placeholder; a locked-by-default
  instance means a new member sees it for a while, so it is worth more than
  one line.
- **Tombstoned members.** What renders in place of a deleted account is
  still undecided — inherited from the original brief and still open.

## Files

- `app/javascript/mastodon/features/mates_tab/index.tsx` — route mount, fetch
  states.
- `app/javascript/mastodon/features/mates_tab/list_view.tsx` — the list.
- `app/javascript/mastodon/features/mates_tab/use_mates_list.ts` — hook.
- `app/controllers/api/v1/accounts/mates_controller.rb` — endpoint.
- `app/javascript/styles/mastodon/_mates_tab.scss` — shell + row divider
  (in the stylelint token-governance list since 2026-09-03).
