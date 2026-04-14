# frozen_string_literal: true

class Api::V1::ProposalsController < Api::BaseController
  before_action :require_user!
  before_action :set_proposal, only: [:show, :vote, :unvote, :close]
  before_action :require_steward!, only: [:create, :update, :close]

  def index
    scope = params[:filter] == 'closed' ? Proposal.closed : Proposal.active
    @proposals = scope.recent.limit(40)
    render json: @proposals, each_serializer: REST::ProposalSerializer
  end

  def show
    render json: @proposal, serializer: REST::ProposalSerializer
  end

  def create
    @proposal = Proposal.new(
      proposal_params.merge(
        created_by_account: current_account,
        status: :open,
        opens_at: Time.now.utc
      )
    )
    if @proposal.save
      render json: @proposal, serializer: REST::ProposalSerializer, status: :created
    else
      render json: { error: @proposal.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end
  end

  def update
    if @proposal.update(proposal_params)
      render json: @proposal, serializer: REST::ProposalSerializer
    else
      render json: { error: @proposal.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end
  end

  def vote
    vote = ProposalVote.find_or_initialize_by(proposal: @proposal, account: current_account)
    vote.assign_attributes(vote_params)
    if vote.save
      render json: @proposal.reload, serializer: REST::ProposalSerializer
    else
      render json: { error: vote.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end
  end

  def unvote
    ProposalVote.find_by(proposal: @proposal, account: current_account)&.destroy!
    render json: @proposal.reload, serializer: REST::ProposalSerializer
  end

  def close
    outcome = @proposal.blocked? ? :blocked : :approved
    outcome = :lapsed if params[:lapsed]
    @proposal.update!(status: :closed, outcome: outcome, outcome_notes: params[:outcome_notes])
    render json: @proposal, serializer: REST::ProposalSerializer
  end

  private

  def set_proposal
    @proposal = Proposal.find(params[:id])
  end

  def proposal_params
    params.require(:proposal).permit(:title, :body, :decision_type, :closes_at)
  end

  def vote_params
    params.require(:vote).permit(:position, :statement)
  end

  def require_steward!
    forbidden unless current_user.role&.administrator? || current_user.role&.moderator?
  end
end
