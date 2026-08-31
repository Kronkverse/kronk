# frozen_string_literal: true

namespace :api, format: false do
  # OEmbed
  get '/oembed', to: 'oembed#show', as: :oembed

  # Experimental JSON / REST API
  namespace :v1_alpha do
    resources :async_refreshes, only: :show
  end

  # JSON / REST API
  namespace :v1 do
    get '/invites/personal', to: 'invites#personal'
    resources :statuses, only: [:index, :create, :show, :update, :destroy] do
      scope module: :statuses do
        resources :reblogged_by, controller: :reblogged_by_accounts, only: :index
        resources :favourited_by, controller: :favourited_by_accounts, only: :index
        resource :reblog, only: :create
        post :unreblog, to: 'reblogs#destroy'

        resources :quotes, only: :index do
          member do
            post :revoke
          end
        end

        resource :favourite, only: :create
        post :unfavourite, to: 'favourites#destroy'

        resource :bookmark, only: :create
        post :unbookmark, to: 'bookmarks#destroy'

        resource :mute, only: :create
        post :unmute, to: 'mutes#destroy'

        resource :pin, only: :create
        post :unpin, to: 'pins#destroy'

        resource :history, only: :show
        resource :audience, only: :show
        resource :source, only: :show

        resource :interaction_policy, only: :update

        post :translate, to: 'translations#create'
      end

      member do
        get :context
      end
    end

    namespace :timelines do
      resource :home, only: :show, controller: :home
      resource :public, only: :show, controller: :public
      resource :link, only: :show, controller: :link
      resource :friends_activity, only: :show, controller: :friends_activity
      resources :tag, only: :show
      resources :list, only: :show
    end

    with_options to: 'streaming#index' do
      get '/streaming'
      get '/streaming/(*any)'
    end

    resources :custom_emojis, only: [:index]
    resources :suggestions, only: [:index, :destroy]
    resources :scheduled_statuses, only: [:index, :show, :update, :destroy]
    resource :draft, only: [:show, :update, :destroy]
    resources :preferences, only: [:index]

    resource :huddle_token, only: [:show]
    # Open Huddle Rooms — docs/spaces/huddle.md § Three categories.
    namespace :huddle do
      resources :rooms, only: [:index, :create]
    end
    resource :token_balance, only: [:show]
    resources :annual_reports, only: [:index, :show] do
      member do
        post :read
      end
    end

    resources :announcements, only: [:index] do
      scope module: :announcements do
        resources :reactions, only: [:update, :destroy]
      end

      member do
        post :dismiss
      end
    end

    resources :conversations, only: [:index, :destroy] do
      member do
        post :read
        post :unread
      end
    end

    resources :media, only: [:create, :update, :show, :destroy] do
      resources :tags, only: [:index, :create, :destroy], controller: 'media_tags'
    end
    resources :blocks, only: [:index]
    resources :mutes, only: [:index]
    resources :favourites, only: [:index]
    resources :bookmarks, only: [:index]

    namespace :inflow do
      resource :observation, only: [:show]
    end

    resources :booth_sets, only: [:index, :show, :create, :update, :destroy] do
      member do
        post :play
        post :share
      end
    end

    # KornerAttachment REST surface (docs/kronk_korner_attachments.md §3.1).
    # Distinct from the proposal-nested `attachments` resource below — this
    # is the cross-korner join primitive, keyed by manifest slug + id.
    resources :attachments, controller: 'attachments', only: [:index, :create, :destroy] do
      collection do
        # Shared candidates search — a picker asks "what could I
        # attach a Kalendar event to?" and gets a list of Album /
        # Booth Set / whatever rows the current user can see + own.
        # Powers `<AttachmentPicker>` (spec §4.3).
        get :candidates, to: 'attachments/candidates#index'
      end
    end

    resources :events, only: [:index, :show, :create, :update, :destroy] do
      member do
        post :rsvp
        get :attendees
        post :invite
        get :my_invitees
      end
    end
    # Moments — ephemeral posts, gone by morning (docs/spaces/moments.md).
    # POST/DELETE :froth is nested via the moment_froths controller
    # (member action rather than nested resource — a Moment has at most
    # one Froth per viewer, so REST's collection/member split is more
    # awkward than a single toggle route).
    resources :moments, only: [:index, :show, :create, :update, :destroy] do
      member do
        post   :froth, to: 'moment_froths#create'
        delete :froth, to: 'moment_froths#destroy'
      end
    end
    resources :proposals, only: [:index, :show, :create, :update] do
      resources :attachments, only: [:index, :create, :show, :destroy], module: :proposals
      resources :comments, only: [:index, :create, :destroy], module: :proposals
      member do
        post :vote
        delete :unvote
        post :back
        post :complete
      end
      resources :tasks, only: [:index, :create, :update], shallow: true
    end

    # Kommons Tree — the feedback map of Kronk. Nodes are user-facing
    # page-types (auto-derived from Kronk::NodeRegistry); a feedback
    # item is a Kommons proposal tagged with `node_id`.
    namespace :kommons do
      resources :nodes, only: [:index]
    end

    namespace :kalendar do
      resources :birthdays, only: [:index]
    end

    namespace :martketplace do
      resources :listings, only: [:index, :show, :create]
    end

    # Albutts — shared albums. Photos are nested under an album; each
    # row is one contribution. See docs/spaces/albutts.md. Per-photo
    # reactions (froth + comments) hang off the photo id — the lightbox
    # opens on a single photo and drives both endpoints from there.
    namespace :albutts do
      resources :albums, only: [:index, :show, :create, :update, :destroy] do
        resources :photos, only: [:create], controller: 'photos'
      end
      resources :album_photos, only: [:update, :destroy], path: 'photos', controller: 'photos'
      # Froth + comment endpoints retired 2026-07-31: an AlbumPhoto is
      # now Status-backed, so favourites go to
      # /api/v1/statuses/:id/favourite and replies use the standard
      # thread endpoints. See docs/spaces/albutts.md §Reactions.
    end

    # Klot — cycle tracker (KRONK_TIDES). Self is a singleton (one per
    # account); logs and settings hang off it. Viewers is the caller's
    # outbound allowlist; circle is the inbound projection with the
    # strict phase-only contract.
    # Map — opt-in presence. Presence is one-per-account; place/remove act on
    # the caller's own pin, index returns pins visible to the caller (Mates-
    # gated). See docs/spaces/map.md.
    namespace :map do
      get    'presence',      to: 'presence#index'
      get    'presence/self', to: 'presence#show'
      post   'presence',      to: 'presence#create'
      delete 'presence',      to: 'presence#destroy'

      # Server-side proxy for OSM Nominatim — see
      # `Api::V1::Map::GeocodeController` for why we don't hit Nominatim
      # from the browser directly. Search box on the map's place
      # control hits this to turn a typed place name into lat/lng.
      get 'geocode', to: 'geocode#index'

      # Treks — recorded activities; feed is mine + Mates' published.
      resources :treks, only: [:index, :show, :create, :destroy] do
        member do
          post :publish
          post :unpublish
        end
      end

      # Event pins — upcoming Kalendar events with a parseable OSM
      # location_url surface here as spiral markers, filtered by the
      # caller's visibility on the underlying Event. The Kalendar ↔
      # Map bridge (event_detail's location link routes to
      # /hub/map?event=<slug>, which reads back into this feed).
      get 'events', to: 'events#index'
    end

    namespace :klot do
      get    'self',              to: 'self#show'
      post   'self/logs',         to: 'self#create_log'
      delete 'self/logs/:id',     to: 'self#destroy_log'
      patch  'self/settings',     to: 'self#update_settings'
      resources :viewers, only: [:index, :create, :destroy], param: :account_id
      get 'circle', to: 'circle#index'
    end

    namespace :kommunity do
      # Discover — the legacy list surface. Kept for any external
      # caller; the SPA now hits the three per-layer endpoints below.
      get 'discover', to: 'discover#index'
      # Discover drawer layers (Tal 2026-08-28): three per-layer
      # lists — public strangers, mates-of-mates, and members of the
      # viewer's krews. Each excludes viewer + viewer's mates.
      get 'kronkers', to: 'layers#kronkers'
      get 'orbit',    to: 'layers#orbit'
      get 'krews',    to: 'layers#krews'
      # Orb — top-N local accounts + follow edges between them.
      # Powers the <KronkOrb> Fibonacci sphere; response is cached
      # server-side (see OrbController::CACHE_TTL).
      get 'orb', to: 'orb#show'
    end

    resources :reports, only: [:create]
    resources :trends, only: [:index], controller: 'trends/tags'
    resources :filters, only: [:index, :create, :show, :update, :destroy]
    resources :endorsements, only: [:index]
    resources :markers, only: [:index, :create]

    namespace :profile do
      resource :avatar, only: :destroy
      resource :header, only: :destroy
    end

    namespace :apps do
      get :verify_credentials, to: 'credentials#show'
    end

    resources :apps, only: [:create]

    namespace :trends do
      resources :tags, only: [:index]
      resources :links, only: [:index]
      resources :statuses, only: [:index]
    end

    namespace :emails do
      resources :confirmations, only: [:create]
      get :check_confirmation, to: 'confirmations#check'
    end

    # Kronk-specific: korner manifest catalogue + kategories + hub order.
    # Under /api/v1/ so downstream apps (Android, iOS shell) hit stable v1 paths.
    resource :kronk_settings, only: [:show, :update], controller: :kronk_settings
    # Personal settings sections (settings rebuild §7). Each is a writeable
    # read/write surface over a slice of the user's preferences.
    namespace :settings do
      resource :appearance, only: [:show, :update], controller: :appearance
      resource :posting, only: [:show, :update], controller: :posting
      resource :feed, only: [:show, :update], controller: :feed
      resource :notifications, only: [:show, :update], controller: :notifications
      resource :privacy, only: [:show, :update], controller: :privacy
      resources :sessions, only: [:index, :destroy]
      resources :login_activities, only: [:index]
    end
    resources :korners, only: [:index, :show], constraints: { id: %r{[^/]+} } do
      member do
        # Tune-out is per-account per-korner (spec §N.5). Present = tuned
        # out. Idempotent create/destroy so the button can toggle safely.
        post :tune_out, action: :tune_out
        delete :tune_out, action: :tune_in
        # Canonical spec §K.9 alias.
        post :tune_in, action: :tune_in

        # Opening a korner marks its content seen up to now (unread badge → 0).
        post :seen, action: :mark_seen

        # Per-korner user settings (spec §K).
        get :settings, action: :settings_show
        post :settings, action: :settings_update
      end

      # Per-name PATCH/DELETE for autosave (spec §K.9 canonical path).
      # `korner_id` is populated by resources :korners; `name` may be
      # dotted (e.g. `push.<type>`) so match allows that.
      member do
        patch 'settings/:name', to: 'korners#setting_patch', constraints: { name: %r{[^/]+} }, as: :setting_patch
        delete 'settings/:name', to: 'korners#setting_delete', constraints: { name: %r{[^/]+} }, as: :setting_delete
      end
    end
    resources :kategories, only: [:index]

    namespace :hub do
      resource :order, only: [:show, :update, :destroy], controller: :orders
    end

    namespace :profile do
      # Library catalogue — told presets (unfilled ProfileCard types)
      # + drawn presets (available korner-projection shelves for this
      # account). Powers the composer's "add a shelf/card" grid.
      get :library, to: 'library#show'

      resources :sections, only: [:index, :create, :update, :destroy] do
        collection do
          put :reorder
        end
      end

      # Identity content cards on the Me tab (About me, Interests, etc.).
      # Keyed by card_type — see ProfileCard::CARD_TYPES.
      resources :cards, only: [:index, :update, :destroy], param: :card_type do
        collection do
          patch :reorder
        end
      end
    end

    # /api/v1/mates — the mates-graph slice for the Mates timeline view
    # (features/mates_tab). `show` returns { members, mates, anchor_date }
    # for a subject account. Subject defaults to current_user; pass
    # `?subject=@handle` to inspect another Kronker.
    namespace :mates do
      resource :timeline, only: :show, controller: :timelines
    end

    namespace :nudges do
      resources :legacy, only: [:index], controller: :legacy_archive
      resources :activity, only: [:index], controller: :activity
      resources :mates, only: [:index]
      resources :conversations, only: [:index, :show, :create] do
        member do
          post :read
          post :leave
          post :mute
          post :unmute
        end
        resources :messages, only: [:create, :destroy] do
          resources :reactions, only: [:create], controller: :reactions
          delete 'reactions/:symbol', to: 'reactions#destroy', constraints: { symbol: %r{[^/]+} }
        end
      end
    end

    resources :krews, only: [:index, :show, :create, :update, :destroy] do
      member do
        get  :members
        post :join
        post :leave
        # Korner attachments (KrewKorner). :attach creates by slug in
        # the body; :detach removes by slug in the URL so DELETE is
        # idempotent and doesn't need a body.
        post   :attach
        delete 'attach/:korner', action: :detach
        # Invite token rotation (Phase 4c).
        post :regenerate_invite
      end

      # KrewRequirement CRUD (Phase 4c). Scoped nested so the URL
      # reads /api/v1/krews/:id/requirements[/:req_id].
      member do
        post   'requirements', action: :add_requirement
        delete 'requirements/:requirement_id', action: :remove_requirement
      end

      scope module: :krews do
        resources :statuses, only: [:index, :create]
      end
    end

    resource :instance, only: [:show] do
      scope module: :instances do
        resources :peers, only: [:index]
        resources :rules, only: [:index]
        resources :domain_blocks, only: [:index]
        resource :privacy_policy, only: [:show]
        resource :extended_description, only: [:show]
        resource :translation_languages, only: [:show]
        resource :languages, only: [:show]
        resource :activity, only: [:show], controller: :activity
      end
    end

    namespace :peers do
      get :search, to: 'search#index'
    end

    namespace :domain_blocks do
      resource :preview, only: [:show]
    end

    resource :domain_blocks, only: [:show, :create, :destroy]

    resource :directory, only: [:show]

    resources :follow_requests, only: [:index] do
      member do
        post :authorize
        post :reject
      end
    end

    # Kronk — Mates: incoming Mate requests + accept/decline (Requests view).
    resources :mate_requests, only: [:index] do
      member do
        post :accept
        post :reject
      end
    end

    namespace :notifications do
      resources :requests, only: [:index, :show] do
        collection do
          post :accept, to: 'requests#accept_bulk'
          post :dismiss, to: 'requests#dismiss_bulk'
          get :merged, to: 'requests#merged?'
        end

        member do
          post :accept
          post :dismiss
        end
      end

      resource :policy, only: [:show, :update]
    end

    resources :notifications, only: [:index, :show] do
      collection do
        post :clear
        get :unread_count
      end

      member do
        post :dismiss
        post :nudge_react, to: 'nudge_reactions#create'
        delete :nudge_react, to: 'nudge_reactions#destroy'
      end
    end

    namespace :accounts do
      get :verify_credentials, to: 'credentials#show'
      patch :update_credentials, to: 'credentials#update'
      resource :search, only: :show, controller: :search
      resource :lookup, only: :show, controller: :lookup
      resources :relationships, only: :index
      resources :familiar_followers, only: :index
    end

    resources :accounts, only: [:index, :create, :show] do
      scope module: :accounts do
        resources :statuses, only: :index
        resources :followers, only: :index, controller: :follower_accounts
        resources :following, only: :index, controller: :following_accounts
        resources :lists, only: :index
        resources :identity_proofs, only: :index
        resources :featured_tags, only: :index
        resources :endorsements, only: :index
        resources :matuals, only: :index

        namespace :profile do
          resources :sections, only: [:index] do
            member do
              get :statuses
            end
          end

          # Read-only listing of the target account's identity cards.
          # Filtered per-viewer by ProfileCard#visible_to?
          resources :cards, only: [:index], param: :card_type
        end
      end

      collection do
        get :nudge_partners
        get :nudge_history
        get :nudge_pending_count
      end

      member do
        post :follow
        post :unfollow
        post :mate
        post :unmate
        post :remove_from_followers
        post :block
        post :unblock
        post :mute
        post :unmute
        post :nudge
        get :nudge_streak
        get :nudge_thread
        get :tagged_media
      end

      scope module: :accounts do
        post :pin, to: 'endorsements#create'
        post :endorse, to: 'endorsements#create'
        post :unpin, to: 'endorsements#destroy'
        post :unendorse, to: 'endorsements#destroy'
        resource :note, only: :create
      end
    end

    resources :tags, only: [:show] do
      member do
        post :follow
        post :unfollow
        post :feature
        post :unfeature
      end
    end

    resources :followed_tags, only: [:index]

    resources :lists, only: [:index, :create, :show, :update, :destroy] do
      resource :accounts, only: [:show, :create, :destroy], module: :lists
    end

    namespace :featured_tags do
      get :suggestions, to: 'suggestions#index'
    end

    resources :featured_tags, only: [:index, :create, :destroy]

    resources :polls, only: [:show] do
      resources :votes, only: :create, module: :polls
    end

    namespace :push do
      resource :subscription, only: [:create, :show, :update, :destroy]
    end

    namespace :admin do
      resources :accounts, only: [:index, :show, :destroy] do
        member do
          post :enable
          post :unsensitive
          post :unsilence
          post :unsuspend
          post :approve
          post :reject
        end

        resource :action, only: [:create], controller: 'account_actions'
      end

      resources :reports, only: [:index, :update, :show] do
        member do
          post :assign_to_self
          post :unassign
          post :reopen
          post :resolve
        end
      end

      resources :domain_allows, only: [:index, :show, :create, :destroy]
      resources :domain_blocks, only: [:index, :show, :update, :create, :destroy]
      resources :email_domain_blocks, only: [:index, :show, :create, :destroy]
      resources :ip_blocks, only: [:index, :show, :update, :create, :destroy]

      namespace :trends do
        resources :tags, only: [:index] do
          member do
            post :approve
            post :reject
          end
        end
        resources :links, only: [:index] do
          member do
            post :approve
            post :reject
          end
        end
        resources :statuses, only: [:index] do
          member do
            post :approve
            post :reject
          end
        end

        namespace :links do
          resources :preview_card_providers, only: [:index], path: :publishers do
            member do
              post :approve
              post :reject
            end
          end
        end
      end

      post :measures, to: 'measures#create'
      post :dimensions, to: 'dimensions#create'
      post :retention, to: 'retention#create'

      resources :canonical_email_blocks, only: [:index, :create, :show, :destroy] do
        collection do
          post :test
        end
      end

      resources :tags, only: [:index, :show, :update]
    end
  end

  namespace :v2 do
    get '/search', to: 'search#index', as: :search

    resources :media, only: [:create]
    resources :suggestions, only: [:index]
    resource :instance, only: [:show]
    resources :filters, only: [:index, :create, :show, :update, :destroy] do
      scope module: :filters do
        resources :keywords, only: [:index, :create]
        resources :statuses, only: [:index, :create]
      end
    end

    namespace :filters do
      resources :keywords, only: [:show, :update, :destroy]
      resources :statuses, only: [:show, :destroy]
    end

    namespace :admin do
      resources :accounts, only: [:index]
    end

    namespace :notifications do
      resource :policy, only: [:show, :update]
    end

    resources :notifications, param: :group_key, only: [:index, :show] do
      collection do
        post :clear
        get :unread_count
      end

      member do
        post :dismiss
      end

      resources :accounts, only: [:index], module: :notifications
    end

    # Kuestions v2 rebuild — swipe-deck shape + gated answers. Legacy
    # /api/v1/questions stays for the transition (see docs/spaces/kuestions.md).
    resources :kuestions, only: [:index, :show, :create] do
      collection do
        get 'prompt/today', to: 'kuestions/daily_prompt#show'
      end
      resources :answers, only: [:create], module: :kuestions
      resource  :skip,    only: [:create, :destroy], module: :kuestions
    end
  end

  namespace :web do
    resource :settings, only: [:update]
    resources :embeds, only: [:show]
    resources :push_subscriptions, only: [:create, :destroy, :update]
  end
end
