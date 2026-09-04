# frozen_string_literal: true

# Krew-scoped timeline + composer per §Krews.4.
#
#   GET  /api/v1/krews/:krew_id/statuses
#     Returns statuses targeted at this krew via the statuses_krews
#     join, most recent first. Standard cursor pagination.
#
#   POST /api/v1/krews/:krew_id/statuses
#     Composes a new Status via PostStatusService and joins it to this
#     krew. Members only. Requires write:statuses.
class Api::V1::Krews::StatusesController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }, only: [:index]
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }, only: [:create]
  before_action :set_krew
  before_action :require_user!, only: [:create]

  DEFAULT_LIMIT = 20

  def index
    scope = @krew.statuses.reorder(id: :desc)
    scope = scope.where(Status.arel_table[:id].lt(params[:max_id])) if params[:max_id].present?
    scope = scope.where(Status.arel_table[:id].gt(params[:min_id])) if params[:min_id].present?
    scope = scope.limit(limit_param(DEFAULT_LIMIT))

    render json: scope,
           each_serializer: REST::StatusSerializer,
           relationships: StatusRelationshipsPresenter.new(scope, current_user&.account_id)
  end

  def create
    return render json: { error: 'members only' }, status: 403 unless @krew.member?(current_account)
    return render json: { error: 'krew is archived' }, status: 422 if @krew.archived?

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
      @krew.statuses << status unless @krew.statuses.exists?(id: status.id)
    end

    Kronk::KornerEvents.publish(
      'krew.post.created',
      krew_id: @krew.id,
      status_id: status.id,
      account_id: status.account_id
    )

    render json: status, serializer: REST::StatusSerializer
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.message }, status: 422
  end

  private

  # Accept slug or numeric id — mirrors Api::V1::KrewsController#set_krew.
  # The SPA routes at /hub/krew/:id use the slug, so the mini-feed hits
  # `/api/v1/krews/testers/statuses`; without slug support it 404'd and the
  # frontend swallowed the error, leaving the feed empty (2026-09-04).
  # `Krew::SLUG_PATTERN` requires a leading letter — a numeric id can never
  # collide with a slug at the format level.
  def set_krew
    @krew = Krew.find_by(slug: params[:krew_id]) || Krew.find(params[:krew_id])
  end

  def status_params
    params.permit(:status, :visibility, :sensitive, :spoiler_text)
  end
end
