# Nudges (`nudges`)

**Manifest:** `config/korners/nudges.yaml` (`core: true`, `enforced: true`,
`pillar: true`, `hub_visible: false`) · **Mount:** `/nudges` (there is no
`/hub/nudges` space) · **Node:** `nudges.index`.

Nudges is where activity that involves you lands, and where you talk to
people. It replaced Mastodon's notifications bell and its DMs. It has two
faces on one barrel: **Notifications**, a list of what has happened that
involves you ("Ana backed your proposal"), which is where you land; and
**Messages**, a messenger with a strip of conversations on the left and the
open conversation on the right. A sideways swipe turns between them.

Nudges is a core space, not a korner. It is a pillar in the primary switcher
(`features/ui/components/hub_switcher.tsx`), carries the unread badge, has no
Hub tile, and can't be tuned out of.

## Nudges spec

This section describes how Nudges works. Code comments cite it as
`docs/spaces/nudges.md (Nudges spec)`.

### Concept

Two kinds of conversation share one surface (`Nudges::Conversation`, `kind`):

- **Mate**: a 1:1 chat between two accounts. Only Mates can start one
  (`POST /api/v1/nudges/conversations` returns 403 otherwise). The pair is
  stored sorted, so there is one row per pair.
- **Krew**: the group chat of a Krew (`krew_id`). Membership, per-person read
  state and mute live on `Nudges::ConversationMembership`. Members can be
  invited, accept or decline, leave, and mute the chat. A Mate chat can't be
  muted or left.

A conversation holds **messages** (`Nudges::ConversationMessage`): text, up
to 5 media attachments, or a voice note.

Separately there are **events** (`Nudges::Event`): a system line that names
the source korner, the actor and the verb. An event is one of two things:

- a **notification**, addressed to one person (`recipient_account_id`) and in
  no chat. "Ana frothed your post", a Mate request, an RSVP. These are listed
  on the Notifications face and nowhere else.
- a **chat line**, which belongs to a conversation and to nobody in
  particular: a Krew join, or a Mate message milestone. These render inline
  in that chat.

An event stores only a **reference** to its source (`source_type` +
`source_id`), never a copy. If the source is deleted the event stays; the
notification just says less and links to the person. Nudges routes
references; it does not store korner data.

**Interactive vs passive.** An interactive event carries a link (CTA) to the
source object. A passive event (a froth, a decline) does not, and only
interactive events may carry one (validated on `Nudges::Event`). On the
Notifications face every row is a link either way: the CTA if there is one,
otherwise the thing it is about, otherwise the person.

System notices that don't come from a person (a proposal moving on, a block
vote, a task, the confirm-your-email reminder) also show on the Notifications
face. They are still read from the old `Notification` store, not Nudges
tables (see [Retiring legacy notifications](#retiring-legacy-notifications)).

### Relevance engine

Who gets a nudge for an event (actor **A** did **X** to object **O** in
korner **K**). The design has three tiers:

1. **Directed at you**: O is yours, or X targets you (reply, mention, froth
   on your post, a Mate request). **Fires regardless of whether A is your
   Mate.** A stranger frothing your post is still about your content.
2. **Someone you chose**: A is someone you Mate with.
3. **Somewhere you tuned in**: you're tuned into K, or involved with O.

What `Nudges::EventRouter.deliver` does today:

1. Drops self-nudges.
2. Drops the event if you muted its type (see [Nudge settings](#nudge-settings)).
3. If the event is not marked `directed`, drops it unless A and you are
   Mates. Directed events skip this check.
4. Writes the event, addressed to you and in no chat. If the listen entry
   declares an aggregation window and a matching event addressed to you (same
   verb and source) is still inside it, the new one collapses onto that
   event, re-floats it and makes it unseen again instead of adding a row.

The router does not create or touch a conversation. It used to file each
event in the Mate chat between A and you, which meant a stranger frothing
your post opened a two-way chat with them.

So Tier 1 is built (the `directed: true` flag), and every non-directed event
is effectively Tier 2 limited to Mates. **Tier 3 is not built**: nothing fans
an event out to everyone tuned into a korner or involved with an object.
There is no per-korner "loudness" setting.

### Notifications list

Decided 2026-10-10 (decisions.md): notifications have their own face, and
activity lines are not in chats.

- Every notification carries **who it is for** (`recipient_account_id`) and
  **when they saw it** (`seen_at`, nil = unseen).
- `GET /api/v1/nudges/notifications` returns what is addressed to you, newest
  first (`Nudges::NotificationFeed`). Passive events about the same thing
  roll up across people into one row with its actors and a count
  ("Ana and 2 others frothed your post"); interactive events stay one row
  each. Page back with `before`, using the `next_before` the response
  returns.
- Each row carries a `subject` (the proposal's title, the first words of the
  post) and a `route` (where a tap goes), resolved a page at a time by
  `Nudges::NotificationSubjects`. A post is only quoted if the viewer is
  allowed to see it (`StatusPolicy`).
- `GET …/notifications/unseen_count` is the number for the badge.
  `POST …/notifications/seen` marks them seen; the client passes `up_to` (the
  `as_of` the list came with) so something that arrived meanwhile stays
  unseen.
- Seen is a timestamp on the event, not a read pointer, because an aggregated
  burst re-floats an existing row and has to become unseen again.
- What a row says is decided on the client, one sentence per
  `<korner>.<verb>` (`features/nudges_messenger/notification_copy.ts`). A
  pair with no sentence falls back to a generic line naming the korner, so
  **a new listen entry should come with its sentence**, and with a badge
  icon if its verb is an action people already know by one.

### Surfaces

**1. Pillar.** The Nudges pillar in `hub_switcher.tsx`. Its icon comes from
the manifest (`icon.material: raven`) through `kornerIcon('nudges')`. The
badge is unread in chats plus unseen notifications (and lights for an unread
system notice), seeded at boot by `useNudgesBadgeSeed` and kept live by the
account stream.

**2. The two faces** (`features/nudges_messenger/`, routed in
`features/ui/index.jsx`), turned with `<FeedDrum>`:

| URL                       | What it is                                                        |
| ------------------------- | ----------------------------------------------------------------- |
| `/nudges`                 | Notifications. Where you land.                                    |
| `/nudges/messages`        | Messages, with no chat open.                                      |
| `/nudges/:conversationId` | Messages, with that chat open. `…/settings` is its info screen.   |
| `/nudges/with/:accountId` | Opens the Mate chat with that person, then becomes the URL above. |

- **Turning.** A sideways swipe on touch. Without touch, the Notifications
  face turns from its title (the standard `<ScopeTitle>` rotator, pushed into
  the Frame's header slot), and the Messages face from the button at the head
  of the chat strip, which also carries the unseen count. The Messages face
  has no header row, on purpose: the conversation gets that height. Turning
  back to Messages returns to the chat that was open.
- **Notifications face** (`notifications_face.tsx`). One row shape for
  everything: who (or a mark, for a system notice), a sentence, a line
  quoting what it is about, and when. A row is a single link. A small badge
  on the avatar says **what happened** where the app already has an icon
  people know for it, and otherwise **where it happened** (decided by Tal,
  2026-10-10; the table is in `notification_row.tsx`):

  | Notification                    | Badge                                       |
  | ------------------------------- | ------------------------------------------- |
  | any froth, in any korner        | the froth heart (`favorite-fill`)           |
  | a reply                         | the reply arrow (`reply`)                   |
  | a mention                       | `@` (`alternate_email`)                     |
  | a Mate request or acceptance    | `person_add` (Mates has no manifest)        |
  | anything else (backed, RSVP, …) | the korner's own icon, from `icon.material` |

  The korner icon is the manifest one (`useKornerIcon`), the same as the
  Hub and the pillar: not the thin line set in `<KornerGlyph>`. A source
  with neither an action icon nor a manifest gets no badge. Opening the
  face is what marks things seen; what was new on arrival keeps its tint and
  dot for the rest of the visit. While messages are unread, a shortcut to
  them sits at the top. Day separators group the list; "Show earlier" pages
  back.

- **Messages face.** A narrow strip of avatars (Mates and Krews mixed, newest
  activity first, unread count on each) beside the open conversation. The
  strip lists every Krew chat, and a Mate chat once it has a message in it.
  Search filters by conversation **name only**. "New chat" is on the Ж menu
  and opens a picker of your Mates (`GET /api/v1/nudges/mates`).
- No presence, last-seen or typing indicators. See
  [Non-negotiables](#non-negotiables).

**3. Conversation stream.** Messages and events in order, with day
separators. Krew bubbles show the sender. Shared posts render as a card
(`inline_status_card.tsx`). Mate chats show a "seen" mark on your messages
the other person has read. Milestone events appear when a Mate pair's
combined message count crosses 250, 500, 1000, 2000, 4000, 8000 or 10000
(`Nudges::Relationship`).

The only events in a stream are chat lines (a Krew join, a milestone).
`aggregate_stream.ts` still collapses consecutive passive lines about the
same thing in a Krew; it predates notifications leaving the chats and has
little left to do.

**4. Composer.** Text, photo/video (up to 5), and voice recording with a
live timer. Reactions: at most 3 distinct per message, enforced on the
server (`REACTION_CAP`).

**5. Settings.** See [Nudge settings](#nudge-settings) below.

**6. Legacy archive** at `/nudges/legacy`: a read-only list of your old
`legacy: true` notifications (`GET /api/v1/nudges/legacy`).

### Nudge settings

- **Muting nudge types**: the Nudges section of `/settings/notifications`
  (`Api::V1::Settings::NudgesController`). It stores a list of muted type
  keys in `nudges.muted_types`. `EventRouter` checks `<korner>.<verb>` and
  `NotifyService` checks the bare notification type against the same list.
  See [Open](#open): the keys the page offers mostly don't match what is
  checked.
- **Manifest settings**: `quiet_hours_start`, `quiet_hours_end`,
  `show_activity_in_chats` and `auto_read_on_open` are declared in the
  manifest. Nothing reads them, and no page links to them.
- **Per-chat**: Krew mute, leave, and invites, on the chat's info screen.

### Data model

| Table                             | Model                            | Holds                                                                                                    |
| --------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `nudges_conversations`            | `Nudges::Conversation`           | `kind` (`mate`/`krew`), the Mate pair or `krew_id`, `last_activity_at`, Mate read pointers, `expires_at` |
| `nudges_conversation_memberships` | `Nudges::ConversationMembership` | Krew member, read pointers, `muted`, pending invite (`invited_by`)                                       |
| `nudges_conversation_messages`    | `Nudges::ConversationMessage`    | author, body, media ids, voice attachment, `reactions` (JSONB), `deleted_at`, `expires_at`               |
| `nudges_events`                   | `Nudges::Event`                  | actor, recipient, `seen_at`, `source_korner_slug`, `verb`, `source_type`/`source_id`, `interaction`, CTA |
| `nudges_relationships`            | `Nudges::Relationship`           | Mate pair, combined `message_count`, `last_milestone_hit`                                                |

**Unread** (`Nudges::Conversation#unread_count_for`) counts unseen messages
and unseen chat lines. Opening a conversation marks everything read. A muted
Krew chat counts as zero. Notifications are counted separately
(`Nudges::NotificationFeed.unseen_count`).

`nudges_events.conversation_id` is nullable: a notification has a recipient
and no conversation, a chat line has a conversation and no recipient.
`Nudges::Conversation#events` is scoped to chat lines.

The source korner is a **slug** (`source_korner_slug`), shown with that
korner's icon and name. All orbs use the same Kronk purple; there is no
per-korner colour.

**Manifest.** `hub_visible: false` keeps Nudges off the Hub grid and
`pillar: true` puts it in the nav. They are two fields on purpose, so the
two concerns never collapse into one.

### Self-delivering delivery

Nudges delivers on its own machinery, not through Mastodon's `Notification`
store:

- **Live stream** (`Nudges::StreamPublisher`): each conversation has a
  channel `timeline:nudges:conversation:<id>`, and each participant also gets
  the envelope on `timeline:nudges:account:<id>`. So an open messenger
  updates even for a conversation you aren't looking at. A notification goes
  to its recipient's account channel alone, as `nudges.notification.created`.
- **Badge**: unread in chats plus unseen notifications, as above.

There is **no push** for Nudges events. Browser push still comes only from
legacy `Notification` rows via `NotifyService`. `Nudges::QuietHours` exists
for when push arrives, but nothing calls it.

### Non-negotiables

- **Private by construction.** No conversation content ever goes to a feed.
- **No federation.** Nudges is local-only (`federates: false`).
- **No presence signals.** No online, last-seen or typing indicators. A
  future liveness cue would have to be opt-in and per conversation.
- **Interactive vs passive** is honoured on every event.
- **Deletion.** Snowflake ids, never reused. A deleted message is
  tombstoned (`tombstone!` clears body, media and reactions; the row stays)
  and the API answers 410.
- **Reaction cap: 3** distinct per message, on the server.
- **References, not copies.** Nudges never stores korner data.

## Delivery: state of play

How a korner event becomes a nudge.

```
korner code                          config/korners/nudges.yaml       Nudges::EventRouter
Kronk::KornerEvents.publish(    →    listens:                     →   Nudges::Event on the
  'kommons.proposal.backed',           - event: kommons.proposal.backed   recipient's notifications
  actor_account_id:,                     verb: backed
  recipient_account_id:,                 cta_route: '/hub/kommons/p/{proposal_id}'
  proposal_id:)
```

- **The bus**: `Kronk::KornerEvents` (`lib/kronk/korner_events.rb`).
- **The wiring**: `config/initializers/nudges_event_bus.rb` reads the
  manifest's `listens:` at boot and subscribes one handler per entry. It
  fills `{token}` placeholders in verbs and CTA routes from the event
  payload, and passes `directed:` and the aggregation window through. Adding
  a nudge is a manifest entry plus one `publish` call.
- **One recipient per event.** A manifest entry delivers to the single
  `recipient_account_id` in the payload. Anything that needs several
  recipients has to be hand-wired.

### Manifest listeners (16)

| Event                                              | Verb                                            | Directed | Notes                                    |
| -------------------------------------------------- | ----------------------------------------------- | -------- | ---------------------------------------- |
| `kommons.proposal.claimed`                         | `claimed`                                       | yes      | interactive; a dev took on your proposal |
| `kommons.proposal.backed`                          | `backed`                                        | no       | interactive                              |
| `kommons.proposal.frothed`                         | `frothed`                                       | no       |                                          |
| `kommons.proposal.commented`                       | `commented`                                     | no       | interactive, 10m aggregation             |
| `kalendar.event.rsvpd`                             | `rsvpd_{status}`                                | no       | interactive                              |
| `wachuneed.offer.made` / `.accepted` / `.declined` | `offered` / `offer_accepted` / `offer_declined` | no       | made and accepted are interactive        |
| `kuestions.question.answered`                      | `answered`                                      | no       | interactive                              |
| `kuestions.question.frothed`                       | `frothed`                                       | no       |                                          |
| `booth.set.frothed`                                | `frothed`                                       | no       |                                          |
| `status.frothed`                                   | `frothed`                                       | yes      | 10m aggregation                          |
| `status.replied`                                   | `replied`                                       | yes      | interactive                              |
| `status.mentioned`                                 | `mentioned`                                     | yes      | interactive                              |
| `mates.request.sent`                               | `mate_requested`                                | yes      | links to the requester's profile         |
| `mates.request.accepted`                           | `mate_accepted`                                 | yes      | "Say hi", to `/nudges/with/<account>`    |

The three `status.*` events are published by `Kronk::StatusNudges` (called
from `Favourite`, `PostStatusService` and `ProcessMentionsService`) behind
the `status_nudges` flag. The flag is off by default and **on in
production** (`config/feature_flags.yaml`). There is no `status.reblogged`
(nothing local can boost) and no `status.quoted`.

### Hand-wired subscribers

Also in `nudges_event_bus.rb`, each for a reason the manifest can't express:

- `krews.member.joined`: adds the member to the Krew chat and posts a
  `joined` line there.
- `krews.member.left`: removes the member from the Krew chat, silently.
- `albutts.album.new_photo`: nudges every other contributor and the album
  owner (several recipients). The Mate check still applies to each one.
- `kommons.proposal.closed` / `.annulled`: tells backers who opted in
  (`notify_on_status_change`). This writes a **legacy** `Notification`
  through `Kronk::KornerNotifier`, not a nudge.

### Published, nobody listens

`huddle.started`, `huddle.ended`, `huddle.room.created`,
`huddle.room.retired`, `krew.post.created` and `kalendar.event.created`.

### Manifest `notifications.types`

Korner manifests also declare `notifications.types`. This field is not
legacy. It drives the per-korner push toggles at `/hub/<slug>/settings`,
the aggregation windows (`Nudges::Aggregator.window_for`), and the
korner rows of the nudge mute list. The korner doctor's **L10** check now
asks each entry to say how it is delivered: `delivery: notification` (a
registered `Notification` type, the default), `delivery: nudge` with an
`event:` that is both published and consumed, or `planned: true` (a
warning). Rules: `docs/korners/korner_standard.md`.

## Retiring legacy notifications

Mastodon's `Notification` store still exists and is still written. The plan
(decisions.md, 2026-08-12) is to **stop writing what Nudges has replaced**,
not to drop the table. Federation and moderation are deferred, so their
notification types stay on the old store.

Where things stand:

- **Social activity is dual-running.** A froth, reply or mention on your
  post creates a legacy `Notification` (which drives email and browser push)
  **and**, with `status_nudges` on, a notification in Nudges. The legacy
  write has not been cut.
- **Kronk-native types still on the store:** `proposal_status_changed`,
  `proposal_challenged`, `task_assigned` (via `Kronk::KornerNotifier`
  and `Kronk::ProposalStates`) and `email_confirmation_reminder`. All four
  render on the Notifications face (`KRONK_SYSTEM_TYPES`,
  `system_notice_row.tsx`), merged into the list by time. `invite_accepted` and
  `birthday` are also written there, but nothing shows them.
- **`legacy: true` types** (`Notification::LEGACY_TYPES`, 17 of them,
  including `mention`, `favourite`, `follow`, `moderation_warning`,
  `severed_relationships`, `annual_report`, `media_tag`) are listed at
  `/nudges/legacy`.
- **`features/notifications_v2/`** is almost all unreachable. Only
  `embedded_status*.tsx` is imported from outside the folder (by the
  composer and boost modal).
- **The 1.x nudge path is still in the tree**: `NudgeService`, the
  `NudgeMessage` model (a `nudge`-type `Notification`), the
  `/api/v1/accounts/:id/nudge*` endpoints, `features/nudges/`,
  `NudgeComposeModal`, and `GET /api/v1/nudges/activity`. The web client
  doesn't route to any of it.

Traps when removing things:

- Don't remove a type from `Notification::PROPERTIES` while rows still use
  it. Old rows would fail to serialise, including in the archive.
- Don't delete `notifications.types` from manifests (see above).
- Froth is `Favourite`. Publish from there so every content type is covered
  once.

## Open

- **Mute keys don't match.** The korner rows on the mute list use
  `<korner>.<notification type>` (e.g. `kommons.proposal_challenged`). The
  router checks `<korner>.<verb>` (e.g. `kommons.backed`) and `NotifyService`
  checks the bare type. So korner mutes do nothing. Person-to-person mutes
  like `favourite` silence the legacy notification and its push, but not the
  `feed.frothed` nudge. `reply` and `mate_request` match nothing.
- **Korner nudges are Mate-only.** The korner listens (backed, commented,
  RSVP, offers, answers, froths) aren't marked `directed`, so a non-Mate
  backing your proposal sends you nothing. That conflicts with the
  "anything that happens to your content" goal. Decide which should be
  directed.
- **Tier 3 and multi-recipient fan-out.** Not built. It needs a decision on
  where the recipient set is computed (inline or in a job), because a
  tuned-in audience can be most of the instance.
- **No push for nudges.** Push, quiet hours and the per-korner push toggles
  all wait on this. The toggles are stored but nothing reads them.
- **Unused Nudges settings.** `show_activity_in_chats` and
  `auto_read_on_open` have no reader, and no page shows the four manifest
  settings. Wire them or remove them.
- **Notifications settings fold into Nudges.** Decided (decisions.md,
  2026-07-20), not done. `/settings/notifications` is still its own page.
- **Events nobody consumes.** Decide for the four Huddle events,
  `krew.post.created` and `kalendar.event.created`: a listen entry each, or
  stop publishing.
- **Planned korner types.** Albutts `contribution_rights_granted`, the
  three Huddle types, the three Moments types and Rose `rose.received` are
  `planned: true`, with no producer.
- **Cut the legacy write** for froth, reply and mention, then move the
  Kommons types onto the bus and retire `Kronk::KornerNotifier`.
- **`invite_accepted` and `birthday`** are written but never shown. Give
  them a renderer (the Notifications face is the obvious home) or stop writing them.
- **Sharing a post into a chat arrives without the post.** The Nudge button
  on a post and "send in Nudges" on the share sheet open the right chat
  (`/nudges/with/<account>`) and pass the post along in history state, but
  the messenger's composer does not read it. Only the retired 1.x thread did.
- **System notices are a second source.** The four legacy types are merged
  into the Notifications list on the client, by time. Moving them onto the
  bus would make them ordinary notifications and remove the merge.
- **Stale stranger chats.** Mate chats that only ever held notifications are
  now empty. They are hidden from the strip (it lists a Mate chat only once
  it has a message) but the rows remain.
- **Time-boxed chats.** `expires_at` and the countdown UI exist, but nothing
  sets an expiry.
- **In-space indicators.** The idea was a dot on a card or tile when you
  have an unseen nudge about it. Not built. Hub tiles use `Kronk::KornerSeen`,
  and the Kommons proposal-card badge still reads legacy notifications.
- **Moderation and system channel.** Deferred. Until it exists, the legacy
  store and `/nudges/legacy` stay. Nothing in the UI links to
  `/nudges/legacy` any more.
- **Dead 1.x code.** Remove the old nudge path and the unreachable parts of
  `notifications_v2/` listed above.
- **Sidebar ordering and in-body search.** Recency-only and name-only by
  choice. Searching message bodies is a privacy decision (should that index
  exist at all?).
- **Voice parity.** Voice notes were to wait for Android parity. They
  shipped on the web, and there is no current Android app.

## History

Rewritten 2026-10-05 to describe what is built. 2026-10-10: notifications
moved out of the chats onto their own face, and the pinned "Kronk" system
chat was removed. Earlier designs and notes
(the original Nudges brief and its amendments, the 2026-08-12 delivery
audit, and the legacy-notification retirement plan): `git show
231cca937a00bf7bdbee9db6f25b6cbc541a8565:docs/spaces/nudges.md`.
