# frozen_string_literal: true

# == Schema Information
#
# Table name: tree_nodes
#
#  id          :bigint(8)        not null, primary key
#  account_id  :bigint(8)        not null
#  parent_id   :bigint(8)
#  kind        :string(16)       not null
#  name        :string(200)      not null
#  description :text             default(""), not null
#  status      :string(16)
#  priority    :string(16)
#  framework   :text
#  steps       :jsonb            default([]), not null
#  position    :integer          default(0), not null
#  created_at  :datetime         not null
#  updated_at  :datetime         not null
#

class TreeNode < ApplicationRecord
  KINDS      = %w(layer idea).freeze
  STATUSES   = %w(blocked provisional ready building done).freeze
  PRIORITIES = %w(low medium high).freeze

  belongs_to :account
  belongs_to :parent, class_name: 'TreeNode', optional: true
  has_many :children, class_name: 'TreeNode', foreign_key: :parent_id, dependent: :destroy, inverse_of: :parent

  has_many :outgoing_dependencies, class_name: 'TreeDependency', foreign_key: :from_node_id, dependent: :destroy, inverse_of: :from_node
  has_many :incoming_dependencies, class_name: 'TreeDependency', foreign_key: :to_node_id, dependent: :destroy, inverse_of: :to_node
  has_many :comments, class_name: 'TreeComment', foreign_key: :node_id, dependent: :destroy, inverse_of: :node

  validates :kind, inclusion: { in: KINDS }
  validates :name, presence: true, length: { maximum: 200 }
  validates :description, length: { maximum: 5_000 }
  validates :status, inclusion: { in: STATUSES }, allow_nil: true
  validates :priority, inclusion: { in: PRIORITIES }, allow_nil: true
  validates :framework, length: { maximum: 20_000 }, allow_nil: true

  # Guardrail: only ideas carry status/priority/framework/steps.
  before_validation :normalize_leaf_fields

  scope :ordered, -> { order(:position, :id) }

  def layer?
    kind == 'layer'
  end

  def idea?
    kind == 'idea'
  end

  private

  def normalize_leaf_fields
    return if idea?

    self.status = nil
    self.priority = nil
    self.framework = nil
    self.steps = []
  end
end
