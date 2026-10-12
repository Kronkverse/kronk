# frozen_string_literal: true

# Profile Kuestions pinned to a profile.
#
#   GET   /api/v2/kuestions/pinned?account_id=   what the viewer may see,
#                                                in the owner's order
#   PATCH /api/v2/kuestions/pinned               reorder your own:
#                                                question_ids[] in order
class Api::V2::Kuestions::PinnedController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }, only: [:index]
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }, only: [:update]
  before_action :require_user!

  def index
    account = Account.find(params.require(:account_id))
    answers = Answer.pinned
                    .where(account_id: account.id)
                    .joins(:question).merge(Question.active.profile)
                    .includes(:question, :account)
                    .select { |answer| answer.visible_on_profile_to?(current_account) }

    render json: answers, each_serializer: REST::Kuestions::PinnedAnswerSerializer
  end

  def update
    ids = Array(params.require(:question_ids)).map(&:to_s)
    answers = Answer.pinned.where(account_id: current_account.id).index_by { |answer| answer.question_id.to_s }

    return render json: { error: 'unknown_kuestion' }, status: :unprocessable_entity unless (ids - answers.keys).empty?

    Answer.transaction do
      ids.each_with_index { |id, position| answers[id].update_columns(pin_position: position) }
    end

    render_empty
  end
end
