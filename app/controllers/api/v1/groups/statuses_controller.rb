# frozen_string_literal: true

# Group-scoped timeline + composer per §Groups.4.
#
#   GET  /api/v1/groups/:group_id/statuses
#     Returns statuses targeted at this group via the statuses_groups
#     join, most recent first. Standard cursor pagination.
#
#   POST /api/v1/groups/:group_id/statuses
#     Composes a new Status via PostStatusService and joins it to this
#     group. Members only. Requires write:statuses.
class Api::V1::Groups::StatusesController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }, only: [:index]
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }, only: [:create]
  before_action :set_group
  before_action :require_user!, only: [:create]

  DEFAULT_LIMIT = 20

  def index
    scope = @group.statuses.reorder(id: :desc)
    scope = scope.where(Status.arel_table[:id].lt(params[:max_id])) if params[:max_id].present?
    scope = scope.where(Status.arel_table[:id].gt(params[:min_id])) if params[:min_id].present?
    scope = scope.limit(limit_param(DEFAULT_LIMIT))

    render json: scope,
           each_serializer: REST::StatusSerializer,
           relationships: StatusRelationshipsPresenter.new(scope, current_user&.account_id)
  end

  def create
    return render json: { error: 'members only' }, status: 403 unless @group.member?(current_account)
    return render json: { error: 'group is archived' }, status: 422 if @group.archived?

    status = PostStatusService.new.call(
      current_account,
      text: status_params[:status],
      visibility: status_params[:visibility] || 'public',
      sensitive: status_params[:sensitive],
      spoiler_text: status_params[:spoiler_text],
      application: doorkeeper_token.application,
      with_rate_limit: true
    )

    ActiveRecord::Base.transaction do
      @group.statuses << status unless @group.statuses.exists?(id: status.id)
    end

    Kronk::KornerEvents.publish(
      'group.post.created',
      group_id: @group.id,
      status_id: status.id,
      account_id: status.account_id
    )

    render json: status, serializer: REST::StatusSerializer
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.message }, status: 422
  end

  private

  def set_group
    @group = Group.find(params[:group_id])
  end

  def status_params
    params.permit(:status, :visibility, :sensitive, :spoiler_text)
  end
end
