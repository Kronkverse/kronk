# frozen_string_literal: true

# Kronk-specific per-user settings. Sits alongside PreferencesController
# but is writeable — feed_scope in particular needs a lightweight
# writeable surface so the Ӂ menu picker doesn't require a full Rails
# settings-form round-trip.
#
#   GET  /api/v1/kronk_settings
#       => { feed_scope: 'friends' | 'friends_of_friends' | 'kommunity' }
#
#   PUT  /api/v1/kronk_settings
#       body: { feed_scope: 'friends' }
#       => same shape, updated
class Api::V1::KronkSettingsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:accounts' }, only: [:show]
  before_action -> { doorkeeper_authorize! :write, :'write:accounts' }, only: [:update]
  before_action :require_user!

  def show
    render json: settings_payload
  end

  def update
    scope = params[:feed_scope]

    if scope.present?
      begin
        current_user.settings.update('kronk.feed_scope' => scope.to_s)
        current_user.save!
      rescue ArgumentError => e
        return render json: { error: e.message }, status: 422
      end
    end

    render json: settings_payload
  end

  private

  def settings_payload
    {
      feed_scope: current_user.settings['kronk.feed_scope'],
    }
  end
end
