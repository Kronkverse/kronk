# frozen_string_literal: true

class Api::V1::QuestionsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }
  before_action :require_user!
  before_action :set_question, only: [:show, :answers]

  DEFAULT_LIMIT = 20

  def index
    @statuses = questions_scope.limit(limit_param(DEFAULT_LIMIT))
    @statuses = @statuses.where(Status.arel_table[:id].lt(params[:max_id])) if params[:max_id].present?
    @statuses = @statuses.where(Status.arel_table[:id].gt(params[:min_id])) if params[:min_id].present?

    render json: @statuses,
           each_serializer: REST::StatusSerializer,
           relationships: StatusRelationshipsPresenter.new(@statuses, current_user.account_id)
  end

  def show
    render json: @question, serializer: REST::StatusSerializer,
           relationships: StatusRelationshipsPresenter.new([@question], current_user.account_id)
  end

  def answers
    unless current_account_has_answered?
      render json: { answers: [], locked: true }, status: 200
      return
    end

    @answers = Status.where(post_type: :answer, in_reply_to_id: @question.id)
                     .includes(:account, account: :account_stat)
                     .reorder(id: :asc)

    render json: @answers,
           each_serializer: REST::StatusSerializer,
           relationships: StatusRelationshipsPresenter.new(@answers, current_user.account_id)
  end

  private

  def set_question
    @question = Status.questions.find(params[:id])
  end

  def current_account_has_answered?
    Status.exists?(account: current_account, post_type: :answer, in_reply_to_id: @question.id)
  end

  def questions_scope
    Status.questions
          .not_excluded_by_account(current_account)
          .not_domain_blocked_by_account(current_account)
          .includes(:media_attachments, :tags, :preloadable_poll, :quote, preview_cards_status: :preview_card, account: :account_stat)
  end
end
