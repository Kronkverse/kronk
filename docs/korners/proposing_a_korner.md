# Proposing a Korner

Discovery-phase companion to [`adding_a_korner.md`](./adding_a_korner.md). When someone suggests a new korner, use this doc to run the standard **two-round question flow** that produces:

- A draft `docs/spaces/<slug>.md` in the repo (PR).
- A skeleton `config/korners/<slug>.yaml` manifest with `enforced: false` + `lifecycle: soon` (per Korner Standard §L1 golden rule).
- An entry in `docs/spaces/README.md` index.

`adding_a_korner.md` picks up from that skeleton and walks the code work end to end.

---

## Read this first

Before authoring anything: [`korner_standard.md`](./korner_standard.md). The Standard's L1–L7 (identity, data, API, projection, mount, tree, aesthetic) is what a live korner must satisfy; a `soon`-stage stub still owes L1 + L5 + L6 + L7. Skipping this step is what got the YOU-korner initial ship non-conformant (see PR #354 → PR #355 retrofit).

Also verify the proposed slug against `config/korners/reserved_slugs.yaml` — reserved platform stems can't be claimed.

---

## Round 1 — ten topics

The canonical opening set. Ask in one or two batches via `AskUserQuestion` (mode allows 1–4 questions per call). Answers map directly to manifest fields; the Round 1 output IS the initial draft.

| # | Topic | Format | Maps to manifest field |
|---|---|---|---|
| 1 | **Description** — what is this korner for? | Open free-text | `hub_teaser.static` / `launch.blurb` |
| 2 | **Primary content unit** — what do users create here? | Open free-text | `resources:` (models) |
| 3 | **Composer** — does the korner need one? | Y/N (drill in R2 if Y) | UI + `write:` permissions |
| 4 | **Visibility** — public / mates / krew-scoped / direct? | Multi-select | `security.visibility_scopes:` |
| 5 | **Storage/media** — does it host media (audio/video/images/files)? | Y/N (drill in R2 if Y) | `storage.media_prefix:` |
| 6 | **Notifications** — does the korner emit any? | Y/N (drill in R2 if Y) | `notifications:` block |
| 7 | **Feed card** — does content project into Home feed? | Y/N (drill in R2 if Y) | `feed_projection:` block |
| 8 | **Kategory-taggable** — do items carry curated Kategory tags? | Y/N | `tags` gating |
| 9 | **Cross-korner connections** — what other korners does this touch, and how? | Open free-text | `emits:` + `listens:` |
| 10 | **User-facing settings** — does the korner give users toggles/preferences to control it? | Y/N (drill in R2 if Y) | `settings:` block + Korner Standard §L8 |

### Suggested Round 1 batching

- **Batch A** (open text, framing): Q1 description + Q2 content unit + Q9 connections.
- **Batch B** (Y/N + multi-select): Q3 composer + Q4 visibility + Q5 storage/media.
- **Batch C** (Y/N structural): Q6 notifications + Q7 feed card + Q8 kategory + Q10 settings.

Three calls total. Adjust as makes sense for the shape of the korner being discussed.

---

## Round 2 — drilldowns

Round 2 drills into whichever Round 1 answer came back "yes" or needs sharpening. Only run the drilldowns that apply.

**If composer = yes:**

- What's the compose action? (post short text / propose a change / list an item for sale / upload audio / schedule a session / etc.)
- What are the required vs optional fields on the composer?
- What's the "post" button call to action?

**If notifications = yes:**

- What events trigger a notification? (per-notification `subject_type`)
- Default push on/off per type? (`default_push`)
- Aggregation window/key? (avoid flooding)
- Interactive (a nudge that opens something) or notice-only?

**If feed card = yes:**

- What appears on the card? (title source, summary source, thumbnail, cta)
- When does the card appear in a viewer's feed? (creator's mates? tune-in only? kategory-follow? krew members?)
- What audience sees it? (`default_visibility`)
- What does tapping the card do? (`links_to` URL grammar)

**If user-facing settings = yes:**

- Which settings? Enumerate each with `kind` (boolean / integer / string / enum / multi_enum / time), `default`, `scope` (`user` for per-account, `group`/`korner` for per-scope), and a short human `label` + `description`.
- Which live at `/hub/<slug>/settings` (per-korner) vs `/settings/*` (account-global)?
- Any tune-in gate settings? (Notification opt-in per type is often a settings-level toggle: `notify_on_<event>` booleans mirroring the `notifications:` block.)
- Any settings that carry sovereignty implications? (E.g., Klot's `share_phase_publicly` — "even when on, only accounts you've granted a KlotShare to see it. Raw dates never leave your account.")

**Cross-korner connections (from Q9):**

- Exact emit event names + payload shapes (e.g. `cinema.screening.started` payload: `screening_id, host_account_id`).
- Which korners listen and what they do with the payload.
- Any bidirectional patterns (event ↔ Krew, etc.).

**Optional Round 3** — anything still open. Not every korner needs one. Kuestions, Krew, Kalendar, Kommons, Marketplace each ran a Round 3 during the 2.0 rebuild; simpler korners settled in two rounds.

---

## Artefacts

Once Round 1 and any Round 2 drilldowns land, produce three artefacts in a single PR against `rebuild/2.0.0`:

### 1. `docs/spaces/<slug>.md` — the space doc

Same shape as the existing per-space docs (see `docs/spaces/kuestions.md`, `docs/spaces/marketplace.md` for reference structure). Standard sections:

- **Purpose** — what the korner is for (from Q1 description)
- **Current shape** — "not shipped yet" note; models/routes to come per Standard §L2
- **Rebuild vision** — the shape locked in from Round 1/2 answers
- **Open decisions** — anything still unresolved
- **Related** — cross-links to `korner_standard.md`, other space docs it touches, `adding_a_korner.md`

### 2. `config/korners/<slug>.yaml` — the manifest skeleton

`enforced: false`, `lifecycle: soon` per Standard §L1. Fill in the fields Round 1 answered (`slug`, `name`, `icon`, empty `resources`, nested `security:` block with the visibility scopes chosen, `feed_projection` if applicable, `nodes:` block with the `<slug>.index` node at `lifecycle: soon`).

Slug follows the Standard §L1 slug rules: one lowercase word (no hyphens/underscores), matches the yaml filename, not in `reserved_slugs.yaml`.

### 3. `docs/spaces/README.md` — add the new space

One new row in the korner-spaces table pointing at the new doc, with the manifest link + a short status note.

---

## What happens next

After the discovery-PR merges:

- Cross-korner ripples flagged in Q9 update the touched korners' `docs/spaces/<slug>.md` files as needed (separate PRs).
- When the team is ready to build the korner for real, `adding_a_korner.md` walks the code work from the manifest skeleton this discovery process produced.
- `bin/tootctl korners doctor` will already gate the manifest against Standard §3 conformance checks; the skeleton needs to pass its stage's required layers (§1 lifecycle gate).

---

## References

- Normative: [`korner_standard.md`](./korner_standard.md), [`../kronk_korner_spec.md`](../kronk_korner_spec.md), [`../kronk_settings_ia.md`](../kronk_settings_ia.md).
- Build walkthrough: [`adding_a_korner.md`](./adding_a_korner.md).
- Visual companion: [`anatomy.md`](./anatomy.md).
- Aesthetic tokens: [`../kronk_aesthetic_system.md`](../kronk_aesthetic_system.md).
- Existing space docs: [`../spaces/`](../spaces/) — reference structure examples.
