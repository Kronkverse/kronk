# Kronk platform primitives — index

The one file to `git grep` when you're about to write something new and want to
know if the platform already has a shared version.

Kronk's standardised pieces are spread by **kind**, not by "standards" bucket
— shared components live in `app/javascript/mastodon/components/`, hooks in
`hooks/`, framework config in `config/`, docs in `docs/`. That layout keeps
upstream Mastodon merges tractable (nothing lives in Kronk-only folders that
Mastodon might collide with) but it also means there is no single directory
you can eyeball to see "what have we already built?"

This doc is that directory. **Index only** — for how each primitive works,
read the file itself; for the norms, read the linked spec.

**When you add a new shared primitive, add a row here.** When you notice a
row that no longer matches reality, fix the row _and_ the primitive in the
same PR.

---

## Layout & Chrome

| Primitive                                                                           | What it does                                                                                                                  | Where                                                                                                                                                             |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<KronkFrame>`                                                                      | The invariant grid every route mounts inside — top membrane, right sidebar (desktop) / bottom nav (phone), Stage cell.        | `app/javascript/mastodon/components/kronk_frame.tsx` + `styles/mastodon/_kronk_frame.scss` + `_kronk_chrome.scss`. Spec: [`docs/kronk_frame.md`](kronk_frame.md). |
| `<Stage>`                                                                           | The single well-defined rectangle every korner paints into. Owns scroll, border-box for children, kills body scrollbar.       | `components/stage.tsx` + `styles/mastodon/_kronk_stage.scss`.                                                                                                     |
| Stage archetypes — `.stage-fill` / `.stage-column` / `.stage-grid`                  | Three shared shapes for a Stage-child so korners stop each writing their own `-shell` wrapper. Vertical scroll only.          | `styles/mastodon/_kronk_stage.scss`. Decision: `docs/rebuild/decisions.md` 2026-08-13.                                                                            |
| `<SpaceHeaderRow>` + `<SpaceBadge>` + `<AutoSpaceHeader>` + `<AutoSpaceViewPicker>` | The header row at the top of every korner — back badge (left), rotating title (centre), view picker (right). Manifest-driven. | `components/space_header_row.tsx`, `space_badge.tsx`, `auto_space_header.tsx`, `auto_space_view_picker.tsx`.                                                      |
| `<FeedDrum>`                                                                        | The quarter-turn spindle animation for face-switching (used by `/home` and Kalendar).                                         | `features/home_timeline/components/feed_drum.tsx`.                                                                                                                |
| `<KornerShell>` (legacy)                                                            | Older per-korner wrapper. Retires as each korner moves onto Stage + archetypes.                                               | `components/korner_shell.tsx`. **Do not use for new korners.**                                                                                                    |
| `<KronkStarfield>`                                                                  | Shared ambient purple starfield backdrop.                                                                                     | `components/kronk_starfield.tsx` + `styles/mastodon/_stars.scss`.                                                                                                 |

## Compose

| Primitive                     | What it does                                                                                                                                          | Where                                                                                                                     |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `<ComposeShell>`              | The floating composer overlay every korner's `/hub/<slug>/composer` renders inside. Portal, dim backdrop, korner-icon header, Cancel + Submit footer. | `components/compose_shell.tsx` + `styles/mastodon/_compose_shell.scss`. Decision: `docs/rebuild/decisions.md` 2026-08-12. |
| `<ComposeFab>` (the Ж bubble) | The single site-chrome entry point for any composer. Reads `compose.route` from manifests — no local FABs.                                            | `components/compose_fab.tsx`.                                                                                             |

## Audience / Reach

| Primitive                                                            | What it does                                                                                                  | Where                                                                                             |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `<ReachDropdown>`                                                    | The "who sees this?" control. Values: `self_only` / `mates` / `orbit` / `public`. Same vocabulary everywhere. | `components/reach_dropdown.tsx`. Spec: [`docs/kronk_feed_and_reach.md`](kronk_feed_and_reach.md). |
| `<ScopeMark>` + `<ScopeTitle>` + `<ScopeCarousel>` + `<ScopePicker>` | Reach-ring glyphs + scoping widgets that appear on feed cards and composers.                                  | `components/scope_*.tsx`.                                                                         |
| `useAvailableKrews`                                                  | Loads the user's Krews for the additive-krew axis on composers.                                               | `hooks/useAvailableKrews.ts`.                                                                     |
| `<KornerVisibilityPicker>` + `<KornerKrewPicker>`                    | Korner-scoped variants for narrower audience controls.                                                        | `components/korner_visibility_picker.tsx`, `korner_krew_picker.tsx`.                              |

## Feed & status projection

| Primitive                                                                                    | What it does                                                                                                                     | Where                                                                             |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `<StatusKornerCard>`                                                                         | The shared per-korner feed card frame. Every korner-projected status **should** render inside this — see "half-done" note below. | `components/status_korner_card.tsx` + `styles/mastodon/_status_korner_card.scss`. |
| Per-korner status cards — `Status{Albutts,Booth,Event,Kommons,Kuestions,Trek,Wachuneed}Card` | Legacy per-korner cards. Being folded into `StatusKornerCard` — Kalendar manifest documents this as a live migration goal.       | `components/status_*_card.tsx`.                                                   |
| `<KornerCards>`, `<StatusSpaceBar>`, `<StatusKrewBadge>`                                     | Sub-parts of status/feed chrome.                                                                                                 | `components/korner_cards.tsx`, `status_space_bar.tsx`, `status_krew_badge.tsx`.   |

## Korner framework

| Primitive                                 | What it does                                                                                                   | Where                                                                                                                                                          |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Korner Registry                           | Loads every `config/korners/*.yaml` at boot, warns on drift, powers `Kronk::Korner.for(slug)`.                 | `config/initializers/kronk_korner_registry.rb`. Spec: [`docs/kronk_korner_spec.md`](kronk_korner_spec.md).                                                     |
| Korner manifests                          | Single source of truth for a korner's identity, resources, security, feed projection, settings, compose, tree. | `config/korners/*.yaml`. Reference: [`docs/korners/adding_a_korner.md`](korners/adding_a_korner.md).                                                           |
| Reserved slugs                            | Slugs a korner cannot claim.                                                                                   | `config/korners/reserved_slugs.yaml`.                                                                                                                          |
| `useKorner(slug)` + `useKornerIcon(slug)` | Read manifest data (icon, name, tagline, colour) from React.                                                   | `hooks/useKorner.ts`, `hooks/useKornerIcon.tsx`.                                                                                                               |
| The Korner Standard (L1–L10 conformance)  | Normative spec every korner must satisfy.                                                                      | [`docs/korners/korner_standard.md`](korners/korner_standard.md). **Read before touching a manifest.**                                                          |
| `bin/tootctl korners doctor`              | Boot validator + CI check enforcing the ⚙︎-marked Standard layers.                                            | `bin/tootctl` + `.github/workflows/korners-doctor.yml`. `continue-on-error: true` today; graduates to a required gate when the debt on `rebuild/2.0.0` clears. |
| `<KornerIframe>`                          | Wrapper for legacy/HTML korners still mounted via iframes.                                                     | `components/korner_iframe.tsx`.                                                                                                                                |
| `<KornerGlyph>`                           | The `material:` icon lookup that resolves per-manifest to a shared icon.                                       | `components/korner_glyph.tsx`.                                                                                                                                 |

## Design tokens & aesthetic system

| Primitive                      | What it does                                                                                                                     | Where                                                                                       |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `tokens.yaml` → `_tokens.scss` | Single design-token source; generated into SCSS by `bin/generate-tokens`. Never hand-edit the SCSS.                              | `app/javascript/mastodon/tokens/tokens.yaml` → `styles/mastodon/_tokens.scss`.              |
| Stylelint custom rules         | Enforce no raw hex (use `--kronk-*` / `--semantic-*` / `color-mix()`), `border-radius` must reference a `--radius-*` token, etc. | `stylelint.config.js`. Spec: [`docs/kronk_aesthetic_system.md`](kronk_aesthetic_system.md). |

## Krew primitive (the audience axis)

| Primitive                        | What it does                                          | Where                                                                                  |
| -------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `Krew` model + `KrewKorner` join | The user-facing group primitive, orthogonal to reach. | `app/models/krew.rb`, `krew_korner.rb`. Spec: [`docs/spaces/krew.md`](spaces/krew.md). |
| `useAvailableKrews`              | Composer-side hook (see Audience above).              | `hooks/useAvailableKrews.ts`.                                                          |
| `<KornerKrewPicker>`             | Korner-scoped picker for scoping to specific Krews.   | `components/korner_krew_picker.tsx`.                                                   |

## Inter-korner communication

| Primitive                                      | What it does                                                         | Where                                                                                                                                 |
| ---------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Event bus (`emits:` / `listens:` in manifests) | Manifest declares outbound signals; other korners subscribe by name. | Framework loader in `config/initializers/kronk_korner_registry.rb`. Contract: [`docs/kronk_korner_spec.md`](kronk_korner_spec.md) §6. |
| Nudges pipeline                                | The shared notification substrate every korner sends alerts through. | `features/nudges_messenger/*` + `app/models/notification.rb`. Spec: [`docs/kronk_nudges.md`](kronk_nudges.md).                        |

---

## Where the spread bites

Three places you'll feel it when navigating:

1. **Header pieces are split** — `<KronkFrame>` in `components/`, its Membrane switcher in `features/ui/components/`, space-header pills in `components/`, some backup chrome still in `features/ui/`. Reading the header layer takes hopping between two directories.
2. **Compose primitives are together in `components/`, but the SCSS is split** — `_compose_shell.scss` is dedicated, each composer body's SCSS lives in that korner's `_<korner>.scss`. A full "how does compose work" read spans four files across three folders.
3. **Docs vs code split** — `docs/kronk_*.md` are cross-cutting; the normative korner doc is `docs/korners/korner_standard.md`. Easy to miss on a first pass.

None of these are worth reorganising the tree over (upstream-merge cost), but they are the reason this index doc exists.

---

## Candidates for future standardisation

Written down for review, not committed. Each row is duplication that already
exists across korners — a shared primitive would delete N per-korner
implementations. Rough order = pain × frequency.

| Candidate                              | What each korner writes today                                                                                                                                                                                                             | Roughly what the shared version looks like                                                                                                                                                                |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`<KornerDetail>` shell**             | `event_detail.tsx`, `krew_detail.tsx`, `album_detail.tsx`, `proposal_page.tsx`, `space_page.tsx`, `booth_set_page.tsx` all re-implement: title strip + meta line + action bar + body sections + related-activity tail.                    | A wrapper that provides those slots + the standard back-nav + the standard scroll shape. Body content stays korner-specific.                                                                              |
| **StatusKornerCard sweep**             | 7 legacy per-korner cards (`StatusEventCard`, `StatusAlbuttsCard`, `StatusBoothCard`, `StatusKommonsCard`, `StatusKuestionsCard`, `StatusTrekCard`, `StatusWachuneedCard`). Kalendar manifest calls this out as an outstanding migration. | Fold each into `StatusKornerCard` with a per-korner content slot. Half of the standardisation is already done — this is completing it, not designing something new.                                       |
| **`<EmptyState>` + `<LoadingState>`**  | `.kalendar-list__state`, `.krew-page__loading`, `.krew-page__error`, `.event-composer__error`, and probably one per Albutts / Booth / Kommons.                                                                                            | Two tiny primitives with an optional CTA slot. Cheap; universal.                                                                                                                                          |
| **`<ConfirmDialog>`**                  | Every "delete this?" / "leave the Krew?" / "cancel your RSVP?" reaches for `dispatch(openModal(...))` or a hand-rolled `<Modal>`. Post-ComposeShell, this is the next-most-frequent bespoke overlay.                                      | A tiny modal primitive with title + body + destructive-CTA + cancel. Same shape everywhere so the destructive interaction reads as one thing.                                                             |
| **Korner action bar**                  | The row of pill buttons under a title (RSVP / Vote / Join / Attend / Play). Visual pattern is identical; semantics differ; each korner writes both.                                                                                       | A `<KornerActionBar>` layout + a shared pill-button variant. Actions stay korner-specific; the strip stops being re-styled.                                                                               |
| **`<KornerTile>` / `<KornerListRow>`** | Booth tiles, Albutts covers, Hub tiles, Krew cards, Mate rows, Kalendar list rows — very similar rectangles, each with its own SCSS.                                                                                                      | Two archetype-scoped card primitives: `<KornerTile>` for `.stage-grid` children, `<KornerListRow>` for `.stage-column` children. Body-content slot; padding, radius, hover state come from the primitive. |
| **Detail metadata line**               | `<by @user · 2h ago · @location>` under a title. Every detail page and every card writes its own version.                                                                                                                                 | A single `<KornerMeta>` component. Cheap.                                                                                                                                                                 |

None of these are urgent. The pattern for landing them is the same as the
Stage archetypes + ComposeShell: **write the primitive, migrate one reference
adopter, leave the shipped korners for follow-up PR-by-PR sweeps.**
