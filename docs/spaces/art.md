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
- **Visibility** — the reach ladder: `public / orbit / mates / self_only`. No Krew scoping: single-author works don't need the group-coordination shape that made it useful on Albutts. The enum's integer values leave room to add it without a schema change.

## Piece details

A piece can also say what a gallery label would (Kommons "Portfolio style & Art cards showing media on profile", @mangobee, 2026-10-23). All optional, under **Details** in the composer:

- **Medium and materials** — free text, up to 160 characters ("Oil on linen", "Stoneware, celadon glaze").
- **Size** — width × height × depth, any of them, in `cm` or `in` (`size_unit`).
- **Year made**, and **Edition** ("Original", "3 of 25", up to 80 characters).
- **Status** (`availability`) — _Not for sale_ (the default), _Available_, _Sold_, _Commissioned_, _On show_.

The piece page shows them as one line under the title, "Oil on linen · 60 × 90 cm · 2026 · Original", with the status as a chip when it isn't _Not for sale_. A portfolio card reads the medium (or the kind) and year, and wears the status. The labels live once, in `features/art/details.ts`.

## Where you see Art

- **`/hub/art` directory** — a grid of piece cards (cover + title + kind + photo count). Rotator faces: **All / Mine / Mates'** via the shared `<AutoSpaceHeader>` rotator (`header.rotator: true`), URL-driven segments `/hub/art/{mine,mates}`.
- **`/hub/art/pieces/:id` viewer** — on `<KornerDetail>`: the cover (the first photo) shown whole as the hero, the title, a facts line (kind · N photos · reach · @owner), then the rest of the photos with their captions, the description, and what it's Konnected to. The cover isn't repeated in the grid. The owner gets **Edit piece** in the Ж menu, which opens the create composer in edit mode: title, kind, description, and the piece's photos, where × takes one off and the photo drop zone adds more at the end (saved together on **Save**; if an upload fails the form stays open and says so). Reach is shown but locked while editing. **Delete piece** sits at the foot of that form, not on the page.
- **On a profile** — an Art shelf shows each piece as a small square of up to four of its photos (the Gallery's 2×2: one fills it, two split it, three put the first beside two), `+N` on the last when there are more, and the title and kind · photo count under it (`ArtTile` in `shelf_drawn.tsx`; Kommons "Art portfolio", @mangobee, 2026-10-23). It is chosen by the shelf's `korner_slug: 'art'`, not its render: the cutover backfill stored Art shelves as `photo`, which looked for photos on the post and found none, because a piece's photos live on the piece. `REST::ArtPieceSummarySerializer#preview_urls` gives the first four at thumbnail size.
- **Home feed** — one card per piece lifetime. `StatusArtCard` renders cover + title + `<kind>` + photo count. Later photo additions do not spawn new cards; the standard Status favourite / reply pipeline handles interaction.

## Portfolio

Every artist has a portfolio at **`/hub/art/@:acct`** (Kommons "Portfolio style & Art cards showing media on profile", @mangobee, 2026-10-23). It is `<KornerDetail>`: their avatar, name, _Portfolio_, and a facts line (N pieces · **Open for commissions** when it is on · @acct, linking to the profile). Under it:

- **Artist statement** — up to 2000 characters, as written.
- **Featured** — up to three pieces the artist leads with, two across and larger, in the order they picked.
- **All works** — every other piece that reaches the viewer, newest first, as a `<SpaceGrid>` of `<SpaceCard>`s.
- **Ask about a commission** — a primary pill, shown to others when the artist is open for commissions. It opens a Nudges conversation with them (`/nudges/with/:id`); nothing about how to reach them is published.

The artist edits it from the Ж menu, **Edit portfolio** (`art_portfolio_editor.tsx`, in the compose shell): the statement, the commissions tick, and the featured pieces, ticked from their own (the order they're ticked is the order they show).

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
- [`albutts.md`](albutts.md) — the multi-contributor cousin whose pattern Art reuses (minus contributor roster and krew scoping).
- [`kronikles.md`](kronikles.md) / [`cinema.md`](cinema.md) — the sibling korners that took the discipline splits.

## History

Rewritten 2026-10-05 to describe what is built. Earlier version:
`git show 231cca937:docs/spaces/art.md`.
