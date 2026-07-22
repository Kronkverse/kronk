# frozen_string_literal: true

# POST /api/v2/kuestions/:kuestion_id/answers — the "answer to unlock"
# submission. Enforces the format contract (text needs a body;
# choice-based needs a `choice_index` and echoes the label onto body
# so the row reads like a sentence for federation + legacy Status
# projection).
class Api::V2::Kuestions::AnswersController < Api::BaseController
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }
  before_action :require_user!
  before_action :set_question

  def create
    if @question.answered_by?(current_account)
      render json: { error: 'already_answered' }, status: :unprocessable_entity
      return
    end

    answer = build_answer

    if answer.save
      render json: @question.reload,
             serializer: REST::Kuestions::QuestionSerializer,
             scope: current_account,
             with_answers: true,
             status: 201
    else
      render json: { error: answer.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end
  end

  private

  def set_question
    @question = Question.find(params[:kuestion_id])
  end

  def build_answer
    scope = valid_scope(params[:visibility_scope])

    if @question.choice_based?
      idx = params.require(:choice_index).to_i
      label = @question.mc_options[idx].is_a?(Hash) ? @question.mc_options[idx]['label'].to_s : ''
      Answer.new(question: @question, account: current_account, body: label, choice_index: idx, visibility_scope: scope)
    else
      Answer.new(question: @question, account: current_account, body: params.require(:body).to_s.strip, visibility_scope: scope)
    end
  end

  # Fall back to `connections` if the client sends nothing or a bad
  # value — matches the manifest default.
  def valid_scope(raw)
    raw = raw.to_s
    Answer::VISIBILITY_SCOPES.include?(raw) ? raw : 'connections'
  end
end
