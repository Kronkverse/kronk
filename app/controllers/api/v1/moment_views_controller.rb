# frozen_string_literal: true

# Views on a Moment (docs/spaces/moments.md, Views).
#
#   POST /api/v1/moments/:id/view   => the viewer saw it (idempotent)
#   GET  /api/v1/moments/:id/views  => who has seen it, newest first;
#                                      the owner only
class Api::V1::MomentViewsController < Api::BaseController
  LIMIT = 200

  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }, only: [:index]
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }, only: [:create]
  before_action :require_user!
  before_action :set_moment

  def index
    raise ActiveRecord::RecordNotFound unless @moment.account_id == current_account.id

    views = @moment.moment_views.includes(:account).order(created_at: :desc).limit(LIMIT)
    render json: views, each_serializer: REST::MomentViewSerializer
  end

  def create
    MomentView.record!(@moment, current_account)
    Kronk::KornerSeen.mark_seen(current_account, 'moments', @moment.id)
    render_empty
  end

  private

  def set_moment
    @moment = Moment.find(params[:id])
    raise ActiveRecord::RecordNotFound unless @moment.visible_to?(current_account)
  end
end
