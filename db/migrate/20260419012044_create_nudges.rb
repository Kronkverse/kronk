# frozen_string_literal: true

class CreateNudges < ActiveRecord::Migration[7.2]
  def change
    create_table :nudges do |t|
      t.references :account, null: false, foreign_key: { on_delete: :cascade }
      t.references :target_account, null: false, foreign_key: { to_table: :accounts, on_delete: :cascade }
      t.timestamps
    end

    add_index :nudges, [:account_id, :target_account_id]
  end
end
