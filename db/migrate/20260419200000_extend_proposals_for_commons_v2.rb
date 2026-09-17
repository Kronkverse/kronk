# frozen_string_literal: true

class ExtendProposalsForCommonsV2 < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    safety_assured do
      add_column :proposals, :summary, :string, limit: 500 unless column_exists?(:proposals, :summary)
      add_column :proposals, :proposal_type, :integer, default: 0, null: false unless column_exists?(:proposals, :proposal_type)
      add_column :proposals, :categories, :string, array: true, default: [] unless column_exists?(:proposals, :categories)
      add_column :proposals, :parent_proposal_id, :bigint unless column_exists?(:proposals, :parent_proposal_id)
      add_column :proposals, :discussion_status_id, :bigint unless column_exists?(:proposals, :discussion_status_id)
    end

    add_index :proposals, :proposal_type, algorithm: :concurrently unless index_exists?(:proposals, :proposal_type)
    add_index :proposals, :parent_proposal_id, algorithm: :concurrently unless index_exists?(:proposals, :parent_proposal_id)
    add_index :proposals, :discussion_status_id, algorithm: :concurrently unless index_exists?(:proposals, :discussion_status_id)
    add_index :proposals, :categories, using: :gin, algorithm: :concurrently unless index_exists?(:proposals, :categories)

    add_foreign_key :proposals, :proposals, column: :parent_proposal_id, on_delete: :nullify, validate: false
  end
end
