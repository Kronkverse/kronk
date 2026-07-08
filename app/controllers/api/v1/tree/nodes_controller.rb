# frozen_string_literal: true

class Api::V1::Tree::NodesController < Api::BaseController
  before_action -> { authorize_if_got_token! :read, :'read:statuses' }, only: [:index, :show]
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }, only: [:create, :update, :destroy, :move]
  before_action :require_user!, only: [:create, :update, :destroy, :move]
  before_action :set_node, only: [:show, :update, :destroy, :move]

  # Seed the initial top structure the first time anyone requests the tree.
  # Kept in the controller (not a migration) so seeding uses the requesting
  # user's account rather than requiring one at migration time.
  SEED_LAYERS = [
    { key: 'kronk', name: 'Kronk',
      children: [
        { name: 'Digital',   children: %w(Development Sovereignty Infrastructure) },
        { name: 'Community', children: ['User Experience', 'Relationships', 'Community'] },
        { name: 'Platform',  children: %w(Governance Structure Vision) },
      ] },
  ].freeze

  def index
    seed_if_empty! if current_user

    render json: TreeNode.ordered, each_serializer: REST::TreeNodeSerializer
  end

  def show
    render json: @node, serializer: REST::TreeNodeSerializer
  end

  def create
    @node = current_account.tree_nodes.create!(node_params)
    render json: @node, serializer: REST::TreeNodeSerializer, status: :created
  end

  def update
    @node.update!(update_params)
    render json: @node, serializer: REST::TreeNodeSerializer
  end

  def destroy
    @node.destroy!
    head :no_content
  end

  # PATCH /api/v1/tree/nodes/:id/move  { parent_id: <id or null> }
  def move
    new_parent_id = params[:parent_id].presence
    raise ActiveRecord::RecordInvalid.new(@node) if would_create_cycle?(@node, new_parent_id)

    @node.update!(parent_id: new_parent_id)
    render json: @node, serializer: REST::TreeNodeSerializer
  end

  private

  def set_node
    @node = TreeNode.find(params[:id])
  end

  def node_params
    params.permit(:kind, :name, :description, :parent_id, :status, :priority, :framework, :position, steps: [])
  end

  def update_params
    # kind and parent don't change via #update — use #move for reparenting.
    params.permit(:name, :description, :status, :priority, :framework, :position, steps: [])
  end

  # Cycle guard for #move — a node cannot become the descendant of itself.
  def would_create_cycle?(node, target_parent_id)
    return false if target_parent_id.blank?
    return true  if target_parent_id.to_s == node.id.to_s

    ancestor = TreeNode.find_by(id: target_parent_id)
    while ancestor
      return true if ancestor.id == node.id

      ancestor = ancestor.parent
    end
    false
  end

  def seed_if_empty!
    return if TreeNode.exists?

    TreeNode.transaction do
      SEED_LAYERS.each do |top|
        root = current_account.tree_nodes.create!(kind: 'layer', name: top[:name], parent_id: nil)
        Array(top[:children]).each_with_index do |branch, i|
          branch_node = current_account.tree_nodes.create!(kind: 'layer', name: branch[:name], parent_id: root.id, position: i)
          Array(branch[:children]).each_with_index do |leaf_name, j|
            current_account.tree_nodes.create!(kind: 'layer', name: leaf_name, parent_id: branch_node.id, position: j)
          end
        end
      end
    end
  end
end
