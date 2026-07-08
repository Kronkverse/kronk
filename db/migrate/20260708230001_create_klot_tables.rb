# frozen_string_literal: true

class CreateKlotTables < ActiveRecord::Migration[8.0]
  def change
    create_table :klot_periods do |t|
      t.references :account, null: false, foreign_key: { on_delete: :cascade }
      t.date :started_on, null: false
      t.timestamps
    end
    add_index :klot_periods, [:account_id, :started_on], unique: true

    create_table :klot_settings do |t|
      t.references :account, null: false, foreign_key: { on_delete: :cascade }, index: { unique: true }
      t.integer :cycle_length, default: 28, null: false
      t.integer :period_length, default: 5, null: false
      t.timestamps
    end

    create_table :klot_shares do |t|
      t.references :account, null: false, foreign_key: { on_delete: :cascade }
      t.bigint :viewer_account_id, null: false
      t.timestamps
    end
    add_index :klot_shares, [:account_id, :viewer_account_id], unique: true, name: 'index_klot_shares_unique'
    add_index :klot_shares, :viewer_account_id
    add_foreign_key :klot_shares, :accounts, column: :viewer_account_id, on_delete: :cascade
  end
end
