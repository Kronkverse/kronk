# Cinema (`cinema`)

**Manifest:** `config/korners/cinema.yaml` · **Mount:** `/hub/cinema` · **Status:** live — model + controller + directory + composer + viewer + feed card shipped (PR #1805, 2026-09-11). Scaffolded 2026-09-09.

## Purpose

Cinema is a house for **short films** — original moving-image work, from title card to end frame. It's the video counterpart to Art's still images: title, description, direct playback of one file, feed card, comments via the standard Status pipeline.

Direct MP4 upload — the video is a plain `MediaAttachment` uploaded via `POST /api/v1/media`, referenced from the film row by id, and played back through an HTML5 `<video>` element in the viewer. No transcoding in v1; no adaptive bitrate; no thumbnail generation. That deliberate simplicity is what let Cinema ship the same week Art and Kronikles did.

## What a film is

- **Title** — required, up to 240 chars.
- **Description** — optional, up to 4000 chars. Plain text.
- **Video** — required. One `MediaAttachment` referenced by `video_media_attachment_id`. The video isn't updatable via `PATCH` — a new video means a new film.
- **Visibility** — `public / orbit / mates / self_only`. No krew scoping.

## Where you see Cinema

- **`/hub/cinema` directory** — a grid of film cards (placeholder poster + title + owner). No cover-thumbnail extraction yet (see § Open decisions), so every tile shows the accent-gradient poster with a play icon.
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

- `films` — `title / description / owner_id / video_media_attachment_id / visibility / status_id / timestamps`.
- `Status.has_one :film`; `Account.has_many :owned_films`.

Storage: video rides the shared `MediaAttachment` pipeline into DO Spaces. The upload cap is whatever `POST /api/v1/media` enforces (currently the default Mastodon video cap — see server config).

## Nodes

- `cinema.index` — `/hub/cinema`, `lifecycle: live`, SPA.

## Cross-korner connections

- `accepts: [{ from: '*', kind: link }]`. No spawns.

## Open decisions

- **Transcoding** — v1 plays back exactly the file the user uploaded. Devices that can't decode the source codec see a black `<video>`. A follow-up is either server-side transcoding (paperclip-av or a proper worker) or a client-side check that rejects non-playable formats at upload time. The latter is cheaper.
- **Poster / thumbnail** — the feed card and directory tile both use a placeholder poster. A first-frame extraction step (ffmpeg during upload post-processing) is the shortest path to real thumbnails.
- **Duration / size cap** — no explicit `max_length_seconds` today. What "short film" means is enforced socially, not by the schema. If bandwidth or storage push back, add a `duration_seconds` column + a soft cap in the composer.
- **Captions / subtitles track** — a `<track kind='captions'>` would need a companion upload + a UX in the composer. Deferred; `jsx-a11y/media-has-caption` is currently disabled with a comment in the viewer.
- **Adaptive playback (HLS/DASH)** — not v1. If Cinema becomes a real destination, this is where the transcoding argument pays off.

## Related

- [`../korners/korner_standard.md`](../korners/korner_standard.md).
- [`../korners/adding_a_korner.md`](../korners/adding_a_korner.md).
- [`art.md`](art.md) / [`kronikles.md`](kronikles.md) — sibling korners from the same discovery.
- [`booth.md`](booth.md) — audio's answer to what Cinema does for video.
