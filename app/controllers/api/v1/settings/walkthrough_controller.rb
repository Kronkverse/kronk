# frozen_string_literal: true

# First-run walkthrough state (spec: docs/kronk_walkthrough.md).
# Account-scoped: dismissing the tour on one device dismisses it
# everywhere the user signs in.
#
#   GET  /api/v1/settings/walkthrough  => { dismissed: bool }
#   PUT  /api/v1/settings/walkthrough  body: { dismissed: bool }
#
# The client's <WalkthroughRunner> reads the initial value from
# `initial_state.walkthrough_dismissed` (see InitialStateSerializer) and
# PATCHes here when the user finishes or ticks "Don't show again".
# Kept a peer of the other settings/* controllers rather than folded
# into one of them — walkthrough state is its own concern and the
# eventual "restart tour" (Settings → Help) will PATCH it back to
# false.
class Api::V1::Settings::WalkthroughController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:accounts' }, only: [:show]
  before_action -> { doorkeeper_authorize! :write, :'write:accounts' }, only: [:update]
  before_action :require_user!

  def show
    render json: payload
  end

  def update
    value = ActiveModel::Type::Boolean.new.cast(params[:dismissed])
    current_user.settings['web.walkthrough_dismissed'] = value
    current_user.save!
    render json: payload
  end

  private

  def payload
    { dismissed: current_user.settings['web.walkthrough_dismissed'] || false }
  end
end
