# Art (`art`)

**Manifest:** `config/korners/art.yaml` · **Mount:** `/hub/art` · **Status:** live — models + composer + directory + viewer + feed card shipped (PR #1800, 2026-09-10). Refocused from an umbrella-of-disciplines to physical works only 2026-09-09; sibling korners (Booth, Kronikles, Cinema) own the disciplines that split off.

## Purpose

Art is a house for **physical works** — paintings, sculptures, prints, drawings, ceramics, and the photographs of them. It exists so the making that lives in the physical world has a place on Kronk that isn't shoehorned into a text post: a piece is titled, categorised by kind, given a description that reads like a caption for the work rather than a status update, and shown as a photo grid so multiple angles / details / close-ups of one work sit together.

Deliberately single-author. Two artists photographing the same sculpture from opposite sides is still one piece, one author (the artist), and one entry in the korner — not a shared album. That's the shape that made the split from the earlier umbrella clean: shared albums with per-photo authorship are what **Albutts** does, and Art doesn't need to be that.

## What a piece is

- **Title** — required, up to 240 chars.
- **Description** — optional, up to 4000 chars. Plain text.
- **Kind** — required. One of `painting / sculpture / print / drawing / ceramic / photograph / other`. Displayed as a badge on the feed card and the viewer meta row; `other` is the escape hatch for assemblage / textile / installation until the taxonomy earns a slot.
- **Photos** — zero or more, ordered by `position`. First photo becomes the piece's cover (unless a `cover_media_attachment` is set explicitly). Photos have an optional caption and no independent favourite / reply surface — all interaction lands on the piece's feed card, not per photo.
- **Visibility** — the reach ladder: `public / orbit / mates / self_only`. No krew scoping in v1 — single-author works don't share the group-coordination shape that made krew useful on Albutts. The DB enum leaves the door open for a future addition without a schema change.

## Where you see Art

- **`/hub/art` directory** — a grid of piece cards (cover + title + kind + photo count). Rotator faces: **All / Mine / Mates'** via the shared `<AutoSpaceHeader>` rotator (`header.rotator: true`), URL-driven segments `/hub/art/{mine,mates}`.
- **`/hub/art/pieces/:id` viewer** — cover, meta row (kind · N photos · visibility), owner attribution, description, photo grid with per-photo captions, owner-only delete.
- **Home feed** — one card per piece lifetime. `StatusArtCard` renders cover + title + `<kind>` + photo count. Later photo additions do not spawn new cards; the standard Status favourite / reply pipeline handles interaction.

## Composer

`ArtPieceComposer`, opened via the Ж bubble → **Post a piece**, or by navigating to `/hub/art/composer`. Fields, top to bottom:

1. **Title** (input).
2. **Kind** (`<select>`; painting default).
3. **Description** (textarea).
4. **Photos** — file picker (multiple, `image/*`); thumbnails render inline with per-tile remove. Serial upload on submit so the first photo lands as position 0 (cover). A pool would race ordering.
5. **Reach** — `<ReachDropdown>` in the compose-shell header slot.

On submit: `POST /api/v1/art/pieces` creates the piece, then for each photo `POST /api/v1/media` → `POST /api/v1/art/pieces/:id/photos`. Progress ("N of M uploaded") + a "some photos failed, try again from the piece page" line if any upload fails. Piece creation is the atomic step — a piece with zero photos is a valid outcome.

## Feed projection

- `Art::PublishPiece` mints one Status per piece on create, stamped `source_korner='art'`. The Status carries the title as its text; visibility mirrors the piece's reach tier verbatim.
- The Status is registered via `korner_cards.tsx` as `{ slug: 'art', assocField: 'art_piece' }`.
- `StatusSerializer` has_one `:art_piece` with an `art_piece_visible_to_viewer?` gate — belt-and-braces against a leaked render spilling past the piece's own visibility.

## Data

- `art_pieces` — `title / description / kind (int enum) / owner_id / cover_media_attachment_id / visibility / status_id / timestamps`.
- `art_piece_photos` — `art_piece_id / media_attachment_id / caption / position / timestamps`.
- `Status.has_one :art_piece`; `Account.has_many :owned_art_pieces`.

Storage: photos ride the shared `MediaAttachment` pipeline. No Art-owned media prefix — the standard `media_attachments/*` root is fine because each photo has exactly one owner (the piece's owner), so there's no cross-tenant path collision to worry about.

## Nodes

- `art.index` — `/hub/art`, `lifecycle: live`, SPA.

## Cross-korner connections

- `accepts: [{ from: '*', kind: link }]` — any source korner (Kalendar event, Kommons proposal, a Nudge) can link to an art piece via the shared attachment primitive. No spawn / bidirectional relationships in v1.

## Open decisions

- **Rich media captions** — captions are plain text today. If the composer ever grows a mentions/hashtag surface, per-photo captions may want to become Status-backed like `AlbumPhoto` did in Albutts.
- **Piece cover picker** — cover currently defaults to the first uploaded photo. A future composer affordance could let the owner pick any photo as the cover without re-ordering the grid.

## Related

- [`../korners/korner_standard.md`](../korners/korner_standard.md) — Standard §L1 identity, §L11 Frame adherence.
- [`../korners/adding_a_korner.md`](../korners/adding_a_korner.md) — the build walkthrough.
- [`albutts.md`](albutts.md) — the multi-contributor cousin whose pattern Art reuses (minus contributor roster and krew scoping).
- [`kronikles.md`](kronikles.md) / [`cinema.md`](cinema.md) — the sibling korners that took the discipline splits.
