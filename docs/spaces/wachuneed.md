# Wachuneed (`wachuneed`)

**Manifest:** `config/korners/wachuneed.yaml` · **Mount:** `/hub/wachuneed`

Wachuneed ("what you need") is where members list things for each other: art
they make, stuff they have, services they offer, and the things they're
looking for. Trust comes from being in the
same Kronk community, not from a reputation system. This doc describes what is
built as of 2026-10-09.

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

## Offered and wanted

Every listing has a `kind` (`Listing::KINDS`), added 2026-10-09 for the
wanted-ad proposals (Kommons #117396143164043201 and #116512978534279538):

| `kind`   | What it is                          | Price reads as |
| -------- | ----------------------------------- | -------------- |
| `offer`  | Something on offer (the default)    | Price          |
| `wanted` | Something the poster is looking for | Budget         |

Rows from before the column read as `offer`. A wanted listing has a category
like any other, carries a "Looking for" chip on its tile and detail page, and
its feed card badge reads LOOKING FOR instead of LISTING. Answering one works
the same way: "Message the poster".

## What you can do

**Browse.** `/hub/wachuneed` has three sections (manifest `views`, rotator
header). The space is Wachuneed; the sections have plain names (Tal,
2026-10-12; they were Wachuneed, Wachumissing and Wachugot, and the old
addresses redirect):

- **Offered** (default): everyone's `live` listings on offer
  (`?kind=offer`), newest first, in the shared `SpaceGrid`
  (`features/wachuneed/wachuneed_view.tsx`).
- **Desired** (`/hub/wachuneed/desired`): everyone's `live` wanted
  listings (`?kind=wanted`), with a **Post a wanted ad** button above the
  grid.
- **Mine** (`/hub/wachuneed/mine`): your own listings of both kinds in
  every state (`?mine=true`).

An empty section says what belongs there and carries the one button that
fixes it: **List something**, or **Post a wanted ad** in Desired.

**List something.** The Ж-menu "New listing" action opens `/hub/wachuneed/new`
(`features/wachuneed/new_listing.tsx`): first whether you're offering
something or looking for something (`?kind=wanted` opens on the second), then
title, description, category, optional price (a budget, when wanted) in AUD,
optional free-text location, and up to ten photos (`Listing::MAX_PHOTOS`).
Photos upload as they are picked; the first is the cover, and **Make cover**
on any other moves it to the front. It always
creates the listing as `live`. No price means free or by arrangement
(`Listing#free_or_by_arrangement?`).

**Look at one.** `/hub/wachuneed/listings/:id` shows the title, category,
photos full size and uncropped (bounded to 60vh) in a strip you swipe or
arrow through (`components/listing_photos.tsx`), the whole description with its
line breaks,
and the seller. On a live listing, "Message the poster" links to
`/nudges/with/<seller's account id>`. It is offered to the seller's Mates,
and to anyone when the seller's shop takes enquiries from anyone
(`can_message` on the detail response); otherwise the page says only their
Mates can message them. When the seller has a shop, **See everything from
<shop>** leads to it. The page pads its bottom so the poster line
clears the phone tab bar and the Ж menu.

**Edit your own.** The poster edits from the Ж menu's **Edit listing** moon
(there is no inline Edit on the listing; others see "Message the poster").
It opens `/hub/wachuneed/listings/:id/edit`, the composer prefilled.
Saving keeps the listing's state; the photos are only sent if you added,
removed or reordered them. A title change also updates the feed card's companion Status
text.

**Take it down.** The edit form ends with **Take down listing**, for
something sold or no longer on offer (it asks once before doing it).
`POST /api/v1/wachuneed/listings/:id/close`, owner only: the listing becomes
`closed`, so it leaves the browse views, and its feed post is removed. It
stays in Mine marked closed, with its offers. It can't be put
back up; list it again.

**API:** `GET /api/v1/wachuneed/listings` (40 newest; `kind=offer|wanted`
filters, absent returns both), `GET …/:id`,
`POST /api/v1/wachuneed/listings`, `PATCH …/:id` (owner only, 403 otherwise;
same validations as create; `media_attachment_ids` replaces the photos only
when sent) (`Api::V1::Wachuneed::ListingsController`, serialized by
`REST::WachuneedListingSummarySerializer`; the detail `GET` and `PATCH` also
carry `account`, `price_cents`, `price_currency` and `photo_full_url`). Every
response carries `photos` (each `id`, `url` small, `full_url` original, in
order) and `photo_url`, the cover. There is no close or delete endpoint.

## Shops

A shop is one seller's live offers on a page of their own, under sections
they name (Tal, 2026-10-12; Kommons "Market Layout"). It is a view of
listings the seller already has, not a second thing to fill: a listing keeps
appearing in Offered and the feed exactly as before.

- **Opening one** is a choice. In Mine, **Open a shop**
  (`/hub/wachuneed/my-shop`, `features/wachuneed/shop_edit.tsx`): a name, an
  optional line and picture (your avatar until you add one), your sections
  in the order you want (up to `ListingShop::MAX_SECTIONS`), and two
  settings. One shop per account. **Close shop** removes the page and its
  sections and leaves every listing up.
- **Sections** are the seller's own words. The listing form shows **Section
  of your shop** once you have sections; a listing sits in one or in none.
  Removing a section drops its listings back to "Everything else".
- **The shop page** is `/hub/wachuneed/shop/<username>`
  (`shop_page.tsx`): each section that has something in it, then
  "Everything else". Wanted ads are not part of a shop.
- **Finding shops.** A row of shop cards runs across the top of Offered
  (`shop_row.tsx`), scrolling sideways: your Mates' shops first, then the
  oldest shop first, and only shops with something on offer. How the row
  should flow as it grows is still to be designed.
- **Enquiries** (`enquiries`: `mates | anyone`, default `mates`). A seller
  who chooses "Anyone on Kronk" has invited the message, so a non-Mate can
  open a chat with them and send the first message
  (`ListingShop.enquiries_open?`, read by the two Nudges gates). Nothing
  else about the relationship changes.
- **On a profile** only if the seller ticks "Show my shop on my profile":
  the profile block then carries a **Shop: <name>** line
  (`components/profile_shop_link.tsx`).

**API** (`Api::V1::Wachuneed::ShopsController`): `GET /api/v1/wachuneed/shops`
(the row), `GET …/shops/:id` (by username or account id, with `sections`
and `listings`), `GET …/shops/:id/profile` (`{ shop: null }` unless shown on
the profile), `GET /api/v1/wachuneed/shop` (your own, `null` until opened),
`PUT` (open or save; `sections` replaces the list in order), `DELETE`.

## Feed and profile

A live listing gets a companion `Status` from `Wachuneed::PublishListing`
(`visibility: public`, `source_korner: 'wachuneed'`, linked by
`listings.status_id`). That is what puts the `wachuneed_card` in the feed and on
the seller's profile. Drafts never get one. All listings are public; there is
no Mates-only or Krew-only listing.

The card shows the listing's photos in the same strip as the listing page,
cropped to 4:3, so they can be looked through without leaving the feed. The
strip scrolls sideways natively, so the home feed's scope swipe leaves it
alone, and a tap anywhere on the card still opens the listing.

Listings are searchable through `Kronk::Search` as `wachuneed_listings`.

## Data

- **`listings`**: `title`, `description`, `category`, `subcategory`, `kind`
  (`offer | wanted`, default `offer`), `price_cents`, `price_currency`
  (3 letters), `location` (free text), `state`, `closed_at`, `status_id`.
- **States** (`draft | live | reserved | closed`) only move forward. Reopening
  a closed listing means a new row. `Listing#close!` sets `closed_at`.
- **`listing_photos`**: ordered links to `MediaAttachment`, up to ten. The
  media belong to no post, so `Vacuum::MediaAttachmentsVacuum` excludes them
  from its sweep of unattached uploads.
- **`listing_shops`**: one per account. `name`, `description`,
  `media_attachment_id` (the picture, excluded from the unattached-media
  sweep), `enquiries`, `show_on_profile`. **`listing_shop_sections`**: `name`
  and `position`. `listings.listing_shop_section_id` places a listing; it has
  no database foreign key and is cleared by the model.
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
- **Managing your listings.** Editing is built (above); there is still no way
  to reserve, close or delete a listing, and no draft flow. The `auto_close_after_days` setting (default 90)
  is declared but nothing reads it.
- **"Or trade" flag.** Designed (a price plus "open to trade"), not built.
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
