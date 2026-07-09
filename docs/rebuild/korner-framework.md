# Korner Framework and the Rebuild

Status: **foundation shipped in 1.7.0** (2026-07-09).

The Korner framework isn't the rebuild itself — it's the foundation the
rebuild sits on. What landed in 1.7.0 is the mechanism: manifest-driven
registration, shared card frame, boot validator, `tootctl korners`. The
rebuild will use it to introduce new Korners and consolidate existing
ones without touching the machinery.

## What's in place (as of 1.7.0)

- Manifest system — every space declares itself in
  `config/korners/*.yaml`; boot validator surfaces drift.
- Shared card frame — `StatusKornerCard` provides badge + border +
  space-colour derivation; per-Korner overrides via SCSS partials.
- JS card registry — `korner_cards.tsx`; adding a Korner card is one
  entry.
- CLI: `bin/tootctl korners list`.
- Docs:
  - Spec: [`docs/kronk_korner_spec.md`](../kronk_korner_spec.md)
  - Walkthrough: [`docs/korners/adding_a_korner.md`](../korners/adding_a_korner.md)
  - Anatomy: [`docs/korners/anatomy.md`](../korners/anatomy.md)

## What's still to build (rebuild scope)

Ordered by spec priority:

1. **Subscription primitive** (spec §8.6, universal MUST-HAVE gap) —
   changes what a Korner *is* from "a place that exists" to "a place you
   subscribe to and get contextual visibility of." Cascades across all
   six main Korners at once. This is likely the next standalone PR
   before or as part of the rebuild.
2. **`/hub/<slug>` URL grammar** — every Korner currently mounts at
   `/<slug>`; spec §4 wants `/hub/<slug>`. Needs a Hub view to exist
   first, or introduce redirects. Aligns with the domain migration
   pattern (redirect from old to new).
3. **DO Spaces media paths** (`spaces/<slug>/`) — every Korner uses
   Mastodon defaults today; spec §5 wants per-slug prefix. Storage
   hygiene.
4. **Aesthetic tokens** (spec §6) — shared design token file each
   Korner derives from.
5. **Single authorization layer** (spec §7) — each Korner authorises
   independently right now.
6. **Feature-flag gates** (spec §9) — nothing gates any Korner today.

## Rebuild integration points

Areas where the rebuild's decisions touch what's shipped:

- **Manifest schema evolution** — as new fields become load-bearing
  (subscription, feature flag, hub-registration), we add them to the
  manifests. Backwards-compat pattern already established.
- **Migration from `/<slug>` to `/hub/<slug>`** — coordinate with the
  `mastodon.kronk.info` → `kronk.info` redirects. Same pattern, same
  nginx config surface.
- **Registry entry shape** — the JS registry can grow more shape as the
  spec matures (e.g., declaring which surfaces the card renders on).

## Not in scope for the rebuild

The framework itself doesn't need to be rebuilt — it needs to be
extended. If a decision would require breaking the manifest shape or the
registry contract, we flag it here and version-bump accordingly.
