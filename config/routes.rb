# frozen_string_literal: true

require 'sidekiq_unique_jobs/web' if ENV['ENABLE_SIDEKIQ_UNIQUE_JOBS_UI'] == true
require 'sidekiq-scheduler/web'

class RedirectWithVary < ActionDispatch::Routing::PathRedirect
  def build_response(req)
    super.tap do |response|
      response.headers['Vary'] = 'Origin, Accept'
    end
  end
end

def redirect_with_vary(path)
  RedirectWithVary.new(301, path)
end

Rails.application.routes.draw do
  root 'home#index'

  mount LetterOpenerWeb::Engine, at: 'letter_opener' if Rails.env.development?

  get 'health', to: 'health#show'

  authenticate :user, ->(user) { user.role&.can?(:view_devops) } do
    mount Sidekiq::Web, at: 'sidekiq', as: :sidekiq
    mount PgHero::Engine, at: 'pghero', as: :pghero
  end

  use_doorkeeper do
    controllers authorizations: 'oauth/authorizations',
                authorized_applications: 'oauth/authorized_applications',
                tokens: 'oauth/tokens'
  end

  namespace :oauth do
    # As this is borrowed from OpenID, the specification says we must also support
    # POST for the userinfo endpoint:
    # https://openid.net/specs/openid-connect-core-1_0.html#UserInfo
    match 'userinfo', via: [:get, :post], to: 'userinfo#show', defaults: { format: 'json' }
  end

  scope path: '.well-known' do
    scope module: :well_known do
      get 'oauth-authorization-server', to: 'oauth_metadata#show', as: :oauth_metadata, defaults: { format: 'json' }
      get 'host-meta', to: 'host_meta#show', as: :host_meta
      get 'nodeinfo', to: 'node_info#index', as: :nodeinfo, defaults: { format: 'json' }
      get 'webfinger', to: 'webfinger#show', as: :webfinger
    end
    get 'change-password', to: redirect('/auth/edit'), as: nil
    get 'proxy', to: redirect { |_, request| "/authorize_interaction?#{request.params.to_query}" }, as: nil
  end

  get '/nodeinfo/2.0', to: 'well_known/node_info#show', as: :nodeinfo_schema

  get 'manifest', to: 'manifests#show', defaults: { format: 'json' }
  get 'intent', to: 'intents#show'
  get 'custom.css', to: 'custom_css#show'
  resources :custom_css, only: :show, path: :css

  get 'remote_interaction_helper', to: 'remote_interaction_helper#index'

  resource :instance_actor, path: 'actor', only: [:show] do
    scope module: :activitypub do
      resource :inbox, only: [:create]
      resource :outbox, only: [:show]
    end
  end

  get '/invite/:invite_code', constraints: ->(req) { req.format == :json }, to: 'api/v1/invites#show'

  devise_scope :user do
    get '/invite/:invite_code', to: 'auth/registrations#new', as: :public_invite

    resource :unsubscribe, only: [:show, :create], controller: :mail_subscriptions

    namespace :auth do
      resource :setup, only: [:show, :update], controller: :setup
      resource :challenge, only: [:create]
      resource :thresholds, only: [:show, :create], controller: :thresholds
      get 'username_available', to: 'username_availability#show'
      get 'sessions/security_key_options', to: 'sessions#webauthn_options'
      # Account switcher (server-side multi-session).
      get  'accounts', to: 'switches#index'
      post 'switch',   to: 'switches#create'
      post 'captcha_confirmation', to: 'confirmations#confirm_captcha', as: :captcha_confirmation
    end
  end

  scope module: :auth do
    devise_for :users, path: 'auth', format: false
  end

  with_options constraints: ->(req) { req.format.nil? || req.format.html? } do
    get '/users/:username', to: redirect_with_vary('/@%{username}')
    get '/users/:username/following', to: redirect_with_vary('/@%{username}/following')
    get '/users/:username/followers', to: redirect_with_vary('/@%{username}/followers')
    get '/users/:username/statuses/:id', to: redirect_with_vary('/@%{username}/%{id}')
  end

  get '/authorize_follow', to: redirect { |_, request| "/authorize_interaction?#{request.params.to_query}" }

  concern :account_resources do
    resources :followers, only: [:index], controller: :follower_accounts
    resources :following, only: [:index], controller: :following_accounts

    scope module: :activitypub do
      resource :outbox, only: [:show]
      resource :inbox, only: [:create]
      resources :collections, only: [:show]
      resource :followers_synchronization, only: [:show]
      resources :quote_authorizations, only: [:show]
    end
  end

  resources :accounts, path: 'users', only: [:show], param: :username, concerns: :account_resources do
    resources :statuses, only: [:show] do
      member do
        get :activity
        get :embed
      end

      resources :replies, only: [:index], module: :activitypub
      resources :likes, only: [:index], module: :activitypub
      resources :shares, only: [:index], module: :activitypub
    end
  end

  scope path: 'ap', as: 'ap' do
    resources :accounts, path: 'users', only: [:show], param: :id, concerns: :account_resources do
      resources :statuses, only: [:show] do
        member do
          get :activity
        end

        resources :replies, only: [:index], module: :activitypub
        resources :likes, only: [:index], module: :activitypub
        resources :shares, only: [:index], module: :activitypub
      end
    end
  end

  resource :inbox, only: [:create], module: :activitypub
  resources :contexts, only: [:show], module: :activitypub, constraints: { id: /[0-9]+-[0-9]+/ } do
    member do
      get :items
    end
  end

  constraints(encoded_path: /%40.*/) do
    get '/:encoded_path', to: redirect { |params|
      "/#{params[:encoded_path].gsub('%40', '@')}"
    }
  end

  constraints(username: %r{[^@/.]+}) do
    with_options to: 'accounts#show' do
      get '/@:username', as: :short_account
      get '/@:username/featured'
      get '/@:username/with_replies', as: :short_account_with_replies
      get '/@:username/media', as: :short_account_media

      get '/@:username/nudges', as: :short_account_nudges
      get '/@:username/mates', as: :short_account_mates
      get '/@:username/tagged/:tag', as: :short_account_tag
    end
  end

  constraints(account_username: %r{[^@/.]+}) do
    get '/@:account_username/following', to: 'following_accounts#index'
    get '/@:account_username/followers', to: 'follower_accounts#index'
    # Sectioned profile view — served by the SPA. Comes BEFORE the
    # generic /:id status route so 'profile' isn't matched as a status id.
    get '/@:account_username/profile', to: 'home#index'
    # Kronk-native Connections subview (follow requests + followers +
    # following) — SPA-served. Same reasoning re: ordering.
    get '/@:account_username/connections', to: 'home#index'
    # Profile composer (owner-only) — SPA-served. Same reasoning re:
    # ordering: 'edit' must not be matched as a status id.
    get '/@:account_username/edit', to: 'home#index'
    # Pretty personal invite: /@tal/invite → looks up Tal's evergreen
    # personal invite (creating it if absent) and redirects to the
    # canonical /invite/<code>. Must sit BEFORE the generic /:id
    # status route so 'invite' isn't matched as a status id.
    get '/@:account_username/invite', to: 'pretty_invites#show', as: :pretty_invite
    get '/@:account_username/:id', to: 'statuses#show', as: :short_account_status
    get '/@:account_username/:id/embed', to: 'statuses#embed', as: :embed_short_account_status
  end

  get '/@:username_with_domain/(*any)', to: 'home#index', constraints: { username_with_domain: %r{([^/])+?} }, as: :account_with_domain, format: false
  # /settings is the SPA settings hub (settings rebuild §4.1) — a launchpad
  # for the personal "You" sections and every korner's settings. The classic
  # Devise/Doorkeeper settings pages below (draw :settings) still serve their
  # own sub-paths (e.g. /settings/profile, /settings/preferences/*).
  get '/settings', to: 'home#index'
  # SPA-served settings sub-pages that don't live in the Devise/Doorkeeper
  # settings module. Add here as new ones ship.
  get '/settings/profile_sections', to: 'home#index'
  get '/settings/you', to: 'home#index'
  get '/hub/settings', to: 'home#index'
  get '/settings/appearance', to: 'home#index'
  get '/settings/posting', to: 'home#index'
  get '/settings/notifications', to: 'home#index'
  get '/settings/privacy', to: 'home#index'

  # /me — the "Me" hub (SPA, `features/me_hub/`, shipped in #1159).
  # Needs a Rails-side mount to `home#index` so the SPA shell renders
  # before React Router picks up the route; without this Rails 404s
  # before the SPA gets a chance to match.
  get '/me', to: 'home#index'

  draw(:settings)

  namespace :disputes do
    resources :strikes, only: [:show, :index] do
      resource :appeal, only: [:create]
    end
  end

  namespace :redirect do
    resources :accounts, only: :show
    resources :statuses, only: :show
  end

  resources :media, only: [:show] do
    get :player
  end

  resources :tags,   only: [:show]
  resources :emojis, only: [:show]
  resources :invites, only: [:index, :create, :destroy]
  resources :filters, except: [:show] do
    resources :statuses, only: [:index], controller: 'filters/statuses' do
      collection do
        post :batch
      end
    end
  end

  resource :relationships, only: [:show, :update]
  resources :severed_relationships, only: [:index] do
    member do
      constraints(format: :csv) do
        get :followers
        get :following
      end
    end
  end
  resource :statuses_cleanup, controller: :statuses_cleanup, only: [:show, :update]

  get '/media_proxy/:id/(*any)', to: 'media_proxy#show', as: :media_proxy, format: false
  get '/backups/:id/download', to: 'backups#download', as: :download_backup, format: false

  resource :authorize_interaction, only: [:show]
  resource :share, only: [:show]

  draw(:admin)

  get '/admin', to: redirect('/admin/dashboard', status: 302)

  draw(:api)

  draw(:fasp)

  get '/activity', to: redirect('/orbit')
  get '/space-preview/:space', to: 'space_preview#show'
  # Booth's Rails-served resource routes (share, embed). Named routes
  # preserve their :as identifiers so link generators (share/copy-link,
  # embed iframe src) continue to resolve.
  get '/booth/sets/:id/embed', to: 'booth#embed', as: :embed_booth_set
  get '/booth/sets/:id', to: 'booth#show', as: :booth_set, constraints: { id: /\d+/ }
  get '/home', to: 'home#index'
  get '/home/settings', to: 'home#index'
  get '/styleguide', to: 'home#index'
  # Huddle is a korner surface at /hub/huddle now; forward the legacy path.
  get '/huddle', to: redirect('/hub/huddle')
  get '/nudges', to: 'home#index'
  get '/nudges/*path', to: 'home#index', format: false

  # Legacy top-level korner paths — 301 redirect to their /hub/<slug>
  # counterparts. Client-side navigation continues to use whichever URL
  # the SPA's <Link> generates (all swept to /hub/... paths); these
  # redirects fire on refresh, bookmarks, and external links.
  get '/booth', to: redirect('/hub/booth', status: 301)
  get '/booth/*path', to: redirect('/hub/booth/%{path}', status: 301)
  get '/kalendar', to: redirect('/hub/kalendar', status: 301)
  get '/kalendar/*path', to: redirect('/hub/kalendar/%{path}', status: 301)
  get '/governance', to: redirect('/hub/kommons', status: 301)
  get '/governance/*path', to: redirect('/hub/kommons/%{path}', status: 301)
  get '/questions', to: redirect('/hub/kuestions', status: 301)
  get '/questions/*path', to: redirect('/hub/kuestions/%{path}', status: 301)
  # Legacy: the pre-/hub/ path (Phase 3 URL migration) and the pre-rename
  # hyphenated mount both fold into /hub/inflow. Kept indefinitely — these
  # URLs are in already-projected feed cards and in users' bookmarks.
  get '/in-flow', to: redirect('/hub/inflow', status: 301)
  get '/in-flow/*path', to: redirect('/hub/inflow/%{path}', status: 301)
  get '/hub/in-flow', to: redirect('/hub/inflow', status: 301)
  get '/hub/in-flow/*path', to: redirect('/hub/inflow/%{path}', status: 301)
  get '/market', to: redirect('/hub/martketplace', status: 301)
  get '/market/*path', to: redirect('/hub/martketplace/%{path}', status: 301)
  get '/hub/marketplace', to: redirect('/hub/martketplace', status: 301)
  get '/hub/marketplace/*path', to: redirect('/hub/martketplace/%{path}', status: 301)
  get '/hub/wachuneed', to: redirect('/hub/martketplace', status: 301)
  get '/hub/wachuneed/*path', to: redirect('/hub/martketplace/%{path}', status: 301)

  # Korner framework — every korner mounts under /hub/<slug> per
  # docs/kronk_korner_spec.md §4. Legacy top-level paths above 301 here.
  # The Kommons Directory was called the Tree until 2026-07-18. `tree` is
  # being reserved for a future invite-lineage space, so the old path
  # redirects rather than staying a live alias.
  get '/hub/kommons/tree', to: redirect('/hub/kommons/lattice', status: 301)
  get '/hub/kommons', to: 'home#index'
  get '/hub/kommons/*path', to: 'home#index', format: false
  # Kommunity — the whole-graph 3D orb view (KRONK_ORB_DATA_BRIEF).
  # SPA-only, no controller. Direct/deep-link loads land on home#index
  # which boots the SPA; features/kommunity/index.tsx handles the rest.
  get '/hub/kommunity', to: 'home#index'
  get '/hub/kommunity/*path', to: 'home#index', format: false
  get '/hub/kuestions', to: 'home#index'
  get '/hub/kuestions/*path', to: 'home#index', format: false
  get '/hub/kalendar', to: 'kalendar#index'
  get '/hub/kalendar/*path', to: 'kalendar#index', format: false
  get '/hub/booth/sets/:id/embed', to: 'booth#embed'
  get '/hub/booth/sets/:id', to: 'booth#show', constraints: { id: /\d+/ }
  get '/hub/booth', to: 'booth#index'
  get '/hub/booth/*path', to: 'booth#index', format: false
  get '/hub/martketplace', to: 'home#index'
  get '/hub/martketplace/*path', to: 'home#index', format: false
  get '/hub/inflow', to: 'home#index'
  get '/hub/inflow/*path', to: 'home#index', format: false
  # Krews — Phase 2 removes the legacy /hub/groups alias that Phase 1
  # kept alive for a release. The canonical route is /hub/krew.
  get '/hub/krew', to: 'home#index'
  get '/hub/krew/*path', to: 'home#index', format: false
  # Klot (KRONK_TIDES) — SPA-only, no controller. Direct/deep-link
  # loads land on home#index which boots the SPA; the client-side
  # router resolves /hub/klot.
  get '/hub/klot', to: 'home#index'
  get '/hub/klot/*path', to: 'home#index', format: false
  # Framework surfaces reached from the Ж menu — SPA-only, no controller.
  # Without these, a direct load / hard-reload of the deep link 404s.
  get '/hub/search', to: 'home#index'
  get '/hub/you', to: 'home#index'
  get '/hub/huddle', to: 'huddle#index'
  get '/hub/huddle/*path', to: 'huddle#index', format: false

  # Moments (KRONK moments discovery locked in alpha.313) — the models
  # + composer landed in alpha.31X. Wildcard for deep links to
  # /hub/moments/:id (viewer).
  get '/hub/moments', to: 'home#index'
  get '/hub/moments/*path', to: 'home#index', format: false
  # Albutts — shipped 2026-07-29 with a real SPA (directory + detail).
  # The wildcard lets a direct load or hard-reload of e.g.
  # /hub/albutts/albums/:id (or /hub/albutts/new) boot the SPA instead
  # of 404ing; the client router then resolves the sub-path.
  get '/hub/albutts', to: 'home#index'
  get '/hub/albutts/*path', to: 'home#index', format: false
  # Map has real lenses now (mates/treks/logger); the /*path wildcard
  # lets a direct load or hard-reload of /hub/map/<lens> boot the SPA
  # instead of 404ing (the client router then resolves the lens).
  get '/hub/map', to: 'home#index'
  get '/hub/map/*path', to: 'home#index', format: false
  # Kompass was renamed to Map (its original Kommons-proposal name);
  # keep the old path working with a permanent redirect.
  get '/hub/kompass', to: redirect('/hub/map')

  # /hub bare — the landing grid. Ships in 2.0.0 as the third HubSwitcher
  # tab (Feed / Profile / Hub).
  get '/hub', to: 'home#index'

  # Per-korner settings pages (spec §K). Fall through to the SPA.
  get '/hub/:slug/settings', to: 'home#index', constraints: { slug: /[a-z0-9-]+/ }

  # Kronk organisation space (§O) — served at /kronk/* from markdown
  # under content/kronk/. The wordmark in the app chrome links here.
  # About / privacy / terms are named routes so existing callers
  # (`about_url`, `privacy_policy_url`, `terms_of_service_url`) keep
  # working — they now generate `/kronk/*` paths. The upstream Mastodon
  # routes (`/about`, `/privacy-policy`, `/terms-of-service`) become
  # 301 redirects to keep bookmarks and federation crawlers alive.
  get '/kronk',           to: 'kronk#show', defaults: { page: 'about' }
  get '/kronk/about',     to: 'kronk#show', defaults: { page: 'about' },   as: :about
  get '/kronk/privacy',   to: 'kronk#show', defaults: { page: 'privacy' }, as: :privacy_policy
  get '/kronk/terms',     to: 'kronk#show', defaults: { page: 'terms' },   as: :terms_of_service
  get '/kronk/:page',     to: 'kronk#show', constraints: { page: %r{[a-z0-9-]+(?:/[a-z0-9-]+)?} }

  draw(:web_app)

  get '/web/(*any)', to: redirect(path: '/%{any}', status: 302), as: :web, defaults: { any: '' }, format: false

  # Legacy upstream Mastodon paths. Retired 2026-08-02 alongside the
  # signup revamp — all instance-facing HTML consolidated under
  # `/kronk/*`. 301 to preserve federation crawlers, bookmarks, and
  # links in already-sent email. `/terms-of-service/:date` (versioned
  # ToS) is squashed to the current page — versioning goes with the
  # ToS model retirement.
  get '/about',                  to: redirect('/kronk/about',   status: 301)
  get '/about/more',             to: redirect('/kronk/about',   status: 301)
  get '/privacy-policy',         to: redirect('/kronk/privacy', status: 301)
  get '/terms-of-service',       to: redirect('/kronk/terms',   status: 301)
  get '/terms-of-service/:date', to: redirect('/kronk/terms',   status: 301)
  get '/terms',                  to: redirect('/kronk/terms',   status: 301)

  match '/', via: [:post, :put, :patch, :delete], to: 'application#raise_not_found', format: false
  match '*unmatched_route', via: :all, to: 'application#raise_not_found', format: false
end
