# Art (`art`)

**Manifest:** `config/korners/art.yaml` · **Mount:** `/hub/art` · `enforced: true`

Art covers physical works only. Writing, film and audio live in sibling korners: Kronikles, Cinema and Booth.

## Purpose

Art is a house for **physical works** — paintings, sculptures, prints, drawings, ceramics, and the photographs of them. It exists so the making that lives in the physical world has a place on Kronk that isn't shoehorned into a text post: a piece is titled, categorised by kind, given a description that reads like a caption for the work rather than a status update, and shown as a photo grid so multiple angles / details / close-ups of one work sit together.

Deliberately single-author. Two artists photographing the same sculpture from opposite sides is still one piece, one author (the artist), and one entry in the korner — not a shared album. That's the shape that made the split from the earlier umbrella clean: shared albums with per-photo authorship are what **Albutts** does, and Art doesn't need to be that.

## What a piece is

- **Title** — required, up to 240 chars.
- **Description** — optional, up to 4000 chars. Plain text.
- **Kind** — required. One of painting, drawing, illustration, print, photograph, collage, mixed media, sculpture, installation, ceramic, glass, textile, jewellery, woodwork, metalwork, papercraft, calligraphy, mural or street art, and other (`ArtPiece#kind`). The names people see live once, in `features/art/kinds.ts`, which the composer, the page, the grid and the feed card all read; the picker lists them by name with Other last. A new kind takes the next enum number in the model and a name there.
- **Photos** — zero or more, ordered by `position`. First photo becomes the piece's cover (unless a `cover_media_attachment` is set explicitly). Photos have an optional caption and no independent favourite / reply surface — all interaction lands on the piece's feed card, not per photo.
- **Visibility** — the reach ladder: `public / orbit / mates / self_only`, plus any Krews it is for (`krew_ids`, the same as an album's): a member of one sees it whatever its tier, and each is a Konnection to the Krew (`record_krews`, `Kronk::KrewAudience`, decisions.md 2026-10-25).

## Piece details

A piece can also say what a gallery label would (Kommons "Portfolio style & Art cards showing media on profile", @mangobee, 2026-10-23). All optional, under **Details** in the composer:

- **Medium** — tapped from the artist's portfolio mediums (or a new one typed, which joins their portfolio too, once they have one; `ArtPiece#add_mediums_to_portfolio`), up to six (`art_pieces.mediums`). It's the category the portfolio's chips sort by, and on the piece page each one links back to the portfolio filtered to it.
- **Materials** — free text, up to 160 characters ("Stoneware, celadon glaze"; the `medium` column).
- **Size** — behind an **Add size** switch: width × height, with a `cm` | `in` toggle (`size_unit`). Depth isn't asked for (@mangobee, 2026-10-23); saving a piece clears any.
- **Year made**, and **Edition** ("Original", "3 of 25", up to 80 characters).
- **Status** (`availability`) — _Not for sale_ (the default), _Available_, _Sold_, _Commissioned_, _On show_.

**Price**: when the status is _Available_, the artist can say what they're asking (`price_cents`, whole cents, and `price_currency`, AUD for now as in Wachuneed). Leave it blank and people use _Ask about it_. Cards then wear the price as their tag, and the piece page and the quick viewer read "Available · $1,200 AUD" (@mangobee, 2026-10-26). Changing the status away from _Available_ clears it.

The piece page shows them as one line under the title, "Oil on linen · 60 × 90 cm · 2026 · Original", with the status as a chip when it isn't _Not for sale_. Every card (the Art grid, a portfolio, a profile's Art shelf) reads the medium (or materials, or kind) and year, and wears the status as a tag. The labels live once, in `features/art/details.ts`.

## Where you see Art

- **`/hub/art` directory**: a `<SpaceGrid>` of `<SpaceCard>`s, the same tiles as a portfolio. Each piece is an equal square with the artwork shown whole on a soft matte, never cropped (`.art-works`); under it the title and the card line, its first medium (or materials, or kind) · year, with the status as a tag when it isn't _Not for sale_ (`pieceCardLine` in `details.ts`; @mangobee, 2026-10-26: one tidy look everywhere). Loading and empty are `<LoadingState>` and `<EmptyState>`. Rotator faces: **All / Mine / Mates'** via the shared `<AutoSpaceHeader>` rotator (`header.rotator: true`), URL-driven segments `/hub/art/{mine,mates}`.
- **`/hub/art/pieces/:id` piece page**: on `<KornerDetail>`, top to bottom (@mangobee, 2026-10-26). First the **main picture** (the first photo), whole, with its caption, then the **title** and a meta line: the artist's profile picture, which opens their portfolio (@mangobee, 2026-10-26: in place of their @name), and who can see the piece, shown to the artist only. Next come **the artist's words** (the description), straight under the title with no heading, a little larger, like a gallery label, folding to four lines behind _Read more_ when long; then **Mediums**: the medium chips and the facts line (materials · size · year · edition, and the status). Last is **More pictures**: every other photo as equal squares, each whole on a soft matte, with its caption. Tapping any picture opens it full screen in the quick viewer (see Portfolio), without the count or _Open piece_, and you can step through the rest from there. What it's Konnected to follows. A piece takes **as many photos as the artist likes**: there's no cap, only Kronk's upload rate limit (300 per 30 minutes), and the composer says so. The owner gets **Edit piece** in the Ж menu, which opens the create composer in edit mode: title, kind, description, and the piece's photos, where × takes one off and the photo drop zone adds more at the end (saved together on **Save**; if an upload fails the form stays open and says so). Reach is shown but locked while editing. **Delete piece** sits at the foot of that form, not on the page.
- **On a profile**: an Art shelf shows each piece like the Art grid does, as its cover shown whole in a square on a soft matte, with the title and card line under it (`ArtTile` in `shelf_drawn.tsx`; @mangobee, 2026-10-26: one look everywhere, replacing the 2×2 of up to four photos from 2026-10-23). It is chosen by the shelf's `korner_slug: 'art'`, not its render: the cutover backfill stored Art shelves as `photo`, which looked for photos on the post and found none, because a piece's photos live on the piece. `REST::ArtPieceSummarySerializer` carries `year_made` for the card line.
- **Home feed** — one card per piece lifetime. `StatusArtCard` renders cover + title + `<kind>` + photo count. Later photo additions do not spawn new cards; the standard Status favourite / reply pipeline handles interaction.

## Portfolio

Every artist has a portfolio at **`/hub/art/@:acct`** (Kommons "Portfolio style & Art cards showing media on profile", @mangobee, 2026-10-23). It is kept simple, the artist and the work (@mangobee, 2026-10-23, after trying a busier "gallery wall" header), top to bottom in `<KornerDetail>`:

- **Their picture and name.** The picture is a link to their main profile.
- **Bio** — their artist statement (up to 2000 characters, written in Edit portfolio), or, when they haven't written one, their profile bio. Past 220 characters it folds to three lines behind **Read more**.
- **Mediums** — the ones they work in, as chips with a count of the pieces in each (up to 12, each up to 40 characters; `art_portfolios.mediums`, plus any a piece uses that the list doesn't). Tapping one narrows the work to the pieces put in it (`art_pieces.mediums`); a piece from before pieces had mediums is matched on its materials and kind. **All** clears it. `?medium=` opens it filtered.
- **All their work** — every piece that reaches the viewer, the featured ones (up to three, in the order the artist picked) first, then the rest newest first, as an even `<SpaceGrid>` of equal squares (@mangobee, 2026-10-23: balanced and equal, after trying masonry), each artwork fitted whole inside its square, never cropped: the same tiles as the Art grid.
- **The quick viewer** — tapping a piece opens it full screen, shown whole (Kommons "Portfolio style & Art cards showing media on profile", @mangobee, 2026-10-26): `{n} of {total}`, and the medium when one is picked; previous and next (arrows, a swipe, or ← → keys) step through the pieces on show; dots switch between its photos; under it the title, its availability when it has one, the facts line (materials, size, year, edition), **Open piece**, and **Ask about it** (Nudges with the artist) for anyone but the artist. Esc or ✕ closes it. The card is still a link to the piece's page, so opening it in a new tab goes there (`art_quick_viewer.tsx`).
- **Commissions** — last. When they're open: a line saying so and **Ask about a commission**, which opens a Nudges conversation with them (`/nudges/with/:id`); nothing about how to reach them is published. The artist, when they're not open, sees where to switch it on; visitors see nothing.

The artist edits it from the Ж menu, **Edit portfolio** (`art_portfolio_editor.tsx`, in the compose shell): their mediums (tapped from a list of common ones or typed), the statement, the featured pieces, ticked from their own (the order they're ticked is the order they show), and the commissions switch.

**Setting it up.** Until an artist has saved a portfolio (`set_up` in the API), their own portfolio opens with a **Set up your portfolio** card. **Start** walks them through the same four sections one at a time (mediums, statement, featured pieces, commissions) with Back and Next; any step can be left empty.

**Commissions** can also say what they start from (`art_portfolios.commission_price_cents` and `commission_currency`) and carry a line about them (`commission_note`, up to 200 characters, such as "Portraits in oil, about six weeks"). Both are optional, set under _Open for commissions_ in Edit portfolio, and shown in the Commissions section as "From $300 AUD · Portraits in oil, about six weeks" (@mangobee, 2026-10-26).

Ways in: the **Mine** face (_Your portfolio_), the owner's @name on a piece page, and **Portfolio** in the header of a profile's Art shelf.

Data: `art_portfolios` (one per account, made on first save: `statement`, `open_for_commissions`) and `art_pieces.featured_position` (1–3, nil when not featured; `ArtPortfolio.feature!` keeps only the owner's own pieces, at most three). `GET /api/v1/art/portfolios/:account_id` gives the account, the statement and commissions marker (only to someone who can see the artist's profile), and the featured pieces and the rest (only those `ArtPiece.visible_to` the viewer, up to 60). `PUT /api/v1/art/portfolio` saves your own.

## Composer

`ArtPieceComposer`, opened via the Ж bubble → **Post a piece**, or by navigating to `/hub/art/composer`. Fields, top to bottom:

1. **Title** (input).
2. **Kind** (`<select>`; painting default).
3. **Description** (textarea).
4. **Photos** — `<PhotoDropZone>`: drag photos onto it or click to choose (multiple, `image/*`); thumbnails render inline with per-tile remove. Serial upload on submit so the first photo lands as position 0 (cover). A pool would race ordering.
5. **Reach** — `<ReachDropdown>` in the compose-shell header slot.

On submit: `POST /api/v1/art/pieces` creates the piece, then for each photo `POST /api/v1/media` → `POST /api/v1/art/pieces/:id/photos`. Progress ("N of M uploaded") + a "some photos failed, try again from the piece page" line if any upload fails. Piece creation is the atomic step — a piece with zero photos is a valid outcome.

## Feed projection

- `Art::PublishPiece` mints one Status per piece on create, stamped `source_korner='art'`. The Status carries the title as its text; visibility mirrors the piece's reach tier verbatim.
- The Status is registered via `korner_cards.tsx` as `{ slug: 'art', assocField: 'art_piece' }`.
- `StatusSerializer` has_one `:art_piece` with an `art_piece_visible_to_viewer?` gate — belt-and-braces against a leaked render spilling past the piece's own visibility.

## Data

Migration `db/migrate/20260910120000_create_art.rb`.

- `art_pieces` — `title / description / kind (int enum) / owner_id / cover_media_attachment_id / visibility / status_id / timestamps`.
- `art_piece_photos` — `art_piece_id / media_attachment_id / caption / position / timestamps`.
- `Status.has_one :art_piece`; `Account.has_many :owned_art_pieces`.

Storage: photos ride the shared `MediaAttachment` pipeline. No Art-owned media prefix — the standard `media_attachments/*` root is fine because each photo has exactly one owner (the piece's owner), so there's no cross-tenant path collision to worry about.

## Nodes

- `art.index` — `/hub/art`, `lifecycle: live`, SPA.

## Cross-korner connections

- `accepts: [{ from: '*', kind: link }]` — any source korner (Kalendar event, Kommons proposal, a Nudge) can link to an art piece via the shared attachment primitive. No spawn or bidirectional relationships.

## Open

- **Rich media captions** — captions are plain text today. If the composer ever grows a mentions/hashtag surface, per-photo captions may want to become Status-backed like `AlbumPhoto` did in Albutts.
- **Piece cover picker** — cover currently defaults to the first uploaded photo. A future composer affordance could let the owner pick any photo as the cover without re-ordering the grid.
- **Changing reach after posting** — the API accepts it but doesn't re-scope the item's feed post, so the edit form locks it.

## Related

- [`../korners/korner_standard.md`](../korners/korner_standard.md) — Standard §L1 identity, §L11 Frame adherence.
- [`../korners/adding_a_korner.md`](../korners/adding_a_korner.md) — the build walkthrough.
- [`albutts.md`](albutts.md) — the multi-contributor cousin whose pattern Art reuses (minus the contributor roster).
- [`kronikles.md`](kronikles.md) / [`cinema.md`](cinema.md) — the sibling korners that took the discipline splits.

## History

Rewritten 2026-10-05 to describe what is built. Earlier version:
`git show 231cca937:docs/spaces/art.md`.
