# frozen_string_literal: true

# Kronk-specific per-user settings. Sits alongside PreferencesController
# but is writeable — feed_scope in particular needs a lightweight
# writeable surface so the Home chip row doesn't require a full Rails
# settings-form round-trip.
#
#   GET  /api/v1/kronk_settings
#       => { feed_scope: 'mates' | 'orbit' | 'kommunity' }
#
#   PUT  /api/v1/kronk_settings
#       body: { feed_scope: 'mates' }
#       => same shape, updated
class Api::V1::KronkSettingsController < Api::BaseController
  # Legacy names still allowed on write for a grace window while any
  # persisted values age out. Normalised to the new tier before store.
  LEGACY_SCOPE_ALIAS = {
    'friends' => 'mates',
    'friends_of_friends' => 'orbit',
  }.freeze

  before_action -> { doorkeeper_authorize! :read, :'read:accounts' }, only: [:show]
  before_action -> { doorkeeper_authorize! :write, :'write:accounts' }, only: [:update]
  before_action :require_user!

  def show
    render json: settings_payload
  end

  def update
    scope = params[:feed_scope]

    if scope.present?
      normalized = LEGACY_SCOPE_ALIAS.fetch(scope.to_s, scope.to_s)
      begin
        current_user.settings.update('kronk.feed_scope' => normalized)
        current_user.save!
      rescue ArgumentError => e
        return render json: { error: e.message }, status: 422
      end
    end

    render json: settings_payload
  end

  private

  def settings_payload
    stored = current_user.settings['kronk.feed_scope']
    { feed_scope: LEGACY_SCOPE_ALIAS.fetch(stored, stored) }
  end
end
