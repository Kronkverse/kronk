# frozen_string_literal: true

class Api::V1::Tree::CommentsController < Api::BaseController
  before_action -> { authorize_if_got_token! :read, :'read:statuses' }, only: [:index]
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }, only: [:create, :destroy]
  before_action :require_user!, only: [:create, :destroy]
  before_action :set_node, only: [:index, :create]
  before_action :set_comment, only: [:destroy]

  def index
    render json: @node.comments.order(:created_at), each_serializer: REST::TreeCommentSerializer, include: :account
  end

  def create
    comment = @node.comments.create!(account: current_account, body: params[:body])
    render json: comment, serializer: REST::TreeCommentSerializer, status: :created, include: :account
  end

  def destroy
    raise Mastodon::NotPermittedError unless can_delete?(@comment)

    @comment.destroy!
    head :no_content
  end

  private

  def set_node
    @node = TreeNode.find(params[:node_id])
  end

  def set_comment
    @comment = TreeComment.find(params[:id])
  end

  def can_delete?(comment)
    comment.account_id == current_account.id || current_user&.role&.can?(:manage_reports)
  end
end
