# frozen_string_literal: true

# Kronk Account & Security — recent sign-ins. Read-only list of the current
# user's own login activity (successful and failed), newest first. Scoped to
# `current_user`; never anyone else's.
class Api::V1::Settings::LoginActivitiesController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:accounts' }
  before_action :require_user!

  DEFAULT_LIMIT = 20

  def index
    activities = current_user.login_activities.order(id: :desc).limit(DEFAULT_LIMIT)
    render json: activities, each_serializer: REST::LoginActivitySerializer
  end
end
