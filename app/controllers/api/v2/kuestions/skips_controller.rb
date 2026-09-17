# frozen_string_literal: true

# Swipe-left = POST /skip. Undo = DELETE /skip. Idempotent both ways.
class Api::V2::Kuestions::SkipsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }
  before_action :require_user!
  before_action :set_question

  def create
    QuestionSkip.find_or_create_by!(account: current_account, question: @question)
    head 201
  end

  def destroy
    QuestionSkip.where(account: current_account, question: @question).destroy_all
    head 204
  end

  private

  def set_question
    @question = Question.find(params[:kuestion_id])
  end
end
