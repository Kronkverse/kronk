# The Kronk card standard

**Status:** agreed 2026-09-12 (Tal). Being built — see _Where we are_ at the
foot. **Primitive:** `<StandardCard>` ·
`app/javascript/mastodon/components/standard_card.tsx`

## What a card is for

> "What I want from this is basically a wrapper for content from all sorts of
> spaces to fit a mould so they can slip into other spaces… rather than
> building the infrastructure of each page to show specialty and different
> content, I want to be able to build them to take the standard card, then any
> content fits within the card and the navigation and layout can become
> familiar across spaces to a user." — Tal, 2026-09-12

A card is the **unit of content that travels**. An album belongs to Albutts, but
it can appear in a feed, on a profile shelf, in a Map space, in a grid of
things somebody made. If each of those surfaces builds its own way of drawing an
album, then adding a korner means editing every surface that might show it — and
a reader learns a new layout in every space.

One card fixes both ends of that: a space builds against the card, not against
the content; a korner describes its content once, and it can appear anywhere.

## The contract: six slots

Every card, of every kind, in every arrangement, is made of the same six slots.
A korner's projection fills the ones it has; the arrangement decides which are
drawn and how large.

| Slot      | What it holds                               | Example (Albutts)           |
| --------- | ------------------------------------------- | --------------------------- |
| `media`   | the visual — image, map glimpse, avatar     | the album cover             |
| `badge`   | which korner this came from                 | `ALBUM`, in korner purple   |
| `title`   | one line, the name of the thing             | "27th Birthday"             |
| `meta`    | a short run of facts — author, date, counts | "14 photos · 1 contributor" |
| `body`    | prose, clamped                              | the album description       |
| `actions` | what you can do without opening it          | contributor avatars, froth  |

Two rules keep this honest:

1. **A slot is optional, never re-purposed.** A korner with no image leaves
   `media` empty and the arrangement handles it; it does not put its title
   there because the space looked empty. Booth's feed card was doing exactly
   that — the artist's name was living in the prose region — which is how the
   rule earned its keep.
2. **The arrangement decides size, the content never does.** A card does not
   ask to be bigger because its album has more photos.

`meta` may appear twice where a card has two runs of facts either side of a
divider — Booth's feed card names the artist above and the genre and length
below. The other five appear at most once.

**The slot styles are defaults, not decisions.** They are written through
`:where()`, which costs nothing in specificity, so any korner rule beats them
by simply existing. That matters where a card uses the slots for their names
rather than their looks: a feed card has its own type scale and supplies its
own padding, and should not have to out-specify the standard to keep them.
Arrangement rules are not written that way — what a grid tile draws is a
decision.

## Three arrangements

The same card, three ways. These are not three cards.

### Feed — flows to content

Badge, media, title, meta, body, actions. Height follows the content. This is
the timeline shape, and the one most korners already draw
(`<StatusKornerCard>`).

### Portrait — 9:19.5, one at a time

Media dominant, title and meta over it, actions at the foot. Fixed aspect, sized
so it can never exceed the viewport (the sizing maths already lives in
`<StandardCard variant='portrait'>`). For content that is **uniform in shape and
considered one at a time**: Kommunity Discover, the Kuestions deck, Moments.

### Grid — the same card, smaller, many at once

Media and title, one meta line at most. Two up on a phone, four from 720px. For
browsing a collection: Wachuneed listings, Kalendar events, a profile's shelf.

## Decisions taken, and why

**The home feed stays flow, it does not become portrait.** Asked directly, and
the reason is mechanical rather than aesthetic: the feed already binds
horizontal swipe to stepping scope (`FeedDrum` — Friends / Friends-of-friends /
Kommunity). Portrait needs that same gesture for next-item, and scope-stepping
is worth more — it is what makes the feed yours rather than a river.

Two supporting reasons. A feed is a **scanning** surface: you skim eight things
to decide what to open, and one-per-screen turns one scroll into eight swipes.
And feed content varies wildly in length — a two-word post and a fourteen-photo
album would each take a full screen, one looking empty and the other cropped.
Portrait works in the Kuestions deck precisely because every card is the same
shape and each one demands an answer: a task queue, not a browse.

**The badge is a pill everywhere except the feed.** A badge says which korner
a card came from. On a board of proposals or a grid of albums, every card is
from the same korner and the badge is a quiet label — a pill, sitting beside
the content. In the home feed, consecutive cards come from different korners
and the badge is the thing telling them apart, so it stays the full-width bar
across the top of the card. The difference is a surface override in
`_status_korner_card.scss`, deliberately not a second standard: if you find
yourself wanting the bar somewhere else, that is a sign the surface is mixing
korners and should say so.

**No separate wide-screen card.** Two feed layouts means two things to maintain
and two mental models for one piece of content. The flow card already works at
both widths; the wide-screen answer is the **grid** arrangement showing more per
row.

**The korner describes its content once.** Manifests already name a card per
korner (`feed_projection.card`). That projection fills slots — it does not draw
a card. Adding a korner should never mean editing a space that might display it.

## Where we are (2026-09-12, end of the migration)

Started at **19 card components**, three de-facto families, and a
`<StandardCard>` that described itself as "the primitive every Kronk card is
built on" while having one consumer. Now:

| Was                                  | Now                                                     |
| ------------------------------------ | ------------------------------------------------------- |
| `<StatusKornerCard>` + 10 feed cards | on `<StandardCard variant='flow'>`, badge slot          |
| `<SpaceCard>` (Wachuneed, Kalendar)  | on `<StandardCard variant='grid'>`                      |
| Albutts directory tiles              | on `<SpaceGrid>` / `<SpaceCard>` — own grid deleted     |
| Kommons proposal card                | on `<StandardCard variant='flow'>`                      |
| Booth gallery tile                   | on `<StandardCard variant='grid'>`, in the shared grid  |
| `<ProfileCard>` (Kommunity deck)     | already portrait — the deck needed nothing              |
| `booth_set_card.tsx`                 | deleted; nothing had imported it since the grid shipped |
| The insides of the ten feed cards    | title / meta / prose are slots (2026-09-13)             |

### What deliberately stays bespoke

Not everything called a card is one. These were looked at and left, with the
reason, so nobody re-opens them as unfinished business:

- **The Kuestions deck card.** A deck, not a card: absolutely positioned,
  stacked, drag-to-skip, sized by the deck rather than by its content. The
  standard's portrait arrangement sizes a card from its own aspect, which is
  the opposite. A Kuestion that travels already has a standard card — the feed
  one.
- **The Map pin card.** A `role="dialog"` anchored to a pin, with an inline
  edit form. It never appears in a collection, so there is nothing for the
  contract to buy.
- **The Explore suggestions card.** Upstream Mastodon, and an account
  suggestion rather than korner content. Putting it on the standard would mean
  carrying a conflict in every Mastodon merge for no gain.

### Known, not fixed

Nothing outstanding from the migration itself. `_booth.scss`'s `.booth-card`
family — which had been half-dressing the live tile from a deleted
component — was removed on 2026-09-13 when Booth's tile joined the shared
grid.

## Build order

Deliberately sequenced so it could stop between any two steps without leaving
the codebase half-converted. All five are done (#1803, #1810, #1823, #1828,
#1829 and the Booth tile).

1. ~~**The contract.**~~ Slots on `<StandardCard>`, nothing migrated.
2. ~~**Two korners, opposite shapes.**~~ Albutts (image-led) and Kommons
   proposals (text-led).
3. ~~**The `<StatusKornerCard>` family**~~ — ten feed cards on one shell.
4. ~~**`<SpaceCard>` becomes the grid arrangement**~~, and Albutts joins the
   shared grid.
5. ~~**The tail**~~ — Booth's tile migrated; the deck, the map pin and the
   Explore suggestion left bespoke for the reasons above.

### Prose, settled

The prose slot had four answers to "how long is it" and one of them was
nothing: the feed frame clamped to two lines, the standard said three, and
Kommons' and Kuestions' rules pointed at a class their markup never carried,
so their prose rendered unstyled and uncut. It is **two lines, 0.875rem,
secondary colour, everywhere** now, said once in `_standard_card.scss`. The
visible effect is that Kommons and Kuestions feed cards finally look like the
others.

### What is still open

- **The badge in the feed is a bar, everywhere else a pill.** Stated as a rule
  above, and the reasoning holds, but it is the one place two surfaces draw the
  same slot differently. Worth revisiting once there are more grid surfaces.

A row in [`kronk_platform_primitives.md`](kronk_platform_primitives.md) points
here.
