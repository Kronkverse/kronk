# frozen_string_literal: true

class CreateBudgetItems < ActiveRecord::Migration[8.0]
  def change
    create_table :budget_items, force: :cascade do |t|
      t.bigint  :proposal_id,  null: false
      t.string  :description,  null: false
      t.decimal :cost_estimate, precision: 10, scale: 2
      t.string  :currency,     default: 'NZD'
      t.integer :status,       null: false, default: 0
      t.timestamps null: false
    end

    add_index :budget_items, :proposal_id
    add_foreign_key :budget_items, :proposals, on_delete: :cascade
  end
end
