# Kalendar (`kalendar`)

**Manifest:** `config/korners/kalendar.yaml` · **Mount:** `/hub/kalendar`

Kalendar maps the rhythms of the shared space. It holds the events people
organise, and alongside them the ambient rhythms the community lives inside:
Mates' birthdays, new and full moons, solstices and equinoxes. Less an RSVP tool,
more a community almanac. This doc describes what is built as of 2026-10-05.

## Faces

Three faces on a rotator header (manifest `views`), mounted by
`features/kalendar/index.tsx` inside a `FeedDrum`:

- **Spiral** (`/hub/kalendar`, default): `KalendarSpiral`
  (`features/kalendar/spiral/`). Days run along a spiral, one turn per half
  lunation. Each day tile can carry a marker: an event, a Mate's birthday, a
  new or full moon, or a solstice or equinox. Tapping a day opens
  `DayDetailsSheet`. Moon phases and seasonal markers are computed in the
  browser (`spiral/astronomy.ts`, standard low-precision formulae, named by
  month so they read right in both hemispheres). They do not come from Inflow.
- **Events** (`/hub/kalendar/events`): upcoming events in the shared space
  grid (`events_view.tsx`).
- **Me** (`/hub/kalendar/me`): your Mates' birthdays in the next 90 days,
  soonest first (`me_view.tsx`).

`/hub/kalendar/list` and `/hub/kalendar/birthdays` (the old face names) still
resolve. `/kalendar/*` 301s to `/hub/kalendar/*`.

## Events

**Creating.** The Ж-menu "New event" action opens `/hub/kalendar/composer`
(`features/kalendar/event_composer.tsx`, on the shared `ComposeShell`). Fields:
title, description, start and optional end, place name and link (a pinned map
location fills these), cover image, invitees, reach, Krews, and "Konnect a
korner" attachments. Every event made here is an in-person event with RSVP on.

**Who sees it.** An event posts a companion `Status` (`source_korner:
'kalendar'`) that carries its reach, using the standard reach ladder and Krews
(see `docs/spaces/feed.md`). The composer defaults to Kronkverse and hides
Just me. `Event#visible_to?` is the rule:

- The host and anyone invited can always see it.
- If `invite_only` is set, nobody else can, and the Status is `self_only` so
  nothing fans out.
- Otherwise it's whatever `StatusPolicy` allows on the companion Status.
  `post_to_feed: false` skips the Status, which leaves host and invitees only.

There is no anonymous access; every event endpoint needs a sign-in.

**URLs.** An event lives at `/hub/kalendar/<slug>`, the slug made from the
title on create and never changed afterwards. Slugs that would shadow a face or
route (`Event::RESERVED_SLUGS`) get a `-1` suffix. Numeric ids still work.

**RSVP.** `going`, `interested`, `not_going` (`EventRsvp`), shown as Going,
Interested and Can't go. `going_count` / `interested_count` are cached on the
event. An RSVP publishes `kalendar.event.rsvpd`, which Nudges routes to the
host if the two are Mates.

**Invitations.** `POST /api/v1/events/:id/invite` writes `EventInvitation`
rows and sends an `event_invitation` notification.

**Editing.** The event page (`features/events/event_detail.tsx`) uses the older
`CreateEventForm` for edits, which also exposes `recurrence_rule`.

**API:** `/api/v1/events` (index with `filter=upcoming|past|mine|invited`,
show, create, update, destroy, plus `rsvp`, `attendees`, `invite`,
`my_invitees`), and `GET /api/v1/kalendar/birthdays`.

## Birthdays

Birthdays aren't stored as events. `Api::V1::Kalendar::BirthdaysController`
reads each Mate's `birthday` profile card (`ProfileCard`), keeps the ones that
card's own visibility lets you see, and works out the next occurrence. So the
list is Mates-only and always current. You set your birthday on your profile.

## Links to other korners

Kalendar is the source side of `korner_attachments`
(`Kronk::AttachmentSource`):

- **Spawn an album:** `spawn_album` creates a companion Albutts album when the
  event is created, deleted with it.
- **Link to anything** that accepts links (`accepts: [{ from: '*', kind: link }]`):
  a Huddle room, a Wachuneed listing, a Kommons proposal, a Booth set. The
  composer can also create a new Huddle room and link it in one go.
- **Map:** events whose `location_url` is a parseable OpenStreetMap link show
  as pins on Map (`/api/v1/map/events`), and the event page links to
  `/hub/map?event=<slug>`.

`kalendar.event.created` is still published on create, but nothing subscribes.

Events are searchable through `Kronk::Search` as `kalendar_events`, and the feed
card is `StatusEventCard`.

## Open

- **Recurring events.** `recurrence_rule` can be saved, and the schema has
  `parent_event_id`, `occurrences` and `occurrence_date`, but nothing turns a
  rule into occurrences. Also undecided: edit one versus edit all, and
  cancelling one occurrence.
- **Spawn a Krew for attendees.** Designed: a checkbox at creation makes
  "[Event name] Krew", and everyone who RSVPs joins it (and can leave without
  un-RSVPing). Not built. Linked question: does attending give lasting access
  to that Krew and its Huddle, or only around the event?
- **Inflow rhythms in Kalendar.** The design had Inflow own celestial rhythms
  and publish them for Kalendar. Today the spiral computes its own. Decide
  whether Inflow should feed Kalendar, and which markers count.
- **RSVP wording.** The proposed Kronk labels ("I'll be there", "I'm a round",
  "I'll be square") aren't used.
- **Settings.** `reminder_lead_time`, `default_event_visibility` and
  `week_start` are declared in the manifest but nothing reads them, and there
  are no event reminders. `default_event_visibility` still lists the retired
  `unlisted` and `private`.
- **Legacy fields.** `event_type` still has a `huddle` value and `huddle_url`
  remains on `events` (see `huddle.md`). `max_attendees` has no UI.
- **Two edit paths.** Create uses `EventComposer`, edit uses the older
  `CreateEventForm`. Worth bringing edit onto the composer.

## History

Rewritten 2026-10-05 to describe what is built. Earlier designs and notes
(the 1.7 shape, the four-scope visibility proposal, the spiral plan):
`git show 231cca937:docs/spaces/kalendar.md`.
