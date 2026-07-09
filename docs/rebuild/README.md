# Kronk 2.x Rebuild

Working space for the next major Kronk release. Ideas, plans, decisions,
and open questions accumulate here as they surface — this is the
capture surface, not a finished spec.

The Korner framework (shipped in 1.7.0) and the `mastodon.kronk.info` →
`kronk.info` URL migration are both being folded into the rebuild rather
than shipped as standalone changes. Anything else that shows up as "let's
do this properly in the rebuild" belongs here too.

## How to add to this space

- **If your idea fits an existing themed file**, append there. Keep the
  file focused on its theme; don't overload.
- **If nothing fits**, create a new themed file: `docs/rebuild/<theme>.md`.
  Filenames short, kebab-case, topic-focused (e.g. `url-migration.md`,
  `identity.md`, `content-model.md`).
- **Update this README's index below** when you add a new file.
- **Rough notes are fine.** This isn't a spec you're finalising; it's a
  place to catch the idea before it gets lost.

## Themed files

- [`url-migration.md`](./url-migration.md) — `mastodon.kronk.info` →
  `kronk.info` migration plan. Approved as part of the rebuild; not
  shipping standalone.
- [`korner-framework.md`](./korner-framework.md) — how the Korner
  framework work (shipped as 1.7.0) fits into the rebuild foundation.
