# frozen_string_literal: true

class Api::V1::BudgetItemsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }, only: [:index]
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }, only: [:create, :update]
  before_action :require_user!
  before_action :require_steward!
  before_action :set_proposal,    only: [:index, :create]
  before_action :set_budget_item, only: [:update]

  def index
    @items = @proposal.budget_items.order(created_at: :asc)
    render json: @items, each_serializer: REST::BudgetItemSerializer
  end

  def create
    @item = @proposal.budget_items.new(budget_item_params)
    if @item.save
      render json: @item, serializer: REST::BudgetItemSerializer, status: 201
    else
      render json: { error: @item.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end
  end

  def update
    if @item.update(budget_item_params)
      render json: @item, serializer: REST::BudgetItemSerializer
    else
      render json: { error: @item.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end
  end

  private

  def set_proposal
    @proposal = Proposal.find(params[:proposal_id])
  end

  def set_budget_item
    @item = BudgetItem.find(params[:id])
  end

  def budget_item_params
    params.expect(budget_item: [:description, :cost_estimate, :currency, :status])
  end

  def require_steward!
    forbidden unless current_user.role&.administrator? || current_user.role&.moderator?
  end
end
