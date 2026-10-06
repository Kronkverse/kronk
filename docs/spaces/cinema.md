# Cinema (`cinema`)

**Manifest:** `config/korners/cinema.yaml` · **Mount:** `/hub/cinema` · `enforced: true`

## Purpose

Cinema is a house for **short films** — original moving-image work, from title card to end frame. It's the video counterpart to Art's still images: title, description, direct playback of one file, feed card, comments via the standard Status pipeline.

Direct MP4 upload: the video is a plain `MediaAttachment` uploaded via `POST /api/v1/media`, referenced from the film row by id, and played back through an HTML5 `<video>` element in the viewer. Cinema adds no video processing of its own: no adaptive bitrate, no posters. The shared media pipeline does run its normal video handling (ffmpeg re-encodes to H.264 MP4 when the file isn't already compatible, and makes a small preview frame), but Cinema doesn't use the preview yet.

## What a film is

- **Title** — required, up to 240 chars.
- **Description** — optional, up to 4000 chars. Plain text.
- **Video** — required (the controller rejects a create without `video_media_attachment_id`; the column itself is nullable). One `MediaAttachment`. The video isn't updatable via `PATCH` — a new video means a new film.
- **Visibility** — `public / orbit / mates / self_only`. No krew scoping.

## Where you see Cinema

- **`/hub/cinema` directory** — a grid of film cards (placeholder poster + title + owner). No poster yet (see Open), so every tile shows the accent-gradient poster with a play icon.
- **`/hub/cinema/:id` viewer** — title header + meta row (visibility), owner attribution, native `<video controls playsInline>` player at 16:9, description, owner-only delete.
- **Home feed** — one card per film lifetime. `StatusCinemaCard` renders a placeholder poster with a centred play icon over an accent gradient + title + owner. Tapping the card opens the viewer.

## Composer

`FilmComposer`, opened via the Ж bubble → **Post a film**, or by navigating to `/hub/cinema/composer`. Fields:

1. **Title** (input).
2. **Description** (textarea).
3. **Video** — file picker (`accept="video/mp4"`). Shows the chosen filename once picked.
4. **Reach** — `<ReachDropdown>` in the compose-shell header slot.

On submit, the two-step upload:

1. `POST /api/v1/media` with the MP4 (multipart form).
2. `POST /api/v1/cinema/films` with `film[video_media_attachment_id]` set to the returned media id, plus the title / description / visibility.

If step 1 fails (network, upload cap, format rejection) the film row isn't created — the user retries the whole submission.

## Feed projection

- `Cinema::PublishFilm` mints one Status per film on create, stamped `source_korner='cinema'`. Status text is the film's title; visibility mirrors the film's.
- Registered via `korner_cards.tsx` as `{ slug: 'cinema', assocField: 'film' }`.
- `StatusSerializer` has_one `:film` with a `film_visible_to_viewer?` gate.

## Data

Migration `db/migrate/20260911120000_create_cinema.rb`.

- `films` — `title / description / owner_id / video_media_attachment_id / visibility / status_id / timestamps`.
- `Status.has_one :film`; `Account.has_many :owned_films`.

Storage: video rides the shared `MediaAttachment` pipeline into DO Spaces. The limits are the pipeline's: `MediaAttachment::VIDEO_LIMIT` (2 GB), up to 3840×2160, 120 fps and 36,000 frames.

## Nodes

- `cinema.index` — `/hub/cinema`, `lifecycle: live`, SPA.

## Cross-korner connections

- `accepts: [{ from: '*', kind: link }]`. No spawns.

## Open

- **Playback compatibility** — the composer only accepts `video/mp4`, and the pipeline normalises to H.264. Whether every MP4 people upload plays on every device hasn't been checked.
- **Poster / thumbnail** — the feed card and directory tile both use a placeholder poster. The media pipeline already makes a preview frame for each video; exposing it on the film serializer is the shortest path to real thumbnails.
- **Duration cap** — nothing Cinema-specific. What "short film" means is enforced socially and by the pipeline's frame cap, not by the schema. If bandwidth or storage push back, add a `duration_seconds` column + a soft cap in the composer.
- **Captions / subtitles track** — a `<track kind='captions'>` would need a companion upload + a UX in the composer. Deferred; `jsx-a11y/media-has-caption` is currently disabled with a comment in the viewer.
- **Adaptive playback (HLS/DASH)** — not built. Worth it only if Cinema becomes a real destination.

## Related

- [`../korners/korner_standard.md`](../korners/korner_standard.md).
- [`../korners/adding_a_korner.md`](../korners/adding_a_korner.md).
- [`art.md`](art.md) / [`kronikles.md`](kronikles.md) — sibling korners from the same discovery.
- [`booth.md`](booth.md) — audio's answer to what Cinema does for video.

## History

Rewritten 2026-10-05 to describe what is built. Earlier version:
`git show 231cca937:docs/spaces/cinema.md`.
