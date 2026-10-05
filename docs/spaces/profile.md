# Profile

**Manifest:** `config/korners/profile.yaml` (`core: true`, mount `/@:acct`) ·
**Node:** `profile.view` in `config/kronk_nodes.yaml`

A profile is a person's space on Kronk: who they are, what they've posted, and
who their Mates are. It is a core space (the "Me" pillar), not a korner, so it
has no Hub tile and can't be tuned out of. This doc describes what is built.
Earlier designs are in git history (see [History](#history)).

## Routes

| URL                | What it is                                                                       |
| ------------------ | -------------------------------------------------------------------------------- |
| `/@:acct`          | The Profile face                                                                 |
| `/@:acct/posts`    | The Timeline face                                                                |
| `/@:acct/mates`    | The Mates face                                                                   |
| `/@:acct/settings` | Your settings for this person (signed in only)                                   |
| `/@:acct/tagged/…` | A tag-filtered timeline. Not a face; it keeps its own route and draws the block. |

`/accounts/:id` and `/accounts/:id/posts` work too. All three faces mount one
component, `features/profile/index.tsx` (`ProfileSpace`). Routes are in
`features/ui/index.jsx`.

**Redirects.** Old profile pages redirect rather than 404, because links to
them exist in the wild:

- `/followers`, `/following` (and the `/accounts/…`, `/users/…` spellings) →
  `/@:acct/mates`.
- `/featured`, `/with_replies`, `/media` → `/@:acct/posts`.
- `/@:acct/nudges` → `/nudges`.
- `/@:acct/edit` → `/@:acct` (editing is Arrange mode, below).
- On the server, `FollowerAccountsController` and `FollowingAccountsController`
  send browsers to the Mates page as well.

These retire **pages, not data**. The ActivityPub `followers`/`following`
collections and the REST endpoints (`/api/v1/accounts/:id/followers`,
`/following`) are untouched: federation and the Android app use them.

## The profile block

One identity block (`components/profile_block.tsx`) sits above every face. It
doesn't move or change height when the face turns. It is the only place
identity is drawn.

**Contents:** cover, avatar, display name, handle, lock icon, relationship tag
("You're Mates", "Blocking", …), and a row of actions:

- the relationship button (`FollowButton`: Mate? / Mating… / Accept). Once you
  are Mates, Unmate lives on the per-person settings screen, not here;
- **Nudge**, a link to `/nudges/<accountId>`;
- **Rose** (see [`rose.md`](rose.md));
- **Share**, which opens the shared `<ShareSheet>`.

Counts: `N posts · N Mates`.

**Deliberately left out** (Tal, 2026-09-15): the domain pill (Kronk isn't
federating, so naming the server is noise), "Followed by X, Y and 25 others",
the notify-me bell (retired), and the three-dot menu (became the per-person
settings screen).

## The drum

Under the block, `<ScopeTitle>` (chevron title) and `<FeedDrum>` (quarter-turn)
switch between three faces, in this order: **Profile · Timeline · Mates**.
Swipe, chevron or arrow keys turn it, and each turn pushes the face's URL. This
is the same rotator `/home` uses. It replaced a strip of seven unlabelled icons.

### Deleted, not relocated

Media, Featured, Posts-and-replies and the per-person Nudges thread are not
faces and have no replacement (2026-09-15). Timeline shows the person's posts.
Nudges owns conversations.

## The Profile face

`features/profile_shelves/index.tsx` (`ProfileFace`). Top to bottom:

1. **Owner toolbar** (own profile only): Arrange / View toggle and Log out.
2. **Bio** (`AccountBio`).
3. **At-a-glance strip** (`ProfileStatsStrip`): Joined · Posts · Mates, plus
   the top korner when the first section is a korner shelf.
4. **Mastodon fields** (`ProfileMeta`): the up-to-four name/value pairs from
   the account record (`fields_attributes`). These still federate and are
   separate from the profile fields below.
5. **The profile board** (below).

### The profile board

`components/profile_board.tsx`. Two zones:

1. **Identity**: the structured fields the person filled in, laid out by
   `<ProfileIdentity>` by what each answer is (short facts as a dot-separated
   stat line, lists as bare chips, long answers as folded prose, links as a
   link row), mostly without labels. Legacy told cards (the old free-text
   About / Note / Where-I-am blocks) still render as tiles here until they are
   converted.
2. **The shelf stack**: one shelf per `ProfileSection`, one korner per screen.
   Each shelf is a full-width band you swipe sideways through; vertical scroll
   moves between korners (`shelf_drawn.tsx`). A shelf with no posts renders
   nothing for visitors.

**Tiles** have sizes `s` / `m` / `l` / `xl`, stored in `settings.size` on both
`ProfileCard` and `ProfileSection`, so a field tile and a korner tile share one
vocabulary. Absent means "derive from the content". A tile can't be sized
below what its content needs.

**Arrange mode** is how the owner edits, on the profile itself rather than a
separate page (decisions.md, 2026-08-14). Hold a shelf's header to lift and
drag it; up/down buttons are the keyboard and screen-reader path
(`arrange_stack.tsx`). The `+` lists every korner, including ones already
shown. Display name, bio, avatar, header and Mastodon fields are edited in a
form that folds open inside Arrange (`identity_editor.tsx`).

Each shelf has three owner-controlled orders: which korners are on, the order
of shelves, and (via `post_picker.tsx`) which posts appear and in what order.
`settings.order` is `newest`, `oldest` or `chosen` (with `order_ids`), plus
`pins` and `hides`. Shelves never copy posts; they resolve at read time through
`Api::V1::Accounts::Profile::SectionsController#statuses`, using each korner
manifest's `status_association`.

`/settings/profile_sections` (`features/profile_sections_settings`) is a
second, list-style place to toggle and reorder sections.

### Fields (the profile creator)

Fields replace freeform told cards. Each field is a `ProfileCard` whose
`card_type` is the field key, with the answer in `body`. The catalog is
`features/profile_shelves/profile_field_catalog.ts` (28 fields in six groups:
Basics, Character, Tastes, Doing, Links, Place), kept in sync with
`ProfileCard::CARD_TYPES`. The owner ticks fields in a pop-up grid
(`field_picker.tsx`).

Each field has an answer type that decides how it is entered and shown:

| Type       | Example                      |
| ---------- | ---------------------------- |
| `text`     | Location → `Sydney`          |
| `pair`     | Pronouns → `she / her`       |
| `chips`    | Interests → `cars, welding`  |
| `longtext` | About me → a short paragraph |
| `link`     | Website → `talitamoss.info`  |
| `date`     | Birthday                     |

This is deliberately separate from Mastodon's four `fields_attributes`, which
stay as they are for federation.

## Who can see a profile

Two layers, both on the reach ladder (Just me / Mates / Orbit / Kronkverse):

- **The whole profile:** `accounts.profile_visibility`, default Kronkverse,
  set in the Privacy screen (decisions.md, 2026-08-16).
  `Account#profile_visible_to?` is checked by the profile cards, sections and
  account statuses endpoints. A viewer who fails it sees the block in its bare
  form and a "You need to be Mates with this person to see more" prompt
  (`ProfileGatedHint`) instead of the drum.
- **Each card and shelf:** its own `visibility`, via the `ProfileVisibility`
  concern on `ProfileCard` and `ProfileSection`. Kronkverse means signed-in
  local members, not the logged-out web.

The owner always sees everything.

## The Mates face

A Mate is a mutual follow (see [`feed.md`](feed.md) for how Mates work). Mates
is the only relationship a profile shows, to anyone, including the owner. A
one-way follow has no list and no count (Tal, 2026-09-04). Pending requests
live at `/mate_requests`.

The face is a plain, paginated list (`features/mates_tab/`):

- `useMatesList()` resolves the handle with `accounts/lookup`, then pages
  through `GET /api/v1/accounts/:id/mates`
  (`Api::V1::Accounts::MatesController`). Results are full
  `REST::AccountSerializer` records, paginated by Follow row id in the `Link`
  header.
- Each row is the shared `<Account>` row. Pagination is a "Load more" button.
- **Privacy** matches the old followers list: `hide_collections` hides the list
  from everyone but the owner, a viewer the subject blocks sees nothing, and
  accounts the viewer muted or blocked are filtered out.

Not to be confused with `GET /api/v1/accounts/:id/matuals` (Mates in common, a
capped preview) or `GET /api/v1/mates/timeline` (the graph slice the Kommunity
orb draws).

**The Mates count** is `account_stats.mates_count`, kept by `Follow` callbacks.
It read 0 for every account until `BackfillMatesCount` (2026-09-15) set the
starting values; the column had been added with a "follow-up recount" that
never ran. `spec/models/follow_spec.rb` locks the callbacks. Lesson: a
migration that says "will be backfilled later" isn't finished.

## Per-person settings

`/@:acct/settings` (`features/profile_settings_per/`) is your settings for one
person, reached from the Ж menu's Settings while you're on their profile. It
has: mute, block, your private note about them, remove Mate, and report. On
your own profile it points you at your account's Privacy settings instead.

## Cutover

`BackfillTopKornersProfileSections` (`db/migrate/20260916100000_*`) gave each
existing local account a starting profile: up to three `ProfileSection` rows
for the korners they had posted in most. It skips any account that already had
a section, so it only wrote onto blank profiles. Owners rearrange from there.

## Open

- **Bio on a gated profile.** decisions.md (2026-08-16) says a gated profile
  still shows the bio. Today the gated view renders only the bare block and the
  Mate prompt; the bio is on the Profile face, which isn't rendered. Either
  show it or update the decision.
- **Custom fields.** The `+` tile in the field picker is a placeholder. Custom
  fields need their own label (a column `ProfileCard` doesn't have).
- **Legacy told cards.** The old free-text card types are still in
  `CARD_TYPES` and still render. Convert them and drop the types.
- **Chrome.** The profile still renders in the legacy `Column`, not `Stage`
  with `<SpaceHeader slug='profile' />`.
- **Per-person settings gaps.** The plan also listed hiding their boosts,
  cancelling or accepting a pending request, and whether you accept roses from
  them. None are on the screen yet.
- **Mates list:** order (currently newest follow row first; by bond date,
  alphabetical or recent interaction are the alternatives), the bond date
  ("Mates since …", needs a subtitle slot on `<Account>`), a better empty state
  than "No Mates yet.", and what a deleted account shows as.
- **On someone else's profile,** should Mates lead with Mates in common?
- **Anthemos.** The direction is for self-shaped data (name, bio, avatar,
  credentials) to live in the person's Anthemos pod, with Kronk holding a
  pointer. Nothing is built. Prototype:
  `docs/prototypes/kronk-profile-redesign.html`.

## History

Rewritten 2026-10-05 to describe what is built. Earlier designs and notes
(the Mates navigation audit and its stages, the profile-creator build order,
the merged Mates tab doc): `git show 231cca937a00bf7bdbee9db6f25b6cbc541a8565:docs/spaces/profile.md`
