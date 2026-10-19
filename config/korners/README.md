# `config/korners/*.yaml`: korner manifests

One manifest per korner, plus the core spaces. Each file declares what the
space is (slug, name, icon), what it owns (resources, storage), what it
emits and accepts, its feed card, notifications, settings, views and
nodes. The rules a manifest is held to are in
[`docs/korners/korner_standard.md`](../../docs/korners/korner_standard.md);
how to write one is in
[`docs/korners/adding_a_korner.md`](../../docs/korners/adding_a_korner.md).
Each korner's prose doc is `docs/spaces/<slug>.md`.

## What reads these files

- **`Kronk::KornerRegistry`** (`config/initializers/kronk_korner_registry.rb`)
  loads every manifest at boot. For `enforced: true` manifests it runs a
  light drift check (table prefix exists, Status association defined) and
  logs a warning; boot never fails on a manifest.
- **The web app** reads the registry through `/api/v1/korners`: Hub
  tiles, the Ж menu's compose action, space headers and views, settings
  pages. On the server it also backs notification settings, attachments
  and the profile library.
- **`Kronk::NodeRegistry`** reads each manifest's `nodes:` block alongside
  `config/kronk_nodes.yaml`.
- **`bin/tootctl korners doctor`** checks every manifest against the
  Korner Standard. Its CI job reports but does not block yet.

## Conventions

- Every korner mounts at `/hub/<slug>`. Older URLs redirect in
  `config/routes.rb`.
- `core: true` marks a core space (feed, profile, nudges, hub, settings,
  welcome): it has a manifest but no Hub tile and can't be tuned out of.
- `enforced: false` with `lifecycle: soon` marks a korner that isn't live.
- `reserved_slugs.yaml` lists slugs a korner can't claim.
- `about:` is what the Ж menu's i moon shows: `what` (what the space is),
  `why` (why it's here) and `how` (a list of short lines on how it works).
  Write it for someone who has just arrived. Core spaces carry one too.
- Inline comments mark gaps: `# not-implemented` (declared, no code yet),
  `# not-applicable`, `# implicit` (done by convention, not by reading the
  manifest) and `# TODO`.
