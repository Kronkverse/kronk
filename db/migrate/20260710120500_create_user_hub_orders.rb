# frozen_string_literal: true

# Per-account custom ordering of the Hub grid. Absence of rows for an
# account = fall back to the default order (by tune-in popularity per
# Kronk::TuneInCounts). See spec §4.7.
class CreateUserHubOrders < ActiveRecord::Migration[8.0]
  def change
    create_table :user_hub_orders do |t|
      t.references :account, null: false, foreign_key: { on_delete: :cascade }
      t.string :korner_slug, null: false
      t.integer :position, null: false

      t.timestamps
    end

    add_index :user_hub_orders, [:account_id, :korner_slug], unique: true
    add_index :user_hub_orders, [:account_id, :position]
  end
end
