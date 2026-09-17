# frozen_string_literal: true

# Comments on a Kommons proposal — the discussion surface for the support-model
# proposal page. Nested under a proposal; one level of threading (`parent_id`).
class Api::V1::Proposals::CommentsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }, only: [:index]
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }, only: [:create, :destroy]
  before_action :require_user!
  before_action :set_proposal
  before_action :set_comment, only: [:destroy]

  def index
    @comments = @proposal.proposal_comments.roots.chronological
                         .includes(:account, replies: :account)
    render json: @comments, each_serializer: REST::ProposalCommentSerializer
  end

  def create
    @comment = @proposal.proposal_comments.new(comment_params.merge(account: current_account))

    if @comment.save
      render json: @comment, serializer: REST::ProposalCommentSerializer, status: 201
    else
      render json: { error: @comment.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end
  end

  def destroy
    @comment.destroy!
    render_empty
  end

  private

  def set_proposal
    @proposal = Proposal.find(params[:proposal_id])
  end

  def set_comment
    @comment = @proposal.proposal_comments.find(params[:id])
    return if @comment.account_id == current_account.id

    render json: { error: 'Only the author can delete this comment.' }, status: 403 # rubocop:disable I18n/RailsI18n/DecorateString
  end

  def comment_params
    params.expect(comment: [:body, :parent_id])
  end
end
