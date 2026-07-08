# frozen_string_literal: true

# == Schema Information
#
# Table name: tree_dependencies
#
#  id           :bigint(8)        not null, primary key
#  from_node_id :bigint(8)        not null
#  to_node_id   :bigint(8)        not null
#  kind         :string(16)       not null
#

class TreeDependency < ApplicationRecord
  KINDS = %w(needs secures relates).freeze

  belongs_to :from_node, class_name: 'TreeNode'
  belongs_to :to_node, class_name: 'TreeNode'

  validates :kind, inclusion: { in: KINDS }
  validate  :not_self_referential

  private

  def not_self_referential
    return if from_node_id.blank? || to_node_id.blank?

    errors.add(:to_node_id, 'cannot reference itself') if from_node_id == to_node_id
  end
end
