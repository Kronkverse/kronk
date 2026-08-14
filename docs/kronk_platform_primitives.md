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

## Compose + confirmation

| Primitive                                     | What it does                                                                                                                                                                                                                                                                                               | Where                                                                                                                     |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `<ComposeShell>`                              | The floating composer overlay every korner's `/hub/<slug>/composer` renders inside. Portal, dim backdrop, korner-icon header, Cancel + Submit footer.                                                                                                                                                      | `components/compose_shell.tsx` + `styles/mastodon/_compose_shell.scss`. Decision: `docs/rebuild/decisions.md` 2026-08-12. |
| `<ComposeFab>` (the Ж bubble)                 | The single site-chrome entry point for any composer. Reads `compose.route` from manifests — no local FABs.                                                                                                                                                                                                 | `components/compose_fab.tsx`.                                                                                             |
| `<ConfirmDialog>` + `useConfirmDialog()` hook | The "are you sure?" primitive — delete / leave / cancel flows. Portal-mounted with a dim backdrop and destructive-CTA variant so the visual grammar matches `<ComposeShell>` (make vs confirm are variants of the same modal system). Hook returns `[dialog, confirm]` — `confirm(opts)` is Promise-based. | `components/confirm_dialog.tsx` + `hooks/useConfirmDialog.tsx` + `styles/mastodon/_kronk_confirm.scss`.                   |

## Audience / Reach

| Primitive                                                            | What it does                                                                                                  | Where                                                                                             |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `<ReachDropdown>`                                                    | The "who sees this?" control. Values: `self_only` / `mates` / `orbit` / `public`. Same vocabulary everywhere. | `components/reach_dropdown.tsx`. Spec: [`docs/kronk_feed_and_reach.md`](kronk_feed_and_reach.md). |
| `<ScopeMark>` + `<ScopeTitle>` + `<ScopeCarousel>` + `<ScopePicker>` | Reach-ring glyphs + scoping widgets that appear on feed cards and composers.                                  | `components/scope_*.tsx`.                                                                         |
| `useAvailableKrews`                                                  | Loads the user's Krews for the additive-krew axis on composers.                                               | `hooks/useAvailableKrews.ts`.                                                                     |
| `<KornerVisibilityPicker>` + `<KornerKrewPicker>`                    | Korner-scoped variants for narrower audience controls.                                                        | `components/korner_visibility_picker.tsx`, `korner_krew_picker.tsx`.                              |

## Feed & status projection

| Primitive                                                                                    | What it does                                                                                                                                                                                             | Where                                                                             |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `<StatusKornerCard>`                                                                         | The shared per-korner feed card frame. Every korner-projected status renders inside this — outer container, badge row, whole-card click-through, keyboard handling.                                      | `components/status_korner_card.tsx` + `styles/mastodon/_status_korner_card.scss`. |
| Per-korner status cards — `Status{Albutts,Booth,Event,Kommons,Kuestions,Trek,Wachuneed}Card` | Per-korner card bodies. **All seven wrap `<StatusKornerCard>` today** — the shell owns the badge + outer chrome, each card body handles korner-specific layout (RSVP buttons, vote counts, media grids). | `components/status_*_card.tsx`.                                                   |
| `<KornerCards>`, `<StatusSpaceBar>`, `<StatusKrewBadge>`                                     | Sub-parts of status/feed chrome.                                                                                                                                                                         | `components/korner_cards.tsx`, `status_space_bar.tsx`, `status_krew_badge.tsx`.   |

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

## Detail pages

| Primitive        | What it does                                                                                                                                                                                                               | Where                                                                  |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `<KornerDetail>` | The shell every korner's detail page mounts inside. Slots: `hero`, `banner`, `title` + `titleIcon`, `subtitle`, `meta`, `actions`, `children`. Mounts inside the `.stage-column` archetype with a detail-scoped 42rem cap. | `components/korner_detail.tsx` + `styles/mastodon/_kronk_detail.scss`. |
| `<KornerMeta>`   | The middle-dot metadata line under a title (`Tue 7pm · The Pier · 4 going · by @jane`). Falsy items filtered so conditionals can be inlined; owns the layout + separator + muted colour + `<strong>` emphasis.             | `components/korner_meta.tsx` + `styles/mastodon/_kronk_meta.scss`.     |

## Actions

| Primitive           | What it does                                                                                                                                                                                                     | Where                                                                          |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `<KornerActionBar>` | Flex-row layout for the row of pill actions under content (Invite / Edit / Delete on event detail, Join / Leave on Krew). Wraps on narrow phones. `align`: `start` / `end` / `center` / `between`.               | `components/korner_action_bar.tsx` + `styles/mastodon/_kronk_action_bar.scss`. |
| `<KornerPill>`      | Rounded pill button, icon slot + label + `default` / `primary` / `destructive` variants + `active` toggle state. Destructive matches `<ConfirmDialog>`'s warn-red so a delete-then-confirm reads as one gesture. | `components/korner_pill.tsx`.                                                  |

## State indicators

| Primitive        | What it does                                                                                                                                                                                                    | Where                                                                  |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `<EmptyState>`   | The rest-state pattern for a korner surface with no content ("Nothing coming up yet."). Muted centred title + optional body + optional trailing CTA. No icon slot (SpaceBadge already carries the korner icon). | `components/empty_state.tsx` + `styles/mastodon/_kronk_states.scss`.   |
| `<LoadingState>` | The transient counterpart. Wraps Mastodon's `<LoadingIndicator>` with Kronk-standard layout + an optional label; spinner sits inline (not absolute-centred) so the primitive drops into any container.          | `components/loading_state.tsx` + `styles/mastodon/_kronk_states.scss`. |

## Inter-korner communication

| Primitive                                      | What it does                                                                                                                                                                                                                                          | Where                                                                                                                                 |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Event bus (`emits:` / `listens:` in manifests) | Manifest declares outbound signals; other korners subscribe by name.                                                                                                                                                                                  | Framework loader in `config/initializers/kronk_korner_registry.rb`. Contract: [`docs/kronk_korner_spec.md`](kronk_korner_spec.md) §6. |
| Nudges pipeline                                | The shared notification substrate every korner sends alerts through.                                                                                                                                                                                  | `features/nudges_messenger/*` + `app/models/notification.rb`. Spec: [`docs/kronk_nudges.md`](kronk_nudges.md).                        |
| `useAttachments(slug, id)`                     | Read/create/remove cross-korner attachments (`spawn` / `link` / `reference`) for a source record. Hand-rolled state + `apiGet/Create/DeleteAttachment` under the hood; drives `<AttachmentSection>` and any composer that toggles a spawn attachment. | `hooks/useAttachments.ts` + `api/attachments.ts`. Spec: [`docs/kronk_korner_attachments.md`](kronk_korner_attachments.md) §4.1.       |
| `<AttachmentSection>`                          | Renders the "Attached" block on a detail page — list rows with the target korner's icon + a link, optional owner-only remove. Silent when the list is empty.                                                                                          | `components/attachment_section.tsx` + `styles/mastodon/_kronk_attachment.scss`. Spec §4.2.                                            |
| `<AttachmentPicker>`                           | Portal-mounted modal — target korner dropdown (from source manifest's `attaches:`) + debounced search of `/api/v1/attachments/candidates?korner=<slug>&q=<query>` + one-click attach. Piggybacks on the ComposeShell modal grammar.                   | `components/attachment_picker.tsx` + `styles/mastodon/_kronk_attachment.scss`. Spec §4.3.                                             |

---

## Where the spread bites

Three places you'll feel it when navigating:

1. **Header pieces are split** — `<KronkFrame>` in `components/`, its Membrane switcher in `features/ui/components/`, space-header pills in `components/`, some backup chrome still in `features/ui/`. Reading the header layer takes hopping between two directories.
2. **Compose primitives are together in `components/`, but the SCSS is split** — `_compose_shell.scss` is dedicated, each composer body's SCSS lives in that korner's `_<korner>.scss`. A full "how does compose work" read spans four files across three folders.
3. **Docs vs code split** — `docs/kronk_*.md` are cross-cutting; the normative korner doc is `docs/korners/korner_standard.md`. Easy to miss on a first pass.

None of these are worth reorganising the tree over (upstream-merge cost), but they are the reason this index doc exists.

---

## Candidates for future standardisation

The 2026-08-13 primitives sweep shipped five of the seven originally
listed here (`<EmptyState>` + `<LoadingState>`, `<KornerMeta>`,
`<ConfirmDialog>`, `<KornerActionBar>` + `<KornerPill>`,
`<KornerDetail>`) — each with a reference adopter in Kalendar or
event_detail. **StatusKornerCard sweep** turned out to be
already-done on inspection (all seven per-korner cards wrap the shell
today; the Kalendar manifest comment implying otherwise was stale and
was fixed in the same sweep). What's left:

| Candidate                              | What each korner writes today                                                                                                        | Roughly what the shared version looks like                                                                                                                                                                | Status                                                                                                                      |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **`<KornerTile>` / `<KornerListRow>`** | Booth tiles, Albutts covers, Hub tiles, Krew cards, Mate rows, Kalendar list rows — very similar rectangles, each with its own SCSS. | Two archetype-scoped card primitives: `<KornerTile>` for `.stage-grid` children, `<KornerListRow>` for `.stage-column` children. Body-content slot; padding, radius, hover state come from the primitive. | **Deferred** — Hub's tile has too much hub-specific chrome to be a clean reference adopter; revisit when a second surfaces. |

Backfill migrations that _could_ happen but aren't urgent: shipped
korners still writing their own `-shell` / `-actions` / `-empty` /
`-loading` / `-meta` / `-detail` blocks (Krew, Kommons, Albutts,
Booth, Kuestions, etc.) can adopt the corresponding primitive one
korner per PR, same pattern this sweep used.
