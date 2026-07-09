# Adding a Korner

**Audience:** developers building a new Korner (space) inside Kronk.
**Reference implementation:** Klot (cycle tracker), landed on `dev/tbone`.
**Read alongside:** [`kronk_korner_spec.md`](../kronk_korner_spec.md).
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

| Question | Klot's answer |
| --- | --- |
| **Slug** — one lowercase word, used everywhere (route, table prefix, i18n keys, manifest filename) | `klot` |
| **Space name** — TitleCase, used in `SPACE_PLANET` and UI copy | `Klot` |
| **Planet** — from the eight planets in `planets.tsx` — determines the accent colour | `Earth` |
| **What does a post from this Korner look like?** — the feed projection | A shared cycle log entry with phase-of-cycle + emoji |
| **What are the primary nouns?** — one Ruby model per noun, table name `<slug>_<noun>` | `KlotPeriod`, `KlotSetting`, `KlotShare` |

If any of these five is unclear, stop here and clarify. Retro-fitting a slug
change across nine files is painful.

**[Spec drift]** The spec (§1) mandates a `config/korners/<slug>.yaml`
manifest that declares slug/planet/nouns before any code is written.
Manifest-driven registration is not yet enforced — you'll write the manifest
at the end of this walkthrough as the last step (see §12). Do the five-question
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
Marketplace a third. Follow the pattern of whichever Korner is closest to
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
card. See how `REST::MarketplaceListingSummarySerializer` handles this on
`dev/kashka`.

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
- **Components are named for what they *are*, not what they *do*.**
  `cycle_ring.tsx`, not `phase_visualiser.tsx`.

Set `--space-color: {spaceColor('Klot')}` on the root element of your
mounted component. Everything nested inherits the accent (borders, glows,
tints) via `color-mix()` on that variable. See how Klot's `index.tsx` and
`_klot.scss` do this.

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
export function Klot () {
  return import("../../klot");
}
```

### 5b. `index.jsx`

Import the async component and wire it as a route:

```jsx
// near the top with the other async imports:
import { ..., Klot, ... } from './util/async-components';

// in the render tree, inside <SignedIn>:
{signedIn && <WrappedRoute path="/klot" component={Klot} content={children} />}
```

Klot's route is auth-gated with `{signedIn && ...}` because it shows personal
health data. If your Korner is public, drop the guard.

**[Spec drift]** Spec §4 mounts every Korner under `/hub/<slug>`. Nothing on
Kronk uses `/hub/` yet — every existing Korner mounts at `/<slug>`. Match the
existing pattern until the URL migration lands (Phase 2).

---

## 6. Rails routes

**File:** `config/routes.rb`

For the SPA shell (client-side routing takes over):

```ruby
get '/klot', to: 'home#index'
get '/klot/*path', to: 'home#index', format: false
```

If you have server-rendered pages (share cards, embeds), add explicit routes
**above** the wildcard so they take precedence — see how Booth handles
`/booth/sets/:id/embed`.

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

Create the partial, prefix every selector with your Korner's namespace:

```scss
// app/javascript/styles/mastodon/_klot.scss
@use 'variables' as *;

.klot-page {
  --klot-bg: #0D0A1F;
  --klot-surface: #181336;
  // ...
}
```

**File:** `app/javascript/styles/application.scss`

Add a `@use` line — alphabetise:

```scss
@use 'mastodon/klot';
```

Don't touch `components.scss` or `basics.scss`. Your styles are yours; keep
them in the partial.

**[Spec drift]** Spec §6 aesthetic tokens — Klot inlines hex values as CSS
custom properties on `.klot-page` and derives everything from them.
No Korner uses design tokens from a shared file yet. Keep your palette
local to your partial for now.

---

## 8. Register your planet

**File:** `app/javascript/mastodon/planets.tsx`

Add your Korner's space name to `SPACE_PLANET`:

```tsx
export const SPACE_PLANET: Record<string, PlanetName> = {
  // ...
  Klot: 'Earth',
};
```

That entry alone gives `spaceColor('Klot')` a colour, which drives every
`color-mix()` derivation across your components and card. Nothing else needs
to know about your Korner's colour.

Two Korners can share a planet — that's fine. Klot and WatchuNeed (now
`Market`) both orbit Earth on `dev/tbone`. Meaning-of-planet matters more
than uniqueness. See `docs/kronk_korner_spec.md` §6 for the planet
semantic table.

---

## 9. Navigation panel

**File:** `app/javascript/mastodon/features/navigation_panel/index.tsx`

Add a `ColumnLink` for your Korner alongside the others:

```tsx
<ColumnLink transparent to='/klot' icon='moon' text={intl.formatMessage(messages.klot)} />
```

Add a matching entry to the `messages` object with the display label.

**[Spec drift]** Klot is currently not in the nav panel — it's reachable only
by URL. Every Korner **should** be discoverable from the nav. Add yours here
so it's not the same drift item. (Klot's absence is captured in
`config/korners/klot.yaml` under `discoverable: false`.)

---

## 10. The Hub (Kosmos) — deferred

Spec §4 says your Korner appears as a moon in the Kosmos view at `/hub`.
**The Hub does not yet exist in code** — `features/hub/index.tsx` is not
present on either `main` or any dev branch as of writing. When the Hub lands,
adding a Korner to it will be one array-entry edit. Don't add it now; it
would fail to compile.

Track this yourself: your Korner appears in the manifest under
`hub_registered: false # not-implemented — Hub surface pending`. When the
Hub ships, that gets flipped in a follow-up PR.

---

## 11. Feed projection — how posts appear in the timeline

If your Korner emits statuses (posts) that need to render as space cards in
the home timeline, the spec (§8) calls this **feed projection**. There are
three moving parts:

### 11a. Association on `Status`

Your Korner attaches to a status via `has_one`:

```ruby
# app/models/status.rb (or a concern) — one line per Korner
has_one :marketplace_listing, dependent: :nullify
has_one :booth_share,         dependent: :nullify   # spec drift — see below
```

### 11b. Serializer exposure

Add a `has_one` in `REST::StatusSerializer` pointing at a **summary**
serializer — deliberately thin, so the timeline JSON stays small. Look at
`REST::MarketplaceListingSummarySerializer` as the template.

### 11c. Adapter component

Create `app/javascript/mastodon/components/status_<slug>_card.tsx` that
renders your Korner's data through the shared `StatusKornerCard` frame.
Same anatomy for every Korner — see `status_marketplace_card.tsx` and
`status_booth_card.tsx` as templates.

The rendering discriminator in `status.jsx` picks the right card based on
which association is populated:

```jsx
} else if (status.get('marketplace_listing')) {
  card = <StatusMarketplaceCard listing={...} />;
} else if (status.get('booth_set')) {
  card = <StatusBoothCard set={...} />;
}
```

Also add the association name to the suppression list at `status.jsx:692` so
the raw text body doesn't render underneath the card.

**[Spec drift]** Spec §8 asks for a manifest-driven discriminator — the
manifest declares which association triggers which card. Today the
discriminator is a branch chain in `status.jsx`. Adding a Korner still means
editing `status.jsx`. Keep the pattern; enforcement moves to Phase 3.

**[Spec drift]** Booth's card doesn't fire in production yet — `booth_sets`
has no `shared_status_id` column, so no `Status` has a `has_one :booth_set`
that resolves. This is captured in `config/korners/booth.yaml` and is a
prerequisite to Booth appearing in the timeline as a card.

---

## 12. Write the manifest

**File:** `config/korners/<slug>.yaml`

Even though nothing enforces it at boot, land the manifest as part of your
PR. It's the machine-readable record of the decisions you made in §0 and the
drift you accepted along the way. Copy one of the existing manifests as a
starting point — `klot.yaml` is the newest and cleanest.

Mark drift honestly:
- `# not-implemented` — spec says the field should be filled, you haven't
- `# implicit` — the code does this thing but it's not declared explicitly
- `# TODO` — you know it needs doing before the Korner is spec-conformant
- `# not-applicable` — the field doesn't apply to your Korner's shape

The `bin/tootctl korners` command (coming in Phase 1) reads these manifests
and reports drift back to you. Marking honestly costs nothing; marking
optimistically costs the next dev's afternoon.

---

## 13. Testing

Once merged locally:

```bash
bundle exec rails db:migrate
yarn dev  # or just RAILS_ENV=development bundle exec rails s
```

Hit `/<slug>` in a browser signed in as any account. Then:

- Load a post from your Korner into the home timeline — verify the shared
  card frame renders with your Korner's planet colour.
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

| File | Purpose |
| --- | --- |
| `db/migrate/*_create_<slug>_tables.rb` | Schema |
| `app/models/<slug>_*.rb` | Ruby models |
| `app/models/concerns/account/associations.rb` | `Account has_many` line |
| `app/controllers/<slug>_controller.rb` | (Optional) server-rendered pages |
| `app/controllers/api/v1/<slug>/*_controller.rb` | JSON API |
| `app/serializers/rest/<slug>_*_serializer.rb` | JSON shape |
| `app/lib/<slug>/*.rb` | Business logic (if substantial) |
| `config/routes.rb` | SPA shell routes |
| `config/routes/api.rb` | API routes |
| `app/javascript/mastodon/features/<slug>/**/*` | Frontend feature module |
| `app/javascript/mastodon/features/ui/util/async-components.js` | Chunk registration |
| `app/javascript/mastodon/features/ui/index.jsx` | Route registration |
| `app/javascript/mastodon/features/navigation_panel/index.tsx` | Nav entry |
| `app/javascript/mastodon/planets.tsx` | `SPACE_PLANET` entry |
| `app/javascript/styles/mastodon/_<slug>.scss` | Styles |
| `app/javascript/styles/application.scss` | `@use` import |
| `app/models/status.rb` (if feed-projected) | `has_one` association |
| `app/serializers/rest/status_serializer.rb` | Timeline JSON exposure |
| `app/serializers/rest/<slug>_summary_serializer.rb` | Card projection |
| `app/javascript/mastodon/components/status_<slug>_card.tsx` | Feed card |
| `app/javascript/mastodon/components/status.jsx` | Discriminator branch |
| `config/korners/<slug>.yaml` | Manifest |

That's ~18–22 files for a Korner with feed presence, ~14–16 for one without.

Everything above is the pattern **as it exists today**. The spec's endpoint
is a Korner that ships in half that many touchpoints because manifest-driven
registration collapses many of these into one file. Getting there is Phase 3.
For now: match the pattern, mark the drift, and land your Korner.
