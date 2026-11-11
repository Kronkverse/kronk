# frozen_string_literal: true

# Kronk-specific per-user settings. Sits alongside PreferencesController
# but is writeable, so feed settings can save a choice without a full Rails
# settings-form round-trip.
#
#   GET  /api/v1/kronk_settings
#       => { feed_opens_on: 'me' | 'mates' | 'orbit' | 'kommunity' }
#
#   PUT  /api/v1/kronk_settings
#       body: { feed_opens_on: 'mates' }
#       => same shape, updated
#
# `feed_opens_on` is the width Home opens on (`kommunity` is Kronkverse,
# the default). Turning the barrel on Home doesn't change it (Tal,
# 2026-11-11); only feed settings does. docs/spaces/feed.md, What the feed
# shows.
class Api::V1::KronkSettingsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:accounts' }, only: [:show]
  before_action -> { doorkeeper_authorize! :write, :'write:accounts' }, only: [:update]
  before_action :require_user!

  def show
    render json: settings_payload
  end

  def update
    opens_on = params[:feed_opens_on]

    if opens_on.present?
      begin
        current_user.settings.update('kronk.feed_opens_on' => opens_on.to_s)
        current_user.save!
      rescue ArgumentError => e
        return render json: { error: e.message }, status: 422
      end
    end

    render json: settings_payload
  end

  private

  def settings_payload
    { feed_opens_on: current_user.settings['kronk.feed_opens_on'] }
  end
end
