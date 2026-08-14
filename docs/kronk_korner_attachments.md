# Kronk — Korner Attachments

> **Status.** Design spec, decided 2026-08-14. Normative — this is the shape
> code must follow when implementing the cross-korner attachment primitive.
> Implementation is intentionally NOT started at spec time: nail the shape
> first, then build.
>
> **Read this correctly.** The decisions in §0 are authoritative. The
> §7 open items are genuinely undecided and must not be treated as settled.
>
> **Precedence.** If code and this doc disagree, code wins — but that
> means one of the two is wrong. Fix the mismatched side in the same PR
> that surfaces it (`docs/rebuild/decisions.md` 2026-07-19 lesson).

---

## 0. Decisions (authoritative)

1. **Every cross-korner connection lives in one place — the `korner_attachments` table** — instead of per-pair FK columns on individual korner tables. Existing pairs (`album.event_id`, `booth_set.event_id`) migrate to this table in Phase 3 (§5) but keep their FK columns as a passive mirror for backward-compat during the transition.
2. **Attachments are keyed by manifest slug + record id, not Rails polymorphic type.** The manifest is already the registry of what a korner is; reuse it. `Kronk::KornerRegistry.model_for("albutts")` returns the AR class. No `type` string on the row (Rails polymorphic conventions) — slug is stable across renames + reads cleanly in SQL logs.
3. **The manifest declares what attaches to what.** A korner cannot receive attachments from a korner that doesn't list it as a target — validated by `bin/tootctl korners doctor`, enforced at API-time by `KornerAttachmentPolicy#can_attach?`. Bidirectional consent is default; wildcard (`to: '*'`) is opt-in when a korner explicitly wants to be attachable from anywhere.
4. **Three kinds, one table:** `spawn` (auto-created by a source-side trigger, cascade-delete), `link` (user-added, independent lifecycle), `reference` (passive, always independent). Extend by adding new kinds — don't extend by adding new tables.
5. **The composer and detail pages get shared React primitives** (`useAttachments`, `<AttachmentSection>`, `<AttachmentPicker>`) — a new row on the platform primitives index (`docs/kronk_platform_primitives.md`). New korners inherit the UX for free.

Everything below elaborates these.

---

## 1. Motivation

Kronk has three shipped cross-korner connections today, each bespoke:

| From           | To             | Shape                                                                                                   |
| -------------- | -------------- | ------------------------------------------------------------------------------------------------------- |
| Kalendar Event | Albutts Album  | `album.event_id` FK + `kalendar.event.created` subscriber in `config/initializers/albutts_event_bus.rb` |
| Kalendar Event | Booth Set      | `booth_set.event_id` FK; set via `event_id` param on booth-set create                                   |
| Kalendar Event | Huddle Session | `event.huddle_session_id` FK + `huddle` listens for `kalendar.event.created`                            |

Each new pair is a new column, a new subscriber, and a new UI. Doing this five more times (Kommons → Kalendar for a "voting deadline event," Booth → Martketplace for "buy the DJ's release," Nudges → Any-korner for "remind me about this") multiplies the surface area without any of the pairs sharing behaviour.

This spec introduces **one** join table and **one** manifest field so any future korner-to-korner connection is a config change + a UI wiring, not a schema migration + a bespoke subscriber.

---

## 2. Data model

### 2.1 The `korner_attachments` table

```
Column                     | Type       | Notes
---------------------------|------------|-----------------------------------------------
id                         | bigint pk  |
source_slug                | string     | Kronk::KornerRegistry slug, e.g. "kalendar"
source_id                  | bigint     | id in that korner's primary resource table
target_slug                | string     |
target_id                  | bigint     |
kind                       | string     | "spawn" | "link" | "reference"
metadata                   | jsonb      | kind-specific, nullable
created_by_account_id      | bigint fk  | who created the row (author of the source
                                          record for `spawn`; the user who clicked
                                          "Attach" for `link` / `reference`)
created_at                 | datetime   |
updated_at                 | datetime   |

Indexes:
  - (source_slug, source_id)
  - (target_slug, target_id)
  - (source_slug, source_id, target_slug, target_id, kind) UNIQUE
```

**Uniqueness key includes `kind`** so the same two records can carry both a `spawn` attachment and a later user `link` without collision (edge case, but the constraint should not artificially prevent it).

**No FK on `source_id` / `target_id`** — Rails polymorphic-ish, without the `_type` column. Referential integrity is application-level; the model handles orphan cleanup (§2.3).

### 2.2 The manifest field

Each korner's `config/korners/<slug>.yaml` declares what it attaches to and what it accepts:

```yaml
# kalendar.yaml
attaches:
  # This korner may create attachments where source = kalendar/<event.id>.
  # Each entry describes ONE (target, kind) combination.
  - to: albutts
    kind: spawn
    trigger: field:spawn_album # auto-create when `event.spawn_album` is true
    lifecycle: cascade # remove attachment when source event is deleted

  - to: booth
    kind: link
    trigger: user # user clicks "Attach a booth set"
    lifecycle: keep # deleting the event doesn't touch the booth set link

accepts:
  # This korner may receive attachments where target = kalendar/<event.id>.
  # An empty list means no korner may attach TO this one. Wildcard `*` = anyone.
  - from: nudges
    kind: reference # a Nudge can `reference` an event (e.g. a reminder)
```

- `attaches` = "I can be the source of these attachments."
- `accepts` = "I can be the target of these attachments."
- Both sides must agree — a Kalendar event can only attach to an Albutts album if `albutts.yaml` also has `accepts: [{ from: kalendar, kind: spawn }]` (or `{ from: '*', kind: spawn }`). `korners doctor` fails the boot check when consent is missing.

**Why bidirectional consent:** stops a korner drive-by-attaching to another one without the target korner's opt-in. Matches how `emits:` / `listens:` already work in Kronk's event bus.

### 2.3 Model: `KornerAttachment`

Approximate shape (illustrative — final signatures come with the code):

```ruby
class KornerAttachment < ApplicationRecord
  belongs_to :created_by, class_name: 'Account', foreign_key: :created_by_account_id

  KIND_SPAWN     = 'spawn'
  KIND_LINK      = 'link'
  KIND_REFERENCE = 'reference'
  KINDS = [KIND_SPAWN, KIND_LINK, KIND_REFERENCE].freeze

  validates :source_slug, :target_slug, presence: true
  validates :kind, inclusion: { in: KINDS }
  validate  :manifests_agree
  validate  :records_exist

  scope :from_source, ->(slug, id) { where(source_slug: slug, source_id: id) }
  scope :to_target,   ->(slug, id) { where(target_slug: slug, target_id: id) }

  def source_record = Kronk::KornerRegistry.model_for(source_slug).find_by(id: source_id)
  def target_record = Kronk::KornerRegistry.model_for(target_slug).find_by(id: target_id)

  private

  def manifests_agree
    # source manifest must list this (target_slug, kind) in `attaches`
    # target manifest must list this (source_slug, kind) in `accepts`
    # (with '*' wildcards honoured)
  end

  def records_exist
    errors.add(:source_id, 'source record missing') if source_record.nil?
    errors.add(:target_id, 'target record missing') if target_record.nil?
  end
end
```

**Orphan cleanup:** when a source record is destroyed, its `spawn`-kind attachments AND their target records cascade-delete (matches "spawn" semantics — the target exists BECAUSE of the source). `link` and `reference` attachments only remove the join row; the target record survives. Cleanup lives in the source model:

```ruby
class Event < ApplicationRecord
  after_destroy :cleanup_korner_attachments

  private

  def cleanup_korner_attachments
    attachments = KornerAttachment.from_source('kalendar', id)
    attachments.where(kind: 'spawn').each do |a|
      a.target_record&.destroy
      a.destroy
    end
    attachments.where.not(kind: 'spawn').destroy_all
  end
end
```

The above becomes a shared `Kronk::AttachmentSource` concern that any korner includes; no per-korner boilerplate.

### 2.4 Triggers

`spawn` attachments fire from the source-side model. Two trigger flavours declared in the manifest:

- `field:<name>` — when `record.<name>` is truthy on create, spawn. Existing `spawn_album` becomes `attaches[to: albutts, kind: spawn, trigger: field:spawn_album]`.
- `event:<korner-bus-event>` — when the named event bus event fires. Replaces the current `albutts_event_bus.rb` subscriber shape; the framework registers the subscriber on the target korner's behalf based on the manifest.
- `user` — no trigger; `link` and `reference` rows are created explicitly by a user action via the API.

The trigger runs a small factory the target korner registers (see §3.2 for how new-record shape is discovered).

---

## 3. API surface

### 3.1 REST endpoints

```
GET    /api/v1/attachments?source=<slug>/<id>
       → [{ id, target_slug, target_id, kind, target: <serialised record> }, …]

GET    /api/v1/attachments?target=<slug>/<id>
       → same shape, target's-eye view

POST   /api/v1/attachments
       body: { source_slug, source_id, target_slug, target_id, kind, metadata? }
       → the created attachment row; 422 with the manifest-consent message
         if the two manifests don't agree.

DELETE /api/v1/attachments/:id
       → 204; only the row creator, source record owner, or target record
         owner may delete.
```

Guards in `KornerAttachmentPolicy`:

- `create`: user must own the source record (or be an admin/invitee if the source has one of those roles).
- `destroy`: user must own the source, own the target, or be the row's `created_by`.
- `index`: user must be able to see both endpoints of the attachment — if a private album is attached to a public event, someone with view access to the event but not the album shouldn't see it in the list. Filter at query time.

### 3.2 Spawn factory registration

When a manifest declares an attachment with `trigger: field:X` or `trigger: event:Y`, the target korner needs to register a factory that turns "source record + spawn intent" into "target record." At boot:

```ruby
# in an initializer under each korner
Kronk::AttachmentFactories.register(
  source: 'kalendar',
  target: 'albutts',
  kind: 'spawn',
) do |source_record, metadata|
  Album.create!(
    owner: source_record.account,
    title: source_record.title,
    description: source_record.description.presence,
    visibility: :public
  )
end
```

The framework wires the trigger (source-side field / bus event) to the factory. Retires the bespoke subscriber in `config/initializers/albutts_event_bus.rb` — that file gets deleted in Phase 3.

---

## 4. React primitives

Adds three rows to the platform primitives index (`docs/kronk_platform_primitives.md`):

### 4.1 `useAttachments(korner, id)`

```ts
const { attached, loading, addLink, removeLink } = useAttachments(
  'kalendar',
  event.id,
);
```

- `attached` — `Array<{ id, target_slug, target_id, kind, target: any }>`, grouped by target_slug for rendering
- `loading` — boolean
- `addLink(target_slug, target_id, kind?)` — POST /attachments
- `removeLink(attachment_id)` — DELETE /attachments/:id

Uses SWR-shaped caching so multiple components on the same page share one fetch.

### 4.2 `<AttachmentSection>`

Renders the "Attached" block on any korner detail page:

```tsx
<AttachmentSection korner='kalendar' recordId={event.id} />
```

Groups by target korner, uses each korner's own card component for the rendered rows (via the korner icon + a link to the target record). Owners of the source record see an "Add attachment" button that opens `<AttachmentPicker>`.

Sits inside a `.stage-column` (or wherever the caller mounts it). Zero configuration — the manifest declares the valid targets, so the picker knows what korners to offer.

### 4.3 `<AttachmentPicker>`

Modal (portal-mounted, ComposeShell grammar): pick a target korner from the dropdown, then search records within that korner. Same visual family as `<MapPinPicker>` / `<ConfirmDialog>` — shared modal aesthetics.

Search reuses the korner's own search endpoint (declared in manifest as `search_endpoint`, e.g. `/api/v1/albums?q=`), or falls back to a generic `/api/v1/attachments/candidates?korner=<slug>&q=<query>` shared endpoint.

---

## 5. Migration path (phased)

| Phase | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Ships                           |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| 0     | This spec (`docs/kronk_korner_attachments.md`) + decisions.md entry. No code.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | ✓ (this PR)                     |
| 1     | Schema + model + policy + REST API + `korners doctor` validation for `attaches:` / `accepts:` manifest fields. Ships without a UI; internal API only. Registers no korners' attachments yet (all existing pairs stay bespoke).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `korner_attachments` table live |
| 2a    | React primitives that don't need per-korner support: `useAttachments` hook + `<AttachmentSection>` (read + owner remove). Add rows to `docs/kronk_platform_primitives.md`. No korner adopts yet — the primitives read/write the API but the source manifests still don't opt in via `attaches:`, so mounting `<AttachmentSection>` renders empty. Isolates the client work from the manifest opt-in that arrives with Phase 3.                                                                                                                                                                                                                                                                                                      | Primitives available            |
| 2b    | `<AttachmentPicker>` modal + shared `GET /api/v1/attachments/candidates?korner=<slug>&q=<query>` endpoint (`Kronk::KornerRegistry.model_for` + `title` / `name` / `display_name` ILIKE + visibility-scoped to `current_account`). `<AttachmentSection>` gains an "Attach…" button when the viewer owns the source and the source manifest declares at least one non-wildcard, non-spawn target. Adds `attaches:` / `accepts:` to `ApiKornerJSON` + `REST::V1::KornerSerializer` so the picker can read what targets a source may reach.                                                                                                                                                                                             | Attach flow surfaced            |
| 3     | First opt-ins land — Kalendar → Albutts (spawn) + Kalendar → Booth (link) via manifest `attaches:` / `accepts:`. New `Kronk::AttachmentFactories` registry + `Kronk::AttachmentSource` model concern: source models include the concern, declare `attachment_source_slug`, and their manifest's `attaches` entries drive spawn factories on create + cascade cleanup on destroy. Backfill migration copies existing `album.event_id` + `booth_set.event_id` rows into `korner_attachments`. `albutts_event_bus.rb` deleted — its subscriber is now a factory registration under `config/initializers/attachment_factories/kalendar_albutts.rb`. FK columns kept as passive mirror; drops in a follow-up PR after consumers migrate. | Existing pairs unified          |
| 4     | New korners never touch bespoke FK columns. Kalendar → Booth attachment ships (event → booth set). Kalendar → Huddle stays hardcoded for now (session_id has time-sensitive semantics — revisit if it fits the attachment model cleanly).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | The primitive is the only way   |

Each phase is one PR (Phase 1 might split into schema + API if it grows).

---

## 6. Access rules cheat-sheet

| Action                           | Who can do it                                                                                       |
| -------------------------------- | --------------------------------------------------------------------------------------------------- |
| Create `spawn` attachment        | Framework (via factory) on behalf of the source record's author. Never surfaced directly to a user. |
| Create `link` / `reference`      | Any user who owns the source record. Manifests must permit (source `attaches` + target `accepts`).  |
| See an attachment in the API     | User must be able to see BOTH source AND target records (each korner's own visibility rules apply). |
| Remove an attachment             | Row creator, source owner, or target owner.                                                         |
| Cascade delete on source destroy | `spawn` → target destroyed too. `link` / `reference` → row removed, target survives.                |

---

## 7. Open items

Genuinely undecided at spec time. Do not build against these until the decision lands here.

1. **Attachment ordering.** If an event has three attached booth sets, in what order do they render? By `created_at`? By an explicit `position` int? For now: `created_at DESC`. Revisit when a real use case wants curation.
2. **Cross-account attachments.** Can Alice attach her album to Bob's event (with Bob's opt-in)? Two design paths: (a) Bob invites Alice's album via a request/accept; (b) any user can attach if they own the source (and only that direction — Bob's event can't grab Alice's album without her consent). Draft leans (b) — source-owner controls. Confirm.
3. **Serialising the target record.** The API returns the attachment row + a nested target — but the target is another korner's record, and we don't want to force every korner to serialize itself over the wire on every attachments read. Options: (a) return just the reference (slug + id + title) and let the frontend fetch full records on demand; (b) return a minimal `AttachmentTargetPreview` per korner (title, icon, url). Draft: (b) — a `KornerAttachmentPreview` shape each korner registers.
4. **The `attaches` manifest field vs. `emits`.** Does `attaches: [{ to: albutts, kind: spawn, trigger: field:spawn_album }]` replace the current `emits: [kalendar.event.created]`? Or do both coexist (emits for arbitrary bus subscribers; attaches for the spawn factory shorthand)? Draft: coexist; `attaches` is a specialised layer on top of the event bus.
5. **UI for attachment-triggered actions.** Currently `spawn_album` is a boolean checkbox in the composer body. Once every field-triggered attachment lives in the manifest, should the composer auto-render toggles for each `field:X`-triggered attachment declared in the manifest? Nice-to-have for consistency; explicit-wiring is fine for MVP.

---

## 8. Related docs

- [`docs/kronk_korner_spec.md`](kronk_korner_spec.md) — manifest field reference (§6 event bus; §7 will grow to include `attaches:` / `accepts:` once Phase 1 ships).
- [`docs/kronk_platform_primitives.md`](kronk_platform_primitives.md) — the shared primitive index. New rows for `useAttachments`, `<AttachmentSection>`, `<AttachmentPicker>` land at Phase 2.
- [`docs/korners/korner_standard.md`](korners/korner_standard.md) — the Korner Standard. A new layer (L11? or a §3.5 addition to L3) covers "manifest declares attachments" as a doctor-enforced check.
- [`docs/rebuild/decisions.md`](rebuild/decisions.md) — the 2026-08-14 entry pointing at this doc.
