# Marketplace (`marketplace`)

**Manifest:** `config/korners/marketplace.yaml` · **Mount:** `/hub/marketplace` · **Status:** in-flight (Phase 10.3) — scaffolding shipped, UI + flow work pending

## Purpose

Marketplace is Kronk's **community-scale trade + service exchange**.
Members can list creations, goods, and services for other Kronk
users to browse, contact, and transact around. Trust flows from
being **in the same Kronk community** — not from platform-brokered
reputation systems.

Kronk **does not broker payment**. Same as Facebook Marketplace: the
listing is a discovery + negotiation surface; buyer and seller work
out payment themselves (cash, Stripe, barter, whatever they agree).
Kronk stays out of financial intermediation.

## Current shape (scaffolding shipped, no UI yet)

Greenfield reference korner — built to spec §5 from day one:

- **`Listing`** model (`app/models/listing.rb`) — `title`,
  `description`, `category`, `subcategory`, `account_id` (seller),
  `state` (`draft` / `live` / `reserved` / `closed`),
  `price_currency` (3-char ISO), `price_cents`, `status_id` (canonical
  Status linkage, spec §5.5 conformant from day one).
- **`ListingPhoto`** — position-ordered, joined to
  `MediaAttachment`.
- **`ListingOffer`** — offers on listings (interaction mechanism —
  see open decisions for shape).
- Storage: `spaces/marketplace/` media prefix (spec §5.5 conformant).
- Searchable via `Kronk::Search` (indexed as `marketplace_listings`).
- Manifest at `config/korners/marketplace.yaml`; no UI at
  `features/marketplace/` yet.

## Rebuild vision (2.0.0)

### The three top-level categories

Kronk splits marketplace listings along **what the thing IS**:

- **Creations** — someone's original artistic output. Leatherwork, a
  song, a painting, handmade jewelry, a zine. The making is what
  gives it its identity.
- **Marketplace (goods)** — physical items being passed on. Second-
  hand bikes, kitchenware, plants for sale. Circulating existing
  stuff.
- **Service** — time or skill being offered. Massages, music
  production, sound healings, tutoring, coaching. What someone can
  do for someone else.

The three-way split is intentional — it foregrounds three fundamentally
different modes of exchange (making, passing-on, doing-for), each with
its own conventions and expectations.

**No subcategory field** in the initial 2.0 shape. The `subcategory`
column on `Listing` retires; three top-level categories are enough.
Search + filtering leans on title/description tokens plus the top-
level axis. If a subcategory taxonomy is warranted later, it comes
in a follow-up.

### State machine

Listings move through:

- **`draft`** — being composed; not visible to others.
- **`live`** — public, listed in the Marketplace directory,
  discoverable in feeds and search.
- **`reserved`** — someone has committed to buying/receiving it;
  visible but not open to new interest.
- **`closed`** — transaction complete (or listing withdrawn); no
  longer active. Historical record only.

Transitions are unidirectional: `draft → live → reserved → closed`
(with `live → closed` also permitted, skipping reserved). **Reopening
a closed listing means creating a fresh row** — no `closed → live`
transition.

### Exchange model — Kronk stays out of the money

Payment happens **between buyer and seller directly** via whatever
channel they agree (cash, Stripe, bank transfer, barter, gift-in-kind).
Kronk does not process payments, hold escrow, dispute-resolve, or
verify completion.

### Interaction modes — seller picks per-listing

Different listing types demand different interaction shapes. Sellers
choose at creation which mode applies to their listing:

- **`buy_now`** — fixed price, tap to buy → listing moves to
  `reserved`, buyer + seller work out fulfilment via Nudges.
- **`buy_or_bargain` (ONO — "Or Nearest Offer")** — listed price
  shown; buyers can tap to buy at price OR submit a lower offer with
  a message. Seller accepts, counters, or declines each offer.
- **`book_service`** — service-oriented (massage, coaching). Buyer
  requests a date/time; seller confirms. Ties into Kalendar if the
  seller has availability structured.
- **`contact_to_discuss`** — custom / large work (a commissioned
  song production, a bespoke leather order). Interested buyer opens
  a Nudges thread; no structured offer or price commitment upfront.
- **`workshop_join`** — RSVP-flavoured; treats the listing more like
  a Kalendar event with a fixed price to join.

`ListingOffer` model shape evolves to capture these — some modes
(buy_now, workshop_join) produce a lightweight commit record; others
(buy_or_bargain) produce structured offer records with amount +
message; others (contact_to_discuss) just seed a Nudges thread.

### Location — integrates with Kompass

Location is **required** for most listings, and integrates with the
**Kompass** korner (the map korner still in the pipeline). Rather
than building a bespoke Marketplace-only location model, Marketplace
listings surface on Kompass, and Kompass's location primitives
(city/region/point) apply. Exact integration shape depends on
Kompass's own scoping — see `kompass.md` when we work it up.

For digital-delivery service listings (music production remotely,
online coaching), location may be flagged as "remote/digital".

### Reputation — mate-affinity, not stars

Listings surface **mate-affinity signals** as trust context:

- Mutual mates count between buyer and seller
- Shared Krew membership (e.g., "Alice is in Melbourne Krew with you")
- Kronk-tenure ("member since 2024")

**No stars, no reviews, no ratings.** Trust flows from community
context, not from a subjective rating system. If someone has a real
concern about a seller, it can go through Kommons as a public
proposal — community adjudicates in the open.

### Pricing — price + "or trade" flag

Every listing has a **price** (`price_cents` + `price_currency`) —
required. Sellers can additionally set an **"or trade" flag**
indicating they're open to barter/exchange alongside the listed
price. Displayed as e.g. `AU$40 (or open to trade)`.

Pure-barter or pure-gift modes aren't first-class in the initial 2.0
shape — sellers list a price and add "or trade" if they're flexible.

### Photos

**Optional**, 0 to 10 per listing. First uploaded photo is the cover.
No hard minimum — some listings (services, digital work) may not have
photos at all; some listings (physical goods, creations) really need
several. Sellers judge.

### Visibility

**All listings are public** in the initial 2.0 shape. No mates-only or
Krew-scoped listings; every listing is publicly discoverable via the
Marketplace directory + Home feed + universal search. Krew-scoped
listings can be added later if community demand emerges.

### Discovery

- **Feed projection** — listings surface as cards in Home feed when
  a mate or someone in your network posts one. Social-graph-driven.
- **Profile section** — a user's profile shows their **active
  listings** (via the sectioned-profile Marketplace section from
  Phase 11). Discovery via browsing who a person is.
- **`/hub/marketplace` directory** — chronological listing of live
  listings, filterable by the 3 top-level categories.
- **Universal search** — listings indexed in `Kronk::Search`; find by
  title, description, category, price range, seller.

### Aesthetic

Marketplace ships greenfield UI in line with current Kronk aesthetic
tokens. Coordinating on visual mockups with Claude web.

## Open decisions

- **Kompass integration** — Marketplace listings need location; the
  Kompass map korner is still in the pipeline. Actual integration
  contract (does Marketplace embed Kompass? does Kompass list
  Marketplace pins?) waits for Kompass scoping. Flagged in
  `kompass.md` too.
- **Digital-delivery services** — how does location work for
  remote/digital service listings? A "remote/no location" flag?
- **Interaction-mode migrations** — some listings may need to shift
  mode (e.g., started as `contact_to_discuss`, seller decides to
  publish a fixed price). Allowed? Forbidden? Requires new listing?
- **book_service ↔ Kalendar** — service-booking listings could tie
  into Kalendar (seller availability, booking creates a Kalendar
  event). Depth of integration TBD.
- **workshop_join ↔ Kalendar** — a workshop listing is arguably a
  Kalendar event with a price. Is it one primitive with two views,
  or two primitives that reference each other?

## Related drafts

- `/home/shared/rebuild/plan/quiet-napping-hare.md` §Phase 10.3 (Marketplace greenfield)
- `/home/shared/rebuild/memory/project_kronk_rebuild_storage_spec_draft.md` (spaces/marketplace/ layout)
- `/home/shared/rebuild/spec/kronk_korner_spec.md` §Marketplace
- Related korners: `nudges.md` (buyer↔seller contact via Nudges), `krew.md` (potential Krew-scoped listings)
