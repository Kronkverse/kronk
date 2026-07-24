# Adding a Korner

> **Stale (pre-2.0.0):** the planet system (`planets.tsx`, `SPACE_PLANET`,
> `spaceColor()`, `--space-color`) referenced throughout this walkthrough
> has been retired. Every Korner now inherits the shared Kronk-purple
> accent from `_tokens.scss` — no per-Korner planet or colour assignment.
> Use `var(--accent)` in SCSS directly. Steps here that ask you to edit
> `planets.tsx` or set `--space-color` no longer apply. The rest of the
> flow (models, controllers, feature module, registration) is still
> broadly correct. See `docs/kronk_korner_spec.md` for the current
> authoritative framework.

**Audience:** developers building a new Korner (space) inside Kronk.
**Reference implementation:** Klot (cycle tracker), landed on `dev/tbone`.
**Read alongside:** [`kronk_korner_spec.md`](../kronk_korner_spec.md).
**Aesthetic reference:** [`kronk_korner_spec.md` §3](../kronk_korner_spec.md#3-aesthetic) covers the shared palette, typography, radius scale, elevation, motion, and the `/styleguide` living reference. **Read §3 before you write any SCSS.** Every Korner composes against those tokens; the stylelint config rejects hardcoded hex codes, radii, durations, and shadows in Korner-owned SCSS files. Add your new SCSS file to the override list in `stylelint.config.js` when you create it.
**Visual companion:** [`anatomy.md`](./anatomy.md) — two diagrams showing how the pieces connect.

This walkthrough describes the pattern **as the codebase actually implements
it today**, not as the spec ultimately wants it. Where the two diverge, each
step calls it out with a **[Spec drift]** callout so you can see what's
provisional and what's stable.

The goal: after following this doc end-to-end, a new Korner is visible in the
nav, its data is stored in `<slug>_*` tables, its API is under
`/api/v1/<slug>/`, and its posts render as unified `StatusKornerCard`
components in the feed.

---

## 0. Decide the shape before you write code

Answer these five questions before touching the repo. Every subsequent step
follows from these answers.

| Question                                                                                               | Klot's answer                                        |
| ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| **Slug** — **one lowercase word**, used everywhere (route, table prefix, i18n keys, manifest filename) | `klot`                                               |
| **Korner name** — TitleCase, used in UI copy. One word too                                             | `Klot`                                               |
| **What does a post from this Korner look like?** — the feed projection                                 | A shared cycle log entry with phase-of-cycle + emoji |
| **What are the primary nouns?** — one Ruby model per noun, table name `<slug>_<noun>`                  | `KlotPeriod`, `KlotSetting`, `KlotShare`             |

If any of these is unclear, stop here and clarify. Retro-fitting a slug change
is painful — see the warning below.

> ### The slug is one lowercase word. No hyphens, no underscores.
>
> This is **Standard L1**, and `korners doctor` enforces it:
>
> - one lowercase word — `inflow`, not `in-flow` or `in_flow`
> - **identical to the manifest filename** — slug `inflow` ⇒ `config/korners/inflow.yaml`
> - not in `config/korners/reserved_slugs.yaml`, and unique across korners
>
> The slug is the URL (`/hub/<slug>`), the manifest filename, the feature
> directory, the table prefix and the i18n key root. Every one of those has to
> agree, so pick a word that works as all five.
>
> In Flow is the cautionary tale. It shipped as filename `in_flow.yaml`, slug
> `in-flow` and display name "In Flow" — three forms of one name, which meant
> `useKorner('in-flow')` and the icon map keyed on a string that matched
> neither the file nor the directory. Renaming it after the fact touched the
> manifest, four route entries, the API namespace, the controller class, the
> feature directory, the stylesheet, three specs and two docs, and needed
> permanent 301s because the old URLs were already in the wild.
>
> If the name you want is two words, join them (`inflow`) or choose another.
> Do not hyphenate.

The spec (§1) mandates a `config/korners/<slug>.yaml` manifest that declares
slug/nouns before any code is written. Registration is now validated by
`bin/tootctl korners doctor` (it gates L1/L3/L4/L5/L10 for `enforced` korners),
though mounting a Korner is not hard-refused on a missing manifest. You'll write
the manifest at the end of this walkthrough (see §12); do the five-question
exercise up front anyway.

---

## 1. Model your data

**Files:**

- `db/migrate/<timestamp>_create_<slug>_tables.rb`
- `app/models/<slug>_<noun>.rb` — one per noun

**Storage discipline** (spec §5.1): every table this Korner owns starts with
the slug. Klot ships three tables — all prefixed:

```ruby
# db/migrate/20260708230001_create_klot_tables.rb
class CreateKlotTables < ActiveRecord::Migration[8.0]
  def change
    create_table :klot_periods do |t|
      t.references :account, null: false, foreign_key: { on_delete: :cascade }
      t.date :started_on, null: false
      t.timestamps
    end
    add_index :klot_periods, [:account_id, :started_on], unique: true

    create_table :klot_settings do |t|
      t.references :account, null: false,
                   foreign_key: { on_delete: :cascade },
                   index: { unique: true }
      t.integer :cycle_length, default: 28, null: false
      t.integer :period_length, default: 5, null: false
      t.timestamps
    end

    create_table :klot_shares do |t|
      t.references :account, null: false, foreign_key: { on_delete: :cascade }
      t.bigint :viewer_account_id, null: false
      t.timestamps
    end
    add_index :klot_shares, [:account_id, :viewer_account_id],
              unique: true, name: 'index_klot_shares_unique'
  end
end
```

Each model belongs to `Account` and includes just the scopes it needs:

```ruby
# app/models/klot_period.rb
class KlotPeriod < ApplicationRecord
  belongs_to :account

  validates :started_on, presence: true
  validates :started_on, uniqueness: { scope: :account_id }

  scope :for_account,       ->(account) { where(account: account) }
  scope :most_recent_first, -> { order(started_on: :desc) }
end
```

### The migration pattern for feed-projected Korners

If your Korner posts to the feed (see §11), your primary table needs one
extra column: the status the share posts as. Follow this exact shape —
`strong_migrations` will block anything else on staging/production:

```ruby
class AddStatusIdToYourTable < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    add_reference :your_table, :status, null: true,
                                        index: { unique: true, algorithm: :concurrently }
  end
end
```

**No `foreign_key:` argument.** Kronk uses Ruby-level `dependent: :nullify`
on the `Status has_one :your_thing` for cascade. Adding a DB-level FK is
what `strong_migrations` refuses (adding a FK locks writes on both tables).
Every existing feed-projected Korner (`events`, `wachuneed`/`listings`,
`booth_sets`) follows this pattern.

### Column naming — use `status_id`

The existing Korners have drifted here:

| Korner    | Column                           | Notes                           |
| --------- | -------------------------------- | ------------------------------- |
| Kalendar  | `events.status_id`               | Canonical                       |
| Wachuneed | `listings.status_id`             | Canonical                       |
| Booth     | `booth_sets.shared_status_id`    | Legacy — kept for compatibility |
| Kommons   | `proposals.discussion_status_id` | Legacy — kept for compatibility |

**For a new Korner, use `status_id`.** Two of four existing Korners agree,
the naming is shorter, and it's what the ORM naturally infers from
`belongs_to :status`. Leave the legacy names alone in Booth and Kommons —
migrating them would ripple through model/serializer/discriminator without
buying much.

---

**Do not** add associations from `Account` back to your models. Kronk uses
concerns for that:

```ruby
# app/models/concerns/account/associations.rb (existing file — add your line)
has_many :klot_periods, dependent: :destroy
has_many :klot_settings, dependent: :destroy
has_many :klot_shares,  dependent: :destroy
```

**[Spec drift]** Spec §5.6 requires snowflake IDs so status references
survive migration between hosts. Klot uses default `bigint(8)` PKs. This is
fleet-wide drift — no Korner has adopted snowflakes yet. Match the existing
pattern for now; snowflake migration is a future cross-Korner change.

---

## 2. Server-side controllers

Kronk uses **two controller trees** for every Korner:

### 2a. The page controller (`app/controllers/<slug>_controller.rb`)

For most Korners this is a tiny shim that just renders the SPA shell.
Klot's is unusual in that it has its own `KlotController` for server-rendered
share pages, but many Korners get away with piggy-backing on `HomeController`
via a wildcard route (see §7). Start with the wildcard route if you don't
need server-rendered pages.

### Never call PostStatusService inside a transaction

If any of your controllers posts a status to the feed (share endpoints,
auto-post-on-create flows like Kalendar events), the call **must not**
be wrapped in an `ApplicationRecord.transaction` block:

```ruby
# WRONG — silently drops the status from home feeds
ApplicationRecord.transaction do
  @thing.save!
  @status = PostStatusService.new.call(current_account, text: ...)
  @thing.update!(status_id: @status.id)
end

# RIGHT — save first, post status outside the transaction
@thing.save!
@status = PostStatusService.new.call(current_account, text: ...)
@thing.update!(status_id: @status.id)
```

**Why:** `PostStatusService` enqueues `DistributionWorker.perform_async`
during its call. Sidekiq starts the fanout job immediately — before your
outer transaction commits. Inside the job, `Status.find(status_id)` raises
`ActiveRecord::RecordNotFound`, which `DistributionWorker#perform` rescues
silently. The status ends up in the DB when the transaction commits, but
its fanout to home feeds never runs. The status is visible on the author's
profile and via direct URL — but the home feed never gets it.

This is the exact bug we hit on Kalendar's event creation. Booth's share
endpoint was already correct.

Trade-off: if `PostStatusService` fails after your save succeeded, you
get an orphan primary row with no linked status. Preferable to the silent
fanout failure — the user can retry or delete.

### 2b. The API controllers (`app/controllers/api/v1/<slug>/`)

**Namespace them under `Api::V1::<Slug>::`.** Klot has four:

```
app/controllers/api/v1/klot/periods_controller.rb   # CRUD on periods
app/controllers/api/v1/klot/phases_controller.rb    # derived phase-of-cycle
app/controllers/api/v1/klot/settings_controller.rb  # cycle length etc.
app/controllers/api/v1/klot/shares_controller.rb    # who can see whose data
```

Each inherits from `Api::BaseController`, calls `doorkeeper_authorize!` with
appropriate scopes, and uses `current_account` to scope to the caller. Keep
these thin — business logic lives in `app/lib/<slug>/` if it's substantial.

**[Spec drift]** Spec §7 mandates a single authorisation layer. Today each
Korner authorises independently — Kommons uses one pattern, Klot uses another,
Wachuneed a third. Follow the pattern of whichever Korner is closest to
yours in shape until the auth-layer consolidation lands (Phase 2).

---

## 3. Serializers

**Files:** `app/serializers/rest/<slug>_<noun>_serializer.rb`

Kronk's serializers live under `app/serializers/rest/` and inherit from
`ActiveModel::Serializer`. Klot ships four — one per model plus one for
derived phase data:

```ruby
# app/serializers/rest/klot_period_serializer.rb
class REST::KlotPeriodSerializer < ActiveModel::Serializer
  attributes :id, :started_on
end
```

For a Korner whose posts show up in the feed (see §11), you'll also need a
**summary serializer** — a thin projection exposed on `Status` for the feed
card. See how `REST::WachuneedListingSummarySerializer` handles this on
`dev/kashka`.

---

## 3.5. Chrome the Frame provides — don't build these

**Read [`docs/kronk_frame.md`](../kronk_frame.md) before writing any UI.** The Frame is the grid every korner renders inside, and it already draws three pieces of chrome for you off the manifest. If your feature file draws them again you'll get a doubled surface — this is exactly the bug Klot shipped in alpha.223 and had to fix in alpha.225 (`bin/tootctl korners doctor` catches it now, as a warning under Standard L11).

| Slot           | Frame component         | Manifest field                           | You render this in your index?                              |
| -------------- | ----------------------- | ---------------------------------------- | ----------------------------------------------------------- |
| Space title    | `<AutoSpaceBadge>`      | `name` + `icon.text_glyph`               | **No.** Don't emit `<h1>`.                                  |
| Space tagline  | `<AutoSpaceIntro>`      | `tagline`                                | **No.** Keep the copy in the manifest.                      |
| View / tab row | `<AutoSpaceViewPicker>` | `views:` (ordered `[{ key, label }, …]`) | **No.** Don't emit `role="tablist"` or a bespoke tab class. |

The view picker is URL-driven: bare `/hub/<slug>` is your first-listed view; `/hub/<slug>/<key>` is any other. Your component should read `useLocation()` and switch on the segment — never a `useState<Tab>` tab state.

**A minimal Frame-adherent korner looks like:**

```tsx
// features/mykorner/index.tsx
import { KornerShell } from 'mastodon/components/korner_shell';

export const MyKorner: React.FC = () => (
  <KornerShell
    slug='mykorner'
    label='MyKorner'
    className='mykorner'
    defaultView='default'
    views={{
      default: () => <DefaultView />,
      other: () => <OtherView />,
    }}
  />
);
```

That's it — no hero, no tab row, no tagline. `<KornerShell>` owns the `<Stage>` wrapper and the URL-to-view routing; the view keys line up with the manifest's `views:` list. Copy the shape from `docs/korners/template/` and delete the parts you don't need.

Landing-view copy that _isn't_ the tagline (a lede paragraph, a getting-started card, a call-to-action) is fine — it's your content, not chrome. The rule is against duplicating what the Frame already renders. Standard L11 spells this out.

---

## 4. Frontend feature module

**Directory:** `app/javascript/mastodon/features/<slug>/`

Klot's shape:

```
features/klot/
├── index.tsx                    # the mounted route component
├── api.ts                       # thin fetch wrappers around /api/v1/klot/
├── phase_math.ts                # pure derivation helpers, unit-testable
├── types.ts                     # TypeScript types shared across the module
└── components/
    ├── cycle_ring.tsx
    ├── log_card.tsx
    ├── moon.tsx
    ├── settings_card.tsx
    └── share_card.tsx
```

**Conventions worth copying from Klot:**

- **`api.ts` isolates fetch calls.** Every network call the Korner makes goes
  through this file. Redux stays out of it — Klot uses local state and hooks.
- **Pure helpers get their own file.** `phase_math.ts` has zero side effects
  and no React. Makes phase logic unit-testable in isolation.
- **Types in one place.** `types.ts` is the source of truth for what a
  `KlotPeriod` looks like on the client.
- **Components are named for what they _are_, not what they _do_.**
  `cycle_ring.tsx`, not `phase_visualiser.tsx`.

Use `var(--accent)` (from `_tokens.scss`) for borders, glows, and tints.
Everything nested picks up the shared Kronk-purple accent — no per-Korner
colour derivation. `color-mix()` on `var(--accent)` is fine where a
softer shade is needed. (Prior to 2.0.0 this went through `--space-color`
and `spaceColor()`; both were retired.)

**[Spec drift]** The spec (§3) requires every Korner declare a language
schema — the verbs and nouns your Korner introduces. Klot's language is
implicit in its component names. Aim for consistency (`period`, `phase`,
`cycle`, `share`) but nothing enforces it yet.

---

## 5. Register the frontend chunk

Two file edits, both under `app/javascript/mastodon/features/ui/`:

### 5a. `util/async-components.js`

Add the dynamic import so the bundle can code-split your Korner:

```js
export function Klot() {
  return import('../../klot');
}
```

### 5b. `index.jsx`

Import the async component and wire it as a route:

```jsx
// near the top with the other async imports:
import { ..., Klot, ... } from './util/async-components';

// in the render tree, inside <SignedIn>:
{signedIn && <WrappedRoute path="/hub/klot" component={Klot} content={children} />}
```

Klot's route is auth-gated with `{signedIn && ...}` because it shows personal
health data. If your Korner is public, drop the guard.

**Every Korner mounts under `/hub/<slug>`.** This is live and universal — the
URL migration (spec §4) shipped, every existing Korner is at `/hub/<slug>`,
and legacy top-level `/<slug>` paths 301-redirect to `/hub/<slug>` in
`config/routes.rb`. Do **not** mount at bare `/<slug>`.

---

## 6. Rails routes

**File:** `config/routes.rb`

For the SPA shell (client-side routing takes over) — mount under `/hub/`:

```ruby
get '/hub/klot', to: 'home#index'
get '/hub/klot/*path', to: 'home#index', format: false
```

If you have server-rendered pages (share cards, embeds), add explicit routes
**above** the wildcard so they take precedence — see how Booth handles
`/hub/booth/sets/:id/embed`.

**File:** `config/routes/api.rb`

Wrap your API controllers in a namespace:

```ruby
namespace :klot do
  resources :periods, only: [:index, :create, :destroy]
  resource :settings, only: [:show, :update]
  resources :shares, only: [:index, :create, :destroy]
  resources :phases, only: [:index]
end
```

---

## 7. Styles

**File:** `app/javascript/styles/mastodon/_<slug>.scss`

Create the partial, prefix every selector with your Korner's namespace, and
build against the shared design tokens — **no raw hex codes**:

```scss
// app/javascript/styles/mastodon/_klot.scss
@use 'variables' as *;

.klot-page {
  background: var(--surface);
  border-color: var(--accent);
  // ... derive shades with color-mix() on var(--accent) where needed
}
```

The token system has shipped: tokens are authored in
`app/javascript/mastodon/tokens/tokens.yaml`, generated into
`_tokens.scss` by `bin/generate-tokens`, and enforced. Korner-owned SCSS
must not inline hex values — stylelint's `color-no-hex` rejects them, and
`korners doctor` check L7 requires your SCSS file be added to the stylelint
governance list (the `files:` array under the token-enforcing overrides in
`stylelint.config.js`). Use `var(--accent)` and the other semantic tokens.

**File:** `app/javascript/styles/application.scss`

Add a `@use` line — alphabetise:

```scss
@use 'mastodon/klot';
```

Don't touch `components.scss` or `basics.scss`. Your styles are yours; keep
them in the partial.

---

## 8. Accent colour — nothing to do

Korners do not have their own colour. There is no planet to register and no
`SPACE_PLANET` entry to add; the planet system was retired on 2026-07-10 and
`planets.tsx` is gone.

Every korner uses the shared palette via `var(--accent)`, which also means it
picks up each user's Personal Appearance settings for free. Differentiation is
icon, name and content — see Standard L1 ("No colour field") and
`docs/kronk_aesthetic_system.md`.

## 9. Navigation panel

**File:** `app/javascript/mastodon/features/navigation_panel/index.tsx`

Add a `ColumnLink` for your Korner alongside the others:

```tsx
<ColumnLink
  transparent
  to='/hub/klot'
  icon='moon'
  text={intl.formatMessage(messages.klot)}
/>
```

Add a matching entry to the `messages` object with the display label.

**[Spec drift]** Klot is currently not in the nav panel — it's reachable only
by URL. Every Korner **should** be discoverable from the nav. Add yours here
so it's not the same drift item. (Klot's absence is captured in
`config/korners/klot.yaml` under `discoverable: false`.)

---

## 10. The Hub

Spec §4 says your Korner appears as a tile in the Hub grid at `/hub`. **The Hub
is shipped** — `app/javascript/mastodon/features/hub/index.tsx`. You do **not**
register your Korner with it by hand: the grid renders from the Korner registry,
so a registered manifest with a Hub-facing node is enough to appear. There is no
`hub_registered` manifest field. Tile ordering is by tune-in count with a
per-user override (§4); nothing to wire per-Korner.

---

## 11. Feed projection — how posts appear in the timeline

If your Korner emits statuses (posts) that need to render as space cards in
the home timeline, the spec (§8) calls this **feed projection**. There are
three moving parts:

### Reference implementations

Four Korners currently ship feed projection. Copy the closest match to
your shape:

| Korner        | Best for                                                                                                                                                                                                                                                           | Reference files                                                                                                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Kommons**   | You have a first-class resource (proposal, decision) with a discussion attached                                                                                                                                                                                    | `app/models/proposal.rb`, `app/controllers/api/v1/proposals_controller.rb`, `app/serializers/rest/proposal_summary_serializer.rb`                                                    |
| **Kuestions** | Dedicated `Question`/`Answer` tables; its feed card is **not yet re-added** — the old Status-polymorphic `question_card` retired (Phase 3a) and a `Question`-model-backed `kuestions_card` is still to build, so there is currently no `KORNER_CARDS` entry for it | `app/models/question.rb`, `app/models/answer.rb`, `app/javascript/mastodon/components/korner_cards.tsx` (see the Kuestions comment)                                                  |
| **Kalendar**  | You have a primary record (event, workshop) that gets shared on create                                                                                                                                                                                             | `app/controllers/api/v1/events_controller.rb#create` (post-race-fix — status creation is outside the transaction), `app/models/event.rb`, `app/serializers/rest/event_serializer.rb` |
| **Booth**     | You have a primary record (audio set, upload) with an explicit share action                                                                                                                                                                                        | `app/controllers/api/v1/booth_sets_controller.rb#share`, `app/models/booth_set.rb`, `app/serializers/rest/booth_set_summary_serializer.rb`                                           |

### 11a. Association on `Status`

Your Korner attaches to a status via `has_one`:

```ruby
# app/models/status.rb (or a concern) — one line per Korner
has_one :listing, dependent: :nullify   # Wachuneed
has_one :booth_share,         dependent: :nullify   # spec drift — see below
```

### 11b. Serializer exposure

Add a `has_one` in `REST::StatusSerializer` pointing at a **summary**
serializer — deliberately thin, so the timeline JSON stays small. Look at
`REST::WachuneedListingSummarySerializer` as the template.

### 11c. Adapter component

Create `app/javascript/mastodon/components/status_<slug>_card.tsx` that
renders your Korner's data through the shared `StatusKornerCard` frame.
Same anatomy for every Korner — see `status_wachuneed_card.tsx` and
`status_booth_card.tsx` as templates.

The rendering discriminator is the **card registry** at
`app/javascript/mastodon/components/korner_cards.tsx` — `KORNER_CARDS` is
an array of `{ slug, matches, card }` entries, and `pickKornerCard` /
`hasKornerCard` walk it. `status.jsx` imports those two helpers; it no
longer carries a per-Korner `if/else` branch chain. To add a feed Korner,
register one `KORNER_CARDS` entry:

```tsx
// app/javascript/mastodon/components/korner_cards.tsx
{
  slug: 'klot',
  matches: (s) => s.get('klot_share') != null,
  card: (s) => <StatusKlotCard share={dataFrom(s, 'klot_share')} />,
},
```

`hasKornerCard(status)` also drives the suppression of the raw text body,
so a registered card automatically hides the underlying post text — there
is no separate suppression list to edit.

Booth's projection is now wired end-to-end: `booth_sets` carries both a
`shared_status_id` and a `status_id` column, `Status has_one :booth_set`
resolves, and `korner_cards.tsx` has a `booth` entry, so a shared set
renders its card in the timeline.

---

## 12. Write the manifest

**File:** `config/korners/<slug>.yaml`

Land the manifest as part of your PR — `bin/tootctl korners doctor` reads it
and gates conformance (see §0: L1/L3/L4/L5/L10 for `enforced` korners, plus
the L7 SCSS-token check). It's also the machine-readable record of the
decisions you made in §0 and the drift you accepted along the way. Copy one
of the existing manifests as a starting point — `klot.yaml` is the newest
and cleanest.

Mark drift honestly:

- `# not-implemented` — spec says the field should be filled, you haven't
- `# implicit` — the code does this thing but it's not declared explicitly
- `# TODO` — you know it needs doing before the Korner is spec-conformant
- `# not-applicable` — the field doesn't apply to your Korner's shape

`bin/tootctl korners doctor` reads these manifests and reports drift back to
you. Marking honestly costs nothing; marking optimistically costs the next
dev's afternoon.

---

## 13. Testing

Once merged locally:

```bash
bundle exec rails db:migrate
yarn dev  # or just RAILS_ENV=development bundle exec rails s
```

Hit `/hub/<slug>` in a browser signed in as any account. Then:

- Load a post from your Korner into the home timeline — verify the shared
  card frame renders with the shared accent colour.
- Check the nav panel — your Korner's link should be there and highlighted
  when active.
- Log out — verify the auth gate on `/api/v1/<slug>/*` returns 401 (or
  whatever your Korner's public surface should be).

Then merge your branch into `staging` and confirm on
[dev.mastodon.kronk.info](https://dev.mastodon.kronk.info) before opening a
PR to `main`. See CLAUDE.md for the full branch/PR workflow.

---

## Appendix: Files touched, in order

For a Korner with a full frontend+backend+feed presence, the merge diff
should touch approximately:

| File                                                           | Purpose                          |
| -------------------------------------------------------------- | -------------------------------- |
| `db/migrate/*_create_<slug>_tables.rb`                         | Schema                           |
| `app/models/<slug>_*.rb`                                       | Ruby models                      |
| `app/models/concerns/account/associations.rb`                  | `Account has_many` line          |
| `app/controllers/<slug>_controller.rb`                         | (Optional) server-rendered pages |
| `app/controllers/api/v1/<slug>/*_controller.rb`                | JSON API                         |
| `app/serializers/rest/<slug>_*_serializer.rb`                  | JSON shape                       |
| `app/lib/<slug>/*.rb`                                          | Business logic (if substantial)  |
| `config/routes.rb`                                             | SPA shell routes                 |
| `config/routes/api.rb`                                         | API routes                       |
| `app/javascript/mastodon/features/<slug>/**/*`                 | Frontend feature module          |
| `app/javascript/mastodon/features/ui/util/async-components.js` | Chunk registration               |
| `app/javascript/mastodon/features/ui/index.jsx`                | Route registration               |
| `app/javascript/mastodon/features/navigation_panel/index.tsx`  | Nav entry                        |
| `app/javascript/styles/mastodon/_<slug>.scss`                  | Styles                           |
| `app/javascript/styles/application.scss`                       | `@use` import                    |
| `app/models/status.rb` (if feed-projected)                     | `has_one` association            |
| `app/serializers/rest/status_serializer.rb`                    | Timeline JSON exposure           |
| `app/serializers/rest/<slug>_summary_serializer.rb`            | Card projection                  |
| `app/javascript/mastodon/components/status_<slug>_card.tsx`    | Feed card                        |
| `app/javascript/mastodon/components/korner_cards.tsx`          | `KORNER_CARDS` registry entry    |
| `config/korners/<slug>.yaml`                                   | Manifest                         |

That's ~18–22 files for a Korner with feed presence, ~14–16 for one without.

Everything above is the pattern **as it exists today**. The spec's endpoint
is a Korner that ships in half that many touchpoints because manifest-driven
registration collapses many of these into one file. Getting there is Phase 3.
For now: match the pattern, mark the drift, and land your Korner.
