# Profile

**Manifest:** `config/korners/profile.yaml` (`core: true`, mount `/@:acct`) ·
**Node:** `profile.view` in `config/kronk_nodes.yaml`

A profile is a person's space on Kronk: who they are and what they've posted.
It is a core space (the "Me" pillar), not a korner, so it
has no Hub tile and can't be tuned out of. This doc describes what is built.
Earlier designs are in git history (see [History](#history)).

## Routes

| URL                | What it is                                                                       |
| ------------------ | -------------------------------------------------------------------------------- |
| `/@:acct`          | The profile: block, Profile face, then their timeline                            |
| `/@:acct/settings` | Your settings for this person (signed in only)                                   |
| `/@:acct/tagged/…` | A tag-filtered timeline. Not a face; it keeps its own route and draws the block. |

`/accounts/:id` works too. It mounts one component,
`features/profile/index.tsx` (`ProfileSpace`). Routes are in
`features/ui/index.jsx`.

**Redirects.** Old profile pages redirect rather than 404, because links to
them exist in the wild:

- `/posts` and `/mates` (the old Timeline and Mates faces) → `/@:acct`.
- `/followers`, `/following` (and the `/accounts/…`, `/users/…` spellings) →
  `/@:acct`.
- `/featured`, `/with_replies`, `/media` → `/@:acct`.
- `/@:acct/nudges` → `/nudges`.
- `/@:acct/edit` → `/@:acct` (editing happens on the profile, below).
- On the server, `FollowerAccountsController` and `FollowingAccountsController`
  send browsers to `/@:acct/mates`, which lands on the profile.

These retire **pages, not data**. The ActivityPub `followers`/`following`
collections and the REST endpoints (`/api/v1/accounts/:id/followers`,
`/following`) are untouched: federation and the Android app use them.

## The profile block

One identity block (`components/profile_block.tsx`) sits at the top. It is the
only place identity is drawn.

**Contents:** cover, avatar, display name, handle, lock icon, relationship tag
("You're Mates", "Blocking", …), and a row of actions:

- the relationship button (`FollowButton`: Mate? / Mating… / Accept). Once you
  are Mates, Unmate lives on the per-person settings screen, not here;
- **Nudge**, a link to `/nudges/<accountId>`;
- **Rose** (see [`rose.md`](rose.md));
- **Share**, which opens the shared `<ShareSheet>`.

Counts: `N posts · N Mates · Joined <month year>`, plain text, not links, and under them the bio
(`AccountBio`; while designing your own, `components/profile_bio_field.tsx`).

The way to someone's Wachuneed shop is not here but in the header of their
Wachuneed shelf (`components/profile_shop_link.tsx`; Tal, 2026-10-14).

**Deliberately left out** (Tal, 2026-09-15): the domain pill (Kronk isn't
federating, so naming the server is noise), "Followed by X, Y and 25 others",
the notify-me bell (retired), and the three-dot menu (became the per-person
settings screen).

## One page

Top to bottom: the block, the Profile face, then the person's timeline
(`AccountTimeline`, embedded). There is no title or switcher under the block
(Tal, 2026-10-18). This replaced a drum that turned between Profile, Timeline
and Mates faces, which had itself replaced a strip of seven unlabelled icons.
While you design your profile or see it as others do, the timeline is hidden:
those are about the Profile face.

### Deleted, not relocated

Media, Featured, Posts-and-replies and the per-person Nudges thread have no
replacement (2026-09-15). The timeline shows the person's posts. Nudges owns
conversations.

## The Profile face

`features/profile_shelves/index.tsx` (`ProfileFace`). Top to bottom:

1. **Owner toolbar** (own profile, while designing only): Save. There is no
   Log out here; it is in the /me hub (Tal, 2026-10-15).
2. **Mastodon fields** (`ProfileMeta`): the up-to-four name/value pairs from
   the account record (`fields_attributes`). These still federate and are
   separate from the profile Kuestion answers below.
3. **The profile board** (below).
4. **Make it yours** (`components/profile_prompts.tsx`; own profile, outside
   designing, never shown to anyone else; Tal, 2026-10-18). Dashed cards with
   a +, where things could go: one per korner you've posted in that has no
   shelf yet (up to four, most posts first; a tap puts the shelf on, as
   ticking it while designing does), **Say who you are** while no profile
   Kuestions are answered (it starts designing with the Kuestions open and in
   view), and **Design your profile**. Nothing is filled in
   for you; the cards suggest and you choose. They go once there is nothing
   left to suggest, unless the profile is still empty. Anyone else sees "This
   profile is quiet." on an empty profile.

The bio and the Joined · Posts · Mates line are in the profile block above
(Tal, 2026-10-15: the at-a-glance bar repeated the counts under the photo,
and the bio read as a loose, unformatted block).

### The profile board

`components/profile_board.tsx`. Two zones:

1. **Identity**: the person's pinned profile Kuestion answers (see About
   you, below). Kronk's own are laid out by `<ProfileIdentity>` by what each
   answer is (short facts as a dot-separated
   stat line, lists as bare chips, long answers as folded prose, links as a
   link row), mostly without labels; members' Kuestions follow as
   question-and-answer tiles. Legacy told cards (the old free-text
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

**Editing** happens on the profile itself rather than a separate page
(decisions.md, 2026-08-14), and starts from the Ж menu: on your own
Profile face it carries **Design your profile** (a page action registered by
`features/profile/index.tsx`, which owns the editing state so the block and
the face edit together; Tal, 2026-10-13). A **Save** button on the face, shown only while editing, ends it. While editing,
everything edits where it already is: the cover and photo take a new
picture from the button on each, the name and bio become fields
(`profile_block.tsx`, `profile_bio_field.tsx`), and each saves as it
changes. There is no second copy of them in a form below. Hold a shelf's
header to lift and drag it; up/down buttons are the keyboard and
screen-reader path (`arrange_stack.tsx`). Under the shelves, **Korners on
your profile** shows every korner that can go there as a tile (glyph, name,
how many posts), the way Krew picks its korners; ticking one puts its shelf
on, unticking takes it off (Tal, 2026-10-15: actual options to choose
from, in place of a + that opened a list). Mastodon's `fields_attributes` aren't edited
here.

Each shelf has three owner-controlled orders: which korners are on, the order
of shelves, and (via `post_picker.tsx`) which posts appear and in what order.
`settings.order` is `newest`, `oldest` or `chosen` (with `order_ids`), plus
`pins` and `hides`. Shelves never copy posts; they resolve at read time through
`Api::V1::Accounts::Profile::SectionsController#statuses`, using each korner
manifest's `status_association`.

**Tagged in photos** (Tal, 2026-10-21) is the one shelf that isn't your own
posts: other people's album photos with you @named in the caption
(`settings.source: 'tagged'` with `korner_slug: 'albutts'`; the library
offers it as `albutts:tagged`, with a count). It is off until you put it on,
like every shelf; Make it yours suggests it once someone has tagged you,
and you hide or pick photos as on any shelf. Each photo still shows only
to people who may see it (`permitted_statuses_from_ids`). A shelf is named
by its key, `korner` or `korner:source` (`shelfKeyOf`).

### The Gallery

**The Gallery** (Kommons, "Adding users gallery of media they have uploaded",
2026-10-22) is the photos and videos from your ordinary posts: one tile per
post, a play mark on a video, a count when a post holds several. It leaves
out what has a home of its own: Albutts photos, Moments, replies, and a
korner's own posts (an Art piece, a Karporn listing), each of which has its
own shelf (`ProfileSection.gallery_statuses`). Audio isn't in it.

It is the one shelf that comes on by itself. Your first photo or video puts
it at the top of your profile (`PostStatusService#add_profile_gallery!`);
everyone who had posted one before got it from a backfill
(`20261023090000_backfill_profile_gallery_shelves`). After that it is a shelf
like any other: drag it lower, hide or pick its posts, or take it off, and
it stays off. Its key is `profile:media` (`settings.source: 'media'` with
`korner_slug: 'profile'`), and the library offers it first, as **Gallery**.
This is not the Media tab that was deleted (above): it is a shelf on the
board, not a second timeline.

`/settings/profile_sections` (`features/profile_sections_settings`) is a
second, list-style place to toggle and reorder sections.

### About you (profile Kuestions)

What someone says about themselves is their answers to **profile Kuestions**,
pinned to the profile. They replaced profile Fields on 2026-10-13; the
Kuestions side is in `docs/spaces/kuestions.md` ("Profile Kuestions").

- **Where you answer.** While designing your profile, **About you** sits
  under your answers: the profile Kuestions grid
  (`features/questions/profile_panel.tsx`, the same grid as the Kuestions
  Profile view), folded behind **Answer kuestions (N)** so it isn't all
  there at once, beside **+ Ask a profile kuestion**, which opens the
  Kuestions composer set to For profiles. What you ask is open to everyone
  on Kronk to answer on their own profile, and each tile says who asked
  it. Answering pins; each answer has its own reach and can be taken off
  the profile without losing it.
- **How it shows.** `GET /api/v2/kuestions/pinned?account_id=` returns what
  the viewer may see, in the owner's order. Answers to Kronk's own Kuestions
  (they carry the old field keys as `seed_key`) are laid out by
  `profile_identity.tsx` by format: short answers in a stat line, lists as
  chips, `longtext` as folded prose, links in a row, the birthday with its
  countdown, the location with its map. Answers to Kuestions members wrote
  are question-and-answer tiles below (`profile_kuestion_tiles.tsx`), at
  the answer's tile size.
- **Arranging them.** While editing, each answer can be dragged within its run
  (the stat line, the chip rows, the paragraphs, the links, the tiles;
  `arrange_group.tsx`), and a tile is sized from the button on it. Pinned
  answers have one order, so a move within a run takes the slots that run
  held and leaves the others put; the whole order is saved
  (`PATCH /api/v2/kuestions/pinned`), the size with
  `PATCH /api/v2/kuestions/:id/answer`. A paragraph tile never goes below
  `m`.
- **The move.** Migration `20261013100000_move_profile_fields_to_kuestions`
  turned each filled Field card into an answer, keeping reach, whether it
  showed, order and size. The cards were left in place and are no longer
  read; a card the answer couldn't hold (a birthday that isn't a date) stayed
  only on its card. Kalendar birthdays and the birthday nudge read the
  `birthday` answer, pinned and within reach.

This is deliberately separate from Mastodon's four `fields_attributes`, which
stay as they are for federation.

## Who can see a profile

Two layers, both on the reach ladder (Just me / Mates / Orbit / Kronkverse):

- **The whole profile:** `accounts.profile_visibility`, default Kronkverse,
  set in the Privacy screen (decisions.md, 2026-08-16).
  `Account#profile_visible_to?` is checked by the profile cards, sections and
  account statuses endpoints. A viewer who fails it sees the block in its bare
  form and a "You need to be Mates with this person to see more" prompt
  (`ProfileGatedHint`) instead of the face and timeline.
- **Each card and shelf:** its own `visibility`, via the `ProfileVisibility`
  concern on `ProfileCard` and `ProfileSection`. Kronkverse means signed-in
  local members, not the logged-out web.

The owner always sees everything.

**Seeing it as others do.** While designing your profile, a **See it as
others do** button sits beside Save (Tal, 2026-10-15: so people can check
who can see what; it is part of designing, so not a moon of its own). A bar
over the profile picks the circle (**Mates**, **Orbit**, **Kronkverse**) and
**Back to designing** ends it; the profile then shows
only what reaches that circle. It reads through the same endpoints anyone
else does, with `as=mates|orbit|kronkverse`, which the server honours only
for the owner (`ProfileViewAsConcern`): cards, pinned answers, shelves, and
each shelf's posts by their own reach. A circle the profile itself doesn't
reach sees nothing on the face. The profile block above (cover, counts,
bio) is not previewed: it shows as it does to you. The check is against the reach
scopes (`ProfileVisibility::AUDIENCE_SCOPES`), not a real member, so a
block or a Krew grant doesn't show in it.

## Posts from Mates

A Mate can write a post on your profile (Tal, 2026-10-06 and 2026-10-12;
Kommons "Post to a profile").

- **Writing one.** A Mate's profile block has **Post on <name>'s profile**
  beside Nudge and Rose. It opens the ordinary composer with "Posting on
  <name>'s profile" above it (`compose/components/profile_target_indicator.tsx`);
  the x there makes it an ordinary post again. The reach picker works as for
  any post, except that it cannot be "Just me".
- **What it is.** Still the author's post (`statuses.profile_account_id`
  names the profile). It travels as any post of theirs does, and wherever it
  shows it says **On <name>'s profile**.
- **Where it shows.** On the owner's timeline, under their profile, with their own posts
  (`AccountStatusesFilter#with_profile_posts`). Who sees it there follows
  the author: everyone for a public one, the author's Mates for a narrower
  one, and always the author and the owner.
- **The owner is told** ("posted on your profile"), and can take any such
  post off from its menu, **Remove from my profile**
  (`DELETE /api/v1/statuses/:id/profile_post`). The post is not deleted; it
  just no longer sits on their profile.
- **Turning it off.** Privacy settings, **Mates can post on my profile**
  (user setting `profile_posts`, on by default). Off, the server refuses.

## The Mates list (off)

**Off for now** (Tal, 2026-10-18): `/@:acct/mates` redirects to the profile
and the Mates count isn't a link, until it is settled who may see whose Mates.
The code below is kept for when it comes back.

A Mate is a mutual follow (see [`feed.md`](feed.md) for how Mates work). Mates
is the only relationship a profile shows, to anyone, including the owner. A
one-way follow has no list and no count (Tal, 2026-09-04). Pending requests
live at `/mate_requests`.

The list was a plain, paginated one (`features/mates_tab/`):

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
capped preview).

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

- **Audit: duplicate controls.** The profile carried its own Log out, which
  duplicated Sign out in the /me hub; it was removed (Tal, 2026-10-15). An
  audit of the space should look for other controls that live in two places.

- **Old Field cards.** Field-keyed `ProfileCard` rows are unread since the
  move. Drop them, and the field keys from `CARD_TYPES` and
  `profile_field_catalog.ts`, once nobody needs to roll back.
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
