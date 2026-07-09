# Anatomy of a Korner

Visual companion to [adding_a_korner.md](./adding_a_korner.md).
Two diagrams to hold the shape in your head — the **runtime map**, and
**feed projection** (the layer only some Korners need).

## The runtime map

Everything you touch to make a new Korner exist. Solid arrows are runtime
data flow; **dotted arrows are declarative** — `planets.tsx` doesn't call
your code, it just exposes a colour your module reads via
`spaceColor(...)`. Thick arrows highlight the two moments a Korner
"activates": the lazy-load into the SPA, and the one-time table creation.

```mermaid
graph TB
    User(["User navigates to /slug"])

    subgraph SPA["Browser — React SPA"]
        UIRoute["ui/index.jsx<br/>WrappedRoute path='/slug'"]
        Async["ui/util/async-components.js<br/>lazy import"]
        Module["features/slug/index.tsx<br/>sets --space-color"]
        Comp["features/slug/components/*"]
        API["features/slug/api.ts<br/>fetch wrappers"]
        Types["features/slug/types.ts"]
    end

    subgraph Reg["Cross-Korner registration"]
        Planets["planets.tsx<br/>SPACE_PLANET entry"]
        Nav["navigation_panel/index.tsx<br/>ColumnLink to='/slug'"]
    end

    subgraph Styl["Styles"]
        AppScss["styles/application.scss<br/>@use 'mastodon/slug'"]
        SlugScss["styles/mastodon/_slug.scss<br/>your palette"]
    end

    subgraph RailsBE["Rails backend"]
        Routes["config/routes.rb<br/>config/routes/api.rb"]
        Ctrl["api/v1/slug/*_controller.rb<br/>doorkeeper_authorize!"]
        Ser["serializers/rest/slug_*.rb"]
        Model["models/slug_*.rb<br/>belongs_to :account"]
        Assoc["concerns/account/associations.rb<br/>has_many :slug_*"]
        Lib["lib/slug/*.rb<br/>optional: pure business logic"]
    end

    subgraph DB["Database"]
        Migration["db/migrate/*_create_slug_tables.rb"]
        Tables[("slug_* tables")]
    end

    Manifest{{"config/korners/slug.yaml"}}

    User --> UIRoute
    UIRoute --> Async
    Async ==>|lazy-loads| Module
    Module --> Comp
    Module --> API
    Module --> Types
    API ==>|fetch| Routes
    Routes --> Ctrl
    Ctrl --> Model
    Ctrl --> Ser
    Ctrl -.-> Lib
    Ser -.-> Model
    Model --> Tables
    Migration ==>|creates| Tables
    Assoc -.->|Account has_many| Model

    Planets -.->|--space-color| Module
    Nav -.->|link to /slug| UIRoute
    AppScss --> SlugScss
    SlugScss -.->|scoped rules| Module

    Manifest -.->|declares shape| Module
    Manifest -.->|declares shape| Model
```

### Reading order

1. User navigates to `/<slug>`.
2. Rails matches the SPA wildcard route in `config/routes.rb` and returns the SPA shell.
3. The React route registered in `ui/index.jsx` mounts the async component for your Korner.
4. `async-components.js` lazy-loads `features/<slug>/index.tsx`.
5. Your feature module sets `--space-color`, renders your components, and calls `api.ts` for data.
6. `api.ts` hits `/api/v1/<slug>/*`, which dispatches to your API controller.
7. The controller authorises via Doorkeeper, scopes to `current_account`, hits the model.
8. The model reads/writes your `<slug>_*` tables.
9. The serializer projects the model into JSON on the way back.

### The four things not in the flow

Four boxes in the diagram aren't in the request path. They're **declarative**
— edited once, referenced forever:

- **`planets.tsx`** — makes your Korner's space colour derivable everywhere via `spaceColor('SlugName')`.
- **`navigation_panel/index.tsx`** — how a user *discovers* your Korner without knowing the URL.
- **`concerns/account/associations.rb`** — one line so `Account.first.slug_periods` works.
- **`config/korners/slug.yaml`** — machine-readable declaration of your Korner's shape. Not enforced yet; will be Phase 3.

These are the most common source of "why isn't my Korner showing up" bugs.

---

## Feed projection

Only Korners whose data appears in the home timeline need this layer.
Currently: **Kommons, Kuestions, Marketplace**, and **Booth once its
`shared_status_id` backend lands**. Klot deliberately does not — its data
is private.

```mermaid
graph TB
    Post(["User posts from Slug"])

    subgraph Backend["Backend"]
        Model2["Slug model<br/>owns status_id column"]
        StatusModel["Status.rb<br/>has_one :slug_thing"]
        Sum["serializers/rest/slug_summary_serializer.rb<br/>thin projection for feed"]
        StatusSer["StatusSerializer<br/>has_one :slug_thing, serializer: Sum"]
    end

    subgraph Frontend["Frontend"]
        TL["Timeline JSON<br/>status.slug_thing = {...}"]
        Disc["components/status.jsx<br/>if status.get('slug_thing')"]
        Card["components/status_slug_card.tsx<br/>adapter for your shape"]
        Frame["StatusKornerCard<br/>shared frame + badge + space-color border"]
    end

    Post ==>|writes| Model2
    Model2 --> StatusModel
    StatusSer --> Sum
    Sum -.->|reads| Model2
    StatusSer ==>|JSON| TL
    TL --> Disc
    Disc ==>|renders| Card
    Card --> Frame
```

### Three moving pieces

- **Backend**: your model owns a `status_id`, `Status.rb` gets a matching `has_one`, and a **summary serializer** projects just the slice the timeline needs (deliberately thin, so timeline JSON stays small).
- **Timeline JSON**: the caller receives a `status` with your association populated. If it's not populated, this Korner's card doesn't fire.
- **Discriminator**: `status.jsx` picks the right card component based on which association is populated. Also add your association name to the suppression list at `status.jsx:692` so the raw text body doesn't render beneath your card.

### Where the drift lives

**The discriminator is currently a branch chain in `status.jsx`.** Adding a
feed-projected Korner still means editing that file. Manifest-driven
discrimination is a Phase 3 move — the manifest will declare which
association triggers which card, and `status.jsx` becomes a lookup instead
of a switch.

---

## Layers, at a glance

| Layer | Files | Role |
| --- | --- | --- |
| **Data** | `db/migrate/*`, `app/models/<slug>_*.rb` | Tables, all `<slug>_` prefixed. Own only what's yours. |
| **API** | `app/controllers/api/v1/<slug>/*.rb`, `app/serializers/rest/<slug>_*.rb` | JSON boundary; thin controllers, authorise via Doorkeeper. |
| **Routes** | `config/routes.rb`, `config/routes/api.rb` | SPA wildcard + `namespace :<slug>` for the API. |
| **Feature module** | `app/javascript/mastodon/features/<slug>/*` | The UI. `index.tsx` mounts, `api.ts` fetches, `components/` renders, `types.ts` types. |
| **Registration** | `ui/index.jsx`, `async-components.js`, `navigation_panel/*`, `planets.tsx` | Cross-cutting existing-file edits that make your Korner known. |
| **Styles** | `_<slug>.scss`, `application.scss` | One partial, one `@use` line. |
| **Feed projection** *(optional)* | `Status.rb`, `StatusSerializer`, `<slug>_summary_serializer.rb`, `status_<slug>_card.tsx`, `status.jsx` | Only if posts from this Korner render as cards in the home timeline. |
| **Manifest** | `config/korners/<slug>.yaml` | Declaration of your Korner's shape. Not enforced yet. |

Everything above is *the pattern as of today*. The spec's endpoint is a
Korner that ships in half these touchpoints because manifest-driven
registration collapses many into one file. Getting there is Phase 3.
For now: match the pattern, mark the drift.
