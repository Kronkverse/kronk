# frozen_string_literal: true

# Be sure to restart your server when you modify this file.

Rails
  .application
  .config
  .session_store :cookie_store,
                 key: '_mastodon_session',
                 secure: Rails.env.production?, # explicit Secure flag in production (force_ssl also enforces it); off in dev/test which run over plain HTTP
                 same_site: :lax
