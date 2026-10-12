# frozen_string_literal: true

# The viewer's own answer to one Kuestion.
#
#   PATCH  /api/v2/kuestions/:kuestion_id/answer
#     body / choice_index   change the answer (never re-locks anything)
#     visibility_scope      change its reach
#     pinned, size          profile Kuestions: on or off the profile, tile size
#   DELETE /api/v2/kuestions/:kuestion_id/answer
#     profile Kuestions only: take the answer back entirely. A community
#     answer stays, because answering is what unlocked the others.
class Api::V2::Kuestions::MyAnswersController < Api::BaseController
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }
  before_action :require_user!
  before_action :set_answer

  def update
    @answer.assign_attributes(answer_changes)

    if @answer.save
      apply_pin
      render json: @answer.question.reload,
             serializer: REST::Kuestions::QuestionSerializer,
             scope: current_account,
             with_my_answer: true
    else
      render json: { error: @answer.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end
  end

  def destroy
    return render json: { error: 'not_removable' }, status: :unprocessable_entity unless @answer.question.profile?

    @answer.destroy!
    render_empty
  end

  private

  def set_answer
    @answer = Answer.includes(:question).find_by!(question_id: params[:kuestion_id], account_id: current_account.id)
  end

  def answer_changes
    question = @answer.question
    changes = {}

    if question.choice_based? && params.key?(:choice_index)
      index = params[:choice_index].to_i
      option = question.mc_options[index]
      changes[:choice_index] = index
      changes[:body] = option.is_a?(Hash) ? option['label'].to_s : ''
    elsif !question.choice_based? && params.key?(:body)
      changes[:body] = params[:body].to_s.strip
    end

    scope = params[:visibility_scope].to_s
    changes[:visibility_scope] = scope if Answer::VISIBILITY_SCOPES.include?(scope)

    if question.profile? && params.key?(:size)
      size = params[:size].to_s
      changes[:settings] = @answer.settings.merge('size' => Answer::TILE_SIZES.include?(size) ? size : nil).compact
    end

    changes
  end

  def apply_pin
    return unless @answer.question.profile? && params.key?(:pinned)

    ActiveModel::Type::Boolean.new.cast(params[:pinned]) ? @answer.pin! : @answer.unpin!
  end
end
