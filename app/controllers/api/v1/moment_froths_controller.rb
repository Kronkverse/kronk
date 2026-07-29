# frozen_string_literal: true

# Ephemeral favourites on a Moment. Nested under a Moment id in
# routes (POST/DELETE /api/v1/moments/:moment_id/froth). Idempotent:
# double-POST doesn't create duplicate rows (unique index catches it,
# controller rescues gracefully).
class Api::V1::MomentFrothsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :write, :'write:favourites' }
  before_action :require_user!
  before_action :set_moment

  def create
    @moment.moment_froths.find_or_create_by!(account: current_account)
    render json: @moment, serializer: REST::MomentSerializer
  rescue ActiveRecord::RecordNotUnique
    # Race between two clicks — the row exists; treat as success.
    render json: @moment, serializer: REST::MomentSerializer
  end

  def destroy
    froth = @moment.moment_froths.find_by(account: current_account)
    froth&.destroy!
    render json: @moment, serializer: REST::MomentSerializer
  end

  private

  def set_moment
    @moment = Moment.find(params[:moment_id])
  end
end
