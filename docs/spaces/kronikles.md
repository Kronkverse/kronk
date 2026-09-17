# Kronikles (`kronikles`)

**Manifest:** `config/korners/kronikles.yaml` · **Mount:** `/hub/kronikles` · **Status:** live — model + controller + directory + reader + composer + feed card shipped (PR #1802, 2026-09-11). Scaffolded 2026-09-09 alongside Cinema when Art narrowed to physical works.

## Purpose

Kronikles is a house for **long-form writing** — essays, short stories, poetry, letters, journals. It exists because a status post is the wrong shape for a piece of writing that needs to breathe: no reasonable character limit, formatting that maps to how prose actually reads (headings, paragraphs, quotes, lists), and a reader surface that treats the text as the point of the visit rather than a payload wrapped in social chrome.

Deliberately single-author. Multi-author writing is a real thing but not a v1 shape — the model has no `contributor` counterpart to Albutts's split, and adding one is a schema change, not a UI toggle.

## What a Kronikle is

- **Title** — required, up to 240 chars.
- **Body** — required. Raw markdown, **no length limit**. Stored as plain text; rendered client-side.
- **Kind** — required. One of `essay / short_story / poetry / letter / journal / other`. Displayed as a badge on the feed card and reader meta row; `other` is the escape hatch.
- **Visibility** — the reach ladder: `public / orbit / mates / self_only`. No krew scoping in v1.

The kind is a **label, not a schema constraint** — re-classifying an essay as a short story is a plain `PATCH` on the row, no data reshape.

## Markdown rendering

The reader uses `RenderMarkdown` — a small (~200 LOC) in-file transformer with no npm dep. Supported:

- Headings `#`, `##`, `###`
- Bold `**x**`, italic `*x*` / `_x_`, inline code `` `x` ``
- Links `[text](url)` — http(s) only; other schemes render as literal characters
- Unordered lists `- ` / `* `
- Blockquotes `> `
- Paragraphs separated by blank lines; hard line breaks inside a paragraph become `<br/>`

All input is treated as untrusted: the renderer builds React nodes directly (no `dangerouslySetInnerHTML`), so HTML tags in the body render as literal characters. Anything unsupported (tables, code fences, images) falls through as plain text — the surface stays deliberately small until long-form authors ask for more.

## Where you see Kronikles

- **`/hub/kronikles` directory** — a vertical feed of chronicle cards (kind badge + title + excerpt + author). Rotator faces: **All / Mine / Mates'** via the shared `<AutoSpaceHeader>` rotator.
- **`/hub/kronikles/:id` reader** — title header + meta row (kind · visibility · owner), rendered markdown body, owner-only delete.
- **Home feed** — one card per Kronikle lifetime. `StatusKroniklesCard` renders kind badge + title + a 360-char plain-text excerpt (leading markdown syntax stripped). Later body edits do not spawn new cards.

## Composer

`ChronicleComposer`, opened via the Ж bubble → **Start a Kronikle**, or by navigating to `/hub/kronikles/composer`. Fields:

1. **Title** (input).
2. **Kind** (`<select>`; essay default).
3. **Body** (textarea, min-height 400px, monospace-free — reads like a writing surface, not a comment box). Placeholder hints at the supported markdown syntax.
4. **Reach** — `<ReachDropdown>` in the compose-shell header slot.

On submit: `POST /api/v1/kronikles/chronicles`. No media, no two-step upload, no serial pool — a Kronikle is text.

## Feed projection

- `Kronikles::PublishChronicle` mints one Status per chronicle on create, stamped `source_korner='kronikles'`. Status text is the Kronikle's title.
- Registered via `korner_cards.tsx` as `{ slug: 'kronikles', assocField: 'chronicle' }`.
- `StatusSerializer` has_one `:chronicle` with a `chronicle_visible_to_viewer?` gate.

## Data

- `chronicles` — `title / body (text) / kind (int enum) / owner_id / visibility / status_id / timestamps`.
- `Chronicle#excerpt(length:)` strips leading markdown syntax (`# `, `> `, `- `, `* `) and collapses whitespace so the feed card / directory row shows the body's actual words, not the format markers.
- `Status.has_one :chronicle`; `Account.has_many :owned_chronicles`.

No table for photos or media — Kronikles is text-only in v1. If images ever belong inline, they'll live in the markdown as `![alt](url)` referencing MediaAttachments on the owner's account, not a separate `chronicle_photos` table.

## Nodes

- `kronikles.index` — `/hub/kronikles`, `lifecycle: live`, SPA.

## Cross-korner connections

- `accepts: [{ from: '*', kind: link }]` — anything can link to a Kronikle. No inbound spawns.

## Open decisions

- **Real markdown pipeline** — the in-file renderer is deliberately minimal. Once long-form authors ask for tables, code fences, or footnotes, the honest move is to add a real library (`marked` or `remark`) with `DOMPurify`, not to grow the in-file transformer into a full parser.
- **Reading time / word count** — nothing shown on the feed card today. Could sit next to the kind badge once we know what value looks like.
- **Draft state** — every Kronikle is publish-on-submit. Multi-session drafts (save-and-continue) haven't been needed yet; add a `drafted_at` or a separate `chronicle_drafts` table if long-form authors start losing work to browser refreshes.

## Related

- [`../korners/korner_standard.md`](../korners/korner_standard.md).
- [`../korners/adding_a_korner.md`](../korners/adding_a_korner.md).
- [`art.md`](art.md) / [`cinema.md`](cinema.md) — sibling korners from the same discovery.
