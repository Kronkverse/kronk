# frozen_string_literal: true

class Api::V1::ProposalsController < Api::BaseController
  before_action :require_user!
  before_action :set_proposal, only: [:show, :vote, :unvote, :complete, :update, :archive, :unarchive]
  before_action :require_creator_or_steward!, only: [:update, :archive, :unarchive]

  def index
    scope = Proposal.active

    scope = case params[:filter]
            when 'delivered' then scope.delivered
            when 'completed' then scope.completed
            when 'annulled'  then scope.annulled
            else                  scope.open
            end

    scope = scope.with_category(params[:category]) if params[:category].present? && Proposal::CATEGORY_VALUES.include?(params[:category])

    scope = case params[:sort]
            when 'newest'         then scope.recent
            when 'most_discussed' then scope.most_discussed
            else                       scope.most_supported
            end

    active = scope.limit(40).to_a
    own_archived = Proposal.archived.where(created_by_account_id: current_account.id).order(archived_at: :desc).to_a
    @proposals = active + own_archived
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
      create_feed_status_for_proposal!(@proposal)
      render json: @proposal, serializer: REST::ProposalSerializer, status: 201
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

  def archive
    @proposal.update!(archived_at: Time.now.utc)
    render json: @proposal, serializer: REST::ProposalSerializer
  end

  def unarchive
    @proposal.update!(archived_at: nil)
    render json: @proposal, serializer: REST::ProposalSerializer
  end

  def vote
    return render json: { error: 'This proposal has been delivered; voting is closed.' }, status: :unprocessable_entity if @proposal.delivered? # rubocop:disable I18n/RailsI18n/DecorateString

    vote = ProposalVote.find_or_initialize_by(proposal: @proposal, account: current_account)
    vote.assign_attributes(vote_params)

    ActiveRecord::Base.transaction do
      vote.save!

      if vote.block?
        condition_texts = Array(params.dig(:vote, :conditions)).map { |t| t.to_s.strip }.compact_blank
        vote.challenge_conditions.destroy_all
        condition_texts.each { |text| vote.challenge_conditions.create!(text: text) }
      end
    end

    render json: @proposal.reload, serializer: REST::ProposalSerializer
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.record.errors.full_messages.to_sentence }, status: :unprocessable_entity
  end

  def unvote
    return render json: { error: 'This proposal has been delivered; voting is closed.' }, status: :unprocessable_entity if @proposal.delivered? # rubocop:disable I18n/RailsI18n/DecorateString

    vote = @proposal.proposal_votes.find_by(account: current_account)
    vote&.destroy
    render json: @proposal.reload, serializer: REST::ProposalSerializer
  end

  # The proposer confirming a delivered proposal. This is what returns the
  # backers' stakes and pays the author. Marking a proposal delivered is not
  # here on purpose — that is a dev action, done through
  # `tootctl kommons deliver`.
  def complete
    Kronk::ProposalStates.complete!(@proposal, by: current_account)
    render json: @proposal.reload, serializer: REST::ProposalSerializer
  rescue Kronk::ProposalStates::NotTheProposer
    render json: { error: 'Only the proposer can complete this proposal.' }, status: :forbidden
  rescue Kronk::ProposalStates::InvalidTransition => e
    render json: { error: e.message }, status: :unprocessable_entity
  end

  private

  def set_proposal
    @proposal = Proposal.find(params[:id])
  end

  def proposal_params
    params.expect(proposal: [:title, :body, :proposal_type, :node_id, categories: []])
  end

  def vote_params
    params.expect(vote: [:position, :title, :statement])
  end

  def create_feed_status_for_proposal!(proposal)
    visibility = current_account.user&.setting_default_privacy || 'public'
    feed_status = PostStatusService.new.call(
      current_account,
      text: proposal.title,
      visibility: visibility,
      post_type: :proposal
    )
    proposal.update_columns(status_id: feed_status.id, discussion_status_id: feed_status.id)
  rescue => e
    Rails.logger.error("Failed to create feed status for proposal #{proposal.id}: #{e.message}")
  end

  def require_creator_or_steward!
    is_creator = @proposal.created_by_account_id == current_account.id
    is_steward = current_user.role&.can?(:administrator) || current_user.role&.can?(:manage_reports)
    forbidden unless is_creator || is_steward
  end

end
