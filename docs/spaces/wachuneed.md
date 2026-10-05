# Wachuneed (`wachuneed`)

**Manifest:** `config/korners/wachuneed.yaml` · **Mount:** `/hub/wachuneed`

Wachuneed ("what you need") is where members list things for each other: art
they make, stuff they have, services they offer. Trust comes from being in the
same Kronk community, not from a reputation system. This doc describes what is
built as of 2026-10-05.

**Kronk does not broker payment.** A listing is for discovery and contact.
Buyer and seller sort out payment themselves (cash, bank transfer, barter,
whatever they agree). Kronk holds no money, runs no escrow and settles no
disputes.

## Categories

Three, split by what the thing is (`Listing::CATEGORIES`):

| Value      | Shown as  | What it is                                   |
| ---------- | --------- | -------------------------------------------- |
| `creation` | Art       | Something the seller made                    |
| `goods`    | Stuff     | A physical thing being passed on             |
| `service`  | Offerings | Time or skill (lessons, massage, production) |

They are three different kinds of exchange (making, passing on, doing for), so
they stay separate. The `subcategory` column exists and is indexed for search,
but nothing in the UI sets or reads it. The browse page has no category filter
(the tabs were removed on 2026-09-07); category shows as a chip on each listing.

## What you can do

**Browse.** `/hub/wachuneed` has two faces (manifest `views`, rotator header):

- **Wachuneed** (default): everyone's `live` listings, newest first, in the
  shared `SpaceGrid` (`features/wachuneed/wachuneed_view.tsx`).
- **Wachugot** (`/hub/wachuneed/wachugot`): your own listings in every state
  (`?mine=true`).

**List something.** The Ж-menu "New listing" action opens `/hub/wachuneed/new`
(`features/wachuneed/new_listing.tsx`): title, description, category, optional
price in AUD, optional free-text location, and one optional photo. It always
creates the listing as `live`. No price means free or by arrangement
(`Listing#free_or_by_arrangement?`).

**Look at one.** `/hub/wachuneed/listings/:id` shows the title, category,
photo, description and seller. On a live listing, "Message the poster" links to
`/nudges/<seller's account id>`. Nudges chats are between Mates; what a
non-Mate sees there is unverified.

**API:** `GET /api/v1/wachuneed/listings` (40 newest), `GET …/:id`,
`POST /api/v1/wachuneed/listings` (`Api::V1::Wachuneed::ListingsController`,
serialized by `REST::WachuneedListingSummarySerializer`). There is no update,
close or delete endpoint.

## Feed and profile

A live listing gets a companion `Status` from `Wachuneed::PublishListing`
(`visibility: public`, `source_korner: 'wachuneed'`, linked by
`listings.status_id`). That is what puts the `wachuneed_card` in the feed and on
the seller's profile. Drafts never get one. All listings are public; there is
no Mates-only or Krew-only listing.

Listings are searchable through `Kronk::Search` as `wachuneed_listings`.

## Data

- **`listings`**: `title`, `description`, `category`, `subcategory`,
  `price_cents`, `price_currency` (3 letters), `location` (free text), `state`,
  `closed_at`, `status_id`.
- **States** (`draft | live | reserved | closed`) only move forward. Reopening
  a closed listing means a new row. `Listing#close!` sets `closed_at`.
- **`listing_photos`**: ordered links to `MediaAttachment`. The schema allows
  many; the composer sends one.
- **`listing_offers`**: an offer with an optional `amount_cents` (none means
  the listed price) and a state (`pending | accepted | declined | withdrawn |
expired`). `accept!` reserves the listing. The model publishes
  `wachuneed.offer.made`, `.accepted` and `.declined` on the korner event bus.
  Nothing in the API or UI creates an offer yet.
- Media prefix `spaces/wachuneed/`.

Old URLs (`/market`, `/hub/marketplace`, `/hub/martketplace`) 301 to
`/hub/wachuneed`. The korner was briefly renamed mARTketplace in July 2026 and
returned to Wachuneed, slug and all, on 2026-09-07.

## Open

- **Making an offer.** The `ListingOffer` model exists but has no endpoint or
  composer. "Message the poster" is the only way to respond today.
- **Interaction modes.** The design lets the seller pick per listing:
  `buy_now`, `buy_or_bargain` (or nearest offer), `book_service`,
  `contact_to_discuss`, `workshop_join`. None exist in code. Undecided: whether
  a listing can switch mode, and how deep `book_service` and `workshop_join`
  tie into Kalendar (is a paid workshop one primitive with two views, or two
  that reference each other?).
- **Managing your listings.** No way to edit, reserve, close or delete a
  listing, and no draft flow. The `auto_close_after_days` setting (default 90)
  is declared but nothing reads it.
- **"Or trade" flag.** Designed (a price plus "open to trade"), not built.
- **More than one photo.** The design allows up to ten, first one the cover.
- **Location and Map.** Location is free text. Undecided: whether listings
  should show on Map, using Map's location primitives, and how remote or
  digital services are marked.
- **Trust signals.** The design shows mutual Mates, shared Krews and time on
  Kronk beside a listing, with no stars or reviews (a real concern goes to
  Kommons). Not built.
- **Notifications.** The manifest declares none. The `notify_on_offer` and
  `default_publish_visibility` settings are declared but unused, and the
  feed card is always public whatever the latter says.
- **`subcategory`.** Unused; remove it or give it a purpose.

## History

Rewritten 2026-10-05 to describe what is built. Earlier designs and notes
(the full interaction-mode and reputation design, the half-done slug rename):
`git show 231cca937:docs/spaces/wachuneed.md`.
