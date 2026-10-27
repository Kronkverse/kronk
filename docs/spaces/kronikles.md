# Kronikles (`kronikles`)

**Manifest:** `config/korners/kronikles.yaml` · **Mount:** `/hub/kronikles` · `enforced: true`

## Purpose

Kronikles is a house for **long-form writing** — essays, short stories, poetry, letters, journals. It exists because a status post is the wrong shape for a piece of writing that needs to breathe: no reasonable character limit, formatting that maps to how prose actually reads (headings, paragraphs, quotes, lists), and a reader surface that treats the text as the point of the visit rather than a payload wrapped in social chrome.

Deliberately single-author. Multi-author writing is a real thing but not this shape: the model has no `contributor` counterpart to Albutts's split, and adding one is a schema change, not a UI toggle.

## What a Kronikle is

- **Title** — required, up to 240 chars.
- **Body** — required. Raw markdown, **no length limit**. Stored as plain text; rendered client-side.
- **Kind** — required. One of `essay / short_story / poetry / letter / journal / other`. Displayed as a badge on the feed card and reader meta row; `other` is the escape hatch.
- **Visibility** — the reach ladder: `public / orbit / mates / self_only`, plus any Krews it is for (`krew_ids`, the same as an album's): a member of one sees it whatever its tier, and each is a Konnection to the Krew (`record_krews`, `Kronk::KrewAudience`, decisions.md 2026-10-25).

The kind is a **label, not a schema constraint** — re-classifying an essay as a short story is a plain `PATCH` on the row, no data reshape.

## Series

A **Series** gathers one writer's Kronikles as ordered **chapters** (Kommons proposal "Kronikles", 117504092528767330; decisions.md, 2026-10-27). It has a **title** (required, up to 240 chars), an optional **description** (up to 2,000) and an optional **cover**, one of the writer's own uploads.

- **One Series per Kronikle, the writer's own.** A Kronikle is a chapter of at most one Series, and only of one its writer made. Added, it goes last; moved into another Series, it leaves the first.
- **No audience of its own.** Each chapter keeps its own reach and Krews. A reader sees, numbers and steps through only the chapters they can see; one they can't see isn't listed, counted or pointed to. A Series with no chapter they can see is a 404 for them. Its writer always sees it, empty or not.
- **Deleting a Series keeps its Kronikles**, just out of any Series.
- **Not Konnectable on its own.** It is a secondary resource in the manifest, not the primary one: with no audience of its own there is nothing to check a Konnection or a preview against. Konnect a chapter.

Where it shows:

- **The reader** — above the title, the Series' name (a link to it) and "Chapter N of M"; below the body, **Previous chapter · Contents · Next chapter** (`components/chapter_nav.tsx`).
- **The Series page** — `/hub/kronikles/series/:id`, on `<KornerDetail>`: cover as hero, title, description, a facts line (writer · N chapters), and **Contents**, the chapters in reading order. The writer gets **Edit Series** in the Ж menu (title, description, cover; **Delete Series** at the foot of that form), **Add a chapter** (one of their Kronikles, by a picker in the compose shell), and **Move up / Move down / Take out** on each chapter (`components/series_page.tsx`, `series_composers.tsx`).
- **The directory** — a Series is **one entry**, standing where its newest chapter you can see would be, badged _Series_, with its chapter count and latest chapter's title. Not a separate Series face: the rotator's faces are one axis, whose writing (All / Mine / Mates'), and a Series belongs on each of them like any other piece.
- **The composer** — an optional **Series** choice: one of yours, **New Series…** (a title field; the Series is made when you publish), or none. Description and cover are set on the Series page.

## Markdown rendering

The reader uses `RenderMarkdown` (`features/kronikles/components/render_markdown.tsx`) — a small (~250 lines) transformer with no npm dep. Supported:

- Headings `#`, `##`, `###`
- Bold `**x**`, italic `*x*` / `_x_`, inline code `` `x` ``
- Links `[text](url)` — http(s) only; other schemes render as literal characters
- Unordered lists `- ` / `* `
- Blockquotes `> `
- Paragraphs separated by blank lines; hard line breaks inside a paragraph become `<br/>`

- Pictures `![caption](picture:<id>)` on a line of their own (Tal, 2026-10-12). The id is one of the Kronikle's own uploaded images; the reader resolves it against `pictures` on the API response. It is never a URL: a picture loaded from somewhere else would tell that server who is reading. An id the Kronikle doesn't hold draws nothing.

All input is treated as untrusted: the renderer builds React nodes directly (no `dangerouslySetInnerHTML`), so HTML tags in the body render as literal characters. Anything unsupported (tables, code fences, images by URL) falls through as plain text — the surface stays deliberately small until long-form authors ask for more.

## Where you see Kronikles

- **`/hub/kronikles` directory** — the shared tile grid (`<SpaceGrid>` + `<SpaceCard>`, two across on a phone, four from tablet width): the Kronikle's first picture, or the Kronikles glyph when it has none, over its title, the author's handle and its kind. A Series is one tile (badge "Series", chapter count and author). Rotator faces: **All / Mine / Mates'** via the shared `<AutoSpaceHeader>` rotator. (It was a column of full-width cards with an excerpt until 2026-10-27, Kommons "Better formatting for posted work".)
- **`/hub/kronikles/series/:id`** — a Series' page and contents (see Series).
- **`/hub/kronikles/:id` reader** — title header + meta row (kind · visibility · owner), rendered markdown body, then the **shared reactions bar** every space uses (`<StatusEngagement>` on the Kronikle's Status, `status_id` on the API response): Reply, Froth, Nudge, as on an album photo, a Moment or a trek. Only the bar, not the reply thread under it (`showThread={false}`); Edit stays in the Ж menu (`hideEdit`). A chapter also shows its Series and Previous / Next (see Series). The author gets **Edit Kronikle** in the Ж menu, which opens the create composer in edit mode (title, kind, body; reach is shown but locked while editing). **Delete Kronikle** sits at the foot of that form, not on the page.
- **Home feed** — one card per Kronikle lifetime. `StatusKroniklesCard` renders kind badge + title + a 360-char plain-text excerpt (leading markdown syntax stripped). Later body edits do not spawn new cards.

## Composer

`ChronicleComposer`, opened via the Ж bubble → **Start a Kronikle**, or by navigating to `/hub/kronikles/composer`. Fields:

1. **Title** (input).
2. **Kind** (`<select>`; essay default).
3. **Body** (textarea, min-height 400px, monospace-free — reads like a writing surface, not a comment box). Placeholder hints at the supported markdown syntax.
4. **Series** (optional) — one of yours, a new one, or none (see Series).
5. **Reach** — `<ReachDropdown>` in the compose-shell header slot.

Above the body are two writing aids: **Heading**, which starts the current line with `## `, and **Add a picture**, which uploads an image (`POST /api/v2/media`) and writes its `![](picture:<id>)` line where the cursor is. Thumbnails under the box show which line is which picture. A caption goes between the square brackets; deleting the line removes the picture.

On submit: `POST /api/v1/kronikles/chronicles`. The body is still the whole Kronikle: pictures ride in it by id.

## Feed projection

- `Kronikles::PublishChronicle` mints one Status per chronicle on create, stamped `source_korner='kronikles'`. Status text is the Kronikle's title.
- Registered via `korner_cards.tsx` as `{ slug: 'kronikles', assocField: 'chronicle' }`.
- `StatusSerializer` has_one `:chronicle` with a `chronicle_visible_to_viewer?` gate.

## Data

Migration `db/migrate/20260911100000_create_kronikles.rb`.

- `chronicles` — `title / body (text) / kind (int enum) / owner_id / visibility / status_id / timestamps`.
- `Chronicle#excerpt(length:)` (default 240; the feed summary asks for 360) strips leading markdown syntax (`# `, `> `, `- `, `* `) and collapses whitespace so the feed card / directory row shows the body's actual words, not the format markers.
- `Status.has_one :chronicle`; `Account.has_many :owned_chronicles`, `:owned_chronicle_series`.

- `chronicle_series` — `owner_id / title / description / cover_media_attachment_id / timestamps` (`ChronicleSeries`, migration `20261027120000_create_chronicle_series.rb`). The cover is checked to be the owner's own upload (`Kronk::OwnUploads`) and kept from the orphaned-media sweep. `ChronicleSeries.visible_to(viewer)` / `#visible_to?` / `#chapters_visible_to` hold the rule above.
- `chronicles.series_id / series_position` (`20261027120100_add_series_to_chronicles.rb`) — the Series and the place in it, 1, 2, 3…; both null outside a Series. `Chronicle#chapter_for(viewer)` gives `{ number, count, previous_id, next_id }` over the chapters `viewer` can see.

API, under `/api/v1/kronikles`:

- `series` — `index` (what you can see; `scope=mine` for your own), `show`, `create`, `update`, `destroy` (owner only for writes); `PUT series/:id/reorder` with `chapter_ids` (every chapter, once).
- `series/:id/chapters` — `index` (the chapters you can see, in order), `create` with `chronicle_id`, `destroy` (owner only for writes). A Series you can't see is a 404 here too.
- A Kronikle's JSON has `series: { id, title, cover_url, chapter_count }` (or null), and on a single Kronikle `chapter: { number, count, previous_id, next_id }`. The `chronicles` index lists a Series once, as its newest visible chapter; `series=each` lists every chapter.

- `chronicle_pictures` — which `MediaAttachment`s a Kronikle's body places (`Chronicle#sync_pictures!`, run after any body change: the owner's own images only, at most 30). It is what keeps them out of the orphaned-media sweep (`Vacuum::MediaAttachmentsVacuum`). A picture the body stops naming is let go and swept later.

## Nodes

- `kronikles.index` — `/hub/kronikles`, `lifecycle: live`, SPA.

## Cross-korner connections

- `accepts: [{ from: '*', kind: link }]` — anything can link to a Kronikle. No inbound spawns.

## Open

- **Real markdown pipeline** — `render_markdown.tsx` is deliberately minimal. Once long-form authors ask for tables, code fences, or footnotes, the honest move is to add a real library (`marked` or `remark`) with `DOMPurify`, not to grow the hand-written transformer into a full parser.
- **Reading time / word count** — nothing shown on the feed card today. Could sit next to the kind badge once we know what value looks like.
- **Draft state** — every Kronikle is publish-on-submit. Multi-session drafts (save-and-continue) haven't been needed yet; add a `drafted_at` or a separate `chronicle_drafts` table if long-form authors start losing work to browser refreshes.
- **Replies on the reader** — the reactions bar is there, but the replies themselves show only on the post (tap Reply, or open the feed card). Showing the thread under the Kronikle, as treks do, is the next step if readers want it.
- **Changing reach after posting** — the API accepts it but doesn't re-scope the item's feed post, so the edit form locks it.

## Related

- [`../korners/korner_standard.md`](../korners/korner_standard.md).
- [`../korners/adding_a_korner.md`](../korners/adding_a_korner.md).
- [`art.md`](art.md) / [`cinema.md`](cinema.md) — sibling korners from the same discovery.

## History

Rewritten 2026-10-05 to describe what is built. Earlier version:
`git show 231cca937:docs/spaces/kronikles.md`.
