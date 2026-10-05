# Korner template

A starting shape for a new korner that already follows the Frame (Standard
L11). Copy it, rename it, and delete what you don't need.

## What's here

| File               | Role                                                                                               |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| `mykorner.yaml`    | The manifest. Copy to `config/korners/<slug>.yaml`. Declares `tagline`, `views:`, `icon:`, a node. |
| `index.tsx`        | The component mounted at `/hub/<slug>`: a `<KornerShell>` mapping URLs to views.                   |
| `default_view.tsx` | The first view in `views:`, at bare `/hub/<slug>`.                                                 |
| `other_view.tsx`   | A second view, at `/hub/<slug>/other`.                                                             |

## What the Frame gives you

Read [`docs/design.md`](../../design.md) (Frame) once. On every `/hub/<slug>`
route the Frame renders, from the manifest:

- `<AutoSpaceBadge>`: the korner name as the back pill.
- `<AutoSpaceHeader>`: the one `<h1>` with the name, and the `tagline` under
  it. It scrolls with the content.
- `<AutoSpaceViewPicker>`: the view picker from `views:`, which drives the
  URL.

So `index.tsx` renders content only. `<KornerShell>` owns the `<Stage>` and
picks the view from the URL. No `<h1>`, no `role="tablist"`, no tagline
literal: the doctor warns on all three. The `views` keys in `index.tsx` must
match `views:` in the manifest, same keys, same order. For a single-view
korner, delete `views:` and render one component.

## To use it

1. `cp docs/korners/template/mykorner.yaml config/korners/<slug>.yaml`.
2. `cp -r docs/korners/template app/javascript/mastodon/features/<slug>`,
   then delete the copied `README.md` and `mykorner.yaml`.
3. Replace `mykorner` / `MyKorner` with your slug and name everywhere. The
   slug is one lowercase word (Standard L1).
4. Register the route: the async chunk, the React route and the Rails SPA
   mount, as in step 5 of [`adding_a_korner.md`](../adding_a_korner.md#5-register-the-route).
5. Wire the icon: `icon.material` must be a key in `MATERIAL_TO_ICON` in
   `hooks/useKornerIcon.tsx` (step 8).
6. Run `bin/tootctl korners doctor` and read the lines naming your slug. They
   should be clean, with no L11 warnings.

The manifest leaves `enforced: false` and the node at `lifecycle: soon`. Keep
them there until the korner meets the whole
[Standard](../korner_standard.md). The rest of the build (models,
controllers, serializers, feed card, composer, settings) is in
[`adding_a_korner.md`](../adding_a_korner.md).
