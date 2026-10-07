# Nudges (`nudges`)

**Manifest:** `config/korners/nudges.yaml` (`core: true`, `enforced: true`,
`pillar: true`, `hub_visible: false`) · **Mount:** `/nudges` (there is no
`/hub/nudges` space) · **Node:** `nudges.index`.

Nudges is where activity that involves you lands, and where you talk to
people. It replaced Mastodon's notifications bell and its DMs. It is a
messenger: a list of conversations on the left, the open conversation on the
right. Notices ("Ana backed your proposal") show up _inside_ the conversation
with the person who did the thing, not in a separate feed.

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

Two kinds of thing appear in a conversation:

- a **message** (`Nudges::ConversationMessage`): text, up to 5 media
  attachments, or a voice note;
- an **event** (`Nudges::Event`): a system line, such as "Ana frothed your
  post", a Krew join, or a milestone. It is not a bubble. It names the source
  korner, the actor and the verb. If it is interactive it carries a link (CTA)
  to the source object.

An event stores only a **reference** to its source (`source_type` +
`source_id`), never a copy. If the source is deleted the event stays and
renders as a tombstone. Nudges routes references; it does not store korner
data.

**Interactive vs passive.** An interactive event has a CTA and you answer it
by replying in the same conversation. A passive event (a froth, a decline)
only links out. Only interactive events may carry a CTA (validated on
`Nudges::Event`).

A pinned **"Kronk"** row at the top of the list (`/nudges/kronk`,
`features/nudges_messenger/kronk_system.ts`) shows system notices that don't
come from a person. It reads the old `Notification` store, not Nudges tables
(see [Retiring legacy notifications](#retiring-legacy-notifications)).

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
4. Finds or creates the Mate conversation between A and you
   (`Nudges::Conversation.mate_between!`).
5. Writes the event. If the listen entry declares an aggregation window and a
   matching event (same verb and source) is still inside it, the new one
   collapses onto that event and re-floats it instead of adding a row.

So Tier 1 is built (the `directed: true` flag), and every non-directed event
is effectively Tier 2 limited to Mates. **Tier 3 is not built**: nothing fans
an event out to everyone tuned into a korner or involved with an object.
There is no per-korner "loudness" setting.

### Surfaces

**1. Pillar.** The Nudges pillar in `hub_switcher.tsx`. Its icon comes from
the manifest (`icon.material: raven`) through `kornerIcon('nudges')`. The
badge reads Nudges' own unread count (messages _and_ unseen events, plus the
Kronk row), seeded at boot by `useNudgesBadgeSeed` and kept live by the
account stream. `NudgeArrivalToast` pops up when something new arrives.

**2. Messenger shell** at `/nudges` (`features/nudges_messenger/`, routed in
`features/ui/index.jsx`). `/nudges/:conversationId` opens one conversation;
`/nudges/:conversationId/settings` is its info screen.

- One list of Mates and Krews mixed, newest activity first. No tabs, no
  pinned or unread-first tier (only the Kronk row is pinned).
- Each row: avatar (a stacked pair for a Krew), name, time, one-line
  preview, unread count. The preview hints whether the latest item was a
  message or an event (`latest_kind`).
- Search filters the list by conversation **name only**.
- The pencil opens a picker of your Mates (`GET /api/v1/nudges/mates`).
- No presence, last-seen or typing indicators. See
  [Non-negotiables](#non-negotiables).

**3. Conversation stream.** Messages and events in order, with day
separators. Krew bubbles show the sender. Shared posts render as a card
(`inline_status_card.tsx`). Mate chats show a "seen" mark on your messages
the other person has read. Milestone events appear when a Mate pair's
combined message count crosses 250, 500, 1000, 2000, 4000, 8000 or 10000
(`Nudges::Relationship`).

Passive events are rolled up on the client (`aggregate_stream.ts`). In a
Mate chat, runs of bare froths become one strip. In a Krew, consecutive
nudges about the same thing collapse into one expandable line. Interactive
events, messages and milestones never roll up.

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
| `nudges_events`                   | `Nudges::Event`                  | actor, `source_korner_slug`, `verb`, `source_type`/`source_id`, `interaction`, `cta_label`/`cta_route`   |
| `nudges_relationships`            | `Nudges::Relationship`           | Mate pair, combined `message_count`, `last_milestone_hit`                                                |

**Unread** (`Nudges::Conversation#unread_count_for`) counts unseen messages
**and** unseen events, so a chat whose only new item is a nudge reads
unread. Opening a conversation marks everything read. A muted Krew chat
counts as zero.

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
  updates even for a conversation you aren't looking at.
- **Badge**: computed from Nudges unread, as above.

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
  'kommons.proposal.backed',           - event: kommons.proposal.backed   recipient's Mate chat
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
| `mates.request.accepted`                           | `mate_accepted`                                 | yes      | "Say hi"                                 |

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
- `kommons.proposal.completed` / `.annulled`: tells backers who opted in
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
  **and**, with `status_nudges` on, a nudge in your Mate chat. The legacy
  write has not been cut.
- **Kronk-native types still on the store:** `proposal_status_changed`,
  `proposal_challenged`, `task_assigned` (via `Kronk::KornerNotifier`
  and `Kronk::ProposalStates`) and `email_confirmation_reminder`. All four
  render in the Kronk row (`KRONK_SYSTEM_TYPES`). `invite_accepted` and
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
  them a renderer (the Kronk row is the obvious home) or stop writing them.
- **The "Say hi" link** on `mate_accepted` points at
  `/nudges/{actor_account_id}`, but that route takes a conversation id
  (unverified in a browser).
- **Time-boxed chats.** `expires_at` and the countdown UI exist, but nothing
  sets an expiry.
- **In-space indicators.** The idea was a dot on a card or tile when you
  have an unseen nudge about it. Not built. Hub tiles use `Kronk::KornerSeen`,
  and the Kommons proposal-card badge still reads legacy notifications.
- **Moderation and system channel.** Deferred. Until it exists, the legacy
  store, `/nudges/legacy` and the Kronk row stay. Nothing in the UI links to
  `/nudges/legacy` any more.
- **Dead 1.x code.** Remove the old nudge path and the unreachable parts of
  `notifications_v2/` listed above.
- **Sidebar ordering and in-body search.** Recency-only and name-only by
  choice. Searching message bodies is a privacy decision (should that index
  exist at all?).
- **Voice parity.** Voice notes were to wait for Android parity. They
  shipped on the web, and there is no current Android app.

## History

Rewritten 2026-10-05 to describe what is built. Earlier designs and notes
(the original Nudges brief and its amendments, the 2026-08-12 delivery
audit, and the legacy-notification retirement plan): `git show
231cca937a00bf7bdbee9db6f25b6cbc541a8565:docs/spaces/nudges.md`.
