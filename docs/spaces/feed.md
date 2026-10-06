# Feed

**Node bucket:** `feed` (Kronk::NodeRegistry) · **Cross-cutting**: not owned by a single korner manifest.

Feed is the home screen: one continuous scroll where Kronk reads as one
thing rather than a set of separate tools. This doc covers what the feed
shows, who sees what, and how korners get into it. It describes what is built
as of 2026-10-05. Earlier designs are in git history (see [History](#history)).

## Nodes

Declared in `config/kronk_nodes.yaml`:

- **`feed.home`**: the feed itself, at `/home`.
- **`settings.feed`**: the feed's settings (`bucket: feed`), at
  `/home/settings`.

Feed is **one** destination, not a set of timeline tabs. Local, federated
and explore timelines are the same feed at a different width (a setting, not
a node). Bookmarks, froths and lists are your content, not the feed. The
composer is the global Post action. `feed.nudges` belongs to the Nudges
pillar.

## Who sees what

### Mates

There is no one-way following in the product. The only person-to-person
relationship is **Mates**: mutual, formed by request then accept.

- **The API:** `POST /api/v1/accounts/:id/mate` and `/unmate`, with
  `/api/v1/mate_requests` to accept or reject (`app/services/mates/`).
- **Underneath, it's still Mastodon's follow tables.** A pending request is a
  `FollowRequest`. Being Mates means two `Follow` rows, one each way
  (`Account::Interactions`). There's no Mate model.
- **No conversion at cutover.** Follows were never mass-converted. A
  leftover one-way follow is tidied up the next time either person sends a
  request.

### The reach ladder

One scale, from narrowest to widest. It's used both for how far a post goes
and how wide a feed reads:

| Tier           | Who                      | `Status#visibility` |
| -------------- | ------------------------ | ------------------- |
| **Just me**    | The author; profile only | `self_only` (8)     |
| **Mates**      | Your mutual connections  | `mates` (6)         |
| **Orbit**      | Mates, and their Mates   | `orbit` (7)         |
| **Kronkverse** | Everyone on the instance | `public`            |

- **Just me** reaches no feed at all, not even the author's own home feed,
  and sends no mention or quote notifications. The post shows only on the
  profile.
- **The old Mastodon visibilities are retired** as choices. The composer
  hides `unlisted`, `private`, `direct` and `limited`, and old rows were
  folded at cutover (decisions.md, 2026-08-28 and 2026-09-16). Slot 5 is
  empty (it was `krew`) and is not renumbered.
- **Orbit is computed live**, with an EXISTS query or subqueries
  (`Account::Interactions#orbit_of?`, `Reachable.visible_to`). There's no
  maintained set (see [Open](#open)).
- **Where it's enforced:**
  - reads in `StatusPolicy#show?` and `AccountStatusesFilter`;
  - fan-out in `FanOutOnWriteService`;
  - the shared rule in `app/models/concerns/reachable.rb`.

### Krew is a separate axis

Krew is not a rung on the ladder. A post has **exactly one** reach tier
**and**, separately, **any number of** krews (`statuses_krews`). Its audience
is _the tier's audience_ **plus** _the members of those krews_, so "Mates and
Krew X" is a valid audience. `krew` is not a visibility value on any model.
The main composer, Moments and Albutts all offer it through the shared
`reach_dropdown.tsx` (`krewSingleSelect` for Moments). Decision:
decisions.md, 2026-08-09.

### Per-post audience

On top of the tier and krews, the author can add or remove specific people
on their own posts:

```
audience = tier  +  krews  +/−  people
```

- **Public is a true broadcast.** People can only be added or removed on the
  gated tiers (Mates, Orbit, Just me). A Kronkverse post can't be narrowed
  person by person, because that would only pretend to be private.
- **Storage:** `status_audience_grants` and `status_audience_exclusions`,
  enforced in `StatusPolicy`. An exclusion beats every grant.
- **Readout:** `GET /api/v1/statuses/:id/audience` (owner only) says who can
  see a post.
- **Editing afterwards:** `UpdateStatusService` accepts a changed tier,
  krews, and people, and reconciles who has the post in their feed.
- **`self_only` plus added people** is how you post to specific people,
  replacing Mastodon's `direct`.

Decision: decisions.md, 2026-08-28.

### Comments

A reply is a **comment**, whether it answers a post, another comment, or
your own post. It takes the reach of its thread's root post. You can't write
a Mates-only comment under a public post, or a public comment under a private
one (Tal, 2026-09-14).

- **It's applied when the comment is written,** not when it's read
  (`PostStatusService#inherited_comment_visibility` via `Status#thread_root`).
  The client's choice is ignored. Older replies keep the reach they had: 84 on
  the live instance were narrower than their root, and recomputing at read
  time would have published them.
- **The composer hides the reach picker** when replying.
- **The home feed shows no replies at all**
  (`FeedManager#filter_from_home`). Search labels a comment as a Comment.

## What the feed shows

**Width.** `UserSettings` `kronk.feed_scope` (`me | mates | orbit |
kommunity`, default `orbit`) is the saved choice. The home feed rotates
between widths with `FeedDrum`, and `ScopeCarousel` is the selector, used
here and in about 18 other places.

The API reads width from the `scope` parameter, defaulting to Orbit
(`Api::V1::Timelines::HomeController`). The client passes the saved setting
in. With `feed_scope_enforced` on (in production, per
`config/feature_flags.yaml`), the timeline is narrowed through
`Kronk::AudienceScope`. Kommunity width reads the local timeline.

**Replies:** none on the home feed (see [Comments](#comments)).

**Korner cards:** see the next section.

## How korners reach the feed

A korner posts to the feed by creating a real `Status` through
`PostStatusService`, stamped with the korner's slug in
**`statuses.source_korner`** (null means an ordinary post). The korner's
record links back with `status_id`.

- **Cards go out automatically when content is created** for Kalendar,
  Kommons, Albutts, Art, Cinema, Kronikles, Karporn, Kuestions and Wachuneed
  (live listings only).
  - **Booth** posts a card only when shared.
  - **Map** posts one only when a trek is published.
  - **Moments** mints no `Status`, by design.
- **The card is chosen by `source_korner`** (falling back to the associated
  record) from the list in `components/korner_cards.tsx`, inside the shared
  `StatusKornerCard` frame: one primary action, and tap for the full record.
- **Adding a card** means adding a component and an entry in that list.
  `tootctl korners doctor` checks that every manifest's `feed_projection.card`
  is in it.

## Open

Not built, or not decided:

- **Korner reach ceiling.** The design gives each korner a default reach
  that authors can narrow but never widen. No manifest declares one and
  nothing enforces it. `feed_projection.default_visibility` appears in 13
  manifests, but nothing reads it.
- **Tune-in as a feed filter.** `Kronk::TuneInGate` exists and the home
  controller calls it, but it does nothing unless `tune_in_enforced` is on,
  and that flag isn't set. Meanwhile the settings copy promises that tuning
  out hides a korner's cards. Either turn it on or change the copy. Also
  unanswered: if you're in a Krew whose post came from a korner you tuned
  out, do you see it?
- **Unused manifest fields.** The card fields in `feed_projection`
  (`title_from`, `summary_from`, `links_to`) aren't read anywhere: make the
  list manifest-driven, or delete them.
- **Default reach for your own posts.** `default_privacy` defaults to nil,
  and its allowed values still include the retired `unlisted`/`private`.
- **Computing Orbit at scale.** It's live per query today. Decide when a
  maintained set becomes worth it.
- **What a comment is, as a model.** The reach rule is decided, but not the
  storage. Options: keep it a post with a parent (today), add a `comment`
  value to `post_type`, or give comments their own model like Kuestions
  answers. There's also the question of whether korner-native comments
  (albums, events, proposals) are the same thing.
- **A shared composer frame.** Proposed, not built: one `<ComposerFrame>`
  for the chrome around every korner composer (identity, the reach slot,
  media, the primary action), each korner posting to its own endpoint.
- **Small leftovers:**
  - Booth's unused `shared_status_id` column.
  - Moments' uncalled `mint_backing_status!`.
  - A redundant reply check below the one in `FeedManager#filter_from_home`.
- **Missing decisions entries.** `decisions.md` has nothing on Mates
  replacing following, on comments inheriting reach, or on the scope
  carousel.

## History

This doc was rewritten on 2026-10-05 from the version the 2026-10-04
consolidation produced. That version merged four older documents:

- the Feed & Reach spec (2026-07-24);
- per-post audience (2026-08-28);
- the scope carousel and composer-frame investigation (2026-08-06);
- the comments exploration, with its live-data analysis (2026-09-14).

Their reasoning, phasing and data are in git:
`git show 231cca937:docs/spaces/feed.md`.
