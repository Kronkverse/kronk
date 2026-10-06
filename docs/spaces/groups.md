# Krew: why it is shaped this way

The Krew korner (`config/korners/krew.yaml`, slug `krew`, model `Krew`) was
called Groups until 2026. **How it works today is in [`krew.md`](krew.md).**
This file keeps only the reasoning behind it, so the two don't repeat each
other.

## A Krew is an audience, not a place

A Krew lets you share with a defined group of people. It is a filter on who
sees a post, not somewhere you go to read posts. Krew posts reach members in
their own Home feed, with a small badge saying which Krew they were sent to.
There is no Krew timeline and no Krew tab in the feed.

The point is to let people be specific about who they're talking to, without
building another feed to keep up with. Examples:

- Reflections on an event, posted to the event's Krew, so attendees see them.
- An album posted to the Mayhem Krew, for Mayhem members only.
- "Anyone got a lift?" to the event Krew, without bothering everyone else.
- Joining the Melbourne Krew to see posts meant for people in Melbourne.

Krews make overlapping networks of intent out of one broadcast audience.

## Why Krew is not a reach tier

Early on, Krew was one more visibility value: picking a Krew threw away the
reach tier. That made "my Mates and the Mayhem Krew" impossible to say, and
the enum slot differed between models. So Krew became a separate field: one
reach tier plus any number of Krews (decisions.md, "Krew is an orthogonal
axis"). Status visibility slot 5, which was `krew`, is left empty.

## Low ceremony

- **Joining is easy.** A listed Krew is one tap to join. Hidden Krews are
  joined by invite link. Nobody approves members by hand.
- **No internal moderation.** Seeders can't remove members, mute or ban.
  Leaving is always voluntary. If someone is disruptive, people block them or
  leave, and Kronk-wide reports and admin action are the safety net.
- **No size cap.** A Melbourne Krew with thousands of members is a valid
  shape. Posting to it is a real broadcast, with no warnings or throttles.
- **No governance layer.** Groups once had five voting frameworks for
  structural changes (peer support, two-key, threshold, majority, consensus).
  Once a Krew became an audience filter rather than a governed mini-community,
  that was overbuilt. Nothing in the app uses it now. The leftover columns are listed in
  `krew.md` under Open.

## Krews and events

The intended link with Kalendar runs both ways: RSVPing an event that belongs
to a Krew adds you to that Krew (and you can leave the Krew without cancelling
the RSVP), and an event can be shown only to certain Krews. The second works,
through Krew being an audience axis. The first is not built; see `krew.md`.

Event Krews don't expire when the event ends. They persist like any other
Krew.

## History

Rewritten 2026-10-05. This file used to hold the full Groups spec, including
the planned rename to Krew (done: URL, slug, tables, model and API) and
designs since superseded. Earlier text:
`git show 231cca937a00bf7bdbee9db6f25b6cbc541a8565:docs/spaces/groups.md`
