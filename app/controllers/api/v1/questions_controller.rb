# frozen_string_literal: true

class Api::V1::QuestionsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }
  before_action :require_user!

  DEFAULT_LIMIT = 20

  def index
    @statuses = questions_scope.limit(limit_param(DEFAULT_LIMIT))
    @statuses = @statuses.where(Status.arel_table[:id].lt(params[:max_id])) if params[:max_id].present?
    @statuses = @statuses.where(Status.arel_table[:id].gt(params[:min_id])) if params[:min_id].present?

    render json: @statuses,
           each_serializer: REST::StatusSerializer,
           relationships: StatusRelationshipsPresenter.new(@statuses, current_user.account_id)
  end

  private

  def questions_scope
    Status.questions
          .not_excluded_by_account(current_account)
          .not_domain_blocked_by_account(current_account)
          .includes(:account, :media_attachments, :tags, :preview_cards_status, :preview_card, :preloadable_poll, :quote, account: :account_stat)
  end
end
