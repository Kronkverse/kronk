# frozen_string_literal: true

class CreateTasks < ActiveRecord::Migration[8.0]
  def change
    create_table :tasks, force: :cascade do |t|
      t.bigint  :proposal_id,            null: false
      t.string  :title,                  null: false
      t.text    :description
      t.integer :status,                 null: false, default: 0
      t.string  :skill_tag
      t.integer :effort_estimate
      t.bigint  :assigned_to_account_id
      t.timestamps null: false
    end

    add_index :tasks, :proposal_id
    add_index :tasks, :assigned_to_account_id
    add_foreign_key :tasks, :proposals, on_delete: :cascade
    add_foreign_key :tasks, :accounts, column: :assigned_to_account_id, on_delete: :nullify
  end
end
