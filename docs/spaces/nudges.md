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
  stored sorted, so there is one row per pair. One exception: a Wachuneed
  seller whose shop takes enquiries from anyone can be written to by a
  non-Mate (`docs/spaces/wachuneed.md`, Shops).
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

Most events have an **actor**, the person who did it. A few come from no one
in particular: "People are huddling" is a head-count (`docs/spaces/huddle.md`,
Fomo noto). Those have no actor; the row shows the space's own mark where the
avatar goes, and the push carries no face. Use this only for something no
person did.

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
  allowed to see it (`StatusPolicy`). A post that only backs something a
  space owns (a Moment, an album photo, a Kuestions answer) has nothing of
  its own to show, so its row opens `Status#kronk_page` instead, and a
  Moment's row quotes its caption. A Kuestion opens Answered with its
  answers showing (`/hub/kuestions/answered?k=:id`).
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
badge is a number (2026-10-12; it was a waving hand): unread chats plus
unseen notifications plus unread system notices (`selectNudgesAlertCount`),
seeded at boot by `useNudgesBadgeSeed` and kept live by the account stream.
Opening the Notifications face clears the last two, including notices that
arrived live and were still pending.

**2. The two faces** (`features/nudges_messenger/`, routed in
`features/ui/index.jsx`), turned with `<FeedDrum>`:

| URL                       | What it is                                                        |
| ------------------------- | ----------------------------------------------------------------- |
| `/nudges`                 | Notifications. Where you land.                                    |
| `/nudges/messages`        | Messages, with no chat open.                                      |
| `/nudges/:conversationId` | Messages, with that chat open. `…/settings` is its info screen.   |
| `/nudges/with/:accountId` | Opens the Mate chat with that person, then becomes the URL above. |

- **Turning.** Both faces wear the standard `<ScopeTitle>` rotator in the
  Frame's header slot, as every space does, and a sideways swipe turns
  between them on touch. Inside an open chat a swipe does nothing, so a
  stray thumb can't throw you out of a conversation. Turning back to
  Messages returns to the chat that was open.
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

- **Messages face.** A list of chats and the open chat (Tal, 2026-10-12;
  it was an avatar-only strip beside the chat before, with a bell at its
  head). A row is the avatar, the name, the latest line, when, and the
  unread count. Mates and Krews are mixed, newest activity first. The list
  holds every Krew chat, and a Mate chat once it has a message in it. Search
  is a full-width box above the list and filters by **name only**. "New
  chat" is on the Ж menu and opens a picker of your Mates
  (`GET /api/v1/nudges/mates`). Its search asks the server (`?q=`), since
  the list it holds is one page; Rose's **Send a rose** uses the same picker.
  - **Wide screen:** the list is a column on the left, the open chat on the
    right.
  - **Phone:** two pages. The list, under the title; and a chat, which
    takes the whole page with one row at the top (the shared back chip to
    the list, then the name) where the title was.
  - **Height is measured, not inherited** (`use_fill_viewport.ts`): from the
    messenger's top edge to the top of the pillar nav, or to the bottom of
    what is visible when the nav is not (wide screens; the keyboard up). It
    used to come from pinning the page to `100vh`, which on a phone is
    taller than the screen whenever the browser's bar is showing, so the
    composer sat below the bottom edge. Don't put a viewport-height rule
    back on this page.
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
  (`Api::V1::Settings::NudgesController`), and each korner's own rows on
  `/hub/<slug>/settings`. It stores a list of muted row keys in
  `nudges.muted_types`. The rows and the check are one module,
  `Nudges::MuteCatalogue`, so what the page offers is what delivery checks:
  - **Rows come from what is delivered**: one per `listens:` entry, keyed
    `<source_korner>.<verb>` (`kommons.backed`, `feed.frothed`,
    `mates.mate_requested`); the router calls outside the manifest
    (`albutts.added_photo`, `albutts.tagged`, `profile.posted_on`); and
    notices that still
    exist only on the legacy store, under the key they had before
    (`kommons.proposal_challenged`, `kommons.proposal_status_changed`,
    `kommons.task_assigned`, `media_tag`, `poll`, `event_invitation`).
    Each has a plain-English label in `MuteCatalogue::ROWS`; a listen entry
    without one fails `spec/services/nudges/mute_catalogue_spec.rb`, so
    **a new listen entry also needs a label there**.
  - **A verb template is one row.** `kalendar.rsvpd_{status}` covers
    `rsvpd_going`, `rsvpd_interested` and `rsvpd_not_going`.
  - **One mute, every copy.** `EventRouter` drops a muted nudge.
    `NotifyService` maps the legacy notification to the row of the nudge it
    duplicates (a `favourite` on a plain post is `feed.frothed`, on a
    proposal `kommons.frothed`; a `mention` is `feed.replied` when it
    replies to you, else `feed.mentioned`; `follow_request` and `follow` are
    the Mate request and acceptance) and drops it, which also stops its
    email and browser push. `Kronk::KornerNotifier` and
    `ProposalStates#notify_proposer` drop the Kommons notices.
  - **Keys saved before 2026-10-17** were bare notification types. The ones
    with an obvious row are read as it (`favourite` as `feed.frothed`,
    `mention`, `reply`, `mate_request`, `follow_request`, `follow`); the
    others (`reblog`) match nothing and drop out the next time the person
    saves. Boosts and plain follows have no row: Kronk has neither.
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

- **Push** (Tal, 2026-10-19). A new notification (`Nudges::Event` with a
  recipient, including one collapsed onto an earlier row) or chat message
  queues `Nudges::PushWorker`. It sends to every browser push subscription
  of each person it is for: a notification's recipient; a message's other
  Mate, or the Krew chat's joined members who haven't muted it, never the
  author. Each person is skipped if they turned that row's push off
  (`Nudges::PushPreferences`, setting `nudges.push_off_types`: the mute rows
  plus `messages.mate` and `messages.krew`, everything on until turned off)
  or is inside their quiet hours (`Nudges::QuietHours`, in their time zone;
  off by default, Tal 2026-10-19; equal start and end is off). A muted row
  is never pushed because it is never delivered.
- **What the phone shows** (`Nudges::PushPayload`): who, in the space's own
  words, from `nudges.push` in `config/locales/kronk/overrides.yml` (kept in
  step with `notification_copy.ts`): "Ana sent you a rose", "Ana tagged you
  in an album photo", with the thing's name under it when it has one. A
  message says only "Ana nudged you" or "Ana nudged Growers", never what it
  says, so nothing private sits on a lock screen. A tap opens the chat or
  the notification's page. One chat's messages replace each other (`tag`).
  `Nudges::WebPushWorker` subclasses `Web::PushNotificationWorker` for the
  encryption and request; the service worker shows a `kronk_nudge` payload
  as sent.
- **Turning it on, and choosing** (Tal, 2026-10-19). The browser only asks
  when someone taps, so **Turn on notifications** sits at the top of Nudges →
  Notifications (`components/push_prompt.tsx`; dismissible) and under
  **This device** on `/settings/notifications`. On an iPhone outside the
  Home Screen app it says how to add Kronk there first (iOS 16.4 or later);
  Android and desktop browsers need no such step. Every nudge row on
  `/settings/notifications`, and a korner's rows on its settings page,
  has **In Nudges** and **Push** switches (`NudgeSwitches`; Push greys out
  while a row is hidden), with Mate and Krew messages under **Messages** and
  quiet hours under **This device** (`QuietHoursControl`). Both pages use
  `useNudgeSettings`. The old per-korner push toggles are gone from the
  korner settings page.
- **No double push.** A legacy `Notification` still pushes through
  `NotifyService`, except where its nudge pushes instead (froths, replies,
  mentions, Mate requests; `PushPreferences.skip_legacy_push?`) or its row's
  push is off. Notifications with no row (moderation, admin) push as
  before. The Kommons notices from `Kronk::KornerNotifier` are still not
  pushed.

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

### Manifest listeners (19)

| Event                                              | Verb                                            | Directed | Notes                                    |
| -------------------------------------------------- | ----------------------------------------------- | -------- | ---------------------------------------- |
| `kommons.proposal.claimed`                         | `claimed`                                       | yes      | interactive; a dev took on your proposal |
| `kommons.proposal.backed`                          | `backed`                                        | no       | interactive                              |
| `kommons.proposal.frothed`                         | `frothed`                                       | no       |                                          |
| `kommons.proposal.commented`                       | `commented`                                     | no       | interactive, 10m aggregation             |
| `kalendar.event.rsvpd`                             | `rsvpd_{status}`                                | no       | interactive                              |
| `wachuneed.offer.made` / `.accepted` / `.declined` | `offered` / `offer_accepted` / `offer_declined` | no       | made and accepted are interactive        |
| `freethedream.comment.mentioned`                   | `mentioned`                                     | yes      | interactive; to the page the talk is on  |
| `kuestions.question.answered`                      | `answered`                                      | no       | interactive                              |
| `kuestions.question.frothed`                       | `frothed`                                       | no       |                                          |
| `booth.set.frothed`                                | `frothed`                                       | no       |                                          |
| `status.frothed`                                   | `frothed`                                       | yes      | 10m aggregation                          |
| `status.replied`                                   | `replied`                                       | yes      | interactive                              |
| `status.mentioned`                                 | `mentioned`                                     | yes      | interactive                              |
| `mates.request.sent`                               | `mate_requested`                                | yes      | links to the requester's profile         |
| `mates.request.accepted`                           | `mate_accepted`                                 | yes      | "Say hi", to `/nudges/with/<account>`    |
| `krews.join.requested`                             | `join_requested`                                | yes      | interactive; one per member of the Krew  |
| `krews.join.accepted`                              | `join_accepted`                                 | yes      | interactive; to the person who asked     |

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
legacy. It drives the per-korner push toggles at `/hub/<slug>/settings`
and the aggregation windows (`Nudges::Aggregator.window_for`). It no
longer feeds the nudge mute list, which is built from the `listens:`
block (see [Nudge settings](#nudge-settings)). The korner doctor's **L10** check now
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
  `/api/v1/accounts/:id/nudge*` endpoints, `NudgeComposeModal`, and
  `GET /api/v1/nudges/activity`. The web client
  doesn't route to any of it.

Traps when removing things:

- Don't remove a type from `Notification::PROPERTIES` while rows still use
  it. Old rows would fail to serialise, including in the archive.
- Don't delete `notifications.types` from manifests (see above).
- Froth is `Favourite`. Publish from there so every content type is covered
  once.

## Open

- **Korner nudges are Mate-only.** The korner listens (backed, commented,
  RSVP, offers, answers, froths) aren't marked `directed`, so a non-Mate
  backing your proposal sends you nothing. That conflicts with the
  "anything that happens to your content" goal. Decide which should be
  directed.
- **Tier 3 and multi-recipient fan-out.** Not built. It needs a decision on
  where the recipient set is computed (inline or in a job), because a
  tuned-in audience can be most of the instance.
- **Old per-korner push columns.** `user_korner_settings.push_enabled` and
  `push_preferences` are read by nothing and no page shows them since the
  push switches (2026-10-19); drop them in a migration.
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
