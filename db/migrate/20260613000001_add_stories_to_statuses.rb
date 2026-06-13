# frozen_string_literal: true

class AddStoriesToStatuses < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    safety_assured do
      add_column :statuses, :expires_at, :datetime, null: true unless column_exists?(:statuses, :expires_at)
      add_index :statuses, :expires_at, where: 'expires_at IS NOT NULL', algorithm: :concurrently unless index_exists?(:statuses, :expires_at)
    end
  end
end
