# frozen_string_literal: true

class Api::V1::ChallengeConditionsController < Api::BaseController
  before_action :require_user!
  before_action :set_condition

  # POST /api/v1/challenge_conditions/:id/toggle
  # Only the author of the parent challenge (vote) may toggle its conditions.
  def toggle
    forbidden unless @condition.proposal_vote.account_id == current_account.id
    @condition.update!(met_at: @condition.met? ? nil : Time.now.utc)
    render json: @condition.proposal_vote.proposal.reload, serializer: REST::ProposalSerializer
  end

  private

  def set_condition
    @condition = ChallengeCondition.find(params[:id])
  end
end
