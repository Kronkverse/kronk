# frozen_string_literal: true

# POST /seen: the viewer opened this Kuestion's answers, so the ones there
# now stop counting as new on their Answered list.
class Api::V2::Kuestions::SeensController < Api::BaseController
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }
  before_action :require_user!
  before_action :set_question

  def create
    QuestionSeenMarker.mark!(current_account, @question)
    head 204
  end

  private

  def set_question
    @question = Question.find(params[:kuestion_id])
  end
end
