# frozen_string_literal: true

class Api::V1::ChallengeResponsesController < Api::BaseController
  before_action :require_user!
  before_action :set_condition

  # POST /api/v1/challenge_conditions/:challenge_condition_id/responses
  def create
    response = @condition.challenge_responses.new(
      account: current_account,
      body: params.dig(:response, :body).to_s.strip
    )
    if response.save
      render json: @condition.proposal_vote.proposal.reload, serializer: REST::ProposalSerializer
    else
      render json: { error: response.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end
  end

  private

  def set_condition
    @condition = ChallengeCondition.find(params[:challenge_condition_id])
  end
end
