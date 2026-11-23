# frozen_string_literal: true

# Kollection's side of a Doorkeeper application (docs/spaces/kollection.md).
# Included into Doorkeeper::Application at boot, next to Mastodon's own
# ApplicationExtension, so the engine files stay untouched.
#
# An app an admin has pulled can't be found as an OAuth client: Doorkeeper
# looks every client up through `by_uid` (authorize, token, and through
# `by_uid_and_secret` every client-authenticated request), so a pulled app
# gets the same answer as one that doesn't exist ("invalid_client"). Its
# tokens were revoked when it was pulled.
module Kronk::KollectionClient
  extend ActiveSupport::Concern

  included do
    has_one :kollection_app, foreign_key: :oauth_application_id, inverse_of: :oauth_application, dependent: nil
  end

  class_methods do
    def by_uid(uid)
      application = super
      return if application && KollectionApp.pulled.exists?(oauth_application_id: application.id)

      application
    end
  end
end
