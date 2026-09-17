# Korner template

A canonical, Frame-adherent shape for a new korner. Copy the files here into your feature dir and delete what you don't need — the point is to start from something that already passes `bin/tootctl korners doctor` (including the L11 Frame-parasite warning), not to bolt Frame adherence on later.

## What's here

| File               | Role                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------- |
| `mykorner.yaml`    | Manifest — copy to `config/korners/<slug>.yaml`. Declares `tagline`, `views:`, `icon:`.     |
| `index.tsx`        | Feature entry — the file that mounts at `/hub/<slug>`. **This is the L11 reference shape.** |
| `default_view.tsx` | Placeholder for the first view listed in the manifest (`views: [{ key: default, … }]`).     |
| `other_view.tsx`   | Placeholder for a second view (`/hub/<slug>/other`).                                        |

## What the Frame gives you (don't reimplement)

Read [`docs/kronk_frame.md`](../../kronk_frame.md) once. In short — every `/hub/<slug>` route inherits three chrome slots from the Frame, driven by your manifest:

- `<AutoSpaceBadge>` renders the space title (`name`) into the SpaceNav slot.
- `<AutoSpaceHeader>` renders the korner name as an `<h1>` above the manifest `tagline`, at the top of the Stage's scrollable region (so it scrolls with content — the SpaceBadge pill is the persistent chrome affordance).
- `<AutoSpaceViewPicker>` renders the tab/dropdown from your `views:` list and drives the URL.

Your `index.tsx` renders **only content** — it reads the URL to pick which view to show, and drops it inside `<Stage>`. No `<h1>`, no `role="tablist"`, no tagline literal. `bin/tootctl korners doctor` warns on all three via Standard L11.

## To use this template

1. `cp docs/korners/template/mykorner.yaml config/korners/<slug>.yaml` and fill in the manifest.
2. `cp -r docs/korners/template app/javascript/mastodon/features/<slug>`, rename files, and update strings.
3. Rename `<slug>` in `mykorner.yaml`, `index.tsx`, etc. — the slug is one lowercase word (Standard L1).
4. Wire the async chunk (`app/javascript/mastodon/features/ui/util/async-components.js`) and the route (`app/javascript/mastodon/features/ui/index.jsx`), per §5 in `docs/korners/adding_a_korner.md`.
5. Run `bin/tootctl korners doctor` — expect **your korner** to be clean, with no L11
   warnings. Note the doctor reports the whole platform, and there are currently 27
   pre-existing issues on other korners (see the CI note in
   `docs/korners/korner_standard.md` §3), so read the lines naming your slug rather
   than the total. Your `icon.material` must be a key in `MATERIAL_TO_ICON` in
   `hooks/useKornerIcon.tsx` — add a row (and the SVG import) if you picked a new glyph.

The rest of the walkthrough (models, controllers, serializers, feed projection, tests) is in `docs/korners/adding_a_korner.md`.
