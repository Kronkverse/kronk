# frozen_string_literal: true

# Requests to join an `approval` Krew. Asking is POST /api/v1/krews/:id/join.
#
#   GET    /api/v1/krews/:krew_id/join_requests              (members)
#   POST   /api/v1/krews/:krew_id/join_requests/:id/accept   (members)
#   POST   /api/v1/krews/:krew_id/join_requests/:id/decline  (members)
#   DELETE /api/v1/krews/:krew_id/join_request               (the asker withdraws)
#
# Any member can answer a request, not only the seeder.
class Api::V1::Krews::JoinRequestsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:accounts' }, only: [:index]
  before_action -> { doorkeeper_authorize! :write, :'write:accounts' }, except: [:index]
  before_action :require_user!
  before_action :set_krew
  before_action :require_member!, except: [:destroy]
  before_action :set_join_request, only: [:accept, :decline]

  def index
    requests = @krew.krew_join_requests.oldest_first.joins(:account).merge(Account.without_suspended).preload(:account)
    render json: requests, each_serializer: REST::KrewJoinRequestSerializer
  end

  def accept
    return render json: { error: 'krew is archived' }, status: 422 if @krew.archived?

    asker = @join_request.account
    @join_request.accept!
    Kronk::KrewJoinRequests.notify_accepted(@krew, asker, by: current_account)

    render json: @krew.reload, serializer: REST::KrewSerializer, scope: current_user
  end

  def decline
    @join_request.destroy!
    render json: @krew.reload, serializer: REST::KrewSerializer, scope: current_user
  end

  def destroy
    @krew.krew_join_requests.where(account: current_account).destroy_all
    render json: @krew.reload, serializer: REST::KrewSerializer, scope: current_user
  end

  private

  def set_krew
    @krew = Krew.find_by(slug: params[:krew_id]) || Krew.find(params[:krew_id])
  end

  def require_member!
    render json: { error: 'members only' }, status: 403 unless @krew.member?(current_account)
  end

  def set_join_request
    @join_request = @krew.krew_join_requests.find(params[:id])
  end
end
