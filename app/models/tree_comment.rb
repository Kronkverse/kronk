# frozen_string_literal: true

# == Schema Information
#
# Table name: tree_comments
#
#  id         :bigint(8)        not null, primary key
#  node_id    :bigint(8)        not null
#  account_id :bigint(8)        not null
#  body       :text             not null
#  created_at :datetime         not null
#  updated_at :datetime         not null
#

class TreeComment < ApplicationRecord
  belongs_to :node, class_name: 'TreeNode'
  belongs_to :account

  validates :body, presence: true, length: { maximum: 5_000 }
end
