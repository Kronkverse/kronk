# frozen_string_literal: true

class Api::V1::ProposalsController < Api::BaseController
  before_action :require_user!
  before_action :set_proposal, only: [:show, :vote, :unvote, :mark_delivered, :update]
  before_action :require_creator_or_steward!, only: [:mark_delivered, :update]

  def index
    scope = case params[:filter]
            when 'vetoed'    then Proposal.vetoed
            when 'delivered' then Proposal.delivered
            else                  Proposal.open
            end

    scope = scope.with_category(params[:category]) if params[:category].present? && Proposal::CATEGORY_VALUES.include?(params[:category])

    scope = case params[:sort]
            when 'newest'         then scope.recent
            when 'most_discussed' then scope.most_discussed
            else                       scope.most_supported
            end

    @proposals = scope.limit(40)
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
    return render json: { error: 'This proposal has been delivered; voting is closed.' }, status: :unprocessable_entity if @proposal.delivered?

    vote = ProposalVote.find_or_initialize_by(proposal: @proposal, account: current_account)
    vote.assign_attributes(vote_params)
    if vote.save
      reconcile_status!
      render json: @proposal.reload, serializer: REST::ProposalSerializer
    else
      render json: { error: vote.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end
  end

  def unvote
    return render json: { error: 'This proposal has been delivered; voting is closed.' }, status: :unprocessable_entity if @proposal.delivered?

    vote = @proposal.proposal_votes.find_by(account: current_account)
    vote&.destroy
    reconcile_status!
    render json: @proposal.reload, serializer: REST::ProposalSerializer
  end

  def mark_delivered
    @proposal.update!(status: :delivered, outcome_notes: params[:outcome_notes])
    render json: @proposal, serializer: REST::ProposalSerializer
  end

  private

  def set_proposal
    @proposal = Proposal.find(params[:id])
  end

  def proposal_params
    params.require(:proposal).permit(:title, :body, :proposal_type, categories: [])
  end

  def vote_params
    params.require(:vote).permit(:position, :statement)
  end

  def require_creator_or_steward!
    is_creator = @proposal.created_by_account_id == current_account.id
    is_steward = current_user.role&.administrator? || current_user.role&.moderator?
    forbidden unless is_creator || is_steward
  end

  def reconcile_status!
    return if @proposal.delivered?

    has_block = @proposal.proposal_votes.where(position: :block).exists?
    if has_block && !@proposal.vetoed?
      @proposal.update!(status: :vetoed)
    elsif !has_block && @proposal.vetoed?
      @proposal.update!(status: :open)
    end
  end
end
