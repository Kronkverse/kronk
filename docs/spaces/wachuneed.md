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

**Browse.** `/hub/wachuneed` has four sections (manifest `views`, rotator
header). The space is Wachuneed; the sections have plain names (Tal,
2026-10-12; they were Wachuneed, Wachumissing and Wachugot, and the old
addresses redirect):

- **Offered** (default): everyone's `live` listings on offer
  (`?kind=offer`), newest first, in the shared `SpaceGrid`
  (`features/wachuneed/wachuneed_view.tsx`).
- **Desired** (`/hub/wachuneed/desired`): everyone's `live` wanted
  listings (`?kind=wanted`), with a **Post a wanted ad** button above the
  grid.
- **Shops** (`/hub/wachuneed/shops`): every shop with something on offer
  (see Shops below).
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
  (`shop_page.tsx`), the shop front. It is the standard detail page
  (`<KornerDetail>`; rebuilt on it 2026-10-13 after Tal found the first
  version out of Kronk spec). Hero: the covers of the shop's newest items
  (up to `ListingShop::PREVIEW_PHOTOS`; made from the listings, so there is
  no cover to upload, and no hero until an item has a photo). Title and
  subtitle: the shop's name and line. Facts line (`<KornerMeta>`): the
  seller, the place, how many listings. One action: **Message the seller**
  (same rule as on a listing, `can_message`). Then what the shop says of
  itself (about, how to pay, pickup and postage), its sections as pills
  that jump down the page when there is more than one, and each section
  that has something in it over a `<SpaceGrid>`, ending with "Everything
  else". Wanted ads are not part of a shop. The owner changes the shop from
  **Edit** on the Ж menu, and **+** there is **Add an item**: in your own
  shop and in the builder it opens the shop item composer, where everywhere
  else in Wachuneed it is **New listing** (the page registers a page action
  keyed `post`, which takes the + moon over; `page_action_context.tsx`).
  The page carries no Edit or Add button, except **Add an item** in the
  empty state.
- **Finding shops.** The **Shops** section (`shops_view.tsx`) lists every
  shop with something on offer as a tile in the standard grid
  (`shop_card.tsx`, a `<SpaceCard>`): the shop's picture (the cover of its
  newest item when it has none, then the seller's avatar), its name, how
  many listings, and the place as the chip. Offered opens with the first
  four shops as the same cards under **Shops** (`shop_row.tsx`), with
  **All shops** when there are more, then **Listings**. Mine opens the
  same way with your own shop under **My shop** (Tal, 2026-10-13: cards
  in place of the pills on Offered and of the See my shop / Edit shop
  buttons on Mine); with no shop it offers **Open a shop**. Order in
  Shops and Offered: your Mates' shops first, then the
  oldest shop first, up to 60. Search and paging are not built.
- **Enquiries** (`enquiries`: `mates | anyone`, default `mates`). A seller
  who chooses "Anyone on Kronk" has invited the message, so a non-Mate can
  open a chat with them and send the first message
  (`ListingShop.enquiries_open?`, read by the two Nudges gates). Nothing
  else about the relationship changes.
- **On a profile** only if the seller ticks "Link my shop from the Wachuneed shelf on my profile":
  the Wachuneed shelf on their profile carries a **Shop: <name>** link
  in its header (`components/profile_shop_link.tsx`, drawn by
  `shelf_drawn.tsx`). The shelf's cards are the listings the seller chose
  for it (the shelf's own picker); only listings posted to the feed can be
  on it, so a quietly added shop item is not. (Tal, 2026-10-14: with the
  other spaces, not under the profile header where it was.)

**API** (`Api::V1::Wachuneed::ShopsController`): `GET /api/v1/wachuneed/shops`
(every stocked shop), `GET …/shops/:id` (by username or account id, with
`sections`, `listings` and `can_message`). Both carry `preview_photos`,
the cover photos of the newest items. `GET …/shops/:id/profile` (`{ shop: null }` unless shown on
the profile), `GET /api/v1/wachuneed/shop` (your own, `null` until opened),
`PUT` (open or save; `sections` replaces the list in order), `DELETE`.

## The shop builder

`/hub/wachuneed/my-shop` is where a seller runs a shop (Tal, 2026-10-13:
a shop is for someone selling what they make, over time, and needs more
than a form for one-offs). It has two parts once the shop exists.

- **Items** (`features/wachuneed/shop_items.tsx`): everything you have on
  offer in one list. **Add an item**, **Edit**, and an availability switch
  on each row. Both open the shop item composer over the list. (**Copy**
  was removed 2026-10-14: Tal found it unneeded.)
- **Shop details**: the name, line and picture, your sections, and four
  things said once and shown on every item and on the shop page: where the
  shop is **based**, **about** it, **how to pay**, and **pickup and
  postage** (`listing_shops.based_in / about / payment / handover`).

**The shop item composer** (`shop_item_composer.tsx`; Tal, 2026-10-13: adding
to a shop was showing the same form as a one-off listing) is how a seller
fills the shop, one product after another. It is the standard composer
overlay (`<ComposeShell>`), not a page, and asks only what a product needs,
in this order: photos, name, price and availability side by side, the
section of the shop, description, and its variations. It does not ask
whether you are offering or looking, where the exchange happens, a
category, extras (Options), or whether there is only one (Tal, 2026-10-14):
a shop item is on offer and ongoing, the shop says where it is based, and
a new item is filed as Art (`creation`). An item that had a category,
extras or one-off set on the listing form keeps them when edited here.

- **Add another after this one** keeps the composer open after saving, on a
  clean form that keeps the section and category, and says what was just
  added. That is the quick way through a product list.
- **Take this item down**, at the foot when editing, asks first
  (`useConfirmDialog`) and closes the listing as the listing form does.
- Which composer is open is in the address: `/hub/wachuneed/my-shop?item=new`,
  `?item=<id>` to edit. The shop page's **Add
  an item** links to the first, and Back or Cancel closes it.
- The photos part (`listing_photo_field.tsx`) is shared with the listing
  form.

The listing form (`/hub/wachuneed/new`, and **Edit listing** on an item's own
page) still opens a shop item, since it is a listing; it no longer has a
shop mode.

A shop item is an ordinary listing underneath, so it shows in Offered and in
search like any other, and a shop can hold one-offs too. What the builder
adds to a listing:

- **Ongoing** (`listings.ongoing`): something you keep selling, not a
  one-off. Its page asks **How many**.
- **Availability** (`listings.availability`: `available | sold_out |
made_to_order`). Flipped by hand; nothing is counted. A sold-out tile says
  so.
- **Variations** (`listings.variants`, `listing_variants_editor.tsx`): what
  a buyer chooses between. **Add a variation**, name it whatever fits
  (Colour, Size, Design, Leather type), and add its choices one at a time
  (type one, then Enter or **Add**); each shows as a pill, and tapping a
  pill removes it. Up to `Listing::MAX_VARIANT_AXES` variations; their order
  is the order a buyer is asked. Every combination is then a **kind** with
  its own price and availability (`off` for one not offered), filled
  quickly with **Quick fill** (every kind alike, or by one variation). The
  listing's own price becomes the lowest kind's, and the tile says "From"
  when they differ. On the page the buyer picks a choice for each variation
  (`listing_variant_chooser.tsx`); one with nothing behind it cannot be
  picked. The section was called "Comes in" and took the choices as one
  comma-separated box until 2026-10-14, when Tal typed two colours with a
  space and got one.
- **Photos per choice** (`listing_photos.variant_value`): "What each photo
  shows" on the form. Picking that value on the page brings its photo to the
  front.
- **Quiet adding** (`listings.announced`): an item added from the builder
  posts nothing to the feed unless **Announce it in the feed** is ticked,
  then or later. An ordinary listing is always posted, as before.

Options (below) remain for add-ons that are not a kind of the item, such as
gift wrapping. The message **Message the poster** starts carries the kind,
any extras, the quantity and the total.

Not built: counted stock, reordering items by hand, pausing an item without
changing its availability, an order or a payment.

## Options

A listing on offer can carry options: what a buyer may choose (Tal,
2026-10-12; Kommons "Functionality for Ordering Services"). An option is a
named group of choices, such as Length (30 minutes, 1 hour) or Size, and a
choice can **add** to the listing's price. The listing keeps one base
price; nothing replaces it.

- **Setting them** (`features/wachuneed/listing_options_editor.tsx`, in the
  listing form): nothing shows until asked for. A row of suggestions fits
  the category (Offerings: Length, Style, Where, When; Stuff: Size, Colour,
  Condition, Pickup or delivery; Art: Size, Medium, Framing, Edition), plus
  **Something else**. Tapping one opens it as its own card, with the usual
  choices filled in where they are known. Up to `Listing::MAX_OPTIONS`
  options of `Listing::MAX_OPTION_CHOICES` choices.
- **Choosing** (`listing_options_chooser.tsx`, on the listing page): each
  option is a row of choices to tap, with what a choice adds beside it and a
  running **Total** when the listing has a price.
- **Then what.** Kronk takes no order. **Message the poster** with something
  chosen opens the chat with the choices and the total already written in
  the message box, for the buyer to send or change
  (`writeComposerDraft` in `hooks/useComposerDraft.ts`). Requests with
  Accept and Decline are left for later.
- **Stored** as JSON in `listings.options`, cut to shape and limits by
  `Listing#options=`. Sent on create; on an edit they replace the set when
  present (an empty list removes them). Served on the detail response only.
  A wanted ad has none.

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
- **`listings`** also carries `ongoing`, `availability`, `announced`,
  `variants` and `options` (see The shop builder, Options).
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
