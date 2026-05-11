# frozen_string_literal: true

class AddPostTypeToStatuses < ActiveRecord::Migration[7.2]
  def change
    add_column :statuses, :post_type, :integer, default: 0, null: false
    add_index :statuses, :post_type, where: 'post_type != 0'
  end
end
