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

  # Dual-path answers reader during the Kuestions v2 transition:
  #
  #   • If a Question row exists (backfilled), route through
  #     Kuestions::VisibilityGate — the answer-before-view rule is now
  #     enforced at the service layer rather than reimplemented here.
  #   • If no Question row exists (pre-backfill Status), fall back to
  #     the legacy in_reply_to_id + post_type=answer query so shadow
  #     and prod both keep working without a hard cutover.
  #
  # Both paths return Status records so REST::StatusSerializer stays
  # the response shape.
  def answers
    q = Question.find_by(status_id: @question.id)

    if q
      answers = Kuestions::VisibilityGate.visible_answers(q, current_account)

      unless Kuestions::VisibilityGate.can_view_answers?(q, current_account)
        render json: { answers: [], locked: true }, status: 200
        return
      end

      status_ids = answers.pluck(:status_id).compact
      scope = Status.where(id: status_ids)
    else
      unless legacy_current_account_has_answered?
        render json: { answers: [], locked: true }, status: 200
        return
      end

      scope = Status.where(post_type: :answer, in_reply_to_id: @question.id)
    end

    @answers = scope.includes(:account, account: :account_stat).reorder(id: :asc)

    render json: @answers,
           each_serializer: REST::StatusSerializer,
           relationships: StatusRelationshipsPresenter.new(@answers, current_user.account_id)
  end

  private

  def set_question
    @question = Status.questions.find(params[:id])
  end

  def legacy_current_account_has_answered?
    Status.exists?(account: current_account, post_type: :answer, in_reply_to_id: @question.id)
  end

  def questions_scope
    Status.questions
          .not_excluded_by_account(current_account)
          .not_domain_blocked_by_account(current_account)
          .includes(:media_attachments, :tags, :preloadable_poll, :quote, preview_cards_status: :preview_card, account: :account_stat)
  end
end
